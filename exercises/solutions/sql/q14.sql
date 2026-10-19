WITH per_advance AS (
    SELECT merchant_id,
           advance_id,
           SUM(amount_usd) AS outstanding_usd,
           MIN(created_at) FILTER (WHERE entry_type = 'advance') AS advanced_at
    FROM ledger_entries
    WHERE created_at < TIMESTAMP '2026-09-30'
    GROUP BY 1, 2
)
SELECT merchant_id,
       SUM(outstanding_usd)                                       AS outstanding_usd,
       COUNT(*) FILTER (WHERE outstanding_usd > 0)                AS open_advances,
       CAST(MIN(advanced_at) FILTER (WHERE outstanding_usd > 0) AS DATE) AS oldest_open_advance_on
FROM per_advance
GROUP BY merchant_id
HAVING SUM(outstanding_usd) > 0
ORDER BY outstanding_usd DESC, merchant_id;
