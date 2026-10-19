#!/usr/bin/env node
// Checks an answer from the command line, the same way Check does on the site.
//   node scripts/check-answer.mjs s-left-zero my.sql     SQL drill: practice data + hidden edge-case data
//   node scripts/check-answer.mjs left-where fix.sql     trap: your fixed query
//   node scripts/check-answer.mjs q04 my.sql             SQL task
//   node scripts/check-answer.mjs y-group-sum my.py      Python drill: the drill's checks
//   node scripts/check-answer.mjs p03 my.py              Python task: the task's pytest tests
// Column names are ignored. On the practice data the row order matters only when the exercise asks
// for an order; on the hidden edge-case data the rows are compared as a set, as on the site.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { inOneTransaction, loadData, PARSERS, normRows } from '../src/runtime/pg-setup.js';

const [id, file] = process.argv.slice(2);
if (!id || !file) {
  console.error('Usage: node scripts/check-answer.mjs <exercise id> <answer file>');
  process.exit(2);
}
const root = fileURLToPath(new URL('../', import.meta.url));
const answer = readFileSync(file, 'utf8');
const data = (f) => import(new URL(`../src/data/practice/${f}`, import.meta.url).href);
const P = JSON.parse(readFileSync(`${root}src/data/generated/practice.json`, 'utf8'));
const { sqlDrills } = await data('sql-drills.ts');
const { pyDrills } = await data('py-drills.ts');
const { traps } = await data('traps.ts');

// Python drills need only the standard library (python3); Python tasks run their pytest tests
// through uv, with the packages pinned in exercises/uv.lock.
const exec = (cmd, args, opts = {}) => {
  try {
    return { ok: true, out: execFileSync(cmd, args, { encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'], ...opts }) };
  } catch (e) {
    return { ok: false, out: `${e.stdout || ''}${e.stderr || e.message}` };
  }
};
const python = (args, opts = {}) => exec('python3', args, opts);

// ---------------------------------------------------------------- Python drill
const pyDrill = pyDrills.find((d) => d.id === id);
if (pyDrill) {
  const r = python(['-I', '-c', answer + P.pyDrills[id].harness]);
  const line = r.out.split('\n').reverse().find((l) => l.startsWith('@@LC@@'));
  if (!line) {
    console.log(`✕ ${id}: the code did not finish\n${r.out.slice(-2000)}`);
    process.exit(1);
  }
  const res = JSON.parse(line.slice(6));
  for (const [ok, call, detail] of res) console.log(`${ok ? '✓' : '✕'} ${call}  →  ${detail}`);
  const pass = res.every((x) => x[0]);
  console.log(pass ? `PASS ${id}` : `FAIL ${id}`);
  process.exit(pass ? 0 : 1);
}

// ---------------------------------------------------------------- Python task
const pyTask = P.pyTasks[id];
if (pyTask) {
  const dir = mkdtempSync(join(tmpdir(), 'lc-check-'));
  try {
    cpSync(`${root}exercises`, dir, { recursive: true, filter: (s) => !/(__pycache__|\.venv|\.pytest_cache)/.test(s) });
    writeFileSync(`${dir}/tasks/${pyTask.mod}.py`, answer);
    const r = exec('uv', ['run', '--quiet', '--locked', 'pytest', '-q', '-p', 'no:cacheprovider', `tests/test_${pyTask.mod}.py`], { cwd: dir });
    console.log(r.out.trim().split('\n').slice(-40).join('\n'));
    const skipped = /\bskipped\b/.test(r.out);
    if (skipped) console.log('Some tests were skipped: the file still has the NotImplementedError or START marker, or a database test could not run.');
    const pass = r.ok && !skipped;
    console.log(pass ? `PASS ${id}` : `FAIL ${id}`);
    process.exit(pass ? 0 : 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- SQL: drill, trap fix or task
let ref;
let ordered;
const drill = sqlDrills.find((d) => d.id === id);
const trap = traps.find((t) => t.id === id);
if (drill) {
  if (drill.check === false) {
    console.log(`${id} has nothing to compare (check: false)`);
    process.exit(0);
  }
  ref = drill.ref;
  ordered = !!drill.ordered;
} else if (trap) {
  if (!trap.fix) {
    console.log(`${id} has no fixed query to compare with`);
    process.exit(0);
  }
  ref = trap.fix;
  ordered = !!P.traps[id].fixed?.ordered;
} else if (P.sqlTasks[id]) {
  ref = readFileSync(`${root}exercises/solutions/sql/${id}.sql`, 'utf8');
  ordered = !!P.sqlTasks[id].order;
} else {
  console.error(`Unknown exercise id: ${id}`);
  process.exit(2);
}

const db = await PGlite.create({ parsers: PARSERS });
await loadData(db, async (t) => new Blob([readFileSync(`${root}exercises/data/csv/${t}.csv`)]));
await db.exec(readFileSync(`${root}src/runtime/edge.sql`, 'utf8'));
async function run(sql, schema) {
  await db.exec('BEGIN');
  try {
    if (schema === 'edge') await db.exec('SET LOCAL search_path TO edge');
    const res = await db.exec(inOneTransaction(sql).sql, { rowMode: 'array' });
    const last = [...res].reverse().find((r) => r.fields && r.fields.length);
    if (!last) throw new Error('no statement returns rows');
    return { cols: last.fields.map((f) => f.name), rows: normRows(last.rows, last.fields.map((f) => f.dataTypeID)) };
  } finally {
    await db.exec('ROLLBACK');
  }
}
const key = (r) => JSON.stringify(r);
/**
 * A reference that builds its own tables does not read the dataset: the site does not check it on
 * edge. A task that loads its table from the dataset (Q15) opts in (sql-tasks.ts `edge: true`), and
 * the build then records an edge fingerprint for it, so for tasks practice.json decides.
 */
const ownTables = (sql) => /\b(CREATE|INSERT|UPDATE|DELETE|ALTER|DROP|EXPLAIN)\b/i.test(sql.replace(/--[^\n]*/g, ''));
const onEdge = drill || trap ? !ownTables(ref) : !!P.sqlTasks[id].expected.edge;
function compare(got, exp, ordered) {
  if (got.cols.length !== exp.cols.length) return `${got.cols.length} columns, expected ${exp.cols.length} (${exp.cols.join(', ')})`;
  if (got.rows.length !== exp.rows.length) return `${got.rows.length} rows, expected ${exp.rows.length}`;
  const a = ordered ? got.rows : [...got.rows].sort((x, y) => key(x).localeCompare(key(y)));
  const b = ordered ? exp.rows : [...exp.rows].sort((x, y) => key(x).localeCompare(key(y)));
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b[i].length; j++)
      if (key(a[i][j]) !== key(b[i][j])) {
        const sameSet = JSON.stringify([...got.rows].map(key).sort()) === JSON.stringify([...exp.rows].map(key).sort());
        if (sameSet) return 'same rows, different order';
        return `row ${i + 1}, column ${exp.cols[j]}: got ${key(a[i][j])}, expected ${key(b[i][j])}`;
      }
  return null;
}
let failed = false;
for (const schema of onEdge ? ['public', 'edge'] : ['public']) {
  const label = schema === 'public' ? 'practice data' : 'hidden edge-case data';
  let got;
  try {
    got = await run(answer, schema);
  } catch (e) {
    console.log(`✕ ${label}: ${e.message}`);
    failed = true;
    continue;
  }
  let exp;
  try {
    exp = await run(ref, schema);
  } catch {
    if (schema === 'edge') continue; // the reference builds its own tables: nothing to compare on edge
    throw new Error('the reference fails');
  }
  const diff = compare(got, exp, schema === 'public' && ordered);
  console.log(diff ? `✕ ${label}: ${diff}` : `✓ ${label}: ${exp.rows.length} rows match`);
  if (diff) failed = true;
}
console.log(failed ? `FAIL ${id}` : `PASS ${id}`);
process.exit(failed ? 1 : 0);
