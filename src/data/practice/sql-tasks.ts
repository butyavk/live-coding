// Interview-style SQL tasks. The task text, the questions to ask and the output columns are in
// exercises/tasks/sql/<id>.sql; the reference is exercises/solutions/sql/<id>.sql. This file adds
// what an interviewer would explain about the data (`notes`, with an optional `example` query
// that shows a few rows) and one line to say out loud after solving.
//
// Keep this file free of imports and of non-erasable TypeScript.

export interface SqlTask {
  id: string;
  /** Shown instead of the technique, so the label does not give the solution away. */
  difficulty: 'easy' | 'medium' | 'hard';
  tables: string[];
  notes: string[];
  example?: string;
  say: string;
  /**
   * The reference builds its own table but loads it from the dataset (Q15), so Check runs it on the
   * hidden edge-case data too. Without it, a reference with CREATE, INSERT, UPDATE … is checked on
   * the practice data only.
   */
  edge?: boolean;
}

export const sqlTasks: SqlTask[] = [
  {
    id: "q01",
    difficulty: "easy",
    tables: ["transactions"],
    notes: [
      "One row in transactions is one subscription period: a purchase, a renewal or a trial. Renewals of the same subscription are separate rows.",
      "channel is one of north_market, south_market, web, promo.",
      "charged_usd is what the customer paid (gross). revenue_usd is the same, but 0 if the purchase was refunded (net).",
      "is_test marks a merchant's test purchase; it never counts in business numbers.",
    ],
    example: `(SELECT transaction_id AS id, channel, charged_usd AS gross, revenue_usd AS net, refunded_at, is_test
  FROM transactions WHERE refunded_at IS NOT NULL ORDER BY transaction_id LIMIT 1)
UNION ALL
(SELECT transaction_id, channel, charged_usd, revenue_usd, refunded_at, is_test
  FROM transactions WHERE is_test ORDER BY transaction_id LIMIT 1)
UNION ALL
(SELECT transaction_id, channel, charged_usd, revenue_usd, refunded_at, is_test
  FROM transactions WHERE NOT is_test AND refunded_at IS NULL AND NOT is_trial ORDER BY transaction_id LIMIT 1);`,
    say: "Every query here filters by time, so on a big table I would want an index on start_time.",
  },
  {
    id: "q02",
    difficulty: "easy",
    tables: ["transactions", "products", "merchants"],
    notes: [
      "transactions.product_id → products.id; products.merchant_id → merchants.id. A transaction reaches its merchant only through products.",
      "The product name is products.name, the merchant name is merchants.name.",
      "Net revenue is SUM(revenue_usd), test purchases excluded.",
    ],
    example: `SELECT p.id AS product_id, p.name AS product_name, m.id AS merchant_id, m.name AS merchant_name
FROM products p JOIN merchants m ON m.id = p.merchant_id
ORDER BY p.id LIMIT 3;`,
    say: "The joins go through primary keys, so the only index I need is on start_time.",
  },
  {
    id: "q03",
    difficulty: "easy",
    tables: ["transactions"],
    notes: [
      "One row in transactions is one subscription period: a purchase, a renewal or a trial. Renewals of the same subscription are separate rows.",
      "A period is active at moment m if start_time <= m < end_time.",
      "A refund ends the period: from refunded_at on, it is not active.",
      "A paid row is not a trial, not a test purchase, and channel <> 'promo' (promo means free access).",
      "In the example, period t_000144 runs until October 13, 2025, but it was refunded on September 20 — from September 20 it is no longer active.",
    ],
    example: `SELECT transaction_id AS id, original_transaction_id AS chain,
       is_trial AS trial, is_trial_conversion AS conversion, renewal_number AS n,
       start_time, end_time, revenue_usd AS net, refunded_at
FROM transactions
WHERE original_transaction_id IN ('t_000141', 't_003269')
ORDER BY chain, start_time;`,
    say: "A normal index helps only half of this condition. A range column with a GiST index answers 'active at a moment' directly.",
  },
  {
    id: "q04",
    difficulty: "medium",
    tables: ["transactions"],
    notes: [
      "Active at moment m works as in q03: start_time <= m < end_time, and a refund ends the period.",
      "A paid row is not a trial, not a test purchase, and channel <> 'promo' (promo means free access).",
      "Every day, even a day with no data, comes from a calendar: generate_series(start, end, INTERVAL '1 day').",
    ],
    say: "In production I would precompute a daily snapshot instead of scanning all transactions for every day.",
  },
  {
    id: "q05",
    difficulty: "medium",
    tables: ["transactions", "products", "merchants"],
    notes: [
      "The month of a transaction is date_trunc('month', start_time).",
      "A merchant with no sales exists only in merchants: start from merchants and attach sales with a LEFT JOIN.",
      "All months, even empty ones, come from a calendar: generate_series(…, INTERVAL '1 month').",
    ],
    say: "For a monthly report I would keep monthly aggregates, so the report does not read every transaction.",
  },
  {
    id: "q06",
    difficulty: "medium",
    tables: ["transactions"],
    notes: [
      "A customer's history in a product is their rows with the same (customer_id, product_id), in start_time order.",
      "A break is the gap from one row's end_time to the next row's start_time.",
      "In the example, chain t_000141 has no breaks: each start_time equals the previous end_time.",
    ],
    example: `SELECT transaction_id AS id, original_transaction_id AS chain,
       is_trial AS trial, is_trial_conversion AS conversion, renewal_number AS n,
       start_time, end_time, revenue_usd AS net, refunded_at
FROM transactions
WHERE original_transaction_id IN ('t_000141', 't_003269')
ORDER BY chain, start_time;`,
    say: "For one customer, an index on (customer_id, product_id, start_time) returns the rows in order. For the whole table I would check EXPLAIN: a full scan plus a sort is usually cheaper.",
  },
  {
    id: "q07",
    difficulty: "medium",
    tables: ["transactions"],
    notes: [
      "A customer's latest row in a product is the one with the latest start_time among rows with the same (customer_id, product_id).",
      "The status comes from that row: end_time compared with 'today' (2026-09-30), is_trial, refunded_at.",
    ],
    example: `SELECT transaction_id AS id, original_transaction_id AS chain,
       is_trial AS trial, is_trial_conversion AS conversion, renewal_number AS n,
       start_time, end_time, revenue_usd AS net, refunded_at
FROM transactions
WHERE original_transaction_id IN ('t_000141', 't_003269')
ORDER BY chain, start_time;`,
    say: "In production the current status usually lives in its own table, updated from webhooks.",
  },
  {
    id: "q08",
    difficulty: "medium",
    tables: ["transactions"],
    notes: [
      "All periods of one subscription form a chain: they share original_transaction_id (for the first row it equals its own id).",
      "A trial is a row with is_trial = true. If the customer paid after the trial, the same chain has a row with is_trial_conversion = true.",
      "In the example, chain t_000141 is a trial that converted (then a renewal and a refund); t_003269 is a trial that never converted — one row.",
      "A product has several plans (plan_id, for example prd_02.monthly and prd_02.annual): the result has one row per plan.",
    ],
    example: `SELECT transaction_id AS id, original_transaction_id AS chain,
       is_trial AS trial, is_trial_conversion AS conversion, renewal_number AS n,
       start_time, end_time, revenue_usd AS net, refunded_at
FROM transactions
WHERE original_transaction_id IN ('t_000141', 't_003269')
ORDER BY chain, start_time;`,
    say: "Trials and conversions are linked by original_transaction_id, so I would index that column.",
  },
  {
    id: "q09",
    difficulty: "medium",
    tables: ["transactions", "products", "merchants"],
    notes: [
      "Revenue per day is SUM(revenue_usd) by CAST(start_time AS DATE), test purchases excluded.",
      "Every merchant × every day comes from a calendar and a CROSS JOIN; empty days are 0.",
    ],
    say: "The window part is cheap; the cost is reading transactions, so an index on start_time.",
  },
  {
    id: "q10",
    difficulty: "hard",
    tables: ["transactions"],
    notes: [
      "One subscription = all its rows with the same original_transaction_id: the first purchase and every renewal. Each row is one paid period, start_time to end_time.",
      "So the subscription lives from the earliest start_time to the latest end_time of its paid rows. If it was active on 1 August and is no longer active on 1 September 00:00, nobody renewed it — that is churn.",
    ],
    example: `SELECT transaction_id AS id, original_transaction_id AS chain,
       is_trial AS trial, is_trial_conversion AS conversion, renewal_number AS n,
       start_time, end_time, revenue_usd AS net, refunded_at
FROM transactions
WHERE original_transaction_id IN ('t_000141', 't_003269')
ORDER BY chain, start_time;`,
    say: "This groups the whole table, so an index does not help. In production I would keep one row per subscription with its first start and last end.",
  },
  {
    id: "q11",
    difficulty: "easy",
    tables: ["webhook_events"],
    notes: [
      "The same event can arrive several times with the same event_id (at-least-once delivery).",
      "occurred_at is when the event happened, received_at is when it reached us. The first copy is the earliest by received_at.",
    ],
    example: `SELECT event_id, type, occurred_at, received_at
FROM webhook_events
WHERE event_id = 'evt_000834'
ORDER BY received_at;`,
    say: "The real fix is a unique constraint on event_id with ON CONFLICT DO NOTHING at ingest.",
  },
  {
    id: "q12",
    difficulty: "hard",
    tables: ["transactions", "products", "channel_payouts"],
    notes: [
      "channel_payouts is what the channels actually paid: one row per payout to a merchant for a channel and a period_month (the first day of the sales month).",
      "What they should have paid is calculated from transactions (through products to merchant_id).",
    ],
    say: "A unique key on (merchant_id, channel, period_month) would stop a duplicate payout at write time.",
  },
  {
    id: "q13",
    difficulty: "hard",
    tables: ["advances", "merchants", "transactions", "products"],
    notes: [
      "advances are early payouts to merchants: merchant_id, channel, period_month, amount_usd, idempotency_key = 'merchant:channel:month'.",
      "merchants.advances_enrolled_at is when the merchant joined the advances program; NULL means not enrolled.",
    ],
    say: "A unique index on idempotency_key prevents the duplicate advance instead of finding it later.",
  },
  {
    id: "q14",
    difficulty: "medium",
    tables: ["ledger_entries"],
    notes: [
      "Each advance has several ledger rows with the same advance_id: advance and fee are positive, repayment is negative.",
      "What a merchant owes is the sum of their amount_usd. An advance is open while the sum of its rows is above 0.",
    ],
    example: `SELECT entry_id, merchant_id, advance_id, entry_type, amount_usd, created_at
FROM ledger_entries
WHERE advance_id = 'adv_0001'
ORDER BY created_at, entry_id;`,
    say: "Index on (merchant_id, created_at); in production I would also keep the balance updated in the same transaction.",
  },
  {
    id: "q15",
    difficulty: "hard",
    tables: ["transactions", "products"],
    notes: [
      "A transaction reaches its merchant through products: transactions.product_id → products.id → products.merchant_id.",
      "A refund is not a row of its own: it is the same transaction with refunded_at set. Its sale and its refund can fall on different days, even in different months.",
      "fee_rate is the channel's fee: 0.15 or 0.30 on a marketplace, 0.03 on the web checkout. charged_usd * (1 - fee_rate) is what the merchant keeps of one sale.",
      "In the example, t_005659 was sold on 31 August and refunded on 17 September; t_007681 is the sale that step (4) refunds late.",
      "Every run starts from the same data and is rolled back at the end, so CREATE TABLE and UPDATE are safe to run again and again.",
    ],
    example: `SELECT t.transaction_id AS id, p.merchant_id, t.channel, t.start_time, t.refunded_at, t.charged_usd, t.fee_rate
FROM transactions t
JOIN products p ON p.id = t.product_id
WHERE t.transaction_id IN ('t_005659', 't_007681')
ORDER BY t.start_time;`,
    say: "The primary key is the grain, and the load replaces a day's rows instead of adding to them, so a retry or a late refund only means loading that day again.",
    edge: true,
  },
  {
    id: "d01",
    difficulty: "medium",
    tables: ["transactions", "products", "merchants", "channel_payouts"],
    notes: [
      "transactions → products → merchants, as in q02.",
      "channel_payouts has many rows per merchant: one per channel and month.",
    ],
    say: "Fixed: the payouts join multiplied rows, gross was used instead of net, and BETWEEN lost August 31.",
  },
];
