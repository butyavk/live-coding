#!/usr/bin/env node
// Puts everything the in-browser practice needs into public/runtime/ (git-ignored):
//   pglite/   PostgreSQL compiled to WebAssembly (from @electric-sql/pglite)
//   pyodide/  CPython compiled to WebAssembly (from pyodide)
//   data/     the practice dataset (from exercises/data/csv)
//   *.js, py/ the workers and the Python runner (from src/runtime)
//   edge.sql  the hidden edge-case data Check also runs SQL answers on
// Runs before `npm run dev` and `npm run build`. Everything is served from this site:
// no third-party CDN, and a local clone works offline.
import { cpSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = `${root}public/runtime/`;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const copy = (from, to, filter = () => true) => {
  if (!existsSync(from)) throw new Error(`copy-runtimes: ${from} not found (run npm install)`);
  mkdirSync(to, { recursive: true });
  for (const f of readdirSync(from)) if (filter(f)) cpSync(`${from}/${f}`, `${to}/${f}`, { recursive: true });
};

const pglite = `${root}node_modules/@electric-sql/pglite/dist`;
copy(pglite, `${out}pglite`, (f) => /^(index\.js|chunk-[\w-]+\.js|pglite\.(js|wasm|data)|initdb\.(js|wasm))$/.test(f));
// Licences travel with the redistributed files.
cpSync(`${root}node_modules/@electric-sql/pglite/LICENSE`, `${out}pglite/LICENSE`);
cpSync(`${root}src/runtime/licenses/pglite-notice.txt`, `${out}pglite/NOTICE.txt`);

const pyodide = `${root}node_modules/pyodide`;
copy(pyodide, `${out}pyodide`, (f) => /^(pyodide\.mjs|pyodide\.asm\.(mjs|wasm)|pyodide-lock\.json|python_stdlib\.zip)$/.test(f));
cpSync(`${root}src/runtime/licenses/pyodide.txt`, `${out}pyodide/LICENSE.txt`);

copy(`${root}exercises/data/csv`, `${out}data`, (f) => f.endsWith('.csv'));
copy(`${root}src/runtime`, out, (f) => f.endsWith('.js') || f.endsWith('.sql') || f === 'py');
// Python task tests run in the browser as they are; some compare with a SQL reference.
copy(`${root}exercises/tests`, `${out}tests`, (f) => /^test_[pd]\d\d_\w+\.py$/.test(f));
copy(`${root}exercises/solutions/sql`, `${out}solutions/sql`, (f) => f.endsWith('.sql'));

console.log(`✓ runtimes copied to ${out}`);
