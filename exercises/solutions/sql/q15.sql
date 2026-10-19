-- 1. The grain is one row per UTC day, merchant and channel: the primary key enforces it.
CREATE TABLE daily_merchant_revenue (
    day          DATE          NOT NULL,
    merchant_id  TEXT          NOT NULL,
    channel      TEXT          NOT NULL,
    sales        INTEGER       NOT NULL,
    gross_usd    NUMERIC(12,2) NOT NULL,
    refunds_usd  NUMERIC(12,2) NOT NULL,
    net_usd      NUMERIC(12,2) NOT NULL,
    PRIMARY KEY (day, merchant_id, channel)
);

-- 2. The load for [2026-09-01, 2026-09-30). A sale counts on the day of start_time, a refund on
--    the day of refunded_at, so a day with refunds and no sales gets a row too. ON CONFLICT
--    replaces the totals (EXCLUDED), never adds to them: a second run changes nothing.
INSERT INTO daily_merchant_revenue (day, merchant_id, channel, sales, gross_usd, refunds_usd, net_usd)
SELECT day, merchant_id, channel,
       SUM(sales), SUM(gross), SUM(refunded), ROUND(SUM(proceeds), 2)
FROM (
    SELECT CAST(t.start_time AS DATE) AS day, p.merchant_id, t.channel,
           1 AS sales, t.charged_usd AS gross, 0 AS refunded,
           t.charged_usd * (1 - t.fee_rate) AS proceeds
    FROM transactions t
    JOIN products p ON p.id = t.product_id
    WHERE NOT t.is_trial AND NOT t.is_test AND t.channel <> 'promo'
      AND t.start_time >= TIMESTAMP '2026-09-01' AND t.start_time < TIMESTAMP '2026-09-30'
    UNION ALL
    SELECT CAST(t.refunded_at AS DATE), p.merchant_id, t.channel,
           0, 0, t.charged_usd,
           -t.charged_usd * (1 - t.fee_rate)
    FROM transactions t
    JOIN products p ON p.id = t.product_id
    WHERE NOT t.is_trial AND NOT t.is_test AND t.channel <> 'promo'
      AND t.refunded_at >= TIMESTAMP '2026-09-01' AND t.refunded_at < TIMESTAMP '2026-09-30'
) AS m
GROUP BY day, merchant_id, channel
ON CONFLICT (day, merchant_id, channel) DO UPDATE
SET sales       = EXCLUDED.sales,
    gross_usd   = EXCLUDED.gross_usd,
    refunds_usd = EXCLUDED.refunds_usd,
    net_usd     = EXCLUDED.net_usd;

-- 3. The same load again, as a retried job would run it.
INSERT INTO daily_merchant_revenue (day, merchant_id, channel, sales, gross_usd, refunds_usd, net_usd)
SELECT day, merchant_id, channel,
       SUM(sales), SUM(gross), SUM(refunded), ROUND(SUM(proceeds), 2)
FROM (
    SELECT CAST(t.start_time AS DATE) AS day, p.merchant_id, t.channel,
           1 AS sales, t.charged_usd AS gross, 0 AS refunded,
           t.charged_usd * (1 - t.fee_rate) AS proceeds
    FROM transactions t
    JOIN products p ON p.id = t.product_id
    WHERE NOT t.is_trial AND NOT t.is_test AND t.channel <> 'promo'
      AND t.start_time >= TIMESTAMP '2026-09-01' AND t.start_time < TIMESTAMP '2026-09-30'
    UNION ALL
    SELECT CAST(t.refunded_at AS DATE), p.merchant_id, t.channel,
           0, 0, t.charged_usd,
           -t.charged_usd * (1 - t.fee_rate)
    FROM transactions t
    JOIN products p ON p.id = t.product_id
    WHERE NOT t.is_trial AND NOT t.is_test AND t.channel <> 'promo'
      AND t.refunded_at >= TIMESTAMP '2026-09-01' AND t.refunded_at < TIMESTAMP '2026-09-30'
) AS m
GROUP BY day, merchant_id, channel
ON CONFLICT (day, merchant_id, channel) DO UPDATE
SET sales       = EXCLUDED.sales,
    gross_usd   = EXCLUDED.gross_usd,
    refunds_usd = EXCLUDED.refunds_usd,
    net_usd     = EXCLUDED.net_usd;

-- 4. The late refund (given), then the load for that day only: [2026-09-22, 2026-09-23).
UPDATE transactions
SET refunded_at = TIMESTAMP '2026-09-22 10:20:00', revenue_usd = 0
WHERE transaction_id = 't_007681';

INSERT INTO daily_merchant_revenue (day, merchant_id, channel, sales, gross_usd, refunds_usd, net_usd)
SELECT day, merchant_id, channel,
       SUM(sales), SUM(gross), SUM(refunded), ROUND(SUM(proceeds), 2)
FROM (
    SELECT CAST(t.start_time AS DATE) AS day, p.merchant_id, t.channel,
           1 AS sales, t.charged_usd AS gross, 0 AS refunded,
           t.charged_usd * (1 - t.fee_rate) AS proceeds
    FROM transactions t
    JOIN products p ON p.id = t.product_id
    WHERE NOT t.is_trial AND NOT t.is_test AND t.channel <> 'promo'
      AND t.start_time >= TIMESTAMP '2026-09-22' AND t.start_time < TIMESTAMP '2026-09-23'
    UNION ALL
    SELECT CAST(t.refunded_at AS DATE), p.merchant_id, t.channel,
           0, 0, t.charged_usd,
           -t.charged_usd * (1 - t.fee_rate)
    FROM transactions t
    JOIN products p ON p.id = t.product_id
    WHERE NOT t.is_trial AND NOT t.is_test AND t.channel <> 'promo'
      AND t.refunded_at >= TIMESTAMP '2026-09-22' AND t.refunded_at < TIMESTAMP '2026-09-23'
) AS m
GROUP BY day, merchant_id, channel
ON CONFLICT (day, merchant_id, channel) DO UPDATE
SET sales       = EXCLUDED.sales,
    gross_usd   = EXCLUDED.gross_usd,
    refunds_usd = EXCLUDED.refunds_usd,
    net_usd     = EXCLUDED.net_usd;

-- 5. The report reads only the table.
SELECT merchant_id,
       channel,
       COUNT(*) FILTER (WHERE sales > 0) AS days_with_sales,
       SUM(sales)       AS sales,
       SUM(gross_usd)   AS gross_usd,
       SUM(refunds_usd) AS refunds_usd,
       SUM(net_usd)     AS net_usd
FROM daily_merchant_revenue
WHERE day >= DATE '2026-09-01' AND day < DATE '2026-09-30'
GROUP BY merchant_id, channel
ORDER BY merchant_id, channel;
