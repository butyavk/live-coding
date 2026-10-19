// PostgreSQL (PGlite) in a worker, so a slow query never freezes the page and can be stopped.
// Messages: { type: "run", id, sql, schema? } (schema "edge" runs on the hidden edge-case copy),
// { type: "query", id, sql, params } for Python's db.py. Every run is rolled back.
import { PGlite } from "./pglite/index.js";
import { loadData, PARSERS } from "./pg-setup.js";

const base = new URL(".", import.meta.url);
const file = (p) => new URL(p, base);
let db = null;

async function init() {
  const t0 = performance.now();
  const [wasm, initdbWasm, fsBundle] = await Promise.all([
    fetch(file("pglite/pglite.wasm")).then((r) => r.arrayBuffer()),
    fetch(file("pglite/initdb.wasm")).then((r) => r.arrayBuffer()),
    fetch(file("pglite/pglite.data")).then((r) => r.blob()),
  ]);
  const [pgliteWasmModule, initdbWasmModule] = await Promise.all([
    WebAssembly.compile(wasm),
    WebAssembly.compile(initdbWasm),
  ]);
  db = await PGlite.create({ pgliteWasmModule, initdbWasmModule, fsBundle, parsers: PARSERS });
  await loadData(db, async (t) => (await fetch(file(`data/${t}.csv`))).blob());
  // Hidden edge-case copy of the data in schema `edge` (see edge.sql). Check runs answers there too.
  let edge = false;
  try {
    const r = await fetch(file("edge.sql"));
    if (r.ok) {
      await db.exec(await r.text());
      edge = true;
    }
  } catch (_) {
    /* without it Check compares on the practice data only */
  }
  const v = (await db.query("SHOW server_version")).rows[0].server_version;
  postMessage({ type: "ready", ms: Math.round(performance.now() - t0), version: v, edge });
}

async function run(id, sql, schema) {
  const t0 = performance.now();
  let results = [];
  let error = null;
  try {
    await db.exec("BEGIN");
    if (schema === "edge") await db.exec("SET LOCAL search_path TO edge");
    const res = await db.exec(sql, { rowMode: "array" });
    results = res.map((r) => ({
      fields: (r.fields || []).map((f) => ({ name: f.name, typeId: f.dataTypeID })),
      rows: r.rows || [],
      affected: r.affectedRows ?? null,
    }));
  } catch (e) {
    error = {
      message: String(e && e.message || e),
      position: e && e.position ? Number(e.position) : null,
      hint: e && e.hint || null,
      detail: e && e.detail || null,
      code: e && e.code || null,
    };
  } finally {
    try { await db.exec("ROLLBACK"); } catch (_) { /* nothing open */ }
  }
  postMessage({ type: "result", id, results, error, ms: Math.round(performance.now() - t0) });
}

// For Python: one statement with $1, $2 … parameters (or a plain script without them); last result only.
async function query(id, sql, params) {
  let out;
  try {
    await db.exec("BEGIN");
    let r;
    if (params && params.length) r = await db.query(sql, params, { rowMode: "array" });
    else {
      const res = await db.exec(sql, { rowMode: "array" });
      r = [...res].reverse().find((x) => x.fields && x.fields.length) || { fields: [], rows: [] };
    }
    out = { fields: (r.fields || []).map((f) => ({ name: f.name, typeId: f.dataTypeID })), rows: r.rows || [] };
  } catch (e) {
    out = { error: { message: String(e && e.message || e), hint: e && e.hint || null, position: e && e.position ? Number(e.position) : null } };
  } finally {
    try { await db.exec("ROLLBACK"); } catch (_) { /* nothing open */ }
  }
  postMessage({ type: "qres", id, json: JSON.stringify(out, (k, v) => (typeof v === "bigint" ? v.toString() : v)) });
}

onmessage = (e) => {
  const m = e.data || {};
  if (m.type === "run") run(m.id, m.sql, m.schema);
  else if (m.type === "query") query(m.id, m.sql, m.params);
};

init().catch((e) => postMessage({ type: "fail", message: String(e && e.stack || e) }));
