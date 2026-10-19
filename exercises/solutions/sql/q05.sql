WITH months AS (
    SELECT CAST(m AS DATE) AS month
    FROM generate_series(TIMESTAMP '2026-01-01', TIMESTAMP '2026-09-01', INTERVAL '1 month') AS g(m)
),
revenue AS (
    SELECT p.merchant_id,
           CAST(date_trunc('month', t.start_time) AS DATE) AS month,
           SUM(t.revenue_usd) AS net_usd
    FROM transactions t
    JOIN products p ON p.id = t.product_id
    WHERE NOT t.is_test
      AND t.start_time >= TIMESTAMP '2026-01-01'
      AND t.start_time <  TIMESTAMP '2026-10-01'
    GROUP BY 1, 2
)
SELECT m.id AS merchant_id,
       mo.month,
       COALESCE(r.net_usd, 0) AS net_usd
FROM merchants m
CROSS JOIN months mo
LEFT JOIN revenue r ON r.merchant_id = m.id AND r.month = mo.month
ORDER BY m.id, mo.month;
