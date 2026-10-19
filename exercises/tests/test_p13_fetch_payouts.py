from datetime import date
from typing import NamedTuple
import pytest
from conftest import load
from tasks.p13_fetch_payouts import ApiError

BASE = {"merchant_id": "mer_03", "since": "2026-09-01"}


class Response(NamedTuple):                 # what the fake HTTP client returns
    status: int
    headers: dict
    json: dict | None


class FakeClient:
    """Answers with the scripted responses, in order, and records every call."""
    def __init__(self, script):
        self.script, self.calls = list(script), []

    def get(self, path, params):
        self.calls.append((path, dict(params)))
        if not self.script:
            raise AssertionError(f"call {len(self.calls)}: no more pages, so the code asked for too many (a loop?)")
        return self.script.pop(0)


def page(ids, next_cursor, amount="10.00"):
    return Response(200, {}, {"data": [{"id": i, "amount": amount} for i in ids], "next_cursor": next_cursor})


def status(code, headers=None):
    return Response(code, headers or {}, {"error": f"status {code}"})


def call(cursor=None):
    return ("/v1/payouts", BASE if cursor is None else {**BASE, "cursor": cursor})


def run(script, **kw):
    client, sleeps = FakeClient(script), []
    out = load("p13_fetch_payouts").fetch_all_payouts(client, "mer_03", date(2026, 9, 1), sleep=sleeps.append, **kw)
    return out, client.calls, sleeps


def ids(payouts):
    return [p["id"] for p in payouts]


def test_follows_the_cursor_until_it_is_none():
    out, calls, sleeps = run([page(["po_1", "po_2"], "c2"), page([], "c3"), page(["po_3"], None)])
    assert ids(out) == ["po_1", "po_2", "po_3"]         # an empty page with a cursor is not the end
    assert out[0] == {"id": "po_1", "amount": "10.00"}  # the dicts as the API sent them
    assert calls == [call(), call("c2"), call("c3")]
    assert sleeps == []


def test_a_payout_on_two_pages_is_returned_once():
    out, _, _ = run([page(["po_1", "po_2"], "c2"), page(["po_2", "po_3"], None, amount="99.00")])
    assert ids(out) == ["po_1", "po_2", "po_3"]
    assert out[1]["amount"] == "10.00"                  # the first copy is kept


def test_429_waits_retry_after_and_asks_for_the_same_page():
    out, calls, sleeps = run([page(["po_1"], "c2"), status(429, {"Retry-After": "3"}), page(["po_2"], None)])
    assert ids(out) == ["po_1", "po_2"]
    assert calls == [call(), call("c2"), call("c2")]    # the same page again, not the next one
    assert sleeps == [3]                                # a number of seconds, not the string "3"


def test_retry_after_in_lower_case_or_missing():
    out, calls, sleeps = run([status(429, {"retry-after": "2"}), page(["po_1"], "c2"),
                              status(429), page(["po_2"], None)])
    assert ids(out) == ["po_1", "po_2"]
    assert sleeps == [2, 0.5]                           # no header: the backoff, retry 1 of that page
    assert calls == [call(), call(), call("c2"), call("c2")]


def test_5xx_backoff_starts_again_on_every_page():
    out, calls, sleeps = run([status(503), status(502), page(["po_1"], "c2"), status(500), page(["po_2"], None)],
                             base_delay=0.5)
    assert ids(out) == ["po_1", "po_2"]
    assert sleeps == [0.5, 1.0, 0.5]
    assert len(calls) == 5


def test_429_and_5xx_share_the_retries_of_a_page():
    out, _, sleeps = run([status(503), status(429, {"Retry-After": "4"}), status(503), page(["po_1"], None)])
    assert ids(out) == ["po_1"] and sleeps == [0.5, 4, 2.0]    # retry 3 waits 0.5 * 2 ** 2


def test_gives_up_with_the_last_status_and_no_wait_after_it():
    client, sleeps = FakeClient([status(503), status(429, {"Retry-After": "1"}), status(500)]), []
    with pytest.raises(ApiError) as e:
        load("p13_fetch_payouts").fetch_all_payouts(client, "mer_03", date(2026, 9, 1), max_retries=2, sleep=sleeps.append)
    assert e.value.status == 500
    assert sleeps == [0.5, 1] and len(client.calls) == 3


@pytest.mark.parametrize("code", [400, 401, 404])
def test_other_errors_are_not_retried(code):
    client, sleeps = FakeClient([page(["po_1"], "c2"), status(code), page(["po_2"], None)]), []
    with pytest.raises(ApiError) as e:
        load("p13_fetch_payouts").fetch_all_payouts(client, "mer_03", date(2026, 9, 1), sleep=sleeps.append)
    assert e.value.status == code
    assert sleeps == [] and len(client.calls) == 2


@pytest.mark.parametrize("cursors", [["c1", "c1"], ["c1", "c2", "c1"]])
def test_a_cursor_that_comes_back_stops_the_loop(cursors):
    script = [page([f"po_{i}"], c) for i, c in enumerate(cursors)] + [page(["po_x"], None)]
    client = FakeClient(script)
    with pytest.raises(ApiError) as e:
        load("p13_fetch_payouts").fetch_all_payouts(client, "mer_03", date(2026, 9, 1), sleep=lambda s: None)
    assert e.value.status is None
    assert len(client.calls) == len(cursors)           # it stops as soon as the cursor repeats
