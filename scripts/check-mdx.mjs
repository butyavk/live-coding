#!/usr/bin/env node
// Quick self-check for content files without running a full Astro build.
// Usage: node scripts/check-mdx.mjs src/content/docs/fundamentals/*.mdx src/content/docs/ru/fundamentals/*.mdx
// Checks: MDX compiles, frontmatter has title/description/sidebar.order,
// internal links point to pages that exist in scripts/pages.json, EN/RU twin exists,
// practice ids (<Drill id>, <Trap id>, <Task id>) exist and are not placed twice in one language.
// With every page passed (npm run check:content) it also checks that every id is placed.
import { compile } from '@mdx-js/mdx';
import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'yaml';
import path from 'node:path';

const pages = JSON.parse(readFileSync(new URL('./pages.json', import.meta.url), 'utf8'));
const known = new Set(['/']);
for (const [dir, slugs] of Object.entries(pages)) for (const s of slugs) known.add(`/${dir}/${s}/`);

const data = (f) => import(new URL(`../src/data/practice/${f}`, import.meta.url).href);
const practice = {
  Drill: new Set([...(await data('sql-drills.ts')).sqlDrills, ...(await data('py-drills.ts')).pyDrills].map((d) => d.id)),
  Trap: new Set((await data('traps.ts')).traps.map((d) => d.id)),
  Task: new Set([...(await data('sql-tasks.ts')).sqlTasks, ...(await data('py-tasks.ts')).pyTasks].map((d) => d.id)),
};
const placed = { en: new Map(), ru: new Map() };

const files = process.argv.slice(2);
if (!files.length) { console.error('Pass one or more .mdx files'); process.exit(2); }
let failed = 0;
for (const f of files) {
  const problems = [];
  const src = readFileSync(f, 'utf8');
  const fm = src.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) problems.push('missing frontmatter');
  else {
    let data = {};
    try { data = parse(fm[1]) || {}; } catch (e) { problems.push('frontmatter YAML: ' + e.message); }
    if (!data.title) problems.push('frontmatter: missing title');
    if (!data.description) problems.push('frontmatter: missing description');
    if (!(data.sidebar && typeof data.sidebar.order === 'number') && !f.endsWith('index.mdx')) problems.push('frontmatter: missing sidebar.order');
  }
  try {
    await compile(src.replace(/^---\n[\s\S]*?\n---\n/, ''), { format: 'mdx' });
  } catch (e) {
    problems.push(`MDX syntax: ${e.message} (line ${e.line ?? e.place?.line ?? '?'})`);
  }
  // Internal links: markdown [x](/a/b/) and href="/a/b/"
  const body = src.replace(/```[\s\S]*?```/g, '');
  const links = [...body.matchAll(/\]\((\/[^)\s#]*)(#[^)\s]*)?\)/g), ...body.matchAll(/href=["'](\/[^"'#]*)(#[^"']*)?["']/g)].map((m) => m[1]);
  for (const l of links) {
    if (l.startsWith('/ru/')) { problems.push(`link ${l}: do not add /ru/ — the build adds the locale prefix`); continue; }
    if (!l.endsWith('/')) problems.push(`link ${l}: must end with a trailing slash`);
    else if (!known.has(l)) problems.push(`link ${l}: no such page in scripts/pages.json`);
  }
  // Practice ids
  const lang = f.replaceAll('\\', '/').includes('/docs/ru/') ? 'ru' : 'en';
  for (const m of src.matchAll(/<(Drill|Trap|Task)\s+id=["']([^"']+)["']/g)) {
    const [, kind, id] = m;
    if (!practice[kind].has(id)) problems.push(`<${kind} id="${id}">: no such ${kind.toLowerCase()} in src/data/practice/`);
    const where = placed[lang].get(id);
    if (where) problems.push(`<${kind} id="${id}"> is already placed in ${where}`);
    placed[lang].set(id, f);
  }
  // Twin check
  const norm = f.replaceAll('\\', '/');
  const twin = norm.includes('/docs/ru/') ? norm.replace('/docs/ru/', '/docs/') : norm.replace('/docs/', '/docs/ru/');
  if (!existsSync(twin)) problems.push(`translation twin missing: ${twin}`);
  if (problems.length) { failed++; console.log(`✗ ${f}\n  - ${problems.join('\n  - ')}`); }
  else console.log(`✓ ${f}`);
}
// When every page was passed, every exercise must be placed in both languages.
const all = files.length >= Object.values(pages).flat().length * 2;
if (all) {
  for (const [kind, ids] of Object.entries(practice))
    for (const id of ids)
      for (const lang of ['en', 'ru'])
        if (!placed[lang].has(id)) { failed++; console.log(`✗ <${kind} id="${id}"> is not placed on any ${lang === 'en' ? 'English' : 'Russian'} page`); }
}
process.exit(failed ? 1 : 0);
