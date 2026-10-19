"""D02. DEBUG: subscription report                Target time: 15 min.

BUG REPORT (from the product team)
  "Active subscriber numbers are a bit too high, and they do not change when we pass a different
   list of transactions in the same process. Revenue sometimes shows numbers like 10.290000000000001
   in the export."

What the functions SHOULD do (the tests check this):
- active_at(transactions, moment) -> {product_id: count} of PAID subscriptions active at `moment`:
  start_time <= moment < end_time (end excluded), not a trial, not a test purchase, not 'promo',
  and not refunded at or before `moment`.
- revenue_by_product(transactions) -> {product_id: Decimal}: SUM(revenue_usd) per product, test purchases excluded,
  exact to the cent (Decimal, never float).

ASK FIRST: Is a period that ends exactly at moment still active?  A: No, the end is excluded.
           Do we need the cache?  A: Only if it is correct. If you remove it, say why it was wrong.
           Which fields mark promo and refunded transactions?  A: t["channel"] == "promo";
                                                    t["refunded_at"] is a datetime or None.

HOW TO PRACTISE: delete the START line, run `pytest -k d02`, read the failures, find each bug, say it
out loud ("The bug is …, because …"), fix it, run again.
"""
# START: delete this line to run the tests


def active_at(transactions, moment, _cache={}):
    if moment in _cache:
        return _cache[moment]
    counts = {}
    for t in transactions:
        if t["is_trial"] or t["is_test"]:
            continue
        if t["start_time"] <= moment <= t["end_time"]:
            counts[t["product_id"]] = counts.get(t["product_id"], 0) + 1
    _cache[moment] = counts
    return counts


def revenue_by_product(transactions):
    total = {}
    for t in transactions:
        if t["is_test"]:
            continue
        total[t["product_id"]] = total.get(t["product_id"], 0.0) + float(t["revenue_usd"])
    return total
