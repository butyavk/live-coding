WITH days AS (
    SELECT d AS day_start
    FROM generate_series(TIMESTAMP '2026-09-01', TIMESTAMP '2026-09-30', INTERVAL '1 day') AS g(d)
)
SELECT CAST(days.day_start AS DATE)     AS day,
       COUNT(t.transaction_id)    AS active_subscriptions
FROM days
LEFT JOIN transactions t
       ON t.start_time <= days.day_start
      AND t.end_time   >  days.day_start
      AND NOT t.is_trial
      AND NOT t.is_test
      AND t.channel <> 'promo'
      AND (t.refunded_at IS NULL OR t.refunded_at > days.day_start)
GROUP BY days.day_start
ORDER BY day;
