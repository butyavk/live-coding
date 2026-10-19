import random
from datetime import datetime, timedelta
import pytest
from conftest import load

def d(day, hour=0):
    return datetime(2026, 9, 1) + timedelta(days=day - 1, hours=hour)


def test_example():
    m = load("p03_merge_periods")
    got = m.merge_periods([(d(30), d(31)), (d(5), d(20)), (d(1), d(10)), (d(20), d(25))])
    assert got == [(d(1), d(25)), (d(30), d(31))]
    assert m.total_access([(d(1), d(10)), (d(5), d(20))]) == timedelta(days=19)


def test_contained_and_empty():
    m = load("p03_merge_periods")
    assert m.merge_periods([(d(1), d(20)), (d(3), d(4))]) == [(d(1), d(20))]
    assert m.merge_periods([]) == [] and m.total_access([]) == timedelta(0)


def test_invalid_period():
    m = load("p03_merge_periods")
    with pytest.raises(ValueError):
        m.merge_periods([(d(5), d(5))])


def test_matches_brute_force_on_random_input():
    m = load("p03_merge_periods")
    rnd = random.Random(7)
    for _ in range(200):
        periods = []
        for _ in range(rnd.randint(1, 8)):
            s = rnd.randint(0, 40)
            periods.append((d(1, s), d(1, s + rnd.randint(1, 10))))
        hours = {h for s, e in periods for h in range(int((s - d(1)).total_seconds() // 3600),
                                                       int((e - d(1)).total_seconds() // 3600))}
        assert m.total_access(periods) == timedelta(hours=len(hours))
        merged = m.merge_periods(periods)
        assert all(a[1] < b[0] for a, b in zip(merged, merged[1:]))
