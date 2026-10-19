SELECT channel,
       COUNT(*)                    AS transactions,
       SUM(charged_usd)  AS gross_usd,
       SUM(revenue_usd)           AS net_usd
FROM transactions
WHERE NOT is_test
  AND start_time >= TIMESTAMP '2026-08-01'
  AND start_time <  TIMESTAMP '2026-09-01'
GROUP BY channel
ORDER BY gross_usd DESC, channel;
