-- Hidden edge-case data for Check. After the practice data is loaded, this copies every table
-- into the schema `edge` and changes the copy so that the traps the visible data cannot show
-- become visible: Check runs a SQL answer on the practice data and then on `edge`, and both must
-- match the reference. The practice data itself (schema public) is never changed.
--
-- Runs as it is in PostgreSQL (the browser worker and scripts/build-exercises.mjs) and in DuckDB
-- (exercises/tests/test_sql.py), so it sticks to SQL both understand. Deterministic: no random().

CREATE SCHEMA edge;
CREATE TABLE edge.merchants AS SELECT * FROM merchants;
CREATE TABLE edge.products AS SELECT * FROM products;
CREATE TABLE edge.transactions AS SELECT * FROM transactions;
CREATE TABLE edge.webhook_events AS SELECT * FROM webhook_events;
CREATE TABLE edge.channel_payouts AS SELECT * FROM channel_payouts;
CREATE TABLE edge.advances AS SELECT * FROM advances;
CREATE TABLE edge.ledger_entries AS SELECT * FROM ledger_entries;

-- 1. A day with no activity: nothing is active at 2026-09-12 00:00 and nothing starts that day.
--    A daily report without a calendar, or with COUNT(*) after a LEFT JOIN, gets this day wrong (Q04).
--    The 24 sales of 12 September are removed. The periods that run through that moment are not
--    removed: they end exactly at it. So what is active at any earlier moment (1 August,
--    1 September, 10 September) stays as in the practice data, and apart from those 24 sales so do
--    revenue and refunds; only what is active after the moment changes. Every row added below is
--    over (ended or refunded) before that moment, or starts after that day.
DELETE FROM edge.transactions
WHERE start_time >= TIMESTAMP '2026-09-12 00:00:00' AND start_time < TIMESTAMP '2026-09-13 00:00:00';
UPDATE edge.transactions SET end_time = TIMESTAMP '2026-09-12 00:00:00'
WHERE start_time < TIMESTAMP '2026-09-12 00:00:00' AND end_time > TIMESTAMP '2026-09-12 00:00:00';

-- 2. A quiet month: mer_05 sells nothing in August 2026. Monthly reports must still show it with 0;
--    its August South Market payout becomes a payout with nothing expected behind it.
DELETE FROM edge.transactions
WHERE product_id IN (SELECT id FROM edge.products WHERE merchant_id = 'mer_05')
  AND start_time >= TIMESTAMP '2026-08-01 00:00:00' AND start_time < TIMESTAMP '2026-09-01 00:00:00';

-- 3. Both edges of a month (Q01, August): sales during 31 August, which BETWEEN … '2026-08-31'
--    loses, and a sale exactly at 2026-09-01 00:00, which belongs to September and which
--    BETWEEN … '2026-09-01' wrongly counts. A promo grant, a web sale and a marketplace sale refunded
--    the same evening. Weekly plans, so they end before 12 September (section 1). Nothing here
--    happens after "today" (2026-09-30 00:00): hidden data must not contradict it.
INSERT INTO edge.transactions VALUES
  ('t_900001', 't_900001', 'cus_09001', 'prd_12', 'prd_12.weekly', 'P1W', 'promo', false, false, 1,
   TIMESTAMP '2026-08-31 09:15:00', TIMESTAMP '2026-09-07 09:15:00', 0.00, 0.00, 0.0000, NULL, false, 'US'),
  ('t_900002', 't_900002', 'cus_09002', 'prd_16', 'prd_16.weekly', 'P1W', 'web', false, false, 1,
   TIMESTAMP '2026-08-31 13:40:00', TIMESTAMP '2026-09-07 13:40:00', 2.99, 2.99, 0.0300, NULL, false, 'DE'),
  ('t_900003', 't_900003', 'cus_09003', 'prd_12', 'prd_12.weekly', 'P1W', 'north_market', false, false, 1,
   TIMESTAMP '2026-08-31 10:30:00', TIMESTAMP '2026-09-07 10:30:00', 2.99, 0.00, 0.1500,
   TIMESTAMP '2026-08-31 18:00:00', false, 'GB'),
  ('t_900101', 't_900101', 'cus_09101', 'prd_08', 'prd_08.weekly', 'P1W', 'south_market', false, false, 1,
   TIMESTAMP '2026-09-01 00:00:00', TIMESTAMP '2026-09-08 00:00:00', 2.99, 2.99, 0.1500, NULL, false, 'US');

-- 4. The boundaries of "active at 2026-09-01 00:00" (Q03): a period that ends exactly at that
--    moment, and one refunded exactly at that moment. Neither is active (t_900101 in section 3
--    starts exactly then and is active). The first one is also a subscription that is active on
--    1 August and not active on 1 September: churned in August (Q10).
INSERT INTO edge.transactions VALUES
  ('t_900004', 't_900004', 'cus_09004', 'prd_04', 'prd_04.monthly', 'P1M', 'north_market', false, false, 1,
   TIMESTAMP '2026-08-01 00:00:00', TIMESTAMP '2026-09-01 00:00:00', 6.99, 6.99, 0.1500, NULL, false, 'US'),
  ('t_900005', 't_900005', 'cus_09005', 'prd_04', 'prd_04.monthly', 'P1M', 'south_market', false, false, 1,
   TIMESTAMP '2026-08-20 08:00:00', TIMESTAMP '2026-09-20 08:00:00', 6.99, 0.00, 0.1500,
   TIMESTAMP '2026-09-01 00:00:00', false, 'US');

-- 5. Ties on start_time for one customer and product: "latest" needs a second key
--    (transaction_id DESC). The rows are inserted in both orders, so a query without the
--    tie-breaker gets at least one customer wrong whichever tied row it happens to keep. For Q07
--    the tied rows have different statuses: in cus_09011 and cus_09012 the trial has the larger id
--    (status 'expired'), in cus_09112 and cus_09113 the paid month has it (status 'active').
INSERT INTO edge.transactions VALUES
  ('t_900011', 't_900011', 'cus_09011', 'prd_05', 'prd_05.monthly', 'P1M', 'north_market', false, false, 1,
   TIMESTAMP '2026-09-20 10:00:00', TIMESTAMP '2026-10-20 10:00:00', 9.99, 9.99, 0.1500, NULL, false, 'US'),
  ('t_900012', 't_900012', 'cus_09011', 'prd_05', 'prd_05.monthly', 'P1M', 'north_market', true, false, 1,
   TIMESTAMP '2026-09-20 10:00:00', TIMESTAMP '2026-09-27 10:00:00', 0.00, 0.00, 0.1500, NULL, false, 'US'),
  ('t_900014', 't_900014', 'cus_09012', 'prd_05', 'prd_05.monthly', 'P1M', 'south_market', true, false, 1,
   TIMESTAMP '2026-09-21 11:00:00', TIMESTAMP '2026-09-28 11:00:00', 0.00, 0.00, 0.1500, NULL, false, 'FR'),
  ('t_900013', 't_900013', 'cus_09012', 'prd_05', 'prd_05.monthly', 'P1M', 'south_market', false, false, 1,
   TIMESTAMP '2026-09-21 11:00:00', TIMESTAMP '2026-10-21 11:00:00', 9.99, 9.99, 0.1500, NULL, false, 'FR'),
  ('t_900015', 't_900015', 'cus_09013', 'prd_03', 'prd_03.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2026-09-22 09:00:00', TIMESTAMP '2026-10-22 09:00:00', 4.99, 4.99, 0.0300, NULL, false, 'ES'),
  ('t_900016', 't_900016', 'cus_09013', 'prd_03', 'prd_03.annual', 'P1Y', 'web', false, false, 1,
   TIMESTAMP '2026-09-22 09:00:00', TIMESTAMP '2027-09-22 09:00:00', 79.99, 79.99, 0.0300, NULL, false, 'ES'),
  ('t_900018', 't_900018', 'cus_09014', 'prd_03', 'prd_03.annual', 'P1Y', 'web', false, false, 1,
   TIMESTAMP '2026-09-23 15:00:00', TIMESTAMP '2027-09-23 15:00:00', 79.99, 79.99, 0.0300, NULL, false, 'ES'),
  ('t_900017', 't_900017', 'cus_09014', 'prd_03', 'prd_03.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2026-09-23 15:00:00', TIMESTAMP '2026-10-23 15:00:00', 4.99, 4.99, 0.0300, NULL, false, 'ES'),
  ('t_900113', 't_900113', 'cus_09112', 'prd_09', 'prd_09.monthly', 'P1M', 'north_market', false, false, 1,
   TIMESTAMP '2026-09-22 14:00:00', TIMESTAMP '2026-10-22 14:00:00', 7.99, 7.99, 0.1500, NULL, false, 'PL'),
  ('t_900112', 't_900112', 'cus_09112', 'prd_09', 'prd_09.monthly', 'P1M', 'north_market', true, false, 1,
   TIMESTAMP '2026-09-22 14:00:00', TIMESTAMP '2026-09-29 14:00:00', 0.00, 0.00, 0.1500, NULL, false, 'PL'),
  ('t_900114', 't_900114', 'cus_09113', 'prd_09', 'prd_09.monthly', 'P1M', 'north_market', true, false, 1,
   TIMESTAMP '2026-09-22 16:00:00', TIMESTAMP '2026-09-29 16:00:00', 0.00, 0.00, 0.1500, NULL, false, 'PL'),
  ('t_900115', 't_900115', 'cus_09113', 'prd_09', 'prd_09.monthly', 'P1M', 'north_market', false, false, 1,
   TIMESTAMP '2026-09-22 16:00:00', TIMESTAMP '2026-10-22 16:00:00', 7.99, 7.99, 0.1500, NULL, false, 'PL');

-- 6. An advance for a merchant who never joined the advances program (Q13 'before_enrollment').
INSERT INTO edge.advances VALUES
  ('adv_0901', 'mer_02', 'north_market', DATE '2026-08-01', 10.00, 0.30, 'mer_02:north_market:2026-08-01',
   TIMESTAMP '2026-09-02 10:00:00');
INSERT INTO edge.ledger_entries VALUES
  ('le_00901', 'mer_02', 'adv_0901', 'advance', 10.00, TIMESTAMP '2026-09-02 10:00:00'),
  ('le_00902', 'mer_02', 'adv_0901', 'fee', 0.30, TIMESTAMP '2026-09-02 10:00:00');

-- 7. A tie across the edge of a top 5 (Q02). Of the last 30 days, the fifth to the eighth product
--    each get one more web sale that brings their net revenue exactly level with the fourth. Five
--    products then share places 4 to 8, and only a second sort key (product_id) decides which two
--    of them are in the top 5. Without it the database keeps the tied rows it happens to meet first,
--    and with five of them a lucky pick is unlikely. (Check compares the hidden result as a set of
--    rows, so a tie inside the top 5 would not be seen: the tie must cross the LIMIT.)
INSERT INTO edge.transactions
SELECT 't_9' || ids.sfx, 't_9' || ids.sfx, 'cus_0' || ids.cus, r.product_id, r.product_id || '.monthly', 'P1M', 'web',
       false, false, 1, TIMESTAMP '2026-09-20 12:00:00', TIMESTAMP '2026-10-20 12:00:00',
       lvl.net - r.net, lvl.net - r.net, 0.0300, NULL, false, 'US'
FROM (
    SELECT product_id, net, ROW_NUMBER() OVER (ORDER BY net DESC, product_id) AS rn
    FROM (
        SELECT product_id, SUM(revenue_usd) AS net
        FROM edge.transactions
        WHERE NOT is_test
          AND start_time >= TIMESTAMP '2026-08-31 00:00:00'
          AND start_time <  TIMESTAMP '2026-09-30 00:00:00'
        GROUP BY product_id
    ) AS s
) AS r
JOIN (VALUES (5, '00118', '9118'), (6, '00117', '9117'), (7, '00116', '9116'), (8, '00030', '9030')) AS ids(rn, sfx, cus)
  ON ids.rn = r.rn
JOIN (
    SELECT net, ROW_NUMBER() OVER (ORDER BY net DESC, product_id) AS rn
    FROM (
        SELECT product_id, SUM(revenue_usd) AS net
        FROM edge.transactions
        WHERE NOT is_test
          AND start_time >= TIMESTAMP '2026-08-31 00:00:00'
          AND start_time <  TIMESTAMP '2026-09-30 00:00:00'
        GROUP BY product_id
    ) AS s
) AS lvl ON lvl.rn = 4
WHERE lvl.net > r.net;

-- 8. Two plans bought at the same moment, where the order decides the gap (Q06). Each customer has
--    a month, a break, a weekly and a monthly plan that start together (the weekly one has the
--    smaller id), and a return after a second break. "Previous" is by start_time, then
--    transaction_id, so the weekly plan comes first and the second break runs from the end of the
--    monthly plan: 45 days. With the monthly plan first it would run from the end of the weekly
--    plan, while the customer still had the monthly one: 68 days. The pairs are inserted in both
--    orders, so a query without the tie-breaker, or with transaction_id DESC, gets at least one
--    customer wrong. Web checkout, 2025: far from every other task.
INSERT INTO edge.transactions VALUES
  ('t_900120', 't_900120', 'cus_09120', 'prd_16', 'prd_16.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2025-01-10 10:00:00', TIMESTAMP '2025-02-10 10:00:00', 9.99, 9.99, 0.0300, NULL, false, 'NL'),
  ('t_900121', 't_900121', 'cus_09120', 'prd_16', 'prd_16.weekly', 'P1W', 'web', false, false, 1,
   TIMESTAMP '2025-04-01 10:00:00', TIMESTAMP '2025-04-08 10:00:00', 2.99, 2.99, 0.0300, NULL, false, 'NL'),
  ('t_900122', 't_900122', 'cus_09120', 'prd_16', 'prd_16.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2025-04-01 10:00:00', TIMESTAMP '2025-05-01 10:00:00', 9.99, 9.99, 0.0300, NULL, false, 'NL'),
  ('t_900123', 't_900123', 'cus_09120', 'prd_16', 'prd_16.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2025-06-15 10:00:00', TIMESTAMP '2025-07-15 10:00:00', 9.99, 9.99, 0.0300, NULL, false, 'NL'),
  ('t_900124', 't_900124', 'cus_09121', 'prd_16', 'prd_16.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2025-01-11 10:00:00', TIMESTAMP '2025-02-11 10:00:00', 9.99, 9.99, 0.0300, NULL, false, 'NL'),
  ('t_900126', 't_900126', 'cus_09121', 'prd_16', 'prd_16.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2025-04-02 10:00:00', TIMESTAMP '2025-05-02 10:00:00', 9.99, 9.99, 0.0300, NULL, false, 'NL'),
  ('t_900125', 't_900125', 'cus_09121', 'prd_16', 'prd_16.weekly', 'P1W', 'web', false, false, 1,
   TIMESTAMP '2025-04-02 10:00:00', TIMESTAMP '2025-04-09 10:00:00', 2.99, 2.99, 0.0300, NULL, false, 'NL'),
  ('t_900127', 't_900127', 'cus_09121', 'prd_16', 'prd_16.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2025-06-16 10:00:00', TIMESTAMP '2025-07-16 10:00:00', 9.99, 9.99, 0.0300, NULL, false, 'NL'),
  ('t_900128', 't_900128', 'cus_09122', 'prd_08', 'prd_08.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2025-01-12 10:00:00', TIMESTAMP '2025-02-12 10:00:00', 6.99, 6.99, 0.0300, NULL, false, 'NL'),
  ('t_900129', 't_900129', 'cus_09122', 'prd_08', 'prd_08.weekly', 'P1W', 'web', false, false, 1,
   TIMESTAMP '2025-04-03 10:00:00', TIMESTAMP '2025-04-10 10:00:00', 2.99, 2.99, 0.0300, NULL, false, 'NL'),
  ('t_900130', 't_900130', 'cus_09122', 'prd_08', 'prd_08.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2025-04-03 10:00:00', TIMESTAMP '2025-05-03 10:00:00', 6.99, 6.99, 0.0300, NULL, false, 'NL'),
  ('t_900131', 't_900131', 'cus_09122', 'prd_08', 'prd_08.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2025-06-17 10:00:00', TIMESTAMP '2025-07-17 10:00:00', 6.99, 6.99, 0.0300, NULL, false, 'NL'),
  ('t_900132', 't_900132', 'cus_09123', 'prd_08', 'prd_08.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2025-01-13 10:00:00', TIMESTAMP '2025-02-13 10:00:00', 6.99, 6.99, 0.0300, NULL, false, 'NL'),
  ('t_900134', 't_900134', 'cus_09123', 'prd_08', 'prd_08.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2025-04-04 10:00:00', TIMESTAMP '2025-05-04 10:00:00', 6.99, 6.99, 0.0300, NULL, false, 'NL'),
  ('t_900133', 't_900133', 'cus_09123', 'prd_08', 'prd_08.weekly', 'P1W', 'web', false, false, 1,
   TIMESTAMP '2025-04-04 10:00:00', TIMESTAMP '2025-04-11 10:00:00', 2.99, 2.99, 0.0300, NULL, false, 'NL'),
  ('t_900135', 't_900135', 'cus_09123', 'prd_08', 'prd_08.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2025-06-18 10:00:00', TIMESTAMP '2025-07-18 10:00:00', 6.99, 6.99, 0.0300, NULL, false, 'NL');

-- 9. A month with a refund and no sales (Q12): an annual South Market sale of mer_05 from December
--    2025, refunded in August 2026, when mer_05 sells nothing (section 2). Its expected proceeds for
--    August are negative, so the row is ignored, and the August payout stays 'unexpected_payout'.
INSERT INTO edge.transactions VALUES
  ('t_900110', 't_900110', 'cus_09110', 'prd_05', 'prd_05.annual', 'P1Y', 'south_market', false, false, 1,
   TIMESTAMP '2025-12-05 11:00:00', TIMESTAMP '2026-12-05 11:00:00', 39.99, 0.00, 0.3000,
   TIMESTAMP '2026-08-10 12:00:00', false, 'GE');

-- 10. An advance whose limit a refund moves (Q13): mer_11, South Market, May 2026. May sales give
--     216.58 of proceeds, a refund in May takes 25.49 back, so the limit is 70% of 191.09 = 133.76.
--     The advance of 140.00 is over it; without the refund (151.61) it would not be. Created after
--     mer_11 joined the program and repaid when the payout arrived, so its balance is 0 (Q14).
INSERT INTO edge.advances VALUES
  ('adv_0911', 'mer_11', 'south_market', DATE '2026-05-01', 140.00, 4.20, 'mer_11:south_market:2026-05-01',
   TIMESTAMP '2026-06-15 08:00:00');
INSERT INTO edge.ledger_entries VALUES
  ('le_009101', 'mer_11', 'adv_0911', 'advance', 140.00, TIMESTAMP '2026-06-15 08:00:00'),
  ('le_009102', 'mer_11', 'adv_0911', 'fee', 4.20, TIMESTAMP '2026-06-15 08:00:00'),
  ('le_009103', 'mer_11', 'adv_0911', 'repayment', -144.20, TIMESTAMP '2026-06-15 09:00:00');

-- 11. A repayment exactly at "today", 2026-09-30 00:00 (Q14): balances are as of entries before that
--     moment, so it does not count yet.
INSERT INTO edge.ledger_entries VALUES
  ('le_009104', 'mer_11', 'adv_0035', 'repayment', -50.00, TIMESTAMP '2026-09-30 00:00:00');

-- 12. Webhook copies (Q11): an event delivered three times (two duplicates, not one), an event of
--     31 August whose copies arrive on 1 September, and an event of 28 September whose second copy
--     arrives after midnight. Counting by received_at, or counting events with copies instead of
--     extra copies, gets them wrong. Every copy arrives before "today". (t_900190–t_900192 are only
--     ids in the events: no transaction rows.)
INSERT INTO edge.webhook_events VALUES
  ('evt_900101', 'renewal', 'cus_09190', 'prd_09', 't_900190', TIMESTAMP '2026-09-14 08:00:00', TIMESTAMP '2026-09-14 08:00:40'),
  ('evt_900101', 'renewal', 'cus_09190', 'prd_09', 't_900190', TIMESTAMP '2026-09-14 08:00:00', TIMESTAMP '2026-09-14 08:03:10'),
  ('evt_900101', 'renewal', 'cus_09190', 'prd_09', 't_900190', TIMESTAMP '2026-09-14 08:00:00', TIMESTAMP '2026-09-14 08:20:05'),
  ('evt_900102', 'purchase', 'cus_09191', 'prd_13', 't_900191', TIMESTAMP '2026-08-31 23:58:30', TIMESTAMP '2026-09-01 00:00:20'),
  ('evt_900102', 'purchase', 'cus_09191', 'prd_13', 't_900191', TIMESTAMP '2026-08-31 23:58:30', TIMESTAMP '2026-09-01 00:04:00'),
  ('evt_900103', 'renewal', 'cus_09192', 'prd_02', 't_900192', TIMESTAMP '2026-09-28 23:59:00', TIMESTAMP '2026-09-28 23:59:40'),
  ('evt_900103', 'renewal', 'cus_09192', 'prd_02', 't_900192', TIMESTAMP '2026-09-28 23:59:00', TIMESTAMP '2026-09-29 00:01:10');

-- 13. Boundaries that wrong answers met only by luck.
--     a) A web sale at 2026-08-31 23:59:59.5 (Q01, D01): August is [2026-08-01, 2026-09-01), and
--        BETWEEN … '2026-08-31 23:59:59' loses the last half second. prd_20, so Q02 does not move.
--     b) One customer with two web subscriptions to the same product, both active at 2026-09-01
--        00:00 (Q03): a count of customers instead of subscriptions gives one less.
--     c) Q12: North Market sends mer_05 an August payout twice, for a month with nothing expected:
--        'duplicate_payout', the first rule that applies, not 'unexpected_payout'. And mer_03's July
--        South Market payout is exactly 1.00 above the expected 16.97: still 'matched' (<= 1.00).
--     Weekly plans, over before 12 September (section 1); everything happens before "today".
INSERT INTO edge.transactions VALUES
  ('t_900301', 't_900301', 'cus_09301', 'prd_20', 'prd_20.weekly', 'P1W', 'web', false, false, 1,
   TIMESTAMP '2026-08-31 23:59:59.5', TIMESTAMP '2026-09-07 23:59:59.5', 2.99, 2.99, 0.0300, NULL, false, 'FR'),
  ('t_900302', 't_900302', 'cus_09302', 'prd_16', 'prd_16.weekly', 'P1W', 'web', false, false, 1,
   TIMESTAMP '2026-08-28 10:00:00', TIMESTAMP '2026-09-04 10:00:00', 2.99, 2.99, 0.0300, NULL, false, 'PL'),
  ('t_900303', 't_900303', 'cus_09302', 'prd_16', 'prd_16.weekly', 'P1W', 'web', false, false, 1,
   TIMESTAMP '2026-08-29 18:30:00', TIMESTAMP '2026-09-05 18:30:00', 2.99, 2.99, 0.0300, NULL, false, 'PL');
INSERT INTO edge.channel_payouts VALUES
  ('po_0901', 'mer_05', 'north_market', DATE '2026-08-01', 64.20, TIMESTAMP '2026-09-28 09:00:00'),
  ('po_0902', 'mer_05', 'north_market', DATE '2026-08-01', 64.20, TIMESTAMP '2026-09-28 09:05:00');
UPDATE edge.channel_payouts SET amount_usd = 17.97
WHERE merchant_id = 'mer_03' AND channel = 'south_market' AND period_month = DATE '2026-07-01';

-- D. Drill and trap cases (hidden)
--    Rows for the drills and trap fixes whose typical mistakes the rows above do not show.
--    Web checkout only (partner payouts and advances stay as they are), new customers, and
--    no row is active at 2026-09-12 00:00 or starts that day (section 1). Revenue over the
--    last 30 days (Q02) grows only on prd_04 and prd_20, far from the top 5.
INSERT INTO edge.transactions VALUES
  -- s-filter: exactly 2026-09-01 00:00 is September; 23:45 on 31 August is still August.
  -- BETWEEN … '2026-09-01' counts the first, BETWEEN … '2026-08-31' loses the second.
  ('t_900201', 't_900201', 'cus_09201', 'prd_04', 'prd_04.weekly', 'P1W', 'web', false, false, 1,
   TIMESTAMP '2026-09-01 00:00:00', TIMESTAMP '2026-09-08 00:00:00', 2.99, 2.99, 0.0300, NULL, false, 'DE'),
  ('t_900202', 't_900202', 'cus_09202', 'prd_04', 'prd_04.weekly', 'P1W', 'web', false, false, 1,
   TIMESTAMP '2026-08-31 23:45:00', TIMESTAMP '2026-09-07 23:45:00', 2.99, 2.99, 0.0300, NULL, false, 'DE'),
  -- s-case: prices exactly on the bucket edges (5 and 20 belong to '5 to 20').
  ('t_900203', 't_900203', 'cus_09203', 'prd_10', 'prd_10.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2026-09-30 11:00:00', TIMESTAMP '2026-10-30 11:00:00', 5.00, 5.00, 0.0300, NULL, false, 'US'),
  ('t_900204', 't_900204', 'cus_09204', 'prd_14', 'prd_14.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2026-09-30 11:30:00', TIMESTAMP '2026-10-30 11:30:00', 20.00, 20.00, 0.0300, NULL, false, 'US'),
  -- s-exists: a September payer with two refunds before September (a JOIN counts the payment twice).
  -- Three different products, so no return-after-a-break (Q06) appears.
  ('t_900205', 't_900205', 'cus_09205', 'prd_01', 'prd_01.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2026-06-10 09:00:00', TIMESTAMP '2026-07-10 09:00:00', 6.99, 0.00, 0.0300,
   TIMESTAMP '2026-06-12 09:00:00', false, 'FR'),
  ('t_900206', 't_900206', 'cus_09205', 'prd_05', 'prd_05.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2026-07-14 09:00:00', TIMESTAMP '2026-08-14 09:00:00', 9.99, 0.00, 0.0300,
   TIMESTAMP '2026-07-15 09:00:00', false, 'FR'),
  ('t_900207', 't_900207', 'cus_09205', 'prd_04', 'prd_04.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2026-09-29 09:00:00', TIMESTAMP '2026-10-29 09:00:00', 6.99, 6.99, 0.0300, NULL, false, 'FR'),
  -- s-active and s-mrr: weeks that end exactly at the moment (2026-09-10 and 2026-09-30 00:00)
  -- are no longer active then: end_time >= moment counts them.
  ('t_900208', 't_900208', 'cus_09208', 'prd_20', 'prd_20.weekly', 'P1W', 'web', false, false, 1,
   TIMESTAMP '2026-09-03 00:00:00', TIMESTAMP '2026-09-10 00:00:00', 2.99, 2.99, 0.0300, NULL, false, 'GB'),
  ('t_900209', 't_900209', 'cus_09209', 'prd_20', 'prd_20.weekly', 'P1W', 'web', false, false, 1,
   TIMESTAMP '2026-09-23 00:00:00', TIMESTAMP '2026-09-30 00:00:00', 2.99, 2.99, 0.0300, NULL, false, 'GB'),
  -- s-running (mer_04, 14–20 September): a sale late on the last day, and a test purchase on a
  -- day without sales, which must not become a row.
  ('t_900210', 't_900210', 'cus_09210', 'prd_04', 'prd_04.weekly', 'P1W', 'web', false, false, 1,
   TIMESTAMP '2026-09-20 23:40:00', TIMESTAMP '2026-09-27 23:40:00', 2.99, 2.99, 0.0300, NULL, false, 'US'),
  ('t_900211', 't_900211', 'cus_09211', 'prd_04', 'prd_04.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2026-09-18 10:00:00', TIMESTAMP '2026-10-18 10:00:00', 6.99, 6.99, 0.0300, NULL, true, 'US'),
  -- The trap distinct-on-order and other "latest row" answers: more customers with two plans bought
  -- at the same moment, inserted in both orders. Without transaction_id DESC as the last sort key
  -- the kept row is a matter of chance, and with this many ties a lucky pick is unlikely.
  ('t_900240', 't_900240', 'cus_09240', 'prd_19', 'prd_19.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2026-09-30 08:00:00', TIMESTAMP '2026-10-30 08:00:00', 4.99, 4.99, 0.0300, NULL, false, 'IT'),
  ('t_900241', 't_900241', 'cus_09240', 'prd_19', 'prd_19.annual', 'P1Y', 'web', false, false, 1,
   TIMESTAMP '2026-09-30 08:00:00', TIMESTAMP '2027-09-30 08:00:00', 29.99, 29.99, 0.0300, NULL, false, 'IT'),
  ('t_900243', 't_900243', 'cus_09241', 'prd_11', 'prd_11.annual', 'P1Y', 'web', false, false, 1,
   TIMESTAMP '2026-09-30 08:30:00', TIMESTAMP '2027-09-30 08:30:00', 29.99, 29.99, 0.0300, NULL, false, 'IT'),
  ('t_900242', 't_900242', 'cus_09241', 'prd_11', 'prd_11.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2026-09-30 08:30:00', TIMESTAMP '2026-10-30 08:30:00', 7.99, 7.99, 0.0300, NULL, false, 'IT'),
  ('t_900244', 't_900244', 'cus_09242', 'prd_14', 'prd_14.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2026-09-30 09:00:00', TIMESTAMP '2026-10-30 09:00:00', 7.99, 7.99, 0.0300, NULL, false, 'IT'),
  ('t_900245', 't_900245', 'cus_09242', 'prd_14', 'prd_14.annual', 'P1Y', 'web', false, false, 1,
   TIMESTAMP '2026-09-30 09:00:00', TIMESTAMP '2027-09-30 09:00:00', 29.99, 29.99, 0.0300, NULL, false, 'IT'),
  ('t_900247', 't_900247', 'cus_09243', 'prd_10', 'prd_10.annual', 'P1Y', 'web', false, false, 1,
   TIMESTAMP '2026-09-30 09:30:00', TIMESTAMP '2027-09-30 09:30:00', 39.99, 39.99, 0.0300, NULL, false, 'IT'),
  ('t_900246', 't_900246', 'cus_09243', 'prd_10', 'prd_10.monthly', 'P1M', 'web', false, false, 1,
   TIMESTAMP '2026-09-30 09:30:00', TIMESTAMP '2026-10-30 09:30:00', 6.99, 6.99, 0.0300, NULL, false, 'IT');

-- s-top1: the merchant whose two best September products are closest gets one more web sale on
-- 30 September that brings the second exactly level with the first. Only the tie-break
-- (smaller product_id) decides; product_id DESC picks the other one.
INSERT INTO edge.transactions
SELECT 't_900220', 't_900220', 'cus_09220', product_id, product_id || '.monthly', 'P1M', 'web', false, false, 1,
       TIMESTAMP '2026-09-30 15:00:00', TIMESTAMP '2026-10-30 15:00:00', gap, gap, 0.0300, NULL, false, 'US'
FROM (
    SELECT merchant_id, product_id,
           LAG(net) OVER (PARTITION BY merchant_id ORDER BY net DESC, product_id) - net AS gap,
           ROW_NUMBER() OVER (PARTITION BY merchant_id ORDER BY net DESC, product_id)   AS rn
    FROM (
        SELECT p.merchant_id, t.product_id, SUM(t.revenue_usd) AS net
        FROM edge.transactions t
        JOIN edge.products p ON p.id = t.product_id
        WHERE NOT t.is_test
          AND t.start_time >= TIMESTAMP '2026-09-01 00:00:00'
          AND t.start_time <  TIMESTAMP '2026-10-01 00:00:00'
        GROUP BY p.merchant_id, t.product_id
    ) AS s
) AS r
WHERE rn = 2 AND gap > 0
ORDER BY gap, merchant_id
LIMIT 1;

-- s-rank: a tie inside the top 5 of September paid transactions, so RANK (1, 2, 2, 4) and
-- DENSE_RANK (1, 2, 2, 3) give different ranks. The product closest to the one above it gets
-- the missing sales; they are refunded within the hour (revenue 0), so revenue rankings stay.
INSERT INTO edge.transactions
SELECT 't_9002' || k.sfx, 't_9002' || k.sfx, 'cus_092' || k.sfx, pick.product_id, pick.product_id || '.monthly',
       'P1M', 'web', false, false, 1, k.st, k.st + INTERVAL '1 month', 4.99, 0.00, 0.0300, k.rf, false, 'US'
FROM (
    SELECT product_id, gap
    FROM (
        SELECT product_id,
               ROW_NUMBER() OVER (ORDER BY n DESC, product_id)   AS pos,
               LAG(n) OVER (ORDER BY n DESC, product_id) - n AS gap
        FROM (
            SELECT product_id, COUNT(*) AS n
            FROM edge.transactions
            WHERE NOT is_trial AND NOT is_test AND channel <> 'promo'
              AND start_time >= TIMESTAMP '2026-09-01 00:00:00'
              AND start_time <  TIMESTAMP '2026-10-01 00:00:00'
            GROUP BY product_id
        ) AS c
    ) AS r
    WHERE pos BETWEEN 2 AND 5 AND gap BETWEEN 1 AND 6
    ORDER BY gap, pos
    LIMIT 1
) AS pick
JOIN (VALUES
  (1, '31', TIMESTAMP '2026-09-29 20:01:00', TIMESTAMP '2026-09-29 20:31:00'),
  (2, '32', TIMESTAMP '2026-09-29 20:02:00', TIMESTAMP '2026-09-29 20:32:00'),
  (3, '33', TIMESTAMP '2026-09-29 20:03:00', TIMESTAMP '2026-09-29 20:33:00'),
  (4, '34', TIMESTAMP '2026-09-29 20:04:00', TIMESTAMP '2026-09-29 20:34:00'),
  (5, '35', TIMESTAMP '2026-09-29 20:05:00', TIMESTAMP '2026-09-29 20:35:00'),
  (6, '36', TIMESTAMP '2026-09-29 20:06:00', TIMESTAMP '2026-09-29 20:36:00')
) AS k(i, sfx, st, rf) ON k.i <= pick.gap;

-- s-join: two merchants with the same name. mer_03 takes the name of mer_02, so grouping by the
-- name alone adds their revenue together; GROUP BY m.id, m.name keeps them apart.
UPDATE edge.merchants SET name = 'Lumen Labs' WHERE id = 'mer_03';
