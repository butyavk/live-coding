-- Bugs: (1) the join to channel_payouts multiplies every transaction by the number of payouts;
--       (2) charged_usd is gross — net of refunds is revenue_usd;
--       (3) BETWEEN ... '2026-08-31' stops at 2026-08-31 00:00 — use a half-open interval.
SELECT m.id AS merchant_id,
       m.name              AS merchant_name,
       COUNT(*)            AS transactions,
       SUM(t.revenue_usd) AS net_usd
FROM merchants m
JOIN products p         ON p.merchant_id = m.id
JOIN transactions t ON t.product_id = p.id
WHERE t.start_time >= TIMESTAMP '2026-08-01'
  AND t.start_time <  TIMESTAMP '2026-09-01'
  AND NOT t.is_test
GROUP BY m.id, m.name
ORDER BY net_usd DESC, m.id;
