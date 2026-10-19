#!/usr/bin/env node
// Runs SQL on the practice dataset with real PostgreSQL (PGlite) and prints the result as a
// Markdown table: handy for writing pages, where every number must come from a real run.
// Usage:  node scripts/sql.mjs "SELECT channel, COUNT(*) FROM transactions GROUP BY channel"
//         node scripts/sql.mjs path/to/query.sql
// Every run is wrapped in BEGIN … ROLLBACK, so CREATE TABLE and INSERT are safe (the script's own
// BEGIN … COMMIT becomes a savepoint, as on the site).
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { inOneTransaction, loadData, PARSERS } from '../src/runtime/pg-setup.js';

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node scripts/sql.mjs "<SQL>" | file.sql');
  process.exit(2);
}
const sql = existsSync(arg) ? readFileSync(arg, 'utf8') : arg;
const root = fileURLToPath(new URL('../', import.meta.url));
const db = await PGlite.create({ parsers: PARSERS });
await loadData(db, async (t) => new Blob([readFileSync(`${root}exercises/data/csv/${t}.csv`)]));
const cell = (v) => (v === null ? 'NULL' : String(v).replace(/\|/g, '\\|'));
try {
  await db.exec('BEGIN');
  const res = await db.exec(inOneTransaction(sql).sql, { rowMode: 'array' });
  for (const r of res) {
    if (!r.fields?.length) continue;
    console.log(`| ${r.fields.map((f) => f.name).join(' | ')} |`);
    console.log(`|${r.fields.map(() => ' --- ').join('|')}|`);
    for (const row of r.rows.slice(0, 200)) console.log(`| ${row.map(cell).join(' | ')} |`);
    console.log(`\n(${r.rows.length} rows)\n`);
  }
} catch (e) {
  console.log(`ERROR: ${e.message}${e.hint ? `\nHINT: ${e.hint}` : ''}`);
  process.exitCode = 1;
} finally {
  await db.exec('ROLLBACK').catch(() => {});
}
