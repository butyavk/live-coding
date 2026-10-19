#!/usr/bin/env node
// End-to-end check of the built site in a real browser (Playwright + Chromium):
// - every page in both languages opens without console errors and without a horizontal
//   scroll at phone width (390px);
// - every exercise passes Check in the browser with its reference: all SQL and Python drills,
//   every trap fix, every SQL task and every Python task with its real tests; SQL answers must
//   also match on the hidden edge-case data;
// - wrong queries that look right on the practice data fail on the hidden edge-case data;
// - a failed Check on a task says where the difference is but shows the expected value only on
//   request (drills still show it); walkthroughs are soft-locked; "Start fresh" on a solved task;
// - Russian pages: the "Перевод" toggle and the Russian UI; hints open;
// - the mock interview: the plan filter, the clock (max(25, target + 10) minutes, kept on reload),
//   the starter code with "Restore my draft", the candidate's own questions, nothing that names the
//   technique, no expected values on a failed Check, and the self-review at the end;
// - without WebAssembly JSPI, a Python task whose tests need the database is never marked solved;
// - the study plan and the skill map share one plan choice, one progress and one Reset, and both
//   count the exercises that passed Check (ONLY=plan runs just this part).
//
// Usage: npm run build && npx astro preview &   then   npm run test:e2e
// BASE overrides the address (default http://localhost:4321/live-coding);
// PW_CHROMIUM points to a Chromium binary when Playwright's own build is not installed;
// ONLY=python-tasks tests one section; SKIP_PAGES=1 skips the 390px pass over every page.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4321/live-coding';
const ONLY = process.env.ONLY;
const root = new URL('../', import.meta.url).pathname;
const P = JSON.parse(readFileSync(`${root}src/data/generated/practice.json`, 'utf8'));
const data = (f) => import(new URL(`../src/data/practice/${f}`, import.meta.url).href);
const { sqlDrills } = await data('sql-drills.ts');
const { pyDrills } = await data('py-drills.ts');
const { traps } = await data('traps.ts');
const optional = async (f, key) => {
  try {
    return (await data(f))[key] ?? {};
  } catch {
    return {};
  }
};
const taskHints = await optional('hints.ts', 'taskHints');
const ruText = await optional('translations-ru.ts', 'ruText');
const pages = JSON.parse(readFileSync(`${root}scripts/pages.json`, 'utf8'));
const EDGE_PASS = { en: 'also on hidden edge-case data', ru: 'в том числе на скрытых граничных данных' };
const EDGE_FAIL = 'not on hidden edge-case data';
const mockMinutes = (target) => Math.max(25, target + 10);
const { studyPhases } = await import(new URL('../src/data/study-plan.ts', import.meta.url).href);
const planPages = (plan) => new Set(studyPhases.flatMap((ph) => ph.steps.filter((x) => x.timelines.includes(plan)).map((x) => `/${x.path}`)));
/** A page's path without the base and the locale: "/sql-tasks/revenue-reports/". */
const sitePath = (url) => new URL(url).pathname.slice(new URL(BASE).pathname.replace(/\/$/, '').length).replace(/^\/ru\//, '/');

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const results = [];
const ok = (name, cond, extra = '') => {
  results.push(!!cond);
  if (!cond || process.env.VERBOSE) console.log(`${cond ? '✓' : '✕'} ${name}${extra ? ' — ' + extra : ''}`);
};
const section = (name) => {
  const n = results.length;
  return () => console.log(`${name}: ${results.slice(n).filter(Boolean).length}/${results.length - n}`);
};

async function open(path, { viewport = { width: 1280, height: 900 }, dark = false, init } = {}) {
  const ctx = await browser.newContext({ viewport, colorScheme: dark ? 'dark' : 'light' });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  const res = await page.goto(BASE + path, { waitUntil: 'load' });
  return { page, ctx, errors, status: res?.status() };
}
const block = (page, id) => page.locator(`[data-lcp][data-id="${id}"]`);
async function setCode(page, id, code) {
  await block(page, id).scrollIntoViewIfNeeded();
  const ready = (i) => document.querySelector(`[data-lcp][data-id="${i}"]`)?.lcpBlock?.editor;
  await page.waitForFunction(ready, id, { timeout: 20000 }).catch(async () => {
    await block(page, id).locator('[data-editor]').click();
    await page.waitForFunction(ready, id, { timeout: 20000 });
  });
  await page.evaluate(([i, c]) => document.querySelector(`[data-lcp][data-id="${i}"]`).lcpBlock.editor.set(c), [id, code]);
}
/** Clicks Check and waits for the final verdict (after the edge-case run, when there is one). */
async function check(page, id, timeout = 180000) {
  const verdict = block(page, id).locator('[data-verdict]');
  await verdict.evaluate((v) => (v.innerHTML = ''));
  await block(page, id).locator('[data-act="check"]').click();
  await verdict.locator('.lcp-banner').first().waitFor({ timeout });
  // Check is finished when the Check button is enabled again.
  await page.waitForFunction((i) => !document.querySelector(`[data-lcp][data-id="${i}"] [data-act="check"]`)?.disabled, id, { timeout });
  const v = verdict.locator('.lcp-banner').first();
  const cls = await v.getAttribute('class');
  return { pass: cls.includes('lcp-pass'), info: cls.includes('lcp-info'), text: (await verdict.innerText()).replace(/\s+/g, ' ').trim() };
}
const shown = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].some((el) => getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0), sel);

// Where each exercise is placed (English pages).
const placed = new Map();
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? (f === 'ru' ? [] : walk(join(dir, f))) : [join(dir, f)]));
for (const f of walk(`${root}src/content/docs`).filter((f) => f.endsWith('.mdx'))) {
  const slug = '/' + f.slice(`${root}src/content/docs/`.length).replace(/\.mdx$/, '/').replace(/^index\/$/, '');
  for (const m of readFileSync(f, 'utf8').matchAll(/<(Drill|Trap|Task)\s+id=["']([^"']+)["']/g)) placed.set(m[2], { kind: m[1], page: slug });
}
const byPage = new Map();
for (const [id, v] of placed) byPage.set(v.page, [...(byPage.get(v.page) ?? []), { id, ...v }]);

// ---------------------------------------------------------------- every page, both languages
if (!process.env.SKIP_PAGES) {
  const done = section('pages');
  const all = ['/', ...Object.entries(pages).flatMap(([s, list]) => list.map((p) => `/${s}/${p}/`))];
  for (const lang of ['', '/ru']) {
    for (const p of all) {
      if (ONLY && !p.includes(ONLY)) continue;
      const { page, ctx, errors, status } = await open(lang + p, { viewport: { width: 390, height: 844 }, dark: lang === '/ru' });
      await page.waitForTimeout(300);
      const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      ok(`${lang}${p}: opens`, status === 200, `HTTP ${status}`);
      ok(`${lang}${p}: no horizontal scroll at 390px`, sw <= cw, `${sw} > ${cw}`);
      ok(`${lang}${p}: no console errors`, !errors.length, errors.join(' | ').slice(0, 300));
      await ctx.close();
    }
  }
  done();
}

// ---------------------------------------------------------------- study plan and skill map
if (!ONLY || ONLY === 'plan') {
  const done = section('plan and map');
  const planOf = (page) => page.evaluate(() => [...document.querySelectorAll('[data-sp] input[type=radio]')].find((r) => r.checked)?.value);
  const mapOf = (page) => page.evaluate(() => [...document.querySelectorAll('input[name=sm-plan]')].find((r) => r.checked)?.value);
  const stepEx = (page, id) => page.locator(`[data-sp] [data-step="${id}"] [data-sp-ex]`).innerText();
  const nodeEx = (page, p) => page.locator(`.sm-node[data-p="${p}"] [data-sm-ex]`).innerText();
  const optCounts = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((l) => (l.textContent.match(/(\d+)\s+(?:steps|шаг)/) ?? [])[1]), sel);
  for (const lang of ['', '/ru']) {
    // A fresh browser: both pages show the same default plan and the same number of steps.
    const { page, ctx, errors } = await open(`${lang}/start/study-plan/`);
    const fresh = await planOf(page);
    const planCounts = await optCounts(page, '[data-sp] .sp-option');
    await page.goto(`${BASE}${lang}/start/skill-map/`);
    ok(`${lang || 'en'}: fresh browser, the map and the plan show the same plan`, fresh === 'medium' && (await mapOf(page)) === fresh, `${fresh} / ${await mapOf(page)}`);
    const mapCounts = await optCounts(page, '.sm-plan--time label');
    ok(`${lang || 'en'}: the map and the plan give each plan the same number of steps`, planCounts.join() === mapCounts.join() && planCounts.every(Boolean), `${planCounts} / ${mapCounts}`);
    ok(`${lang || 'en'}: map total = plan steps`, (await page.locator('[data-sm-total]').innerText()) === planCounts[1]);
    // Next up follows the plan's order.
    const first = await page.locator('[data-sm-next] .sm-chip').first().getAttribute('data-go');
    ok(`${lang || 'en'}: Next up starts with the first step of the plan`, first === 'start/introduction/', first);
    // Switching on the map shows on the plan, and back.
    await page.locator('input[name=sm-plan][value=short]').check({ force: true });
    await page.goto(`${BASE}${lang}/start/study-plan/`);
    ok(`${lang || 'en'}: plan follows the map's choice`, (await planOf(page)) === 'short');
    await page.locator('[data-sp] input[value=long]').check({ force: true });
    ok(`${lang || 'en'}: one plain key`, (await page.evaluate(() => localStorage.getItem('lcm-study-plan'))) === 'long');
    await page.goto(`${BASE}${lang}/start/skill-map/`);
    ok(`${lang || 'en'}: map follows the plan's choice`, (await mapOf(page)) === 'long');
    ok(`${lang || 'en'}: no console errors (plan and map)`, !errors.length, errors.join(' | ').slice(0, 300));
    await ctx.close();
  }
  {
    // Older keys: the plan's JSON and the map's own key move into one plain key.
    const { page, ctx } = await open('/start/skill-map/', {
      init: () => {
        if (sessionStorage.getItem('seeded')) return;
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('lcm-study-plan', JSON.stringify({ timeline: 'short', done: { short: ['intro'] } }));
        localStorage.setItem('lcm-map-plan', 'long');
        localStorage.setItem('lcm-flashcards-en', JSON.stringify({ v: 1, cards: { 'sql-half-open-month': { b: 3, d: 1 } } }));
        localStorage.setItem('lcm-flashcards-ru', JSON.stringify({ v: 1, cards: { 'sql-half-open-month': { b: 2, d: 0 }, 'sql-count-forms': { b: 4, d: 9 } } }));
      },
    });
    await page.reload();
    const st = await page.evaluate(() => ({ plan: localStorage.getItem('lcm-study-plan'), old: localStorage.getItem('lcm-map-plan'), p: JSON.parse(localStorage.getItem('lcm-progress') || '{}') }));
    ok('old plan keys migrate once', (await mapOf(page)) === 'short' && st.plan === 'short' && st.old === null && !!st.p.learned?.['start/introduction/'], JSON.stringify(st).slice(0, 200));
    await page.goto(`${BASE}/ru/reference/flashcards/`);
    const fc = await page.evaluate(() => ({ one: JSON.parse(localStorage.getItem('lcm-flashcards') || '{}').cards, en: localStorage.getItem('lcm-flashcards-en'), ru: localStorage.getItem('lcm-flashcards-ru') }));
    ok('flashcards: both languages merge into one store', fc.one?.['sql-half-open-month']?.b === 3 && fc.one?.['sql-count-forms']?.b === 4 && fc.en === null && fc.ru === null, JSON.stringify(fc).slice(0, 200));
    await ctx.close();
  }
  {
    // A real Check on Q01 counts on the plan and on the map, in the short plan's scope (Q01, Q05).
    const { page, ctx, errors } = await open('/sql-tasks/revenue-reports/', { init: () => localStorage.getItem('lcm-study-plan') || localStorage.setItem('lcm-study-plan', 'short') });
    await setCode(page, 'q01', P.sqlTasks.q01.solution);
    const v = await check(page, 'q01');
    ok('q01 passes and is stored as solved', v.pass && (await page.evaluate(() => !!JSON.parse(localStorage.getItem('lcm-progress')).activities['ex:q01'])));
    await page.goto(`${BASE}/start/study-plan/`);
    ok('plan: solved exercise counts', (await stepEx(page, 't-revenue')).endsWith('1/2'), await stepEx(page, 't-revenue'));
    ok('plan: no mark offer before all are solved', await page.locator('[data-step="t-revenue"] [data-sp-learn]').isHidden());
    // The way client.ts stores a pass: an `ex:<id>` activity in lcm-progress.
    await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('lcm-progress'));
      p.activities['ex:q05'] = Date.now();
      localStorage.setItem('lcm-progress', JSON.stringify(p));
    });
    await page.reload();
    ok('plan: all solved', (await stepEx(page, 't-revenue')).endsWith('2/2'));
    ok('plan: offers Mark as learned', await page.locator('[data-step="t-revenue"] [data-sp-learn]').isVisible());
    await page.goto(`${BASE}/start/skill-map/`);
    ok('map: node shows 2/2', (await nodeEx(page, 'sql-tasks/revenue-reports/')) === '2/2');
    ok('map: exercises in the stat', /^[1-9]/.test(await page.locator('[data-sm-ex-solved]').innerText()));
    await page.locator('[data-sm-solved] [data-learn-p="sql-tasks/revenue-reports/"]').click();
    ok('map: marked as learned from "Every exercise solved"', (await page.locator('[data-sm-learned]').innerText()) === '1' && (await page.locator('[data-sm-solved-wrap]').isHidden()));
    await page.goto(`${BASE}/start/study-plan/`);
    ok('plan: the step is ticked', await page.locator('[data-step="t-revenue"] input[type=checkbox]').isChecked());
    // One Reset, the same scope on both pages; drafts and timers only when asked.
    await page.evaluate(() => {
      localStorage.setItem('lcm-draft:q01', 'SELECT 1');
      localStorage.setItem('lcm-timer:q01', '{"elapsed":5,"running":false,"since":0}');
    });
    await page.locator('[data-sp] [data-reset-open]').click();
    await page.locator('[data-sp] [data-reset-yes]').click();
    const after = await page.evaluate(() => ({ p: JSON.parse(localStorage.getItem('lcm-progress')), draft: localStorage.getItem('lcm-draft:q01'), plan: localStorage.getItem('lcm-study-plan') }));
    ok('reset (plan): learned, visited and solved cleared; drafts and plan kept', !Object.keys(after.p.learned).length && !Object.keys(after.p.activities).length && !Object.keys(after.p.visited).length && after.draft && after.plan === 'short', JSON.stringify(after).slice(0, 200));
    ok('reset (plan): counters back to zero', (await stepEx(page, 't-revenue')).endsWith('0/2') && !(await page.locator('[data-step="t-revenue"] input[type=checkbox]').isChecked()));
    await page.goto(`${BASE}/start/skill-map/`);
    await page.locator('[data-sm] [data-reset-open]').click();
    await page.locator('[data-sm] [data-reset-drafts]').check();
    await page.locator('[data-sm] [data-reset-yes]').click();
    const gone = await page.evaluate(() => [localStorage.getItem('lcm-draft:q01'), localStorage.getItem('lcm-timer:q01')]);
    ok('reset (map) with the option: drafts and timers cleared', gone.every((x) => x === null));
    ok('no console errors (plan and map progress)', !errors.length, errors.join(' | ').slice(0, 300));
    await ctx.close();
  }
  done();
}

// ---------------------------------------------------------------- every exercise passes with its reference
{
  const done = section('exercises');
  const ref = (id) => sqlDrills.find((d) => d.id === id)?.ref ?? pyDrills.find((d) => d.id === id)?.ref;
  const edgeOk = (v, edge) => !edge || v.text.includes(EDGE_PASS.en);
  for (const [path, items] of byPage) {
    if (ONLY && !path.includes(ONLY)) continue;
    const { page, ctx, errors } = await open(path);
    for (const it of items) {
      try {
        if (it.kind === 'Drill') {
          if (sqlDrills.find((d) => d.id === it.id)?.check === false) {
            await setCode(page, it.id, ref(it.id));
            await block(page, it.id).locator('[data-act="run"]').click();
            await block(page, it.id).locator('[data-out] table').last().waitFor({ timeout: 60000 });
            ok(`${it.id} runs`, true);
            continue;
          }
          await setCode(page, it.id, ref(it.id));
          const v = await check(page, it.id);
          ok(`${it.id}: reference passes`, v.pass && edgeOk(v, P.sqlDrills[it.id]?.edge), v.text.slice(0, 200));
        } else if (it.kind === 'Trap') {
          const t = traps.find((x) => x.id === it.id);
          await setCode(page, it.id, t.sql);
          await block(page, it.id).locator('[data-act="run"]').click();
          await block(page, it.id).locator('[data-out] table, [data-out] .lcp-fail').first().waitFor({ timeout: 60000 });
          ok(`${it.id}: trap runs`, true);
          if (t.fix) {
            await setCode(page, it.id, t.fix);
            const v = await check(page, it.id);
            ok(`${it.id}: fix passes`, v.pass && edgeOk(v, P.traps[it.id]?.fixed?.edge), v.text.slice(0, 200));
          }
        } else {
          const task = P.sqlTasks[it.id] ?? P.pyTasks[it.id];
          const first = await check(page, it.id);
          ok(`${it.id}: template fails`, !first.pass, first.text.slice(0, 120));
          await setCode(page, it.id, task.solution);
          const v = await check(page, it.id);
          const skipped = await block(page, it.id).locator('.lcp-tests .lcp-skip').count();
          ok(`${it.id}: solution passes`, v.pass && !skipped && edgeOk(v, P.sqlTasks[it.id]?.expected?.edge), `${v.text.slice(0, 200)}${skipped ? ` (${skipped} skipped)` : ''}`);
        }
      } catch (e) {
        ok(`${it.id} on ${path}`, false, String(e).split('\n')[0]);
      }
    }
    ok(`${path}: no console errors while solving`, !errors.length, errors.join(' | ').slice(0, 300));
    await ctx.close();
  }
  done();
}

if (!ONLY) {
  // -------------------------------------------------------------- wrong but plausible queries fail on the edge-case data
  {
    const done = section('edge cases');
    const sol = (id) => P.sqlTasks[id].solution;
    const swap = (id, from, to) => {
      const s = sol(id);
      if (!s.includes(from)) throw new Error(`${id}: "${from}" not in the reference`);
      return s.replace(from, to);
    };
    const wrong = [
      ['q01', 'BETWEEN counts 1 September 00:00', () => swap('q01', "AND start_time >= TIMESTAMP '2026-08-01'\n  AND start_time <  TIMESTAMP '2026-09-01'", "AND start_time BETWEEN '2026-08-01' AND '2026-09-01'")],
      ['q03', 'end_time >= counts a period that ended', () => swap('q03', "AND end_time   >  TIMESTAMP '2026-09-01'", "AND end_time >= TIMESTAMP '2026-09-01'")],
      ['q04', 'COUNT(*) after LEFT JOIN', () => swap('q04', 'COUNT(t.transaction_id)', 'COUNT(*)')],
      ['q04', 'inner JOIN drops the empty day', () => swap('q04', 'LEFT JOIN transactions t', 'JOIN transactions t')],
      ['q07', 'no tie-breaker', () => swap('q07', 'ORDER BY start_time DESC, transaction_id DESC', 'ORDER BY start_time DESC')],
      ['q12', 'LEFT JOIN misses the unexpected payout', () => swap('q12', 'FULL OUTER JOIN paid p', 'LEFT JOIN paid p')],
      ['q13', 'NULL enrollment not checked', () => swap('q13', 'm.advances_enrolled_at IS NULL OR adv.created_at < m.advances_enrolled_at', 'adv.created_at < m.advances_enrolled_at')],
    ];
    const pageOf = new Map();
    for (const [id, why, make] of wrong) {
      const path = placed.get(id)?.page;
      if (!path) {
        ok(`${id} (${why}): task is on a page`, false);
        continue;
      }
      try {
        if (!pageOf.has(path)) pageOf.set(path, await open(path));
        const { page } = pageOf.get(path);
        await setCode(page, id, make());
        const v = await check(page, id);
        ok(`${id} wrong (${why}) fails on the edge-case data`, !v.pass && v.text.includes(EDGE_FAIL), v.text.slice(0, 200));
      } catch (e) {
        ok(`${id} wrong (${why})`, false, String(e).split('\n')[0]);
      }
    }
    for (const [path, { ctx, errors }] of pageOf) {
      ok(`${path}: no console errors (edge cases)`, !errors.length, errors.join(' | ').slice(0, 300));
      await ctx.close();
    }
    done();
  }

  // -------------------------------------------------------------- Russian UI, translation toggle, hints
  {
    const done = section('russian and hints');
    const { page, ctx, errors } = await open('/ru/sql/left-join-and-zeros/', { dark: true });
    const ref = sqlDrills.find((d) => d.id === 's-left-zero').ref;
    await setCode(page, 's-left-zero', ref.replace(/LEFT JOIN/i, 'JOIN'));
    const v = await check(page, 's-left-zero');
    ok('wrong answer fails', !v.pass, v.text.slice(0, 120));
    ok('Russian button label', (await block(page, 's-left-zero').locator('[data-act="check"]').innerText()).includes('Проверить'));
    ok('drills show the output columns', await block(page, 's-left-zero').locator('.lcp-spec').count(), '');
    if (ruText['s-left-zero']) {
      const tr = block(page, 's-left-zero').locator('details.lcp-tr');
      await tr.locator('summary').click();
      ok('drill: "Перевод" opens a Russian text', /[а-яё]{4}/i.test(await tr.innerText()));
    }
    ok('no console errors (ru, dark)', !errors.length, errors.join(' | ').slice(0, 300));
    await ctx.close();

    const taskIds = [...Object.keys(P.sqlTasks), ...Object.keys(P.pyTasks)];
    const withRu = taskIds.filter((id) => ruText[id] && placed.get(id));
    const withHint = taskIds.filter((id) => (taskHints[id] || P.pyTasks[id]?.hint) && placed.get(id));
    const paths = new Set([...withRu, ...withHint].map((id) => placed.get(id).page));
    for (const path of paths) {
      const ru = await open('/ru' + path);
      const en = await open(path);
      for (const id of withRu.filter((i) => placed.get(i).page === path)) {
        const tr = block(ru.page, id).locator('details.lcp-tr').first();
        await tr.locator('summary').click();
        ok(`${id}: "Перевод" opens on the Russian page`, /[а-яё]{4}/i.test(await tr.innerText()));
        ok(`${id}: no translation on the English page`, (await block(en.page, id).locator('details.lcp-tr').count()) === 0);
      }
      for (const id of withHint.filter((i) => placed.get(i).page === path)) {
        for (const [lang, p] of [['ru', ru.page], ['en', en.page]]) {
          const h = block(p, id).locator('details[data-hint]');
          if (!(await h.count())) {
            ok(`${id}: hint on the ${lang} page`, false);
            continue;
          }
          await h.locator('summary').scrollIntoViewIfNeeded();
          await h.locator('summary').click();
          const text = (await h.innerText()).trim();
          const want = taskHints[id]?.[lang] ?? P.pyTasks[id]?.hint ?? '';
          ok(`${id}: hint opens (${lang})`, (await h.evaluate((d) => d.open)) && text.includes(want.slice(0, 20).trim()), text.slice(0, 100));
        }
      }
      for (const x of [ru, en]) {
        ok(`${path}: no console errors (translations, hints)`, !x.errors.length, x.errors.join(' | ').slice(0, 300));
        await x.ctx.close();
      }
    }
    done();
  }

  // -------------------------------------------------------------- Check on tasks, walkthrough lock, Start fresh
  {
    const done = section('task check');
    const path = placed.get('q01').page;
    const { page, ctx, errors } = await open(path);
    const wrong = P.sqlTasks.q01.solution.replace('WHERE NOT is_test\n  AND start_time', 'WHERE start_time');
    ok('q01 wrong answer is different from the reference', wrong !== P.sqlTasks.q01.solution);
    await setCode(page, 'q01', wrong);
    const v = await check(page, 'q01');
    ok('task: a failed Check fails', !v.pass, v.text.slice(0, 160));
    ok('task: it says where the difference is', /column/.test(v.text), v.text.slice(0, 200));
    ok('task: no expected value before the button', !v.text.includes('expected:') && !v.text.includes('Missing, for example'), v.text.slice(0, 300));
    const btn = block(page, 'q01').locator('[data-show-expected]');
    ok('task: "Show the expected value" button', (await btn.count()) === 1);
    if (await btn.count()) {
      await btn.click();
      ok('task: the button shows the expected value', (await block(page, 'q01').locator('[data-verdict]').innerText()).includes('expected:'));
    }
    // The walkthrough after the task is soft-locked like the solution.
    const walk = page.locator('.sl-markdown-content > details.lcp-reveal').first();
    await walk.locator('summary').scrollIntoViewIfNeeded();
    await walk.locator('summary').click();
    ok('walkthrough: soft-locked before a pass', !(await walk.evaluate((d) => d.open)) && (await shown(page, '.sl-markdown-content > .lcp-lock')));
    await page.locator('.sl-markdown-content > .lcp-lock:not([hidden]) [data-lock-act="show"]').click();
    ok('walkthrough: "Show anyway" opens it', await walk.evaluate((d) => d.open));
    // Start fresh on a solved task: starter code, no draft, timer at zero, and it starts on Run.
    await setCode(page, 'q01', P.sqlTasks.q01.solution);
    const pass = await check(page, 'q01');
    ok('task: the reference passes', pass.pass, pass.text.slice(0, 160));
    const fresh = block(page, 'q01').locator('[data-fresh]');
    ok('task: "Start fresh" shown on a solved task', await fresh.isVisible());
    await fresh.click();
    await page.waitForTimeout(600);
    const state = await page.evaluate(() => ({ code: document.querySelector('[data-lcp][data-id="q01"]').lcpBlock.editor.get(), draft: localStorage.getItem('lcm-draft:q01') }));
    ok('Start fresh: starter code, draft cleared', state.code === P.sqlTasks.q01.template && state.draft === null, JSON.stringify(state).slice(0, 120));
    ok('Start fresh: timer reset', (await block(page, 'q01').locator('[data-timer-display]').innerText()) === '00:00');
    await setCode(page, 'q01', 'SELECT 1');
    await block(page, 'q01').locator('[data-act="run"]').click();
    await page.waitForTimeout(2200);
    ok('Start fresh: the timer starts again on Run', /^00:0[1-9]$/.test(await block(page, 'q01').locator('[data-timer-display]').innerText()));
    await block(page, 'q01').locator('[data-solution] > summary').click();
    ok('Start fresh: the solution is locked again', !(await block(page, 'q01').locator('[data-solution]').evaluate((d) => d.open)));
    ok(`${path}: no console errors (task check)`, !errors.length, errors.join(' | ').slice(0, 300));
    await ctx.close();

    // Drills are for learning: a failed Check still shows the expected values.
    const d = await open(placed.get('s-left-zero').page);
    await setCode(d.page, 's-left-zero', sqlDrills.find((x) => x.id === 's-left-zero').ref.replace(/LEFT JOIN/i, 'JOIN'));
    const dv = await check(d.page, 's-left-zero');
    ok('drill: a failed Check shows the expected values', !dv.pass && (dv.text.includes('expected:') || dv.text.includes('Missing, for example')), dv.text.slice(0, 200));
    await d.ctx.close();
    done();
  }

  // -------------------------------------------------------------- mock interview
  {
    const done = section('mock interview');
    // Every task has a saved draft: the mock must still start from the starter code.
    const ids = [...Object.keys(P.sqlTasks), ...Object.keys(P.pyTasks)];
    const drafts = `try { if (!sessionStorage.getItem('e2e-drafts')) { sessionStorage.setItem('e2e-drafts', '1'); for (const id of ${JSON.stringify(ids)}) localStorage.setItem('lcm-draft:' + id, '-- my old draft ' + id); } } catch {}`;
    for (const [lang, kind] of [['', 'sql'], ['/ru', 'py']]) {
      const { page, ctx, errors } = await open(`${lang}/start/mock-interview/`, { init: drafts });
      await page.locator(`input[name="lcm-mock-kind"][value="${kind}"]`).check();
      await page.locator('[data-mock-start]').click();
      await page.waitForURL(/[?&]mock=/, { timeout: 20000 });
      const id = new URL(page.url()).searchParams.get('mock');
      const task = P.sqlTasks[id] ?? P.pyTasks[id];
      ok(`mock (${kind}${lang}): picked a ${kind} task`, kind === 'sql' ? !!P.sqlTasks[id] : !!P.pyTasks[id], id);
      ok(`mock ${id}: stays in the language`, new URL(page.url()).pathname.includes('/ru/') === (lang === '/ru'), page.url());
      ok(`mock ${id}: from the default (medium) plan`, planPages('medium').has(sitePath(page.url())), page.url());
      await page.locator('[data-mock-bar]').waitFor({ timeout: 20000 });
      const mins = mockMinutes(task.target);
      ok(`mock ${id}: the clock is max(25, target + 10) = ${mins} minutes`, (await page.locator('[data-mock-clock]').innerText()).includes(String(mins)));
      const others = await page.evaluate((i) => [...document.querySelectorAll('[data-lcp]')].filter((b) => b.dataset.id !== i && b.getClientRects().length > 0).length, id);
      ok(`mock ${id}: other exercises hidden`, others === 0, `${others} visible`);
      ok(`mock ${id}: the task is shown`, await block(page, id).isVisible());
      const t = `[data-lcp][data-id="${id}"]`;
      ok(`mock ${id}: difficulty and target hidden`, !(await shown(page, `${t} [data-mock-hide]`)));
      ok(`mock ${id}: hint hidden`, !(await shown(page, `${t} [data-hint]`)));
      ok(`mock ${id}: solution hidden`, !(await shown(page, `${t} [data-solution]`)));
      ok(`mock ${id}: page title hidden`, !(await shown(page, 'h1#_top')));
      ok(`mock ${id}: skill-map box and page links hidden`, !(await shown(page, '.lcm-topic')) && !(await shown(page, '.pagination-links')));
      ok(`mock ${id}: "Edit page" link hidden`, !(await shown(page, 'footer a[href*="/edit/"]')));
      ok(`mock ${id}: no current page in the sidebar`, (await page.locator('nav.sidebar [aria-current="page"]').count()) === 0);
      ok(`mock ${id}: neutral browser tab title`, /^(Mock interview|Мок-интервью)/.test(await page.title()), await page.title());
      ok(`mock ${id}: Pause and reset hidden`, !(await shown(page, `${t} [data-timer="toggle"]`)) && !(await shown(page, `${t} [data-timer="reset"]`)));
      if (task.ask.length) {
        ok(`mock ${id}: the task's questions hidden`, !(await shown(page, `${t} [data-ask-list]`)));
        ok(`mock ${id}: "Your questions" box shown`, await shown(page, `${t} [data-ask-notes]`));
        await block(page, id).locator('[data-ask-notes]').fill('Which time zone?');
      }
      const hasWalk = await page.evaluate((i) => {
        const top = [...document.querySelector('.sl-markdown-content').children].find((c) => c.querySelector(`[data-lcp][data-id="${i}"]`));
        for (let n = top?.nextElementSibling; n; n = n.nextElementSibling) {
          if (n.matches('details.lcp-reveal')) return true;
          if (/^H[1-6]$/.test(n.tagName) || n.classList.contains('sl-heading-wrapper') || n.querySelector('[data-lcp]')) return false;
        }
        return false;
      }, id);
      ok(`mock ${id}: walkthrough hidden`, !(await shown(page, '.sl-markdown-content > details.lcp-reveal')));
      ok(`mock ${id}: table of contents hidden`, !(await shown(page, '.right-sidebar-container')));
      await page.waitForFunction((i) => document.querySelector(`[data-lcp][data-id="${i}"]`)?.lcpBlock?.editor, id, { timeout: 20000 });
      const code = () => page.evaluate((i) => document.querySelector(`[data-lcp][data-id="${i}"]`).lcpBlock.editor.get(), id);
      ok(`mock ${id}: the editor starts from the starter code`, (await code()) === task.template, (await code()).slice(0, 60));
      await page.waitForTimeout(2100);
      const before = await block(page, id).locator('[data-timer-display]').innerText();
      ok(`mock ${id}: timer runs`, /^00:0[1-9]$/.test(before), before);
      await page.reload({ waitUntil: 'load' });
      await page.locator('[data-mock-bar]').waitFor({ timeout: 20000 });
      await page.waitForTimeout(1100);
      const after = await block(page, id).locator('[data-timer-display]').innerText();
      ok(`mock ${id}: a reload keeps the clock`, after > before, `${before} → ${after}`);
      if (task.ask.length) ok(`mock ${id}: a reload keeps the typed questions`, (await block(page, id).locator('[data-ask-notes]').inputValue()) === 'Which time zone?');
      const restore = page.locator('[data-mock-restore]');
      ok(`mock ${id}: "Restore my draft" offered`, (await restore.count()) === 1);
      if (await restore.count()) {
        await restore.click();
        await page.waitForTimeout(200);
        ok(`mock ${id}: "Restore my draft" brings the draft back`, (await code()) === `-- my old draft ${id}`, (await code()).slice(0, 60));
      }
      if (P.sqlTasks[id]) {
        // A wrong answer: one row less than the reference. The missing row must not be shown.
        await setCode(page, id, `SELECT * FROM (\n${task.solution.trim().replace(/;$/, '')}\n) s OFFSET 1`);
        const w = await check(page, id);
        ok(`mock ${id}: a wrong answer fails`, !w.pass, w.text.slice(0, 160));
        ok(`mock ${id}: no expected values on a failed Check`, !/expected:|Missing, for example|ожидалось:|Не хватает/.test(w.text) && !(await block(page, id).locator('[data-show-expected]').count()), w.text.slice(0, 300));
      }
      await setCode(page, id, task.solution);
      const v = await check(page, id);
      ok(`mock ${id}: solution passes`, v.pass, v.text.slice(0, 160));
      await page.waitForTimeout(1300);
      ok(`mock ${id}: solution opens after the pass`, await shown(page, `${t} [data-solution]`));
      if (hasWalk) ok(`mock ${id}: walkthrough opens after the pass`, await shown(page, '.sl-markdown-content > details.lcp-reveal'));
      await page.locator('[data-mock-end]').click();
      ok(`mock ${id}: self-review shown, with the whole checklist`, (await page.locator('[data-mock-bar] input[type="checkbox"]').count()) === 9);
      ok(`mock ${id}: the self-review is not a pass banner`, (await page.locator('[data-mock-bar] .lcp-banner').getAttribute('class')).includes('lcp-review'));
      ok(`mock ${id}: page back to normal`, !(await page.evaluate(() => document.documentElement.classList.contains('lcp-mock'))));
      ok(`mock ${id}: the link leaves mock mode`, !new URL(page.url()).searchParams.has('mock'), page.url());
      if (task.ask.length) {
        ok(`mock ${id}: the task's questions open at the end`, await shown(page, `${t} [data-ask-list]`));
        ok(`mock ${id}: one "I asked this" box per question`, (await block(page, id).locator('[data-ask-tick]').count()) === task.ask.length);
      }
      ok(`mock ${id}: no console errors`, !errors.length, errors.join(' | ').slice(0, 300));
      await ctx.close();
    }

    // "Both": a SQL task, then a Python one; the clock of the whole mock is the sum.
    {
      const { page, ctx, errors } = await open('/start/mock-interview/');
      await page.locator('input[name="lcm-mock-kind"][value="both"]').check();
      await page.locator('[data-mock-start]').click();
      await page.waitForURL(/[?&]mock=/, { timeout: 20000 });
      const plan = JSON.parse(await page.evaluate(() => sessionStorage.getItem('lcm-mock')));
      const [a, b] = plan.queue.map((q) => q.id);
      const sum = mockMinutes(P.sqlTasks[a].target) + mockMinutes(P.pyTasks[b].target);
      ok('mock both: a SQL task, then a Python task', !!P.sqlTasks[a] && !!P.pyTasks[b], `${a}, ${b}`);
      await page.locator('[data-mock-bar]').waitFor({ timeout: 20000 });
      const clock = await page.locator('[data-mock-clock]').innerText();
      ok('mock both: task 1 of 2, the sum for the whole mock', clock.includes('1 of 2') && clock.includes(String(sum)), clock);
      await page.locator('[data-mock-end]').click();
      const next = page.locator('[data-mock-bar] a.lcp-btn-primary');
      ok('mock both: "Next task" goes to the Python task', ((await next.getAttribute('href')) ?? '').includes(`mock=${b}`));
      ok('mock both: no console errors', !errors.length, errors.join(' | ').slice(0, 300));
      await ctx.close();
    }

    // The picker follows the study plan; "Any task" lifts the filter.
    {
      const short = planPages('short');
      const { page, ctx, errors } = await open('/start/mock-interview/', { init: "try { localStorage.setItem('lcm-study-plan', 'short'); } catch {}" });
      ok('mock plan: the picker names the plan', /Short/.test(await page.locator('[data-mock-plan]').innerText()));
      const cfg = JSON.parse(await page.locator('[data-mock-cfg]').textContent());
      const outside = [...cfg.sql, ...cfg.py].filter((x) => !short.has(`/${x.page}`));
      ok('mock plan: some tasks are outside the short plan', outside.length > 0);
      let inside = true;
      for (let i = 0; i < 6; i++) {
        await page.goto(BASE + '/start/mock-interview/', { waitUntil: 'load' });
        await page.locator(`input[name="lcm-mock-kind"][value="${i % 2 ? 'py' : 'sql'}"]`).check();
        await page.locator('[data-mock-start]').click();
        await page.waitForURL(/[?&]mock=/, { timeout: 20000 });
        if (!short.has(sitePath(page.url()))) inside = false;
      }
      ok('mock plan: tasks come from the short plan', inside);
      ok('mock plan: no console errors', !errors.length, errors.join(' | ').slice(0, 300));
      await ctx.close();
      // With the random pick fixed on a task outside the plan, "Any task" reaches it.
      const k = cfg.sql.findIndex((x) => !short.has(`/${x.page}`));
      const fixed = `try { localStorage.setItem('lcm-study-plan', 'short'); Math.random = () => ${(k + 0.5) / cfg.sql.length}; } catch {}`;
      const any = await open('/start/mock-interview/', { init: fixed });
      await any.page.locator('[data-mock-any]').check();
      await any.page.locator('[data-mock-start]').click();
      await any.page.waitForURL(/[?&]mock=/, { timeout: 20000 });
      ok('mock plan: "Any task" picks outside the plan too', k >= 0 && new URL(any.page.url()).searchParams.get('mock') === cfg.sql[k].id, `${any.page.url()} (want ${cfg.sql[k]?.id})`);
      await any.ctx.close();
    }
    done();
  }

  // -------------------------------------------------------------- no JSPI: never solved when tests are skipped
  {
    const done = section('no JSPI');
    const id = Object.keys(P.pyTasks).find((k) => P.pyTasks[k].db && placed.get(k));
    if (id) {
      // Hide JSPI from the page and from the Python worker (init scripts do not reach workers, so the
      // worker is started from a wrapper that deletes it first and replays early messages).
      const init = () => {
        delete WebAssembly.Suspending;
        const W = window.Worker;
        window.Worker = function (url, opts) {
          const href = new URL(String(url), location.href).href;
          if (!/py-worker\.js/.test(href)) return new W(url, opts);
          const src = `delete WebAssembly.Suspending; const q = []; const early = (e) => q.push(e.data); self.addEventListener('message', early); await import(${JSON.stringify(href)}); self.removeEventListener('message', early); for (const d of q) self.onmessage && self.onmessage({ data: d });`;
          return new W(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })), { ...opts, type: 'module' });
        };
      };
      const { page, ctx, errors } = await open(placed.get(id).page, { init });
      await block(page, id).scrollIntoViewIfNeeded();
      ok(`${id} without JSPI: warning on load`, (await block(page, id).locator('[data-verdict]').innerText()).includes('Chrome'));
      await setCode(page, id, P.pyTasks[id].solution);
      const v = await check(page, id);
      ok(`${id} without JSPI: not marked as passed`, !v.pass && v.text.includes('Not checked'), v.text.slice(0, 200));
      const solved = await page.evaluate((i) => {
        try {
          return !!JSON.parse(localStorage.getItem('lcm-progress') || '{}').activities?.[`ex:${i}`];
        } catch {
          return false;
        }
      }, id);
      ok(`${id} without JSPI: not saved as solved`, !solved);
      ok(`${id} without JSPI: no console errors`, !errors.length, errors.join(' | ').slice(0, 300));
      await ctx.close();
    } else ok('a Python task with database tests exists', false);
    done();
  }
}

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${results.length - bad}/${results.length} checks passed`);
process.exit(bad ? 1 : 0);
