import pytest
from conftest import load


class FakeClock:
    def __init__(self): self.now = 0.0
    def __call__(self): return self.now


def make(ttl=10, max_size=None):
    m = load("p01_ttl_cache")
    clock, calls = FakeClock(), []

    @m.ttl_cache(ttl_seconds=ttl, max_size=max_size, clock=clock)
    def f(a, b=0):
        calls.append((a, b))
        return a + b
    return f, clock, calls


def test_caches_within_ttl():
    f, clock, calls = make()
    assert f(1) == 1 and f(1) == 1
    assert calls == [(1, 0)] and f.hits == 1 and f.misses == 1


def test_expires_exactly_at_ttl():
    f, clock, calls = make(ttl=10)
    f(1); clock.now = 9.999; f(1)
    assert len(calls) == 1
    clock.now = 10.0; f(1)
    assert len(calls) == 2


def test_kwargs_are_part_of_key():
    f, clock, calls = make()
    f(1, b=2); f(1, b=3); f(b=2, a=1); f(a=1, b=2)
    assert calls == [(1, 2), (1, 3), (1, 2)]


def test_lru_eviction_uses_recency_of_use():
    f, clock, calls = make(max_size=2)
    f(1); f(2); f(1)        # 1 is now most recently used
    f(3)                    # evicts 2
    f(1); f(2)
    assert calls == [(1, 0), (2, 0), (3, 0), (2, 0)]


def test_exceptions_are_not_cached():
    m = load("p01_ttl_cache")
    clock, n = FakeClock(), {"calls": 0}

    @m.ttl_cache(ttl_seconds=10, clock=clock)
    def flaky():
        n["calls"] += 1
        if n["calls"] == 1:
            raise RuntimeError("bank down")
        return "ok"
    with pytest.raises(RuntimeError):
        flaky()
    assert flaky() == "ok" and flaky() == "ok" and n["calls"] == 2
