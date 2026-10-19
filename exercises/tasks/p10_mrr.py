"""P10. MRR by plan                                  Level: medium.    Target time: 15 min.

MRR (monthly recurring revenue) = the monthly value of all subscriptions that are active right now.

    mrr_by_plan(transactions, as_of=datetime(2026, 9, 30)) -> {"prd_03.monthly": Decimal("69.86"), ...}

Each transaction is a dict with the same fields as the SQL table `transactions`
(start_time, end_time, plan_id, plan_period, channel, is_trial, is_test,
charged_usd as Decimal, refunded_at or None).

- Count a transaction if it is active at as_of (start_time <= as_of < end_time), is not a trial,
  not a test purchase, not 'promo', and not refunded at or before as_of.
- Monthly value = charged_usd * factor:
      P1W: 52/12    P1M: 1    P3M: 1/3    P6M: 1/6    P1Y: 1/12
  Unknown duration -> ValueError.
- Sum per plan in full precision, then round each plan total HALF UP to cents.
- Plans with nothing active are not in the result.

ASK FIRST: What does active at as_of mean?  A: start_time <= as_of < end_time; not a trial, not a test purchase, not promo; not refunded at or before as_of.
           How do I turn a price into a monthly value?  A: Use the table: P1M x 1, P1Y x 1/12, P1W x 52/12, P3M x 1/3, P6M x 1/6. Unknown duration -> ValueError.
           When do I round?  A: Once per plan, at the end, half up to cents.
"""


def mrr_by_plan(transactions, as_of):
    raise NotImplementedError("your code")
