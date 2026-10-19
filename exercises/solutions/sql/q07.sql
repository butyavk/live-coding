WITH latest AS (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY customer_id, product_id
                              ORDER BY start_time DESC, transaction_id DESC) AS rn
    FROM transactions
    WHERE NOT is_test
      AND channel <> 'promo'
)
SELECT product_id,
       CASE
           WHEN end_time > TIMESTAMP '2026-09-30' AND refunded_at IS NULL AND is_trial THEN 'trial'
           WHEN end_time > TIMESTAMP '2026-09-30' AND refunded_at IS NULL THEN 'active'
           ELSE 'expired'
       END      AS status,
       COUNT(*) AS customers
FROM latest
WHERE rn = 1
GROUP BY 1, 2
ORDER BY product_id, status;
