SELECT t.product_id,
       p.name            AS product_name,
       m.name            AS merchant_name,
       SUM(t.revenue_usd) AS net_usd
FROM transactions t
JOIN products p       ON p.id = t.product_id
JOIN merchants m ON m.id = p.merchant_id
WHERE NOT t.is_test
  AND t.start_time >= TIMESTAMP '2026-09-30' - INTERVAL '30 days'
  AND t.start_time <  TIMESTAMP '2026-09-30'
GROUP BY t.product_id, p.name, m.name
ORDER BY net_usd DESC, t.product_id
LIMIT 5;
