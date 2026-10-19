// Renders the link-preview images (Open Graph) shown when a page is shared in a messenger or
// a social network: public/og/og-en.jpg and public/og/og-ru.jpg, 1200×630.
// Left: the logo, the title and what is inside. Right: an editor panel with a query, its result
// and a passed check, drawn in HTML (no screenshot needed). The numbers come from the exercise
// files and src/data/generated/practice.json, so re-run this after adding exercises.
//
// Run: npm run og-images   (needs a Chromium for Playwright; set PW_CHROMIUM to use a system one)
import { mkdirSync, readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const file = (p) => pathToFileURL(join(root, p)).href;
const data = async (f) => import(pathToFileURL(join(root, 'src/data/practice', f)).href);
const { sqlDrills } = await data('sql-drills.ts');
const { pyDrills } = await data('py-drills.ts');
const { traps } = await data('traps.ts');
const { sqlTasks } = await data('sql-tasks.ts');
const { pyTasks } = await data('py-tasks.ts');
const drills = sqlDrills.length + pyDrills.length;
const tasks = sqlTasks.length + pyTasks.length;
// The query in the panel is the drill s-left-zero (products with their refunds, zeros included).
const shown = JSON.parse(readFileSync(join(root, 'src/data/generated/practice.json'), 'utf8')).sqlDrills['s-left-zero'].expected;
const rows = [...shown.sample.slice(0, 2), shown.sample.find((r) => r[1] === 0)];
// Russian noun after a number: 1 упражнение, 2 упражнения, 5 упражнений (11–14 take the last form).
const ru = (n, one, few, many) => {
  const d = n % 10, h = n % 100;
  const word = d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
  return `${n} ${word}`;
};

const TEXT = {
  en: {
    title: 'Live Coding Map',
    sub: 'SQL and Python interviews, practised in the browser',
    facts: `${drills} drills, ${traps.length} traps, ${tasks} interview tasks<br>and a skill map`,
    check: `Check passed: ${shown.n} rows, edge cases too`,
  },
  ru: {
    title: 'Карта лайвкодинга',
    sub: 'Интервью по SQL и Python: практика прямо в браузере',
    facts: `${ru(drills, 'упражнение', 'упражнения', 'упражнений')}, ${ru(traps.length, 'ловушка', 'ловушки', 'ловушек')}, ${ru(tasks, 'задача', 'задачи', 'задач')}<br>и карта навыков`,
    check: `Совпало: ${ru(shown.n, 'строка', 'строки', 'строк')}, и на граничных данных`,
  },
};

const fonts = (name) => `node_modules/@fontsource-variable/${name}/files`;
const css = `
@font-face { font-family: Onest; font-weight: 100 900; src: url(${file(`${fonts('onest')}/onest-latin-wght-normal.woff2`)}) format('woff2');
  unicode-range: U+0000-00FF, U+2013, U+2014, U+2019; }
@font-face { font-family: Onest; font-weight: 100 900; src: url(${file(`${fonts('onest')}/onest-cyrillic-wght-normal.woff2`)}) format('woff2');
  unicode-range: U+0400-04FF; }
@font-face { font-family: Mono; font-weight: 100 800; src: url(${file(`${fonts('jetbrains-mono')}/jetbrains-mono-latin-wght-normal.woff2`)}) format('woff2'); }
* { margin: 0; box-sizing: border-box; }
html, body { width: 1200px; height: 630px; overflow: hidden; background: #0f1420; }
body { position: relative; font-family: Onest, sans-serif; color: #e5e9f2; }
.text { position: absolute; left: 64px; top: 60px; bottom: 60px; width: 540px; display: flex; flex-direction: column; }
.logo { width: 64px; height: 64px; }
h1 { margin-top: 36px; font-size: 76px; line-height: 1; font-weight: 700; letter-spacing: -0.02em; color: #fff; }
.sub { margin-top: 22px; font-size: 34px; line-height: 1.22; font-weight: 500; color: #7c9cff; }
.facts { margin-top: auto; font-size: 29px; line-height: 1.3; color: #c2c9d9; }
.panel { position: absolute; left: 636px; top: 48px; width: 508px; border: 1px solid #2f3a52; border-radius: 14px;
  background: #141a28; overflow: hidden; box-shadow: 0 24px 60px rgb(0 0 0 / 0.35); }
.bar { display: flex; gap: 8px; padding: 14px 16px; border-bottom: 1px solid #2f3a52; }
.bar i { width: 12px; height: 12px; border-radius: 50%; background: #2f3a52; }
pre { font-family: Mono, monospace; font-variant-ligatures: none; font-size: 17.5px; line-height: 1.55; padding: 18px 22px; color: #c2c9d9; white-space: pre; }
.k { color: #7c9cff; font-weight: 650; }
.s { color: #f2b84b; }
table { width: calc(100% - 44px); margin: 0 22px; border-collapse: collapse; font-family: Mono, monospace; font-variant-ligatures: none; font-size: 17px; }
th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #1b2232; }
th { color: #8b96ae; font-weight: 500; }
td.n { text-align: right; }
th.n { text-align: right; }
.ok { margin: 16px 22px 20px; padding: 10px 14px; border: 1.5px solid #7c9cff; border-radius: 8px; color: #d4defd;
  font-size: 18px; background: #1a2550; }
.ok b { margin-right: 8px; }
`;

const page = (lang) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="text">
  <img class="logo" src="${file('src/assets/logo.svg')}" alt="">
  <h1>${TEXT[lang].title}</h1>
  <div class="sub">${TEXT[lang].sub}</div>
  <div class="facts">${TEXT[lang].facts}</div>
</div>
<div class="panel">
  <div class="bar"><i></i><i></i><i></i></div>
<pre><span class="k">SELECT</span> p.id, <span class="k">COUNT</span>(t.transaction_id)
<span class="k">FROM</span> products p
<span class="k">LEFT JOIN</span> transactions t
       <span class="k">ON</span> t.product_id = p.id
      <span class="k">AND NOT</span> t.is_test
      <span class="k">AND</span> t.refunded_at <span class="k">IS NOT NULL</span>
      <span class="k">AND</span> t.start_time >= <span class="s">'2026-09-01'</span>
      <span class="k">AND</span> t.start_time <  <span class="s">'2026-10-01'</span>
<span class="k">GROUP BY</span> p.id;</pre>
  <table>
    <tr><th>id</th><th class="n">count</th></tr>
${rows.map(([id, n]) => `    <tr><td>${id}</td><td class="n">${n}</td></tr>`).join('\n')}
  </table>
  <div class="ok"><b>✓</b>${TEXT[lang].check}</div>
</div></body></html>`;

const out = join(root, 'public/og');
mkdirSync(out, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'og-'));
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  for (const lang of Object.keys(TEXT)) {
    const html = join(tmp, `${lang}.html`);
    writeFileSync(html, page(lang));
    await tab.goto(pathToFileURL(html).href, { waitUntil: 'load' });
    await tab.evaluate(() => document.fonts.ready);
    // JPEG keeps the file small: some messengers skip preview images over ~300 KB.
    await tab.screenshot({ path: join(out, `og-${lang}.jpg`), type: 'jpeg', quality: 90 });
    console.log(`public/og/og-${lang}.jpg`);
  }
} finally {
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
}
