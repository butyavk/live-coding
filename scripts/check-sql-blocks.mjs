#!/usr/bin/env node
// Runs every ```sql block of the given pages on the practice dataset (PGlite) and reports the ones
// that fail. Some blocks fail on purpose (they show an error); the report says which block and why,
// so a writer can tell a deliberate error from a broken example.
// Usage: node scripts/check-sql-blocks.mjs src/content/docs/sql/*.mdx
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { loadData, PARSERS } from '../src/runtime/pg-setup.js';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Pass one or more .mdx files');
  process.exit(2);
}
const root = fileURLToPath(new URL('../', import.meta.url));
const db = await PGlite.create({ parsers: PARSERS });
await loadData(db, async (t) => new Blob([readFileSync(`${root}exercises/data/csv/${t}.csv`)]));
let failed = 0;
let total = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/```sql[^\n]*\n([\s\S]*?)```/g)) {
    total++;
    const line = src.slice(0, m.index).split('\n').length;
    try {
      await db.exec('BEGIN');
      await db.exec(m[1]);
    } catch (e) {
      failed++;
      console.log(`✗ ${f}:${line}  ${e.message.split('\n')[0]}`);
    } finally {
      await db.exec('ROLLBACK').catch(() => {});
    }
  }
}
console.log(`${total} SQL blocks, ${failed} failed (some may fail on purpose)`);
