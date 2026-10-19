import pytest
from conftest import load


def ev(i, t, customer, ts):
    return {"event_id": i, "type": t, "customer": customer, "ts": ts}


def test_basic_flow_and_duplicates():
    p = load("p02_event_processor").EventProcessor()
    assert p.process(ev("e1", "purchase", "c1", 100)) is True
    assert p.process(ev("e1", "purchase", "c1", 100)) is False
    assert p.state("c1") == "active"
    assert p.process(ev("e2", "expiration", "c1", 200)) is True
    assert p.state("c1") == "expired"
    assert p.state("nobody") is None


def test_out_of_order_does_not_revert():
    p = load("p02_event_processor").EventProcessor()
    p.process(ev("e2", "refund", "c1", 300))
    assert p.process(ev("e1", "renewal", "c1", 200)) is True     # older: processed, ignored
    assert p.state("c1") == "refunded"
    assert p.process(ev("e1", "renewal", "c1", 200)) is False


def test_equal_ts_later_wins_and_customers_are_independent():
    p = load("p02_event_processor").EventProcessor()
    p.process(ev("a", "renewal", "c1", 100))
    p.process(ev("b", "expiration", "c1", 100))
    p.process(ev("c", "renewal", "c2", 50))
    assert p.state("c1") == "expired" and p.state("c2") == "active"


def test_duplicate_is_not_applied_again():
    p = load("p02_event_processor").EventProcessor()
    p.process(ev("e1", "renewal", "c1", 100))
    p.process(ev("e2", "expiration", "c1", 100))
    assert p.process(ev("e1", "renewal", "c1", 100)) is False      # a repeat of e1, not a new event
    assert p.state("c1") == "expired"


def test_unknown_type_is_not_marked_processed():
    p = load("p02_event_processor").EventProcessor()
    with pytest.raises(ValueError):
        p.process(ev("x", "UPGRADE", "c1", 1))
    with pytest.raises(ValueError):
        p.process(ev("x", "UPGRADE", "c1", 1))
