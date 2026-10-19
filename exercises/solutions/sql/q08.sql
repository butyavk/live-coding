WITH trials AS (
    SELECT plan_id, original_transaction_id
    FROM transactions
    WHERE is_trial
      AND NOT is_test
      AND start_time >= TIMESTAMP '2026-04-01'
      AND start_time <  TIMESTAMP '2026-07-01'
),
conversions AS (
    SELECT DISTINCT original_transaction_id
    FROM transactions
    WHERE is_trial_conversion
      AND NOT is_test
)
SELECT t.plan_id,
       COUNT(*)                                   AS trials,
       COUNT(c.original_transaction_id)     AS conversions,
       ROUND(1.0 * COUNT(c.original_transaction_id) / COUNT(*), 3) AS conversion_rate
FROM trials t
LEFT JOIN conversions c USING (original_transaction_id)
GROUP BY t.plan_id
ORDER BY t.plan_id;
