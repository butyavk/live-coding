WITH movements AS (
    SELECT p.merchant_id, t.channel,
           CAST(date_trunc('month', t.start_time) AS DATE) AS period_month,
           t.charged_usd * (1 - t.fee_rate) AS net
    FROM transactions t JOIN products p ON p.id = t.product_id
    WHERE NOT t.is_test AND t.channel IN ('north_market', 'south_market')
    UNION ALL
    SELECT p.merchant_id, t.channel,
           CAST(date_trunc('month', t.refunded_at) AS DATE),
           -t.charged_usd * (1 - t.fee_rate)
    FROM transactions t JOIN products p ON p.id = t.product_id
    WHERE NOT t.is_test AND t.channel IN ('north_market', 'south_market') AND t.refunded_at IS NOT NULL
),
expected AS (
    SELECT merchant_id, channel, period_month, ROUND(SUM(net), 2) AS expected_usd
    FROM movements GROUP BY 1, 2, 3
),
checked AS (
    SELECT adv.advance_id,
           adv.merchant_id,
           adv.amount_usd > ROUND(0.70 * COALESCE(e.expected_usd, 0), 2) + 0.01          AS over_limit,
           m.advances_enrolled_at IS NULL OR adv.created_at < m.advances_enrolled_at         AS before_enrollment,
           ROW_NUMBER() OVER (PARTITION BY adv.idempotency_key
                              ORDER BY adv.created_at, adv.advance_id) > 1                  AS duplicate
    FROM advances adv
    JOIN merchants m ON m.id = adv.merchant_id
    LEFT JOIN expected e
           ON e.merchant_id = adv.merchant_id AND e.channel = adv.channel AND e.period_month = adv.period_month
)
SELECT advance_id, merchant_id, 'over_limit' AS issue FROM checked WHERE over_limit
UNION ALL
SELECT advance_id, merchant_id, 'before_enrollment' FROM checked WHERE before_enrollment
UNION ALL
SELECT advance_id, merchant_id, 'duplicate' FROM checked WHERE duplicate
ORDER BY advance_id, issue;
