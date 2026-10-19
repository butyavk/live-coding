// Trap queries: short SQL that looks right and is not (or fails). The reader guesses the result,
// runs it, then fixes it; `fix` is the corrected query that "Check" compares with.
// The question and the answer are written in the MDX page, in the reader's language.
//
// Keep this file free of imports and of non-erasable TypeScript.

export interface Trap {
  id: string;
  core?: boolean;
  sql: string;
  fix?: string;
}

export const traps: Trap[] = [
  {
    id: "null-eq",
    sql: `SELECT NULL = NULL AS eq,
       NULL IS NULL AS is_null,
       NULL <> 1 AS ne;`,
  },
  {
    id: "not-in-null",
    core: true,
    sql: `SELECT 'found' AS result
WHERE 1 NOT IN (2, NULL);`,
    fix: `SELECT 'found' AS result
WHERE NOT EXISTS (SELECT 1 FROM (VALUES (2), (NULL::int)) AS v(x) WHERE v.x = 1);`,
  },
  {
    id: "sum-empty",
    core: true,
    sql: `SELECT SUM(amount_usd) AS advanced_usd
FROM advances
WHERE merchant_id = 'mer_02';`,
    fix: `SELECT COALESCE(SUM(amount_usd), 0) AS advanced_usd
FROM advances
WHERE merchant_id = 'mer_02';`,
  },
  {
    id: "filter-empty",
    sql: `SELECT channel,
       SUM(charged_usd) FILTER (WHERE refunded_at IS NOT NULL) AS refunded_usd
FROM transactions
WHERE NOT is_test
GROUP BY channel
ORDER BY channel;`,
    fix: `SELECT channel,
       COALESCE(SUM(charged_usd) FILTER (WHERE refunded_at IS NOT NULL), 0) AS refunded_usd
FROM transactions
WHERE NOT is_test
GROUP BY channel
ORDER BY channel;`,
  },
  {
    id: "int-div",
    core: true,
    sql: `SELECT COUNT(*) FILTER (WHERE is_trial) / COUNT(*)                   AS share_a,
       ROUND(100.0 * COUNT(*) FILTER (WHERE is_trial) / COUNT(*), 1) AS pct_b
FROM transactions
WHERE NOT is_test;`,
    fix: `SELECT ROUND(1.0 * COUNT(*) FILTER (WHERE is_trial) / COUNT(*), 3) AS share_a,
       ROUND(100.0 * COUNT(*) FILTER (WHERE is_trial) / COUNT(*), 1) AS pct_b
FROM transactions
WHERE NOT is_test;`,
  },
  {
    id: "avg-else0",
    sql: `SELECT ROUND(AVG(charged_usd) FILTER (WHERE channel = 'web'), 2)             AS a_filter,
       ROUND(AVG(CASE WHEN channel = 'web' THEN charged_usd END), 2)        AS b_case,
       ROUND(AVG(CASE WHEN channel = 'web' THEN charged_usd ELSE 0 END), 2) AS c_case_else_0
FROM transactions
WHERE NOT is_test
  AND NOT is_trial;`,
  },
  {
    id: "count-forms",
    sql: `SELECT COUNT(*)               AS all_rows,
       COUNT(refunded_at)     AS refunded,
       COUNT(DISTINCT channel) AS channels
FROM transactions
WHERE NOT is_test;`,
  },
  {
    id: "between-ts",
    core: true,
    sql: `SELECT COUNT(*) FILTER (WHERE start_time BETWEEN '2026-07-01' AND '2026-07-31')        AS with_between,
       COUNT(*) FILTER (WHERE start_time >= '2026-07-01' AND start_time < '2026-08-01') AS half_open
FROM transactions;`,
    fix: `SELECT COUNT(*) AS july
FROM transactions
WHERE start_time >= TIMESTAMP '2026-07-01' AND start_time < TIMESTAMP '2026-08-01';`,
  },
  {
    id: "ts-eq-date",
    sql: `SELECT COUNT(*) FILTER (WHERE start_time = '2026-09-01')                                  AS a_equals,
       COUNT(*) FILTER (WHERE start_time::date = '2026-09-01')                            AS b_cast,
       COUNT(*) FILTER (WHERE start_time >= '2026-09-01' AND start_time < '2026-09-02') AS c_range
FROM transactions;`,
  },
  {
    id: "trunc-date",
    sql: `SELECT date_trunc('month', DATE '2026-09-15')            AS m,
       pg_typeof(date_trunc('month', DATE '2026-09-15')) AS type;`,
    fix: `SELECT CAST(date_trunc('month', DATE '2026-09-15') AS DATE) AS m;`,
  },
  {
    id: "literal-interval",
    core: true,
    sql: `SELECT COUNT(*) AS last_30_days
FROM transactions
WHERE start_time >= '2026-09-30' - INTERVAL '30 days'
  AND start_time <  '2026-09-30';`,
    fix: `SELECT COUNT(*) AS last_30_days
FROM transactions
WHERE start_time >= TIMESTAMP '2026-09-30' - INTERVAL '30 days'
  AND start_time <  TIMESTAMP '2026-09-30';`,
  },
  {
    id: "left-where",
    core: true,
    sql: `SELECT COUNT(*) AS products_in_result
FROM (
  SELECT p.id, COUNT(t.product_id) AS sales
  FROM products p
  LEFT JOIN transactions t ON t.product_id = p.id
  WHERE t.country = 'JP'
    AND t.start_time >= '2026-09-01'
    AND t.start_time <  '2026-10-01'
  GROUP BY p.id
) AS per_product;`,
    fix: `SELECT COUNT(*) AS products_in_result
FROM (
  SELECT p.id, COUNT(t.product_id) AS sales
  FROM products p
  LEFT JOIN transactions t
         ON t.product_id = p.id
        AND t.country = 'JP'
        AND t.start_time >= '2026-09-01'
        AND t.start_time <  '2026-10-01'
  GROUP BY p.id
) AS per_product;`,
  },
  {
    id: "left-count-star",
    core: true,
    sql: `SELECT p.id,
       COUNT(*)        AS count_star,
       COUNT(t.product_id) AS count_col
FROM products p
LEFT JOIN transactions t
       ON t.product_id = p.id
      AND t.country = 'JP'
      AND t.start_time >= '2026-09-01'
      AND t.start_time <  '2026-10-01'
WHERE p.id = 'prd_06'
GROUP BY p.id;`,
  },
  {
    id: "fanout",
    core: true,
    sql: `SELECT COUNT(*)          AS joined_rows,
       SUM(v.amount_usd) AS advanced_usd
FROM merchants m
JOIN products p     ON p.merchant_id = m.id
JOIN advances v ON v.merchant_id = m.id
WHERE m.id = 'mer_09';`,
    fix: `WITH product_counts AS (SELECT merchant_id, COUNT(*) AS products FROM products GROUP BY merchant_id),
     adv   AS (SELECT merchant_id, SUM(amount_usd) AS advanced_usd FROM advances GROUP BY merchant_id)
SELECT m.id, n.products, v.advanced_usd
FROM merchants m
JOIN product_counts n ON n.merchant_id = m.id
JOIN adv   v ON v.merchant_id = m.id
WHERE m.id = 'mer_09';`,
  },
  {
    id: "and-or",
    sql: `SELECT COUNT(*) FILTER (WHERE channel = 'web' OR channel = 'north_market' AND NOT is_test)   AS no_parens,
       COUNT(*) FILTER (WHERE (channel = 'web' OR channel = 'north_market') AND NOT is_test) AS with_parens
FROM transactions;`,
    fix: `SELECT COUNT(*) AS web_or_north_no_test
FROM transactions
WHERE (channel = 'web' OR channel = 'north_market') AND NOT is_test;`,
  },
  {
    id: "dquote",
    sql: `SELECT COUNT(*)
FROM transactions
WHERE channel = "web";`,
    fix: `SELECT COUNT(*)
FROM transactions
WHERE channel = 'web';`,
  },
  {
    id: "where-alias",
    core: true,
    sql: `SELECT transaction_id,
       revenue_usd * (1 - fee_rate) AS proceeds
FROM transactions
WHERE proceeds > 50;`,
    fix: `WITH t AS (
    SELECT transaction_id,
           revenue_usd * (1 - fee_rate) AS proceeds
    FROM transactions
)
SELECT transaction_id, proceeds
FROM t
WHERE proceeds > 50;`,
  },
  {
    id: "having-alias",
    sql: `SELECT country, COUNT(*) AS n
FROM transactions
GROUP BY country
HAVING n > 1000;`,
    fix: `SELECT country, COUNT(*) AS n
FROM transactions
GROUP BY country
HAVING COUNT(*) > 1000;`,
  },
  {
    id: "group-missing",
    sql: `SELECT country, channel, COUNT(*) AS n
FROM transactions
GROUP BY country;`,
    fix: `SELECT country, channel, COUNT(*) AS n
FROM transactions
GROUP BY country, channel;`,
  },
  {
    id: "window-where",
    core: true,
    sql: `SELECT customer_id, start_time
FROM transactions
WHERE ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY start_time) = 1;`,
    fix: `WITH ranked AS (
    SELECT customer_id, start_time,
           ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY start_time) AS rn
    FROM transactions
)
SELECT customer_id, start_time
FROM ranked
WHERE rn = 1;`,
  },
  {
    id: "distinct-on-order",
    sql: `SELECT DISTINCT ON (customer_id) customer_id, start_time, plan_id
FROM transactions
ORDER BY start_time DESC;`,
    fix: `SELECT DISTINCT ON (customer_id) customer_id, start_time, plan_id
FROM transactions
ORDER BY customer_id, start_time DESC, transaction_id DESC;`,
  },
  {
    id: "round-double",
    sql: `SELECT ROUND(AVG(charged_usd)::float8, 2) AS avg_price
FROM transactions;`,
    fix: `SELECT ROUND(AVG(charged_usd)::numeric, 2) AS avg_price
FROM transactions;`,
  },
  {
    id: "distinct-users",
    sql: `SELECT COUNT(*)                    AS transactions,
       COUNT(DISTINCT customer_id)  AS customers
FROM transactions
WHERE country = 'GE'
  AND NOT is_test
  AND start_time >= '2026-09-01' AND start_time < '2026-10-01';`,
  },
];
