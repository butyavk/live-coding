from conftest import load


def make(limit=3, window=10):
    return load("p08_rate_limiter").SlidingWindowLimiter(limit, window)


def test_limit_and_window_boundary():
    lim = make()
    assert [lim.allow("a", t) for t in (0, 1, 2, 3)] == [True, True, True, False]
    assert lim.allow("a", 9.999) is False
    assert lim.allow("a", 10) is True          # the request at 0 left the window (0, 10]
    assert lim.allow("a", 10.5) is False


def test_rejected_requests_do_not_count():
    lim = make(limit=1, window=10)
    assert lim.allow("a", 0) is True
    for t in range(1, 10):
        assert lim.allow("a", t) is False
    assert lim.allow("a", 10) is True


def test_keys_independent():
    lim = make(limit=2, window=5)
    assert lim.allow("a", 0) and lim.allow("b", 0) and lim.allow("a", 1)
    assert not lim.allow("a", 2) and lim.allow("b", 2)


def test_long_run_steady_rate():
    lim = make(limit=2, window=5)
    allowed = [t for t in range(100) if lim.allow("c", float(t))]
    assert allowed[:4] == [0, 1, 5, 6] and len(allowed) == 40
    # memory is not tested automatically: explain out loud why your structure stays small
