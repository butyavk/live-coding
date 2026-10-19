from datetime import datetime, timedelta
from decimal import Decimal as D, ROUND_HALF_UP
import pytest
from conftest import load
import db

NOW = datetime(2026, 9, 30)


def tx(product, dur, price, start_days_ago=5, length_days=30, **kw):
    t = {"plan_id": product, "plan_period": dur, "charged_usd": D(price),
         "start_time": NOW - timedelta(days=start_days_ago),
         "end_time": NOW - timedelta(days=start_days_ago) + timedelta(days=length_days),
         "channel": "north_market", "is_trial": False, "is_test": False, "refunded_at": None}
    t.update(kw)
    return t


def test_factors_and_rounding():
    f = load("p10_mrr").mrr_by_plan
    got = f([tx("w", "P1W", "2.99", length_days=7), tx("m", "P1M", "9.99"), tx("m", "P1M", "9.99"),
             tx("y", "P1Y", "59.99", length_days=365), tx("q", "P3M", "10.00", length_days=90)], NOW)
    assert got == {"w": D("12.96"), "m": D("19.98"), "y": D("5.00"), "q": D("3.33")}


def test_filters():
    f = load("p10_mrr").mrr_by_plan
    got = f([tx("a", "P1M", "5", is_trial=True), tx("a", "P1M", "5", is_test=True),
             tx("a", "P1M", "5", channel="promo"), tx("a", "P1M", "5", refunded_at=NOW),
             tx("a", "P1M", "5", refunded_at=NOW + timedelta(days=1)),
             tx("a", "P1M", "5", start_days_ago=40), tx("a", "P1M", "5", start_days_ago=0)], NOW)
    assert got == {"a": D("10.00")}      # refund in the future still counts; start exactly now counts


def test_unknown_duration():
    with pytest.raises(ValueError):
        load("p10_mrr").mrr_by_plan([tx("a", "P2M", "5")], NOW)


def test_on_the_dataset_matches_sql():
    con = db.connect()
    cur = con.execute("SELECT * FROM transactions")
    cols = [d[0] for d in cur.description]
    rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    got = load("p10_mrr").mrr_by_plan(rows, NOW)
    # SQL adds up price x (12 x factor): an exact number in twelfths of a month. One division by 12
    # in Decimal then gives the exact MRR, and three plans land exactly on half a cent (99.975 and others).
    twelfths = con.execute("""
        SELECT plan_id, SUM(charged_usd * CASE plan_period
                 WHEN 'P1W' THEN 52 WHEN 'P1M' THEN 12 WHEN 'P3M' THEN 4 WHEN 'P6M' THEN 2 WHEN 'P1Y' THEN 1 END)
        FROM transactions
        WHERE start_time <= TIMESTAMP '2026-09-30' AND end_time > TIMESTAMP '2026-09-30'
          AND NOT is_trial AND NOT is_test AND channel <> 'promo'
          AND (refunded_at IS NULL OR refunded_at > TIMESTAMP '2026-09-30')
        GROUP BY 1""").fetchall()
    exp = {plan: (D(str(v)) / 12).quantize(D("0.01"), rounding=ROUND_HALF_UP) for plan, v in twelfths}
    assert set(got) == set(exp)
    wrong = {plan: (got[plan], exp[plan]) for plan in exp if got[plan] != exp[plan]}
    assert wrong == {}, "plan: (yours, expected)"
