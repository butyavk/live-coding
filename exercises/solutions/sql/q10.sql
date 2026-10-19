WITH chains AS (
    SELECT original_transaction_id AS chain_id,
           product_id,
           MIN(start_time) AS first_start,
           MAX(end_time)   AS last_end
    FROM transactions
    WHERE NOT is_trial
      AND NOT is_test
      AND channel <> 'promo'
      AND refunded_at IS NULL
    GROUP BY original_transaction_id, product_id
),
active AS (
    SELECT *
    FROM chains
    WHERE first_start <= TIMESTAMP '2026-08-01'
      AND last_end    >  TIMESTAMP '2026-08-01'
)
SELECT product_id,
       COUNT(*)                                                     AS active_at_start,
       COUNT(*) FILTER (WHERE last_end <= TIMESTAMP '2026-09-01')    AS churned,
       ROUND(1.0 * COUNT(*) FILTER (WHERE last_end <= TIMESTAMP '2026-09-01') / COUNT(*), 4) AS churn_rate
FROM active
GROUP BY product_id
ORDER BY churn_rate DESC, product_id;
