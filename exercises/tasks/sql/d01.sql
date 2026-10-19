-- D01. DEBUG: merchant revenue report for August 2026      Target time: 12 min.
--
-- BUG REPORT (from finance)
--   "The August report below looks wrong. The totals are much higher than what we see in the
--    channel dashboards, and sales from August 31 seem to be missing. Please fix the query."
--
-- What the report SHOULD show
--   Per merchant: number of transactions and revenue NET of refunds for August 2026
--   (UTC, start_time in [2026-08-01, 2026-09-01)), test purchases excluded, trials and promo included.
--   Only merchants with at least one transaction.
--
-- OUTPUT COLUMNS: merchant_id, merchant_name, transactions, net_usd
-- ORDER BY: net_usd DESC, merchant_id
--
-- HOW TO PRACTISE: delete the START line below, run `python db.py tasks/sql/d01.sql`, look at the numbers,
-- find the bugs one by one and say each one out loud before you fix it. Check: pytest -k d01
-- START: delete this line to run the tests

-- your query below
SELECT m.id AS merchant_id,
       m.name                       AS merchant_name,
       COUNT(*)                     AS transactions,
       SUM(t.charged_usd) AS net_usd
FROM merchants m
JOIN products p           ON p.merchant_id = m.id
JOIN transactions t       ON t.product_id = p.id
LEFT JOIN channel_payouts cp ON cp.merchant_id = m.id
WHERE t.start_time BETWEEN TIMESTAMP '2026-08-01' AND TIMESTAMP '2026-08-31'
  AND NOT t.is_test
GROUP BY m.id, m.name
ORDER BY net_usd DESC, m.id;
