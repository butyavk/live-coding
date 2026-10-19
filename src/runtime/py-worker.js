// CPython (Pyodide) in a worker: a long or endless loop never freezes the page and can be stopped
// (the page terminates the worker). Messages from the page:
//   { type: "init", files }            load Python, write the shared files (runner, pytest stand-in, db.py)
//   { type: "write", files }           write more files (a task's tests) before a check
//   { type: "run", id, task, code }    execute code as __main__ (task "" = a scratch file)
//   { type: "check", id, task, code, test }  run tests/<test>.py against tasks/<task>.py = code
//   { type: "sqlres", qid, json }      answer to a database call made from Python (db.py)
// Replies: ready / fail / out (streamed stdout and stderr) / result / sql (a query for the page).
import { loadPyodide } from "./pyodide/pyodide.mjs";

const base = new URL(".", import.meta.url);
const file = (p) => new URL(p, base).href;
let py = null;
let lc = null;

// ---- output: streamed to the page while the code runs
const dec = new TextDecoder();
let buf = "", total = 0, last = 0, cut = false;
const LIMIT = 200000;
function flush(force) {
  if (!buf) return;
  const now = performance.now();
  if (force || now - last > 80 || buf.length > 8000) { postMessage({ type: "out", text: buf }); buf = ""; last = now; }
}
function write(bytes) {
  const s = dec.decode(bytes, { stream: true });
  if (cut) return bytes.length;
  total += s.length;
  if (total > LIMIT) {
    cut = true;
    buf += s.slice(0, Math.max(0, s.length - (total - LIMIT))) + "\n… output truncated: more than 200,000 characters\n";
    flush(true);
    return bytes.length;
  }
  buf += s; flush(false);
  return bytes.length;
}

// ---- SQL from Python goes through the page to the PostgreSQL worker
let qseq = 0;
const waiting = new Map();
self.lcSql = (sql, params) => new Promise((resolve) => {
  const qid = ++qseq;
  waiting.set(qid, resolve);
  postMessage({ type: "sql", qid, sql, params: JSON.parse(params) });
});

// Compile from bytes: does not depend on the server sending .wasm as application/wasm.
WebAssembly.instantiateStreaming = async (resp, imports) => WebAssembly.instantiate(await (await resp).arrayBuffer(), imports);

function writeFiles(files) {
  for (const [path, text] of Object.entries(files || {})) {
    py.FS.mkdirTree(path.slice(0, path.lastIndexOf("/")));
    py.FS.writeFile(path, text);
  }
}

async function init(files) {
  const t0 = performance.now();
  py = await loadPyodide({
    indexURL: file("pyodide/"),
    stdLibURL: file("pyodide/python_stdlib.zip"),
    lockFileURL: file("pyodide/pyodide-lock.json"),
    stdin: () => null,
  });
  py.setStdout({ write, isatty: true });
  py.setStderr({ write, isatty: true });
  writeFiles(files);
  py.runPython(`
import sys
sys.path[:0] = ["/home/pyodide/lc", "/home/pyodide/lc/tests", "/home/pyodide/lc/_lc"]
sys.dont_write_bytecode = True
import os; os.chdir("/home/pyodide/lc")
import _lc
`);
  lc = py.pyimport("_lc");
  const version = py.runPython("import sys; sys.version.split()[0]");
  const jspi = typeof WebAssembly.Suspending === "function";
  postMessage({ type: "ready", ms: Math.round(performance.now() - t0), version, jspi });
}

async function call(id, fn, args) {
  buf = ""; total = 0; cut = false; last = 0;
  let json = null, error = null;
  try {
    const f = lc[fn];
    // callPromising lets db.connect().execute() wait for PostgreSQL (WebAssembly JSPI); else a plain call.
    json = typeof WebAssembly.Suspending === "function" && f.callPromising ? await f.callPromising(...args) : f(...args);
    f.destroy && f.destroy();
  } catch (e) {
    error = String((e && e.message) || e);
  }
  try { py.runPython("import sys; sys.stdout.flush(); sys.stderr.flush()"); } catch (_) { /* ignore */ }
  flush(true);
  postMessage({ type: "result", id, json, error });
}

onmessage = (e) => {
  const m = e.data || {};
  if (m.type === "init") init(m.files).catch((err) => postMessage({ type: "fail", message: String((err && err.stack) || err) }));
  else if (m.type === "write") writeFiles(m.files);
  else if (m.type === "run") call(m.id, "run", [m.task || "", m.code]);
  else if (m.type === "check") call(m.id, "check", [m.task, m.code, m.test]);
  else if (m.type === "sqlres") { const r = waiting.get(m.qid); if (r) { waiting.delete(m.qid); r(m.json); } }
};
