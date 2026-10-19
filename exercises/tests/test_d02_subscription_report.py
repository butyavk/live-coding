from datetime import datetime, timedelta
from decimal import Decimal as D
from conftest import load

NOW = datetime(2026, 9, 15)


def tx(product="a", start_days_ago=5, length=30, price="9.99", **kw):
    t = {"product_id": product, "start_time": NOW - timedelta(days=start_days_ago),
         "end_time": NOW - timedelta(days=start_days_ago) + timedelta(days=length),
         "is_trial": False, "is_test": False, "channel": "north_market",
         "refunded_at": None, "revenue_usd": D(price)}
    t.update(kw)
    return t


def test_end_is_excluded():
    m = load("d02_subscription_report")
    assert m.active_at([tx(start_days_ago=30, length=30)], NOW) == {}


def test_promo_and_refunds():
    m = load("d02_subscription_report")
    got = m.active_at([tx(channel="promo"), tx(refunded_at=NOW - timedelta(days=1)),
                       tx(refunded_at=NOW + timedelta(days=1)), tx(product="b")], NOW)
    assert got == {"a": 1, "b": 1}


def test_trials_and_a_refund_exactly_at_moment():
    m = load("d02_subscription_report")
    got = m.active_at([tx(is_trial=True), tx(refunded_at=NOW), tx(product="b")], NOW)
    assert got == {"b": 1}          # a refund at `moment` counts as refunded ("at or before")


def test_no_stale_results_between_calls():
    m = load("d02_subscription_report")
    assert m.active_at([tx()], NOW) == {"a": 1}
    assert m.active_at([tx(), tx()], NOW) == {"a": 2}
    assert m.active_at([], NOW) == {}


def test_revenue_is_exact_decimal():
    m = load("d02_subscription_report")
    got = m.revenue_by_product([tx(price="0.10"), tx(price="0.20"), tx(price="9.99"), tx(price="5", is_test=True)])
    assert got == {"a": D("10.29")} and isinstance(got["a"], D)
