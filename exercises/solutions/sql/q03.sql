SELECT product_id,
       COUNT(*) AS active_subscriptions
FROM transactions
WHERE start_time <= TIMESTAMP '2026-09-01'
  AND end_time   >  TIMESTAMP '2026-09-01'
  AND NOT is_trial
  AND NOT is_test
  AND channel <> 'promo'
  AND (refunded_at IS NULL OR refunded_at > TIMESTAMP '2026-09-01')
GROUP BY product_id
ORDER BY active_subscriptions DESC, product_id;
