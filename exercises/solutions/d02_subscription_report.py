# Bugs: (1) mutable default `_cache={}` lives between calls and ignores `transactions` -> stale numbers;
#       (2) `<= end_time` — the period is [start, end), end excluded;
#       (3) promo grants and refunds were not excluded;
#       (4) money in float: 0.1 + 0.2 != 0.3 -> keep Decimal.
from decimal import Decimal


def active_at(transactions, moment):
    counts = {}
    for t in transactions:
        if t["is_trial"] or t["is_test"] or t["channel"] == "promo":
            continue
        if t["refunded_at"] is not None and t["refunded_at"] <= moment:
            continue
        if t["start_time"] <= moment < t["end_time"]:
            counts[t["product_id"]] = counts.get(t["product_id"], 0) + 1
    return counts


def revenue_by_product(transactions):
    total = {}
    for t in transactions:
        if t["is_test"]:
            continue
        total[t["product_id"]] = total.get(t["product_id"], Decimal("0")) + t["revenue_usd"]
    return total
