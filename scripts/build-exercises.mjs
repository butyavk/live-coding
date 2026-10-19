#!/usr/bin/env node
// Runs every SQL reference on real PostgreSQL (PGlite in Node), parses the task files in exercises/,
// checks every Python drill with python3 (the reference passes, the starter does not) and writes
// src/data/generated/practice.json, which the practice components read at build time.
//
// Every SQL reference also runs on the hidden edge-case data (src/runtime/edge.sql, schema `edge`).
// Only a fingerprint of that result is stored (row count, column count, SHA-256 of the sorted,
// normalised rows), so the page can tell whether an answer matches without showing the rows.
// It also checks src/data/practice/hints.ts and translations-ru.ts, when they exist: every key
// must be a real exercise id.
//
// Usage: npm run exercises        (CI runs it and fails if the committed file is out of date)
//
// The data files are TypeScript without imports or enums, so Node loads them directly
// (type stripping is on by default since Node 22.18).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { inOneTransaction, loadData, PARSERS, normRows } from '../src/runtime/pg-setup.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const X = `${root}exercises`;
const data = (f) => import(new URL(`../src/data/practice/${f}`, import.meta.url).href);
const { sqlDrills } = await data('sql-drills.ts');
const { pyDrills } = await data('py-drills.ts');
const { traps } = await data('traps.ts');
const { sqlTasks } = await data('sql-tasks.ts');
const { pyTasks } = await data('py-tasks.ts');
const { sqlContext } = await data('columns.ts');

const errors = [];
const fail = (msg) => errors.push(msg);
const ids = new Set();
const unique = (id) => {
  if (ids.has(id)) fail(`duplicate id ${id}`);
  ids.add(id);
};

const db = await PGlite.create({ parsers: PARSERS });
await loadData(db, async (t) => new Blob([readFileSync(`${X}/data/csv/${t}.csv`)]));
await db.exec(readFileSync(`${root}src/runtime/edge.sql`, 'utf8'));

/** Runs a script; the last statement that returns columns is the result. `schema`: public or edge. */
async function runAll(sql, schema = 'public') {
  await db.exec('BEGIN');
  try {
    if (schema !== 'public') await db.exec(`SET LOCAL search_path TO ${schema}`);
    const res = await db.exec(inOneTransaction(sql).sql, { rowMode: 'array' });
    const last = [...res].reverse().find((r) => r.fields && r.fields.length);
    if (!last) throw new Error('no statement returns rows');
    return { cols: last.fields.map((f) => f.name), types: last.fields.map((f) => f.dataTypeID), rows: last.rows };
  } finally {
    await db.exec('ROLLBACK');
  }
}
const expected = (r, sample = 100) => ({ cols: r.cols, types: r.types, rows: normRows(r.rows, r.types), sample: r.rows.slice(0, sample), n: r.rows.length });
const json = (v) => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? Number(x) : x)));

/** The fingerprint the browser compares with (lib/compare.ts edgePrint does the same). */
export const fingerprint = (rows) => createHash('sha256').update(rows.map((r) => JSON.stringify(r)).sort().join('\n')).digest('hex');
/**
 * A reference that builds its own tables does not read the dataset: no edge check for it, unless
 * the task loads its table from the dataset and says so (`edge: true` in sql-tasks.ts, Q15). Then
 * the whole script, its CREATE TABLE included, runs on the edge-case data too.
 */
const ownTables = (sql) => /\b(CREATE|INSERT|UPDATE|DELETE|ALTER|DROP|EXPLAIN)\b/i.test(sql.replace(/--[^\n]*/g, ''));
async function edgeOf(sql, where, readsDataset = false) {
  if (ownTables(sql) && !readsDataset) return null;
  try {
    const r = await runAll(sql, 'edge');
    const rows = normRows(r.rows, r.types);
    return { n: rows.length, cols: r.cols.length, hash: fingerprint(rows) };
  } catch (e) {
    fail(`${where}: the reference fails on the edge-case data: ${e.message}`);
    return null;
  }
}

/** The ORDER BY of the outermost query (not the ones inside OVER (…) or subqueries), or ''. */
function finalOrderBy(sql) {
  const text = sql.replace(/--[^\n]*/g, ' ');
  let depth = 0;
  let at = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'") {
      const j = text.indexOf("'", i + 1);
      i = j < 0 ? text.length : j;
    } else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && /^ORDER\s+BY\b/i.test(text.slice(i, i + 12)) && !/[A-Za-z0-9_]/.test(text[i - 1] ?? ' ')) at = i;
  }
  if (at < 0) return '';
  return text
    .slice(at)
    .replace(/^ORDER\s+BY\s+/i, '')
    .replace(/\s+(LIMIT|OFFSET)\b[\s\S]*$/i, (m) => m.replace(/\s+/g, ' '))
    .replace(/;[\s\S]*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The final ORDER BY written with the output column names, so the contract under a drill reads
 * like a spec and does not show the reference's aliases: `1` -> month, `m.name` -> name,
 * `p.id` -> product_id (products p). Terms that are not output columns stay as written.
 */
function orderSpec(orderBy, cols, sql) {
  if (!orderBy) return '';
  const terms = [];
  let depth = 0;
  let cur = '';
  for (const ch of orderBy) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      terms.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  terms.push(cur.trim());
  return terms
    .map((term) => {
      const m = /^(.*?)((?:\s+(?:ASC|DESC))?(?:\s+NULLS\s+(?:FIRST|LAST))?)$/i.exec(term);
      let [expr, dir] = [m[1].trim(), m[2]];
      if (/^\d+$/.test(expr) && cols[Number(expr) - 1]) expr = cols[Number(expr) - 1];
      const q = /^([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)$/i.exec(expr);
      if (q) {
        const table = new RegExp(`\\b(?:FROM|JOIN)\\s+([a-z_]+)\\s+(?:AS\\s+)?${q[1]}\\b`, 'i').exec(sql)?.[1];
        const prefixed = table ? `${table.replace(/s$/, '')}_${q[2]}` : '';
        if (cols.includes(q[2])) expr = q[2];
        else if (prefixed && cols.includes(prefixed)) expr = prefixed;
      }
      return expr + dir;
    })
    .join(', ');
}

// Context of a query: tables, touched columns, three sample rows of those columns.
const samples = new Map();
async function withSamples(sql) {
  const ctx = sqlContext(sql);
  for (const t of ctx.tables) {
    const list = t.cols.join(', ');
    const key = `${t.name}:${list}`;
    if (!samples.has(key)) {
      // A refund-related query should see one refunded row among the examples.
      const q =
        t.name === 'transactions' && t.cols.includes('refunded_at')
          ? `(SELECT ${list} FROM transactions WHERE refunded_at IS NULL ORDER BY 1 LIMIT 2) UNION ALL (SELECT ${list} FROM transactions WHERE refunded_at IS NOT NULL ORDER BY 1 LIMIT 1)`
          : `SELECT ${list} FROM ${t.name} ORDER BY 1 LIMIT 3`;
      const r = await db.query(q, [], { rowMode: 'array' });
      samples.set(key, { cols: r.fields.map((f) => f.name), rows: r.rows });
    }
    t.sample = samples.get(key);
  }
  return ctx;
}

// ---------------------------------------------------------------- SQL drills
const out = { sqlDrills: {}, traps: {}, sqlTasks: {}, pyDrills: {}, pyTasks: {} };
for (const d of sqlDrills) {
  unique(d.id);
  try {
    const r = await runAll(d.ref);
    if (!r.rows.length && d.check !== false) fail(`${d.id}: the reference returns no rows`);
    if (d.starter) {
      try {
        const s = await runAll(d.starter);
        if (JSON.stringify(normRows(s.rows, s.types)) === JSON.stringify(normRows(r.rows, r.types))) fail(`${d.id}: the starter already gives the answer`);
      } catch {
        /* a starter that does not run is fine */
      }
    }
    out.sqlDrills[d.id] = {
      expected: d.check === false ? null : expected(r),
      edge: d.check === false ? null : await edgeOf(d.ref, d.id),
      orderBy: d.ordered ? orderSpec(finalOrderBy(d.ref), r.cols, d.ref) : '',
      ctx: await withSamples(d.ref),
    };
    if (d.ordered && r.rows.length > 1 && !out.sqlDrills[d.id].orderBy) fail(`${d.id}: ordered, but the reference has no ORDER BY`);
  } catch (e) {
    fail(`${d.id}: the reference fails: ${e.message}`);
  }
}

// ---------------------------------------------------------------- traps
for (const c of traps) {
  unique(c.id);
  let actual;
  try {
    await db.exec('BEGIN');
    const res = await db.exec(c.sql, { rowMode: 'array' });
    const last = [...res].reverse().find((r) => r.fields && r.fields.length);
    actual = { cols: last.fields.map((f) => f.name), rows: last.rows };
  } catch (e) {
    actual = { error: e.message, hint: e.hint || null, position: e.position ? Number(e.position) : null };
  } finally {
    await db.exec('ROLLBACK');
  }
  let fixed = null;
  if (c.fix) {
    try {
      const fr = await runAll(c.fix);
      // Only a final ORDER BY makes the order part of the answer (not the one inside OVER (…)).
      fixed = { ...expected(fr), ordered: !!finalOrderBy(c.fix), orderBy: orderSpec(finalOrderBy(c.fix), fr.cols, c.fix), edge: await edgeOf(c.fix, `trap ${c.id}`) };
    } catch (e) {
      fail(`trap ${c.id}: the fix fails: ${e.message}`);
    }
  }
  out.traps[c.id] = { actual, fixed, ctx: await withSamples(c.sql) };
}

// ---------------------------------------------------------------- SQL tasks
function parseSqlTask(id, text) {
  const [head, body = ''] = text.split('-- your query below');
  const lines = head.split('\n').map((l) => l.replace(/^--\s?/, ''));
  const m = lines[0].match(/^([QD]\d\d)\.\s*(DEBUG:\s*)?(.*?)(?:\s+Target time:\s*(\d+) min\.)?\s*$/);
  if (!m) throw new Error(`${id}: bad first line`);
  let target = m[4] ? Number(m[4]) : null;
  const lvl = lines.find((l) => l.startsWith('Level:'));
  if (lvl) {
    const t = lvl.match(/Target time:\s*(\d+)/);
    if (t) target = Number(t[1]);
  }
  const level = lvl ? lvl.replace(/^Level:\s*/, '').replace(/\.\s*Target time.*$/, '').trim() : 'debug';
  const section = (name) => {
    const i = lines.findIndex((l) => l.trim().startsWith(name));
    if (i < 0) return [];
    const res = [];
    for (let j = i + 1; j < lines.length && lines[j].startsWith('  ') && lines[j].trim(); j++) res.push(lines[j].trim());
    return res;
  };
  const ask = [];
  for (const l of section('ASK FIRST')) {
    if (l.startsWith('Q:')) ask.push({ q: l.slice(2).trim(), a: '' });
    else if (l.startsWith('A:') && ask.length) ask[ask.length - 1].a = l.slice(2).trim();
    else if (ask.length) ask[ask.length - 1].a += ' ' + l;
  }
  const one = (prefix) => (lines.find((x) => x.startsWith(prefix)) ?? '').slice(prefix.length).trim();
  const joined = (name) => section(name).join(' ').replace(/\s+/g, ' ').trim();
  return {
    id,
    debug: !!m[2],
    title: m[3].trim(),
    level,
    target,
    task: section('TASK').join(' '),
    ask,
    cols: one('OUTPUT COLUMNS:'),
    order: one('ORDER BY:'),
    bug: joined('BUG REPORT'),
    should: joined('What the report SHOULD show'),
    template: body.replace(/^--\s*START: delete this line to run the tests\s*\n/m, '').trim(),
  };
}
const sqlTaskIds = readdirSync(`${X}/tasks/sql`).filter((f) => f.endsWith('.sql')).map((f) => f.slice(0, -4)).sort();
for (const id of sqlTaskIds) {
  unique(id);
  const meta = sqlTasks.find((t) => t.id === id);
  if (!meta) {
    fail(`${id}: no entry in src/data/practice/sql-tasks.ts`);
    continue;
  }
  try {
    const t = parseSqlTask(id, readFileSync(`${X}/tasks/sql/${id}.sql`, 'utf8'));
    const solution = readFileSync(`${X}/solutions/sql/${id}.sql`, 'utf8').trim();
    const r = await runAll(solution);
    let example = null;
    if (meta.example) {
      const ex = await db.query(meta.example, [], { rowMode: 'array' });
      example = { cols: ex.fields.map((f) => f.name), rows: ex.rows };
    }
    out.sqlTasks[id] = { ...t, solution, expected: { ...expected(r, 20), ordered: !!t.order, edge: await edgeOf(solution, id, meta.edge === true) }, example };
  } catch (e) {
    fail(`${id}: ${e.message}`);
  }
}
for (const t of sqlTasks) if (!sqlTaskIds.includes(t.id)) fail(`sql-tasks.ts: ${t.id} has no task file`);

// ---------------------------------------------------------------- Python drills
/** The checks appended to the reader's code; they print one line: @@LC@@ + JSON [[ok, label, detail], …].
 *  A value passes when it equals the expected one and has the same type all the way down: inside lists,
 *  tuples, dicts and dataclasses, an int is not a float, a defaultdict is not a dict, a tuple is not a
 *  list. With `scale: true` on the drill, every Decimal must also have the same number of decimal places. */
const PY_CHECKS = `
    from dataclasses import fields as __fields, is_dataclass as __is_dc
    from decimal import Decimal as __D
    __strict = (bool, int, float, str, bytes, list, tuple, dict, set, frozenset, __D)

    def __record(x):
        return __is_dc(x) and not isinstance(x, type)

    def __same(got, exp):
        if (isinstance(exp, __strict) or __record(exp)) and type(got) is not type(exp):
            return False
        if isinstance(exp, (list, tuple)):
            return len(got) == len(exp) and all(__same(g, e) for g, e in zip(got, exp))
        if isinstance(exp, dict):
            return got.keys() == exp.keys() and all(__same(got[k], exp[k]) for k in exp)
        if __record(exp):
            return all(__same(getattr(got, f.name), getattr(exp, f.name)) for f in __fields(exp))
        if __scale and isinstance(exp, __D):
            return got == exp and got.as_tuple().exponent == exp.as_tuple().exponent
        return bool(got == exp)

    def __first(got, exp, path):
        if type(got) is type(exp):
            if isinstance(exp, (list, tuple)) and len(got) == len(exp):
                for i, (g, e) in enumerate(zip(got, exp)):
                    if not __same(g, e):
                        return __first(g, e, path + '[' + str(i) + ']')
            elif isinstance(exp, dict) and got.keys() == exp.keys():
                for k in exp:
                    if not __same(got[k], exp[k]):
                        return __first(got[k], exp[k], path + '[' + repr(k) + ']')
            elif __record(exp):
                for f in __fields(exp):
                    g, e = getattr(got, f.name), getattr(exp, f.name)
                    if not __same(g, e):
                        return __first(g, e, path + '.' + f.name)
        return path, got, exp

    def __why(got, exp):
        msg = 'expected ' + repr(exp) + ', got ' + repr(got)
        path, g, e = __first(got, exp, '')
        if path:
            msg += '; first difference at ' + path + ': expected ' + repr(e) + ', got ' + repr(g)
        try:
            equal = bool(g == e)
        except Exception:
            equal = False
        if equal and type(g) is not type(e):
            msg += ' (equal values, but ' + type(e).__name__ + ' expected, ' + type(g).__name__ + ' returned)'
        elif equal:
            msg += ' (equal values, but a different number of decimal places)'
        return msg

    def __case(label, fn, exp_fn=None, raises=None):
        try:
            got = fn()
        except Exception as e:
            if raises is not None and isinstance(e, raises):
                __res.append([True, label, 'raises ' + type(e).__name__]); return
            __res.append([False, label, type(e).__name__ + ': ' + str(e)]); return
        if raises is not None:
            __res.append([False, label, 'expected ' + raises.__name__ + ', got ' + repr(got)]); return
        try:
            exp = exp_fn()
            ok = __same(got, exp)
            detail = repr(got) if ok else __why(got, exp)
        except Exception as e:
            ok, detail = False, type(e).__name__ + ': ' + str(e)
        __res.append([ok, label, detail])
`.slice(1).trimEnd();
function pyHarness(d) {
  const L = ['', '', '# ---- checks (added when you click Check) ----'];
  if (d.pre) L.push(d.pre);
  L.push('def __lc_check():', '    import json as __j', '    __res = []', `    __scale = ${d.scale ? 'True' : 'False'}`, PY_CHECKS);
  for (const t of d.tests) {
    const label = JSON.stringify(t.call);
    L.push(t.raises ? `    __case(${label}, lambda: ${t.call}, raises=${t.raises})` : `    __case(${label}, lambda: ${t.call}, lambda: ${t.expect})`);
  }
  L.push("    print('@@LC@@' + __j.dumps(__res, ensure_ascii=False))", '__lc_check()');
  return L.join('\n') + '\n';
}
const python = (code) => {
  try {
    return execFileSync('python3', ['-I', '-c', code], { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return 'ERR ' + (e.stderr || e.message);
  }
};
const verdict = (o) => {
  const l = o.split('\n').reverse().find((x) => x.startsWith('@@LC@@'));
  return l ? JSON.parse(l.slice(6)) : null;
};
for (const d of pyDrills) {
  unique(d.id);
  const harness = pyHarness(d);
  const ref = verdict(python(d.ref + harness));
  if (!ref || !ref.every((x) => x[0])) fail(`${d.id}: the reference does not pass: ${JSON.stringify(ref)}`);
  const st = verdict(python(d.starter + harness));
  if (st && st.every((x) => x[0])) fail(`${d.id}: the starter already passes`);
  out.pyDrills[d.id] = { harness, expected: (ref ?? []).map((x) => [x[1], x[2]]) };
}

// ---------------------------------------------------------------- Python tasks
// Joins hard-wrapped lines so the statement wraps to the panel width; code lines (indent >= 4),
// list items, "key: {...}" lines and headers stay on their own lines.
function reflow(lines) {
  const res = [];
  const indent = (l) => l.length - l.trimStart().length;
  for (const l of lines) {
    const p = res.length ? res[res.length - 1] : '';
    const join =
      p.trim() !== '' && l.trim() !== '' && indent(p) < 4 && indent(l) < 4 &&
      !/^\s*(- |\d+\. )/.test(l) && !/^\w+: [{[(]/.test(l) &&
      (!/:\s*$/.test(p) || indent(l) > 0) && !/^[A-Z][A-Z ]+(\(.*\))?$/.test(p.trim());
    if (join) res[res.length - 1] = p.replace(/\s+$/, '') + ' ' + l.trim();
    else res.push(l);
  }
  return res.join('\n');
}
function parseDoc(src) {
  const m = src.match(/^"""([\s\S]*?)"""\n?/);
  if (!m) throw new Error('no docstring');
  const lines = m[1].split('\n');
  const hm = lines[0].match(/^([PD]\d\d)\.\s*(DEBUG:\s*)?(.*?)\s{2,}(?:Level:\s*(.*?)\.\s*)?Target time:\s*(\d+)\s*min\./);
  if (!hm) throw new Error('bad first line: ' + lines[0]);
  const body = [];
  const ask = [];
  let hint = '';
  let mode = 'body';
  for (const l of lines.slice(1)) {
    if (l.startsWith('ASK FIRST:')) mode = 'ask';
    else if (l.startsWith('HINT')) mode = 'hint';
    else if (l.startsWith('HOW TO PRACTISE')) mode = 'skip';
    else if (l.trim() === '') mode = 'body';
    else if (mode === 'ask' && !/^\s/.test(l)) mode = 'body';
    if (mode === 'ask') {
      const t = l.replace(/^ASK FIRST:/, '').trim();
      const qa = t.match(/^(.*?)\s+A:\s*(.*)$/);
      if (qa) ask.push({ q: qa[1].trim(), a: qa[2].trim() });
      else if (ask.length) ask[ask.length - 1].a += ' ' + t;
    } else if (mode === 'hint') hint += (hint ? ' ' : '') + l.replace(/^HINT\s*\([^)]*\):\s*/, '').replace(/^HINT:\s*/, '').trim();
    else if (mode === 'body') body.push(l);
  }
  while (body.length && !body[0].trim()) body.shift();
  while (body.length && !body[body.length - 1].trim()) body.pop();
  return { debug: !!hm[2], title: hm[3].trim(), level: hm[4] || 'debug', target: Number(hm[5]), body: reflow(body).replace(/\n{3,}/g, '\n\n'), ask, hint, docEnd: m[0].length };
}
// The reference solutions import exception classes from tasks.<module>; in the browser the editor
// code IS that module, so the classes are copied in from the task file instead.
function inlineClasses(sol, tpl) {
  return sol.replace(/^from tasks\.\w+ import ([\w, ]+?)\s*(#.*)?$/m, (_, names) =>
    names.split(',').map((n) => n.trim()).map((n) => {
      const c = tpl.match(new RegExp(`^class ${n}\\b.*?:\\n(?:    .*\\n)+`, 'm'));
      if (!c) throw new Error('class not in the task file: ' + n);
      return c[0].trimEnd();
    }).join('\n\n\n'));
}
const mods = readdirSync(`${X}/tasks`).filter((f) => /^[pd]\d\d_\w+\.py$/.test(f)).map((f) => f.slice(0, -3)).sort();
for (const mod of mods) {
  const id = mod.slice(0, 3);
  unique(id);
  const meta = pyTasks.find((t) => t.id === id);
  if (!meta) {
    fail(`${id}: no entry in src/data/practice/py-tasks.ts`);
    continue;
  }
  if (meta.file !== mod) fail(`${id}: file is ${mod}, py-tasks.ts says ${meta.file}`);
  try {
    const src = readFileSync(`${X}/tasks/${mod}.py`, 'utf8');
    const { docEnd, ...doc } = parseDoc(src);
    const template = src.slice(docEnd).replace(/^# START: delete this line to run the tests\n\n?/m, '').replace(/^\n+/, '').replace(/\n{3,}(?=\S)/g, '\n\n\n');
    const test = readFileSync(`${X}/tests/test_${mod}.py`, 'utf8');
    const solution = inlineClasses(readFileSync(`${X}/solutions/${mod}.py`, 'utf8'), src).trim() + '\n';
    out.pyTasks[id] = { mod, ...doc, template, solution, tests: [...test.matchAll(/^def (test_\w+)/gm)].map((x) => x[1]), db: /\bdb\.connect\(/.test(test) };
  } catch (e) {
    fail(`${id}: ${e.message}`);
  }
}

// ---------------------------------------------------------------- hints and Russian translations
const warnings = [];
const allIds = new Set([...sqlDrills, ...pyDrills].map((d) => d.id));
const taskIds = new Set([...Object.keys(out.sqlTasks), ...Object.keys(out.pyTasks)]);
for (const [file, name, keys] of [
  ['hints.ts', 'taskHints', taskIds],
  ['translations-ru.ts', 'ruText', new Set([...allIds, ...taskIds])],
]) {
  if (!existsSync(`${root}src/data/practice/${file}`)) {
    warnings.push(`src/data/practice/${file} does not exist yet`);
    continue;
  }
  const mod = await data(file);
  const map = mod[name];
  if (!map || typeof map !== 'object') {
    fail(`${file}: no export ${name}`);
    continue;
  }
  for (const k of Object.keys(map)) if (!keys.has(k)) fail(`${file}: "${k}" is not an exercise id`);
  const missing = [...keys].filter((k) => !(k in map));
  if (missing.length) warnings.push(`${file}: no entry for ${missing.length} ids (${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ', …' : ''})`);
  if (name === 'taskHints') for (const [k, v] of Object.entries(map)) if (!v?.en || !v?.ru) fail(`${file}: ${k} needs both en and ru`);
}
for (const w of warnings) console.warn(`! ${w}`);

if (errors.length) {
  console.error(`✗ exercises:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
const file = `${root}src/data/generated/practice.json`;
mkdirSync(`${root}src/data/generated`, { recursive: true });
writeFileSync(file, JSON.stringify(json(out), null, 1) + '\n');
const n = (o) => Object.keys(o).length;
console.log(`✓ ${file}: ${n(out.sqlDrills)} SQL drills, ${n(out.traps)} traps, ${n(out.sqlTasks)} SQL tasks, ${n(out.pyDrills)} Python drills, ${n(out.pyTasks)} Python tasks`);
