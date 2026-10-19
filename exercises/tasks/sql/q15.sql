-- Q15. Daily revenue table per merchant and channel
-- Level: hard. Target time: 25 min.
--
-- TASK
--   Reports should read a small daily table, not every transaction. Build that table, fill it and use it, in one script of five steps.
--   (1) CREATE TABLE daily_merchant_revenue: day (DATE), merchant_id, channel, sales (INTEGER), gross_usd, refunds_usd, net_usd (NUMERIC(12,2)), with a primary key that allows one row per merchant, channel and day.
--   (2) Load the days [2026-09-01, 2026-09-30) so that running the load twice is safe: INSERT … SELECT … ON CONFLICT … DO UPDATE, or DELETE those days and INSERT them again in one transaction. A sale is a paid transaction (SCHEMA.md): not a trial, not a test purchase, not promo. It counts on the day of its start_time. sales and gross_usd: the number of sales and their SUM(charged_usd). refunds_usd: SUM(charged_usd) of the refunded sales. net_usd: what the merchant keeps: each sale adds charged_usd * (1 - fee_rate), each refund takes the same amount back, rounded to 2 decimals.
--   (3) Run the same load again, as a retried job would. Nothing may change.
--   (4) A refund arrived late: keep the given UPDATE as it is, then load only its day, [2026-09-22, 2026-09-23).
--   (5) The report, read from daily_merchant_revenue only: September so far, per merchant and channel, with the number of days that have at least one sale and the sums of the four measures.
--
-- ASK FIRST (say the question out loud, then read the answer):
--   Q: Which time zone defines the day?
--   A: UTC: every timestamp in the data is UTC.
--   Q: Which day does a refund count on: the day of the sale or the day of the refund?
--   A: The day of refunded_at, as in the proceeds of a month (SCHEMA.md). So a day that is already loaded does not change when one of its sales is refunded later.
--   Q: A merchant and channel with no sale and no refund on a day: a row of zeros, or no row?
--   A: No row: a missing row means 0. A day with refunds and no sales does get a row, with sales = 0.
--   Q: A refund arrives after its day was loaded. What happens to that row?
--   A: The job loads that day again, and the load replaces the row with the new totals. Step (4) does exactly that.
--
-- OUTPUT COLUMNS: merchant_id, channel, days_with_sales, sales, gross_usd, refunds_usd, net_usd
-- ORDER BY: merchant_id, channel
--
-- Tables: SCHEMA.md.  Run: uv run db.py tasks/sql/q15.sql   Check: uv run pytest -k q15
-- The script below already holds the UPDATE of step (4), so the test skips Q15 until you delete the START line.
-- START: delete this line to run the tests

-- your query below
-- Every run starts from the same data, so one script does all five steps.

-- (1) CREATE TABLE daily_merchant_revenue


-- (2) The load for [2026-09-01, 2026-09-30)


-- (3) The same load again


-- (4) A late refund: keep this UPDATE as it is.
UPDATE transactions
SET refunded_at = TIMESTAMP '2026-09-22 10:20:00', revenue_usd = 0
WHERE transaction_id = 't_007681';
--     Then the load for [2026-09-22, 2026-09-23) only.


-- (5) The report
