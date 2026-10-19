# Practice dataset

A small, made-up **subscription marketplace**. **Merchants** sell subscription **products** to
**customers** on weekly, monthly and annual **plans**. Customers subscribe through four
**sales channels**:

- `north_market` and `south_market`: two invented **partner marketplaces**. They collect the
  money, keep a fee (`fee_rate` 0.15 or 0.30) and pay the merchant **once a month, after a
  delay**: North Market about 32 days after the month ends, South Market about 14 days
  (`channel_payouts`).
- `web`: the merchant's own **web checkout**, with a card processing fee of 0.03.
- `promo`: **free access** granted by the merchant, price 0.

On top of that, an **advances program**: the platform pays a merchant early, against
marketplace payouts that have not arrived yet, and keeps a ledger of what the merchant owes.

All timestamps are UTC. **Today is 2026-09-30 00:00 UTC.** Write it as a literal
(`TIMESTAMP '2026-09-30'`), never `CURRENT_DATE` or `NOW()`, so the answers stay the same.

The site runs this data on real PostgreSQL in the browser (PGlite). This folder loads the same
CSV files into DuckDB, which accepts PostgreSQL syntax for everything used in the tasks:
`INTERVAL '1 day'`, `date_trunc`, `generate_series`, `FILTER (WHERE …)`, `DISTINCT ON`, window
functions and `::` casts. Differences to keep in mind:

- Name the column of `generate_series`: `FROM generate_series(…) AS g(d)`, then use `d`. In
  PostgreSQL `… AS g` followed by `g::date` also works, because `g` is the value. In DuckDB `g`
  is then the whole row (a struct), and `g::date` fails with a ConversionException.
- Write `AS` before a column alias. PostgreSQL accepts `MIN(type) type`; DuckDB gives a syntax
  error for a bare alias that is a keyword (`type`, `day`, `month`, `value`, `name`).
- DuckDB's `ROUND(x, 2)` works on any number; PostgreSQL has it only for `numeric`, so
  `ROUND(AVG(x)::numeric, 2)` or `ROUND(1.0 * a / b, 2)` is the portable form.
- `AVG` of a `DECIMAL` column is a `DOUBLE` in DuckDB and a `numeric` in PostgreSQL, so a
  rounded average can differ by one cent (8.325 → 8.32 here, 8.33 in PostgreSQL).

`db.py` switches DuckDB to integer division (`7 / 2 = 3`), as in PostgreSQL. It also turns off
one DuckDB optimizer, filter pushdown: with it, every DuckDB from 0.10.3 to 1.5.6 returns no rows for a
correlated `EXISTS` with an equality, a `<>` and a `<` on the outer row
(`EXISTS (SELECT 1 FROM advances b WHERE b.idempotency_key = a.idempotency_key
AND b.advance_id <> a.advance_id AND b.created_at < a.created_at)`), which is correct SQL.
`pyproject.toml` and `uv.lock` pin the DuckDB version these files were checked with.

The tests compare values, not types: numbers are rounded to three decimals, and a timestamp
exactly at midnight counts as its date, as on the site.

## How the tables connect

`merchants` and `products` call their own key `id`. Every other table points to them with
`merchant_id` or `product_id`:

- `products.merchant_id` → `merchants.id`
- `transactions.product_id`, `webhook_events.product_id` → `products.id`
- `channel_payouts.merchant_id`, `advances.merchant_id`, `ledger_entries.merchant_id` → `merchants.id`
- `ledger_entries.advance_id` → `advances.advance_id`

The names differ, so join with `ON` (`USING` needs the same name on both sides). A transaction
reaches its merchant through `products`. The tasks use the aliases `t`, `p` and `m`:

```sql
FROM transactions t
JOIN products p  ON p.id = t.product_id
JOIN merchants m ON m.id = p.merchant_id
```

## merchants (12 rows)

| column | meaning |
| --- | --- |
| id | `mer_01` … `mer_12`, primary key |
| name | business name (invented) |
| country | merchant's country |
| advances_enrolled_at | when the merchant joined the advances program; NULL = not enrolled (6 of 12 are enrolled) |

## products (20 rows)

`id` (`prd_01` … `prd_20`, primary key), `merchant_id` (→ `merchants.id`), `name`
(`Product 01` …). One merchant can have several products.

## transactions (8,294 rows, January 2025 – September 2026)

One row is one billing period of one subscription: a purchase, a renewal or a free trial.

| column | meaning |
| --- | --- |
| transaction_id | unique id of this transaction |
| original_transaction_id | id of the first transaction of the chain: all renewals of one subscription share it |
| customer_id | the customer, for example `cus_02564` |
| product_id, plan_id | the product and its plan, for example `prd_03`, `prd_03.monthly` |
| plan_period | `P1W`, `P1M`, `P1Y` (ISO 8601 durations) |
| channel | `north_market`, `south_market`, `web`, `promo` (free access, price 0) |
| is_trial | free trial period (price 0, 7 days) |
| is_trial_conversion | the first paid period right after a trial |
| renewal_number | 1 for the first transaction of a chain, then 2, 3, … |
| start_time, end_time | the period is `[start_time, end_time)`: the end is not included |
| charged_usd | what the customer paid (gross) |
| revenue_usd | revenue net of refunds: **0 if the transaction was refunded** |
| fee_rate | the channel's fee: 0.15 or 0.30 on a marketplace, 0.03 on the web checkout, 0 for promo |
| refunded_at | when the refund happened; NULL if none. A refund ends the subscription |
| is_test | a test purchase: exclude it from every business number |
| country | customer's country |

A **paid** transaction is not a trial, not a test purchase and not promo
(`NOT is_trial AND NOT is_test AND channel <> 'promo'`): 7,022 of the 8,294. A subscription is
**active at moment m** when `start_time <= m < end_time` and it was not refunded by then
(`refunded_at IS NULL OR refunded_at > m`).

## webhook_events (1,285 rows, August – September 2026)

Notifications from the sales channels: `event_id`, `type` (`purchase`, `renewal`,
`expiration`, `refund`), `customer_id`, `product_id`, `transaction_id`, `occurred_at` (when it
happened), `received_at` (when it reached us). **The same `event_id` can arrive more than
once**: delivery is at least once. A duplicate is an exact copy of the event; only
`received_at` differs. There are 1,226 distinct event ids.

## channel_payouts (173 rows, sales months January – August 2026)

What the two marketplaces actually paid: `payout_id`, `merchant_id`, `channel`
(`north_market` or `south_market`), `period_month` (the first day of the sales month),
`amount_usd`, `paid_at`. On 2026-09-30 the latest North Market payout is for July and the
latest South Market payout is for August. Some payouts are missing, some differ from what was
expected, and one is duplicated: that is what the reconciliation task is about.

## advances (38 rows)

The advances program: `advance_id`, `merchant_id`, `channel`, `period_month` (the sales month
the advance is paid against), `amount_usd` (the advance, also called principal), `fee_usd`,
`idempotency_key` (`merchant:channel:month`, for example `mer_01:north_market:2026-06-01`),
`created_at`. The rules: an advance is at most **70%** of the proceeds the merchant expects
from that marketplace for that month, and its fee is **3%** of the amount. A few advances break
the rules: finding them is one of the tasks.

## ledger_entries (104 rows)

Every money movement of the advances program, only ever appended: `entry_id`, `merchant_id`,
`advance_id`, `entry_type` (`advance`, `fee`, `repayment`), `amount_usd` (advance and fee are
positive, a repayment is negative), `created_at`. What a merchant owes right now is
`SUM(amount_usd)` over all their entries.

## Words used in the tasks

| word | meaning | in the data |
| --- | --- | --- |
| gross revenue | what customers paid | `SUM(charged_usd)` |
| net revenue | revenue after refunds | `SUM(revenue_usd)` |
| proceeds of one sale | what the merchant keeps after the channel's fee; 0 once refunded | `revenue_usd * (1 - fee_rate)` |
| proceeds of a month | what a marketplace owes a merchant for one month (Q12, Q13) | each sale adds `charged_usd * (1 - fee_rate)` in the month of `start_time`; each refund subtracts the same amount in the month of `refunded_at` |
| payout | a marketplace's monthly payment to a merchant | a row of `channel_payouts` |
| advance | an early payment against a payout that has not arrived yet | a row of `advances` |
| churn | a subscription was active at the start of the period and is not active at its end: nobody renewed it | first `start_time` <= period start < last `end_time` <= period end (Q10: `last_end <= '2026-09-01'`) |
| MRR | monthly value of the subscriptions active now: yearly / 12, weekly × 52 / 12 | |
| flow vs balance | a sum over a period (revenue for August) vs a state today (what is owed) | a flow has a date window, a balance sums everything up to today |
