from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

FACTOR = {"P1W": Decimal(52) / Decimal(12), "P1M": Decimal(1), "P3M": Decimal(1) / Decimal(3),
          "P6M": Decimal(1) / Decimal(6), "P1Y": Decimal(1) / Decimal(12)}


def _is_counted(t, as_of):
    return (t["start_time"] <= as_of < t["end_time"]
            and not t["is_trial"] and not t["is_test"] and t["channel"] != "promo"
            and (t["refunded_at"] is None or t["refunded_at"] > as_of))


def mrr_by_plan(transactions, as_of):
    totals = defaultdict(Decimal)
    for t in transactions:
        if not _is_counted(t, as_of):
            continue
        if t["plan_period"] not in FACTOR:
            raise ValueError(f"unknown duration {t['plan_period']!r}")
        totals[t["plan_id"]] += t["charged_usd"] * FACTOR[t["plan_period"]]
    return {p: v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) for p, v in totals.items()}
