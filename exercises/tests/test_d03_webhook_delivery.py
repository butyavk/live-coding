import pytest
from conftest import load
from tasks.d03_webhook_delivery import TemporaryError


def ev(i, t):
    return {"id": i, "created_at": t}


class Endpoint:
    def __init__(self, fail_times=None, bad=()):
        self.fail_times, self.bad, self.got, self.calls = dict(fail_times or {}), set(bad), [], 0

    def __call__(self, event):
        self.calls += 1
        if event["id"] in self.bad:
            raise ValueError("payload bug")
        if self.fail_times.get(event["id"], 0) > 0:
            self.fail_times[event["id"]] -= 1
            raise TemporaryError("503")
        self.got.append(event["id"])


def test_order_and_skip_seen():
    m = load("d03_webhook_delivery")
    ep, seen = Endpoint(), {"e1"}
    assert m.deliver_all([ev("e3", 3), ev("e1", 1), ev("e2", 2)], ep, seen=seen, sleep=lambda s: None) == ["e2", "e3"]
    assert ep.got == ["e2", "e3"] and seen == {"e1", "e2", "e3"}


def test_fresh_calls_do_not_share_state():
    m = load("d03_webhook_delivery")
    assert m.deliver_all([ev("x", 1)], Endpoint(), sleep=lambda s: None) == ["x"]
    assert m.deliver_all([ev("x", 1)], Endpoint(), sleep=lambda s: None) == ["x"]     # another merchant, same worker


def test_retry_with_backoff_and_no_sleep_after_last_failure():
    m = load("d03_webhook_delivery")
    sleeps, ep, seen = [], Endpoint(fail_times={"a": 2, "b": 5}), set()
    out = m.deliver_all([ev("a", 1), ev("b", 2), ev("c", 3)], ep, seen=seen, max_attempts=3, base_delay=1.0,
                        sleep=sleeps.append)
    assert out == ["a", "c"]                        # b keeps failing: skip it for now, and go on with c
    assert sleeps == [1.0, 2.0, 1.0, 2.0]          # a: two retries; b: two retries, no sleep after the 3rd failure
    assert seen == {"a", "c"}                       # b is not marked: the next run must try it again
    assert m.deliver_all([ev("b", 2)], Endpoint(), seen=seen, sleep=sleeps.append) == ["b"]


def test_payload_bug_is_not_retried():
    m = load("d03_webhook_delivery")
    sleeps, ep = [], Endpoint(bad={"bad"})
    with pytest.raises(ValueError):
        m.deliver_all([ev("bad", 1)], ep, seen=set(), sleep=sleeps.append)
    assert ep.calls == 1 and sleeps == []
