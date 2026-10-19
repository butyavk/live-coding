WITH movements AS (
    -- sales count in the month of the purchase
    SELECT pr.merchant_id, t.channel,
           CAST(date_trunc('month', t.start_time) AS DATE) AS period_month,
           t.charged_usd * (1 - t.fee_rate) AS net
    FROM transactions t
    JOIN products pr ON pr.id = t.product_id
    WHERE NOT t.is_test AND t.channel IN ('north_market', 'south_market')
    UNION ALL
    -- refunds are taken back in the month of the refund
    SELECT pr.merchant_id, t.channel,
           CAST(date_trunc('month', t.refunded_at) AS DATE),
           -t.charged_usd * (1 - t.fee_rate)
    FROM transactions t
    JOIN products pr ON pr.id = t.product_id
    WHERE NOT t.is_test AND t.channel IN ('north_market', 'south_market') AND t.refunded_at IS NOT NULL
),
expected AS (
    SELECT merchant_id, channel, period_month, ROUND(SUM(net), 2) AS expected_usd
    FROM movements
    WHERE period_month BETWEEN DATE '2026-01-01' AND DATE '2026-08-01'
    GROUP BY 1, 2, 3
    HAVING ROUND(SUM(net), 2) > 0
),
paid AS (
    SELECT merchant_id, channel, period_month, SUM(amount_usd) AS paid_usd, COUNT(*) AS payouts
    FROM channel_payouts
    GROUP BY 1, 2, 3
),
joined AS (
    SELECT COALESCE(e.merchant_id, p.merchant_id) AS merchant_id,
           COALESCE(e.channel, p.channel)               AS channel,
           COALESCE(e.period_month, p.period_month) AS period_month,
           e.expected_usd,
           p.paid_usd,
           p.payouts
    FROM expected e
    FULL OUTER JOIN paid p
      ON p.merchant_id = e.merchant_id AND p.channel = e.channel AND p.period_month = e.period_month
)
SELECT *
FROM (
    SELECT merchant_id, channel, period_month, expected_usd, paid_usd,
           CASE
               WHEN payouts > 1              THEN 'duplicate_payout'
               WHEN expected_usd IS NULL     THEN 'unexpected_payout'
               WHEN paid_usd IS NULL AND TIMESTAMP '2026-09-30' <
                    period_month + INTERVAL '1 month'
                    + CASE WHEN channel = 'north_market' THEN INTERVAL '32 days' ELSE INTERVAL '14 days' END
                                             THEN 'not_due_yet'
               WHEN paid_usd IS NULL         THEN 'missing_payout'
               WHEN ABS(expected_usd - paid_usd) <= 1.00 THEN 'matched'
               ELSE 'mismatch'
           END AS status
    FROM joined
) AS s
WHERE status <> 'matched'   -- not "NOT (payouts = 1 AND ...)": NULL would drop the missing rows
ORDER BY merchant_id, channel, period_month;
