// Shared by the browser worker and the build script: same tables, same parsers, same normalisation.

export const SCHEMA = {
  merchants: `id TEXT PRIMARY KEY, name TEXT, country TEXT, advances_enrolled_at TIMESTAMP`,
  products: `id TEXT PRIMARY KEY, merchant_id TEXT, name TEXT`,
  transactions: `transaction_id TEXT, original_transaction_id TEXT, customer_id TEXT,
    product_id TEXT, plan_id TEXT, plan_period TEXT, channel TEXT, is_trial BOOLEAN,
    is_trial_conversion BOOLEAN, renewal_number INTEGER, start_time TIMESTAMP, end_time TIMESTAMP,
    charged_usd NUMERIC(12,2), revenue_usd NUMERIC(12,2), fee_rate NUMERIC(5,4),
    refunded_at TIMESTAMP, is_test BOOLEAN, country TEXT`,
  webhook_events: `event_id TEXT, type TEXT, customer_id TEXT, product_id TEXT, transaction_id TEXT,
    occurred_at TIMESTAMP, received_at TIMESTAMP`,
  channel_payouts: `payout_id TEXT, merchant_id TEXT, channel TEXT, period_month DATE,
    amount_usd NUMERIC(12,2), paid_at TIMESTAMP`,
  advances: `advance_id TEXT, merchant_id TEXT, channel TEXT, period_month DATE,
    amount_usd NUMERIC(12,2), fee_usd NUMERIC(12,2), idempotency_key TEXT, created_at TIMESTAMP`,
  ledger_entries: `entry_id TEXT, merchant_id TEXT, advance_id TEXT, entry_type TEXT,
    amount_usd NUMERIC(12,2), created_at TIMESTAMP`,
};

// Dates, timestamps and intervals come back as PostgreSQL prints them ("2026-09-01 00:00:00"), not as JS Dates.
const raw = (v) => v;
export const PARSERS = { 1082: raw, 1083: raw, 1114: raw, 1184: raw, 1186: raw, 1266: raw };

export async function loadData(db, readCsv) {
  await db.exec("SET TimeZone = 'UTC'");
  for (const [table, cols] of Object.entries(SCHEMA)) {
    await db.exec(`CREATE TABLE ${table} (${cols})`);
    const blob = await readCsv(table);
    await db.query(`COPY ${table} FROM '/dev/blob' WITH (FORMAT csv, HEADER true, NULL '')`, [], { blob });
  }
  await db.exec("ANALYZE");
}

const NUMERIC_TYPES = new Set([20, 21, 23, 26, 700, 701, 1700]);
const TIMESTAMP_TYPES = new Set([1114, 1184]);
const MIDNIGHT = / 00:00:00(?:\+00(?::00)?)?$/;

/**
 * One cell as a comparable value: numbers rounded to 3 decimals, everything else as text. A
 * timestamp exactly at midnight counts as its date ("2026-09-01 00:00:00" is "2026-09-01"), so
 * date_trunc('month', …) or a generate_series of timestamps matches a DATE column.
 */
export function normCell(v, typeId) {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number" || typeof v === "bigint") return Math.round(Number(v) * 1000) / 1000;
  if (NUMERIC_TYPES.has(typeId)) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : String(v);
  }
  if (TIMESTAMP_TYPES.has(typeId)) return String(v).replace(MIDNIGHT, "");
  return String(v);
}

export function normRows(rows, types) {
  return rows.map((r) => r.map((v, i) => normCell(v, types[i])));
}

/**
 * The statements of a script, split at the semicolons outside strings, quoted names, comments and
 * dollar-quoted bodies: { code, end }, where `code` is the index of the first character that is not
 * a space or a comment and `end` the index of the semicolon (or the length of the text).
 */
function statements(sql) {
  const out = [];
  const n = sql.length;
  let code = -1;
  let i = 0;
  while (i < n) {
    const c = sql[i];
    if (c === '-' && sql[i + 1] === '-') {
      const j = sql.indexOf('\n', i);
      i = j < 0 ? n : j + 1;
      continue;
    }
    if (c === '/' && sql[i + 1] === '*') {
      let depth = 1;
      i += 2;
      while (i < n && depth) {
        if (sql.startsWith('/*', i)) depth++;
        else if (sql.startsWith('*/', i)) depth--;
        else {
          i++;
          continue;
        }
        i += 2;
      }
      continue;
    }
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === ';') {
      if (code >= 0) out.push({ code, end: i });
      code = -1;
      i++;
      continue;
    }
    if (code < 0) code = i;
    if (c === "'") {
      const backslash = /[eE]/.test(sql[i - 1] ?? '') && !/[A-Za-z0-9_$]/.test(sql[i - 2] ?? '');
      i++;
      while (i < n) {
        if (backslash && sql[i] === '\\') i += 2;
        else if (sql[i] === "'" && sql[i + 1] === "'") i += 2;
        else if (sql[i] === "'") break;
        else i++;
      }
      i++;
    } else if (c === '"') {
      const j = sql.indexOf('"', i + 1);
      i = j < 0 ? n : j + 1;
    } else if (c === '$' && !/[A-Za-z0-9_$]/.test(sql[i - 1] ?? '') && /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.test(sql.slice(i, i + 65))) {
      const tag = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 65))[0];
      const j = sql.indexOf(tag, i + tag.length);
      i = j < 0 ? n : j + tag.length;
    } else i++;
  }
  if (code >= 0) out.push({ code, end: n });
  return out;
}

const TXN_BEGIN = /^(?:BEGIN|START\s+TRANSACTION)\b/i;
const TXN_END = /^(COMMIT|END|ROLLBACK|ABORT)(?:\s+(?:WORK|TRANSACTION))?(?:\s+AND\s+(?:NO\s+)?CHAIN)?\s*$/i;

/**
 * Every run is one transaction that is rolled back at the end (the worker, the build and the
 * scripts wrap it in BEGIN … ROLLBACK). A script with its own BEGIN … COMMIT, such as a reload
 * that deletes a day and inserts it again, would end that transaction early: its tables would
 * stay, and the next run would fail. So the script's own transaction statements become a
 * savepoint inside the run's transaction: BEGIN → SAVEPOINT, COMMIT → RELEASE SAVEPOINT,
 * ROLLBACK → ROLLBACK TO SAVEPOINT. A COMMIT without a BEGIN, or a second BEGIN, does nothing,
 * as in PostgreSQL (which only warns). A script without such statements is returned unchanged.
 * `pos` maps a 1-based error position in the new text back to the script.
 */
export function inOneTransaction(sql) {
  const edits = [];
  let open = false;
  for (const s of statements(sql)) {
    const text = sql.slice(s.code, s.end);
    let to = null;
    if (TXN_BEGIN.test(text)) {
      to = open ? '' : 'SAVEPOINT lc_script';
      open = true;
    } else {
      const m = TXN_END.exec(text);
      if (m) {
        const commit = /^(COMMIT|END)$/i.test(m[1]);
        to = !open ? '' : commit ? 'RELEASE SAVEPOINT lc_script' : 'ROLLBACK TO SAVEPOINT lc_script; RELEASE SAVEPOINT lc_script';
        open = false;
      }
    }
    if (to !== null) edits.push({ at: s.code, from: text.length, to });
  }
  if (!edits.length) return { sql, pos: (p) => p };
  let out = '';
  let last = 0;
  for (const e of edits) {
    out += sql.slice(last, e.at) + e.to;
    last = e.at + e.from;
  }
  out += sql.slice(last);
  const pos = (p) => {
    let shift = 0;
    for (const e of edits) {
      const at = e.at + shift + 1; // 1-based start of the edit in the new text
      if (p < at) break;
      if (p < at + e.to.length) return e.at + 1;
      shift += e.to.length - e.from;
    }
    return p - shift;
  };
  return { sql: out, pos };
}
