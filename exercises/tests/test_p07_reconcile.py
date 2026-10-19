from datetime import date
from decimal import Decimal as D
from conftest import load


def inv(i, cp, amount, day):
    return {"id": i, "counterparty": cp, "amount": D(amount), "due": date(2026, 9, day)}


def pay(i, cp, amount, day, ref=None):
    return {"id": i, "counterparty": cp, "amount": D(amount), "date": date(2026, 9, day), "reference": ref}


def test_reference_wins_over_heuristic():
    r = load("p07_reconcile").reconcile(
        [inv("inv_1", "acme", "100.00", 10), inv("inv_2", "acme", "100.00", 10)],
        [pay("pay_a", "acme", "100.00", 10), pay("pay_b", "acme", "60.00", 20, ref="inv_1")])
    assert r == {"matches": [("inv_1", "pay_b"), ("inv_2", "pay_a")], "unmatched_invoices": [], "unmatched_payments": []}


def test_closest_date_then_smallest_id():
    r = load("p07_reconcile").reconcile(
        [inv("inv_3", "acme", "50.00", 8), inv("inv_1", "acme", "50.00", 12), inv("inv_2", "acme", "50.00", 12)],
        [pay("pay_1", "acme", "50.00", 11)])
    assert r["matches"] == [("inv_1", "pay_1")]
    assert r["unmatched_invoices"] == ["inv_2", "inv_3"]


def test_window_counterparty_amount():
    r = load("p07_reconcile").reconcile(
        [inv("inv_1", "acme", "10.00", 1), inv("inv_2", "beta", "10.00", 10), inv("inv_3", "acme", "10.00", 20)],
        [pay("p1", "acme", "10.00", 5),           # 4 days late: outside the window
         pay("p2", "acme", "10.00", 10),          # counterparty differs from inv_2
         pay("p3", "acme", "10.01", 20)])         # amount differs by a cent
    assert r["matches"] == []
    assert r["unmatched_payments"] == ["p1", "p2", "p3"]


def test_payments_in_date_order_and_used_once():
    r = load("p07_reconcile").reconcile(
        [inv("inv_1", "acme", "10.00", 10)],
        [pay("p_late", "acme", "10.00", 10), pay("p_early", "acme", "10.00", 8)])
    assert r["matches"] == [("inv_1", "p_early")]        # the earlier payment is processed first
    assert r["unmatched_payments"] == ["p_late"]


def test_date_order_not_id_order():
    r = load("p07_reconcile").reconcile(
        [inv("inv_1", "acme", "10.00", 10)],
        [pay("p1", "acme", "10.00", 10), pay("p2", "acme", "10.00", 8)])
    assert r["matches"] == [("inv_1", "p2")]             # p2 is earlier by date, although p1 has the smaller id
    assert r["unmatched_payments"] == ["p1"]


def test_references_are_applied_in_payment_order():
    r = load("p07_reconcile").reconcile(
        [inv("inv_1", "acme", "10.00", 10), inv("inv_2", "acme", "10.00", 20)],
        [pay("p1", "acme", "10.00", 20, ref="inv_1"), pay("p2", "acme", "10.00", 8, ref="inv_1")])
    # p2 (Sep 8) comes first and takes inv_1; p1's reference is then used up, and the heuristic finds inv_2
    assert r == {"matches": [("inv_1", "p2"), ("inv_2", "p1")], "unmatched_invoices": [], "unmatched_payments": []}


def test_reference_to_another_counterparty_is_trusted():
    r = load("p07_reconcile").reconcile(
        [inv("inv_1", "beta", "10.00", 10)],
        [pay("p1", "acme", "10.00", 10, ref="inv_1")])
    assert r["matches"] == [("inv_1", "p1")]


def test_reference_to_already_matched_invoice():
    r = load("p07_reconcile").reconcile(
        [inv("inv_1", "acme", "10.00", 10), inv("inv_2", "acme", "10.00", 10)],
        [pay("p1", "acme", "10.00", 10, ref="inv_1"), pay("p2", "acme", "10.00", 10, ref="inv_1")])
    assert r["matches"] == [("inv_1", "p1"), ("inv_2", "p2")]
