#!/usr/bin/env node
// Records the demo GIF for the README (.github/readme/demo.gif): a drill on the built site, a
// query with an inner JOIN fails Check, "LEFT " is typed in, Check passes (also on the hidden
// edge-case data). Playwright takes the frames, Pillow (python3) assembles the GIF.
//
// Usage: npm run build && npx astro preview &   then   node scripts/make-demo-gif.mjs
// BASE overrides the address (default http://localhost:4321/live-coding); PW_CHROMIUM points
// to a Chromium binary when Playwright's own build is not installed.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4321/live-coding';
const root = new URL('..', import.meta.url).pathname;
const out = join(root, '.github/readme/demo.gif');
const ID = 's-left-zero';
const WRONG = `SELECT p.id AS product_id, COUNT(t.transaction_id) AS refunds
FROM products p
JOIN transactions t
       ON t.product_id = p.id
      AND NOT t.is_test
      AND t.refunded_at IS NOT NULL
      AND t.start_time >= TIMESTAMP '2026-09-01'
      AND t.start_time <  TIMESTAMP '2026-10-01'
GROUP BY p.id
ORDER BY refunds DESC, p.id;`;

const tmp = mkdtempSync(join(tmpdir(), 'demo-gif-'));
const frames = [];
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const ctx = await browser.newContext({ viewport: { width: 780, height: 1000 }, colorScheme: 'dark', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/sql/left-join-and-zeros/`, { waitUntil: 'load' });
  const block = page.locator(`[data-lcp][data-id="${ID}"]`);
  await block.scrollIntoViewIfNeeded();
  await page.waitForFunction((i) => document.querySelector(`[data-lcp][data-id="${i}"]`)?.lcpBlock?.editor, ID, { timeout: 30000 });
  // Warm the database up first, so the recording does not show the download.
  await page.evaluate((i) => document.querySelector(`[data-lcp][data-id="${i}"]`).lcpBlock.editor.set('SELECT 1;'), ID);
  await block.locator('[data-act="run"]').click();
  await block.locator('[data-out] table').first().waitFor({ timeout: 120000 });
  await block.locator('[data-act="reset"]').click();
  await page.evaluate((i) => {
    const r = document.querySelector(`[data-lcp][data-id="${i}"]`);
    r.querySelector('[data-out]').replaceChildren();
    r.querySelector('[data-verdict]').replaceChildren();
    r.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -12);
  }, ID);
  const set = (code) => page.evaluate(([i, c]) => document.querySelector(`[data-lcp][data-id="${i}"]`).lcpBlock.editor.set(c), [ID, code]);
  const box = await block.boundingBox();
  const clip = { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: 700 };
  const snap = async (ms) => {
    const path = join(tmp, `${String(frames.length).padStart(3, '0')}.png`);
    await page.screenshot({ path, clip });
    frames.push({ path, ms });
  };
  const check = async (hold) => {
    await block.locator('[data-act="check"]').click();
    await page.waitForFunction((i) => !document.querySelector(`[data-lcp][data-id="${i}"] [data-act="check"]`).disabled, ID, { timeout: 60000 });
    await page.waitForTimeout(150);
    await snap(hold);
  };

  await snap(900);
  // The wrong query appears line by line.
  const lines = WRONG.split('\n');
  for (let n = 1; n <= lines.length; n++) {
    await set(lines.slice(0, n).join('\n'));
    await snap(n === lines.length ? 1200 : 140);
  }
  await check(3200);
  // The fix: LEFT JOIN, typed letter by letter.
  const fix = 'LEFT ';
  for (let k = 1; k <= fix.length; k++) {
    await set(WRONG.replace('\nJOIN transactions', `\n${fix.slice(0, k)}JOIN transactions`));
    await snap(k === fix.length ? 900 : 130);
  }
  await check(3800);
} finally {
  await browser.close();
}

writeFileSync(join(tmp, 'frames.json'), JSON.stringify(frames));
mkdirSync(join(root, '.github/readme'), { recursive: true });
// Pillow: one shared palette for all frames keeps the colours stable and the file small.
const py = `
import json, sys
from PIL import Image
frames = json.load(open(sys.argv[1]))
imgs = [Image.open(f["path"]).convert("RGB") for f in frames]
h = max(i.height for i in imgs)
strip = Image.new("RGB", (imgs[0].width, h * len(imgs)))
for n, i in enumerate(imgs):
    strip.paste(i, (0, n * h))
palette = strip.quantize(colors=96, method=Image.Quantize.MEDIANCUT)
out = [i.quantize(palette=palette, dither=Image.Dither.NONE) for i in imgs]
out[0].save(sys.argv[2], save_all=True, append_images=out[1:], duration=[f["ms"] for f in frames], loop=0, optimize=True, disposal=1)
`;
execFileSync('python3', ['-c', py, join(tmp, 'frames.json'), out], { stdio: 'inherit' });
rmSync(tmp, { recursive: true, force: true });
console.log(`${out}: ${frames.length} frames`);
