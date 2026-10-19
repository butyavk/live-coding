WITH days AS (
    SELECT CAST(d AS DATE) AS day
    FROM generate_series(TIMESTAMP '2026-09-01', TIMESTAMP '2026-09-29', INTERVAL '1 day') AS g(d)
),
daily AS (
    SELECT p.merchant_id,
           CAST(t.start_time AS DATE) AS day,
           SUM(t.revenue_usd)        AS net_usd
    FROM transactions t
    JOIN products p ON p.id = t.product_id
    WHERE NOT t.is_test
      AND t.start_time >= TIMESTAMP '2026-09-01'
      AND t.start_time <  TIMESTAMP '2026-09-30'
    GROUP BY 1, 2
),
grid AS (
    SELECT m.id AS merchant_id, days.day, COALESCE(daily.net_usd, 0) AS net_usd
    FROM merchants m
    CROSS JOIN days
    LEFT JOIN daily ON daily.merchant_id = m.id AND daily.day = days.day
)
SELECT merchant_id,
       day,
       net_usd,
       SUM(net_usd) OVER (PARTITION BY merchant_id ORDER BY day)          AS running_usd,
       ROUND(AVG(net_usd) OVER (PARTITION BY merchant_id ORDER BY day
                                ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 2) AS avg_7d_usd
FROM grid
ORDER BY merchant_id, day;
