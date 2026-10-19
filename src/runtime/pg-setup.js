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
