// SQL drills: a question as an interviewer would ask it, and a reference query.
// The reference runs on the practice database at build time (npm run exercises); "Check" in the
// browser compares the reader's result with its output. `ordered`: row order matters.
// `check: false`: nothing to compare (EXPLAIN output differs between runs). Explanations live in the MDX pages.
//
// Keep this file free of imports and of non-erasable TypeScript: scripts load it with Node's type stripping.

export interface SqlDrill {
  id: string;
  /** Part of the core set: do these first. */
  core?: boolean;
  /** Row order is part of the answer. */
  ordered?: boolean;
  /** false: nothing to compare. */
  check?: boolean;
  /** The task in English, as said in an interview. */
  q: string;
  /** Initial editor text (default: empty). */
  starter?: string;
  ref: string;
}

export const sqlDrills: SqlDrill[] = [
  {
    id: "s-filter",
    core: true,
    q: "How many paid transactions started in August 2026? Paid means: not a trial, not a test purchase, not promo.",
    ref: `SELECT COUNT(*) AS paid_transactions
FROM transactions
WHERE NOT is_trial
  AND NOT is_test
  AND channel <> 'promo'
  AND start_time >= TIMESTAMP '2026-08-01'
  AND start_time <  TIMESTAMP '2026-09-01';`,
  },
  {
    id: "s-group",
    core: true,
    ordered: true,
    q: "Gross revenue (charged_usd) per channel for August 2026, test purchases excluded. Highest first.",
    ref: `SELECT channel, SUM(charged_usd) AS gross_usd
FROM transactions
WHERE NOT is_test
  AND start_time >= TIMESTAMP '2026-08-01'
  AND start_time <  TIMESTAMP '2026-09-01'
GROUP BY channel
ORDER BY gross_usd DESC, channel;`,
  },
  {
    id: "s-having",
    core: true,
    ordered: true,
    q: "Countries with more than 300 paid transactions that started in January–September 2026. Country and count, biggest first.",
    ref: `SELECT country, COUNT(*) AS paid_transactions
FROM transactions
WHERE NOT is_trial AND NOT is_test AND channel <> 'promo'
  AND start_time >= TIMESTAMP '2026-01-01'
  AND start_time <  TIMESTAMP '2026-10-01'
GROUP BY country
HAVING COUNT(*) > 300
ORDER BY paid_transactions DESC, country;`,
  },
  {
    id: "s-join",
    core: true,
    ordered: true,
    q: "Net revenue (revenue_usd) per merchant for September 2026, test purchases excluded: the merchant's name and the amount. Two merchants can have the same name. Highest first.",
    ref: `SELECT m.name, SUM(t.revenue_usd) AS net_usd
FROM transactions t
JOIN products p       ON p.id = t.product_id
JOIN merchants m ON m.id = p.merchant_id
WHERE NOT t.is_test
  AND t.start_time >= TIMESTAMP '2026-09-01'
  AND t.start_time <  TIMESTAMP '2026-10-01'
GROUP BY m.id, m.name
ORDER BY net_usd DESC, m.name;`,
  },
  {
    id: "s-left-zero",
    core: true,
    ordered: true,
    q: "Every product with the number of its refunded transactions that started in September 2026 — include products with zero. Test purchases excluded. Most refunds first, then product id.",
    ref: `SELECT p.id AS product_id, COUNT(t.transaction_id) AS refunds
FROM products p
LEFT JOIN transactions t
       ON t.product_id = p.id
      AND NOT t.is_test
      AND t.refunded_at IS NOT NULL
      AND t.start_time >= TIMESTAMP '2026-09-01'
      AND t.start_time <  TIMESTAMP '2026-10-01'
GROUP BY p.id
ORDER BY refunds DESC, p.id;`,
  },
  {
    id: "s-anti",
    core: true,
    ordered: true,
    q: "Which merchants never received an advance? Merchant id and name.",
    ref: `SELECT m.id, m.name
FROM merchants m
WHERE NOT EXISTS (SELECT 1 FROM advances v WHERE v.merchant_id = m.id)
ORDER BY m.id;`,
  },
  {
    id: "s-distinct",
    core: true,
    ordered: true,
    q: "How many distinct paying customers (customer_id) per channel in September 2026? Paid transactions only.",
    ref: `SELECT channel, COUNT(DISTINCT customer_id) AS customers
FROM transactions
WHERE NOT is_trial AND NOT is_test AND channel <> 'promo'
  AND start_time >= TIMESTAMP '2026-09-01'
  AND start_time <  TIMESTAMP '2026-10-01'
GROUP BY channel
ORDER BY channel;`,
  },
  {
    id: "s-case",
    core: true,
    q: "Paid transactions that started in September 2026 in three price buckets: 'under 5', '5 to 20', 'over 20' (charged_usd; 5 and 20 go to '5 to 20'). Count per bucket.",
    ref: `SELECT CASE
         WHEN charged_usd < 5   THEN 'under 5'
         WHEN charged_usd <= 20 THEN '5 to 20'
         ELSE 'over 20'
       END AS bucket,
       COUNT(*) AS transactions
FROM transactions
WHERE NOT is_trial AND NOT is_test AND channel <> 'promo'
  AND start_time >= TIMESTAMP '2026-09-01'
  AND start_time <  TIMESTAMP '2026-10-01'
GROUP BY 1;`,
  },
  {
    id: "s-filter-multi",
    core: true,
    ordered: true,
    q: "One row per channel for September 2026, test purchases excluded: all transactions, trials, refunded transactions.",
    ref: `SELECT channel,
       COUNT(*)                                      AS transactions,
       COUNT(*) FILTER (WHERE is_trial)       AS trials,
       COUNT(*) FILTER (WHERE refunded_at IS NOT NULL) AS refunded
FROM transactions
WHERE NOT is_test
  AND start_time >= TIMESTAMP '2026-09-01'
  AND start_time <  TIMESTAMP '2026-10-01'
GROUP BY channel
ORDER BY channel;`,
  },
  {
    id: "s-rate",
    core: true,
    ordered: true,
    q: "Refund rate per channel for paid transactions that started in January–August 2026: refunded / all paid, 3 decimals. Highest first.",
    ref: `SELECT channel,
       ROUND(1.0 * COUNT(*) FILTER (WHERE refunded_at IS NOT NULL) / COUNT(*), 3) AS refund_rate
FROM transactions
WHERE NOT is_trial AND NOT is_test AND channel <> 'promo'
  AND start_time >= TIMESTAMP '2026-01-01'
  AND start_time <  TIMESTAMP '2026-09-01'
GROUP BY channel
ORDER BY refund_rate DESC, channel;`,
  },
  {
    id: "s-month",
    core: true,
    ordered: true,
    q: "Net revenue (revenue_usd) per month for January–September 2026, test purchases excluded. The month as a DATE (first day of the month).",
    ref: `SELECT CAST(date_trunc('month', start_time) AS DATE) AS month,
       SUM(revenue_usd) AS net_usd
FROM transactions
WHERE NOT is_test
  AND start_time >= TIMESTAMP '2026-01-01'
  AND start_time <  TIMESTAMP '2026-10-01'
GROUP BY 1
ORDER BY 1;`,
  },
  {
    id: "s-interval",
    ordered: true,
    q: "For refunded paid transactions, per channel: the average time from start_time to refunded_at in days, 1 decimal. Use the exact elapsed time, fractions of a day included, not the difference of the two dates.",
    ref: `SELECT channel,
       ROUND(AVG(EXTRACT(EPOCH FROM refunded_at - start_time) / 86400)::numeric, 1) AS avg_days_to_refund
FROM transactions
WHERE refunded_at IS NOT NULL
  AND NOT is_trial AND NOT is_test AND channel <> 'promo'
GROUP BY channel
ORDER BY channel;`,
  },
  {
    id: "s-active",
    core: true,
    ordered: true,
    q: "Active paid subscriptions per channel at 2026-09-10 00:00. A refund ends a subscription at refunded_at.",
    ref: `SELECT channel, COUNT(*) AS active
FROM transactions
WHERE NOT is_trial AND NOT is_test AND channel <> 'promo'
  AND start_time <= TIMESTAMP '2026-09-10'
  AND end_time   >  TIMESTAMP '2026-09-10'
  AND (refunded_at IS NULL OR refunded_at > TIMESTAMP '2026-09-10')
GROUP BY channel
ORDER BY channel;`,
  },
  {
    id: "s-union",
    core: true,
    ordered: true,
    q: "North Market cash flow per month in 2026 (January–September), test purchases excluded: a sale adds charged_usd * (1 - fee_rate) in the month of start_time; a refund subtracts the same amount in the month of refunded_at. Month as DATE, amount rounded to 2 decimals.",
    ref: `WITH movements AS (
    SELECT CAST(date_trunc('month', start_time) AS DATE) AS month,
           charged_usd * (1 - fee_rate) AS amount
    FROM transactions
    WHERE channel = 'north_market' AND NOT is_test
    UNION ALL
    SELECT CAST(date_trunc('month', refunded_at) AS DATE),
           -charged_usd * (1 - fee_rate)
    FROM transactions
    WHERE channel = 'north_market' AND NOT is_test AND refunded_at IS NOT NULL
)
SELECT month, ROUND(SUM(amount), 2) AS cash_usd
FROM movements
WHERE month >= DATE '2026-01-01' AND month < DATE '2026-10-01'
GROUP BY month
ORDER BY month;`,
  },
  {
    id: "s-full-outer",
    core: true,
    ordered: true,
    q: "For mer_11, months May–August 2026: per (channel, period_month) show the advanced amount and the channel payout side by side, NULL where one side is missing.",
    ref: `WITH adv AS (
    SELECT channel, period_month, SUM(amount_usd) AS advanced_usd
    FROM advances
    WHERE merchant_id = 'mer_11'
      AND period_month >= DATE '2026-05-01' AND period_month < DATE '2026-09-01'
    GROUP BY channel, period_month
),
paid AS (
    SELECT channel, period_month, SUM(amount_usd) AS paid_usd
    FROM channel_payouts
    WHERE merchant_id = 'mer_11'
      AND period_month >= DATE '2026-05-01' AND period_month < DATE '2026-09-01'
    GROUP BY channel, period_month
)
SELECT COALESCE(a.channel, p.channel)               AS channel,
       COALESCE(a.period_month, p.period_month) AS period_month,
       a.advanced_usd,
       p.paid_usd
FROM adv a
FULL OUTER JOIN paid p
  ON p.channel = a.channel AND p.period_month = a.period_month
ORDER BY period_month, channel;`,
  },
  {
    id: "s-fanout",
    core: true,
    ordered: true,
    q: "For each merchant with at least one advance: the number of products and the total advanced amount.",
    ref: `WITH product_counts AS (
    SELECT merchant_id, COUNT(*) AS products
    FROM products
    GROUP BY merchant_id
),
advanced AS (
    SELECT merchant_id, SUM(amount_usd) AS advanced_usd
    FROM advances
    GROUP BY merchant_id
)
SELECT v.merchant_id, COALESCE(c.products, 0) AS products, v.advanced_usd
FROM advanced v
LEFT JOIN product_counts c ON c.merchant_id = v.merchant_id
ORDER BY v.merchant_id;`,
  },
  {
    id: "s-top1",
    core: true,
    ordered: true,
    q: "For each merchant, the product with the highest net revenue (revenue_usd) in September 2026, test purchases excluded. Ties: smaller product_id. Columns: merchant_id, product_id, net_usd.",
    ref: `WITH per_product AS (
    SELECT p.merchant_id, t.product_id, SUM(t.revenue_usd) AS net_usd
    FROM transactions t
    JOIN products p ON p.id = t.product_id
    WHERE NOT t.is_test
      AND t.start_time >= TIMESTAMP '2026-09-01'
      AND t.start_time <  TIMESTAMP '2026-10-01'
    GROUP BY p.merchant_id, t.product_id
),
ranked AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY merchant_id ORDER BY net_usd DESC, product_id) AS rn
    FROM per_product
)
SELECT merchant_id, product_id, net_usd
FROM ranked
WHERE rn = 1
ORDER BY merchant_id;`,
  },
  {
    id: "s-share",
    core: true,
    ordered: true,
    q: "Share of each channel in September 2026 net revenue (revenue_usd), test purchases excluded, percent with 1 decimal.",
    ref: `WITH by_channel AS (
    SELECT channel, SUM(revenue_usd) AS net_usd
    FROM transactions
    WHERE NOT is_test
      AND start_time >= TIMESTAMP '2026-09-01'
      AND start_time <  TIMESTAMP '2026-10-01'
    GROUP BY channel
)
SELECT channel, net_usd,
       ROUND(100.0 * net_usd / SUM(net_usd) OVER (), 1) AS share_pct
FROM by_channel
ORDER BY net_usd DESC, channel;`,
  },
  {
    id: "s-running",
    ordered: true,
    q: "mer_04: net revenue per day for 14–20 September 2026 (test purchases excluded) and the running total. Only days with sales. Day as DATE.",
    ref: `WITH daily AS (
    SELECT CAST(t.start_time AS DATE) AS day, SUM(t.revenue_usd) AS net_usd
    FROM transactions t
    JOIN products p ON p.id = t.product_id
    WHERE p.merchant_id = 'mer_04'
      AND NOT t.is_test
      AND t.start_time >= TIMESTAMP '2026-09-14'
      AND t.start_time <  TIMESTAMP '2026-09-21'
    GROUP BY 1
)
SELECT day, net_usd, SUM(net_usd) OVER (ORDER BY day) AS running_usd
FROM daily
ORDER BY day;`,
  },
  {
    id: "s-lag",
    ordered: true,
    q: "Net revenue per month for January–September 2026 (test purchases excluded), the previous month's revenue and the change. For January 2026 the previous month is December 2025. Month as DATE.",
    ref: `WITH monthly AS (
    SELECT CAST(date_trunc('month', start_time) AS DATE) AS month, SUM(revenue_usd) AS net_usd
    FROM transactions
    WHERE NOT is_test
      AND start_time >= TIMESTAMP '2025-12-01'
      AND start_time <  TIMESTAMP '2026-10-01'
    GROUP BY 1
),
with_prev AS (
    SELECT month, net_usd, LAG(net_usd) OVER (ORDER BY month) AS prev_usd
    FROM monthly
)
SELECT month, net_usd, prev_usd, net_usd - prev_usd AS change_usd
FROM with_prev
WHERE month >= DATE '2026-01-01'
ORDER BY month;`,
  },
  {
    id: "s-rank",
    ordered: true,
    q: "Rank products by paid transactions in September 2026; equal counts share the same rank. Columns: product_id, transactions, rnk. Only ranks 1–5.",
    ref: `WITH c AS (
    SELECT product_id, COUNT(*) AS transactions
    FROM transactions
    WHERE NOT is_trial AND NOT is_test AND channel <> 'promo'
      AND start_time >= TIMESTAMP '2026-09-01'
      AND start_time <  TIMESTAMP '2026-10-01'
    GROUP BY product_id
),
r AS (
    SELECT product_id, transactions, RANK() OVER (ORDER BY transactions DESC) AS rnk
    FROM c
)
SELECT product_id, transactions, rnk
FROM r
WHERE rnk <= 5
ORDER BY rnk, product_id;`,
  },
  {
    id: "s-dedupe",
    core: true,
    ordered: true,
    q: "Webhook events of September 2026 (by occurred_at): per type — deliveries (rows), distinct events and duplicate deliveries.",
    ref: `SELECT type,
       COUNT(*)                            AS deliveries,
       COUNT(DISTINCT event_id)            AS events,
       COUNT(*) - COUNT(DISTINCT event_id) AS duplicates
FROM webhook_events
WHERE occurred_at >= TIMESTAMP '2026-09-01'
  AND occurred_at <  TIMESTAMP '2026-10-01'
GROUP BY type
ORDER BY type;`,
  },
  {
    id: "s-latest",
    core: true,
    ordered: true,
    q: "Most recent transaction of each customer of prd_03 (test purchases excluded): customer_id, plan_id, start_time. Ties: larger transaction_id.",
    ref: `WITH ranked AS (
    SELECT customer_id, plan_id, start_time,
           ROW_NUMBER() OVER (PARTITION BY customer_id
                              ORDER BY start_time DESC, transaction_id DESC) AS rn
    FROM transactions
    WHERE product_id = 'prd_03' AND NOT is_test
)
SELECT customer_id, plan_id, start_time
FROM ranked
WHERE rn = 1
ORDER BY customer_id;`,
  },
  {
    id: "s-calendar",
    ordered: true,
    q: "New paid South Market subscriptions per day for 1–10 September 2026, including days with zero: channel = 'south_market', renewal_number = 1, not a trial, not a test purchase. Day as DATE.",
    ref: `WITH days AS (
    SELECT CAST(d AS DATE) AS day
    FROM generate_series(TIMESTAMP '2026-09-01', TIMESTAMP '2026-09-10', INTERVAL '1 day') AS g(d)
),
new_subs AS (
    SELECT CAST(start_time AS DATE) AS day, COUNT(*) AS n
    FROM transactions
    WHERE channel = 'south_market' AND renewal_number = 1 AND NOT is_trial AND NOT is_test
      AND start_time >= TIMESTAMP '2026-09-01'
      AND start_time <  TIMESTAMP '2026-09-11'
    GROUP BY 1
)
SELECT d.day, COALESCE(n.n, 0) AS new_subscriptions
FROM days d
LEFT JOIN new_subs n ON n.day = d.day
ORDER BY d.day;`,
  },
  {
    id: "s-ledger-fees",
    ordered: true,
    q: "Fee income from advances per month in 2026 from ledger_entries (entry_type = 'fee'), entries before 2026-09-30. Month as DATE.",
    ref: `SELECT CAST(date_trunc('month', created_at) AS DATE) AS month,
       SUM(amount_usd) AS fees_usd
FROM ledger_entries
WHERE entry_type = 'fee'
  AND created_at >= TIMESTAMP '2026-01-01'
  AND created_at <  TIMESTAMP '2026-09-30'
GROUP BY 1
ORDER BY 1;`,
  },
  {
    id: "s-balance",
    core: true,
    ordered: true,
    q: "Outstanding balance per merchant from the ledger (all entries before 2026-09-30), only merchants who owe more than 0. Highest first.",
    ref: `SELECT merchant_id, SUM(amount_usd) AS outstanding_usd
FROM ledger_entries
WHERE created_at < TIMESTAMP '2026-09-30'
GROUP BY merchant_id
HAVING SUM(amount_usd) > 0
ORDER BY outstanding_usd DESC, merchant_id;`,
  },
  {
    id: "s-median",
    ordered: true,
    q: "Median and 90th percentile purchase price of paid transactions per plan_period, 2 decimals.",
    ref: `SELECT plan_period,
       ROUND(CAST(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY charged_usd) AS numeric), 2) AS median_usd,
       ROUND(CAST(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY charged_usd) AS numeric), 2) AS p90_usd
FROM transactions
WHERE NOT is_trial AND NOT is_test AND channel <> 'promo'
GROUP BY plan_period
ORDER BY plan_period;`,
  },
  {
    id: "s-exists",
    ordered: true,
    q: "How many paid transactions in September 2026 were made by customers who had at least one refund before 2026-09-01?",
    ref: `SELECT COUNT(*) AS transactions
FROM transactions t
WHERE NOT t.is_trial AND NOT t.is_test AND t.channel <> 'promo'
  AND t.start_time >= TIMESTAMP '2026-09-01'
  AND t.start_time <  TIMESTAMP '2026-10-01'
  AND EXISTS (
      SELECT 1 FROM transactions r
      WHERE r.customer_id = t.customer_id
        AND r.refunded_at < TIMESTAMP '2026-09-01'
  );`,
  },
  {
    id: "s-retention",
    core: true,
    q: "Customers whose first paid transaction (any product) started in July 2026: how many of them also had a paid transaction that started in August 2026? Return cohort, retained, rate (3 decimals).",
    ref: `WITH paid AS (
    SELECT customer_id, start_time
    FROM transactions
    WHERE NOT is_trial AND NOT is_test AND channel <> 'promo'
),
first_paid AS (
    SELECT customer_id, MIN(start_time) AS first_at
    FROM paid
    GROUP BY customer_id
),
cohort AS (
    SELECT customer_id
    FROM first_paid
    WHERE first_at >= TIMESTAMP '2026-07-01' AND first_at < TIMESTAMP '2026-08-01'
),
flagged AS (
    SELECT c.customer_id,
           EXISTS (
               SELECT 1 FROM paid p
               WHERE p.customer_id = c.customer_id
                 AND p.start_time >= TIMESTAMP '2026-08-01' AND p.start_time < TIMESTAMP '2026-09-01'
           ) AS retained
    FROM cohort c
)
SELECT COUNT(*)                                                    AS cohort,
       COUNT(*) FILTER (WHERE retained)                            AS retained,
       ROUND(1.0 * COUNT(*) FILTER (WHERE retained) / COUNT(*), 3) AS rate
FROM flagged;`,
  },
  {
    id: "s-arppu",
    ordered: true,
    q: "ARPPU for September 2026 per channel: net revenue (revenue_usd) of paid transactions divided by distinct paying customers, 2 decimals. Paid means not a trial, not a test purchase, not promo; refunded transactions stay in (their revenue_usd is 0).",
    ref: `SELECT channel,
       ROUND(SUM(revenue_usd) / COUNT(DISTINCT customer_id), 2) AS arppu_usd
FROM transactions
WHERE NOT is_trial AND NOT is_test AND channel <> 'promo'
  AND start_time >= TIMESTAMP '2026-09-01'
  AND start_time <  TIMESTAMP '2026-10-01'
GROUP BY channel
ORDER BY channel;`,
  },
  {
    id: "s-mrr",
    core: true,
    ordered: true,
    q: "MRR per channel at 2026-09-30 00:00: active paid subscriptions (not refunded at that moment); monthly value = charged_usd × (P1W: 52/12, P1M: 1, P1Y: 1/12). Rounded to 2 decimals.",
    ref: `SELECT channel,
       ROUND(SUM(charged_usd * CASE plan_period
                                            WHEN 'P1W' THEN 52.0 / 12
                                            WHEN 'P1M' THEN 1
                                            WHEN 'P1Y' THEN 1.0 / 12
                                          END), 2) AS mrr_usd
FROM transactions
WHERE NOT is_trial AND NOT is_test AND channel <> 'promo'
  AND start_time <= TIMESTAMP '2026-09-30'
  AND end_time   >  TIMESTAMP '2026-09-30'
  AND (refunded_at IS NULL OR refunded_at > TIMESTAMP '2026-09-30')
GROUP BY channel
ORDER BY channel;`,
  },
  {
    id: "s-coalesce",
    ordered: true,
    q: "Every merchant with the date they joined the advances program as text (YYYY-MM-DD), or 'not enrolled'.",
    ref: `SELECT id,
       COALESCE(CAST(CAST(advances_enrolled_at AS DATE) AS TEXT), 'not enrolled') AS enrolled
FROM merchants
ORDER BY id;`,
  },
  {
    id: "s-ddl",
    core: true,
    q: "Create a table payouts_demo where payout_id cannot repeat and amount_usd cannot be negative. Insert payout 'p1' of 10.00 twice, so that the second insert does nothing and raises no error. Return the number of rows.",
    starter: `-- every run is rolled back: create the table, insert and select in one run
DROP TABLE IF EXISTS payouts_demo;
`,
    ref: `DROP TABLE IF EXISTS payouts_demo;
CREATE TEMP TABLE payouts_demo (
    payout_id  TEXT PRIMARY KEY,
    amount_usd NUMERIC(12, 2) NOT NULL CHECK (amount_usd >= 0)
);
INSERT INTO payouts_demo VALUES ('p1', 10.00) ON CONFLICT (payout_id) DO NOTHING;
INSERT INTO payouts_demo VALUES ('p1', 10.00) ON CONFLICT (payout_id) DO NOTHING;
SELECT COUNT(*) AS rows_in_table FROM payouts_demo;`,
  },
  {
    id: "s-upsert",
    ordered: true,
    q: "Keep a balance per merchant in a table balances(merchant_id primary key, balance_usd). Apply three ledger amounts for 'mer_x': +100.00, +2.50, -102.50 with INSERT … ON CONFLICT DO UPDATE. Return merchant_id and the final balance.",
    starter: `-- every run is rolled back: do everything in one run
DROP TABLE IF EXISTS balances;
`,
    ref: `DROP TABLE IF EXISTS balances;
CREATE TEMP TABLE balances (
    merchant_id TEXT PRIMARY KEY,
    balance_usd  NUMERIC(12, 2) NOT NULL
);
INSERT INTO balances VALUES ('mer_x', 100.00)
ON CONFLICT (merchant_id) DO UPDATE SET balance_usd = balances.balance_usd + EXCLUDED.balance_usd;
INSERT INTO balances VALUES ('mer_x', 2.50)
ON CONFLICT (merchant_id) DO UPDATE SET balance_usd = balances.balance_usd + EXCLUDED.balance_usd;
INSERT INTO balances VALUES ('mer_x', -102.50)
ON CONFLICT (merchant_id) DO UPDATE SET balance_usd = balances.balance_usd + EXCLUDED.balance_usd;
SELECT merchant_id, balance_usd FROM balances;`,
  },
  {
    id: "s-explain",
    check: false,
    q: "Create an index on transactions(start_time) and look at EXPLAIN for 'transactions in September 2026'. Is the index used? Why or why not?",
    ref: `CREATE INDEX IF NOT EXISTS tx_start_time_idx ON transactions (start_time);
EXPLAIN
SELECT COUNT(*)
FROM transactions
WHERE start_time >= TIMESTAMP '2026-09-01'
  AND start_time <  TIMESTAMP '2026-10-01';`,
  },
  {
    id: "s-stock-on-hand",
    ordered: true,
    q: "Stock on hand at the end of September 2026 for every item: id, name, units and value_usd (units × unit cost). Count only moves before 2026-10-01. An item with no moves before that date shows 0 units and 0 value. Item names are not unique. Order by item id.",
    starter: `-- sample tables (each run rolls back: keep this block on top)
CREATE TEMP TABLE items (id int PRIMARY KEY, name varchar, unit_cost_usd numeric(10, 2));
CREATE TEMP TABLE stock_moves (id int PRIMARY KEY, item_id int REFERENCES items(id), moved_at date, qty int);
INSERT INTO items VALUES (1, 'Notebook', 3.50), (2, 'Pen', 1.20), (3, 'Pen', 0.80), (4, 'Stapler', 7.00), (5, 'Tape', 2.40);
INSERT INTO stock_moves VALUES (1, 1, '2026-09-01', 40), (2, 1, '2026-09-10', -15), (3, 2, '2026-09-03', 100),
                               (4, 2, '2026-09-20', -100), (5, 3, '2026-09-05', 25), (6, 1, '2026-10-02', -5),
                               (7, 5, '2026-10-03', 12);

-- RESULT: one row per …
-- AGREED: …
-- PLAN: …
`,
    ref: `-- sample tables (each run rolls back: keep this block on top)
CREATE TEMP TABLE items (id int PRIMARY KEY, name varchar, unit_cost_usd numeric(10, 2));
CREATE TEMP TABLE stock_moves (id int PRIMARY KEY, item_id int REFERENCES items(id), moved_at date, qty int);
INSERT INTO items VALUES (1, 'Notebook', 3.50), (2, 'Pen', 1.20), (3, 'Pen', 0.80), (4, 'Stapler', 7.00), (5, 'Tape', 2.40);
INSERT INTO stock_moves VALUES (1, 1, '2026-09-01', 40), (2, 1, '2026-09-10', -15), (3, 2, '2026-09-03', 100),
                               (4, 2, '2026-09-20', -100), (5, 3, '2026-09-05', 25), (6, 1, '2026-10-02', -5),
                               (7, 5, '2026-10-03', 12);

SELECT i.id, i.name,
       COALESCE(SUM(mv.qty), 0)                   AS units,
       COALESCE(SUM(mv.qty), 0) * i.unit_cost_usd AS value_usd
FROM items i
LEFT JOIN stock_moves mv
       ON mv.item_id = i.id
      AND mv.moved_at < DATE '2026-10-01'
GROUP BY i.id, i.name, i.unit_cost_usd
ORDER BY i.id;`,
  },
];
