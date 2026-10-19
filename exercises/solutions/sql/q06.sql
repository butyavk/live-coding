WITH ordered AS (
    SELECT customer_id,
           product_id,
           start_time,
           LAG(end_time) OVER (PARTITION BY customer_id, product_id
                               ORDER BY start_time, transaction_id) AS prev_end
    FROM transactions
    WHERE NOT is_test
)
SELECT customer_id,
       product_id,
       CAST(prev_end AS DATE)                           AS lapsed_on,
       CAST(start_time AS DATE)                         AS returned_on,
       CAST(start_time AS DATE) - CAST(prev_end AS DATE) AS gap_days
FROM ordered
WHERE start_time > prev_end + INTERVAL '30 days'
ORDER BY returned_on, customer_id, product_id;
