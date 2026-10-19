from datetime import datetime
import pytest
from conftest import load


def test_add_duration_units_and_clamping():
    m = load("p04_iso_duration")
    assert m.add_duration(datetime(2026, 1, 31, 15, 30), "P1M") == datetime(2026, 2, 28, 15, 30)
    assert m.add_duration(datetime(2028, 1, 31), "P1M") == datetime(2028, 2, 29)
    assert m.add_duration(datetime(2026, 11, 30), "P3M") == datetime(2027, 2, 28)
    assert m.add_duration(datetime(2028, 2, 29), "P1Y") == datetime(2029, 2, 28)
    assert m.add_duration(datetime(2027, 3, 1), "P1Y") == datetime(2028, 3, 1)      # 366 days: 2028 is a leap year
    assert m.add_duration(datetime(2026, 9, 25), "P1W") == datetime(2026, 10, 2)
    assert m.add_duration(datetime(2026, 9, 25), "P10D") == datetime(2026, 10, 5)


@pytest.mark.parametrize("bad", ["", "1M", "P0M", "P-1M", "P1H", "P1M2D", "p1m", None, 12, b"P1M"])
def test_invalid(bad):
    with pytest.raises(ValueError):
        load("p04_iso_duration").add_duration(datetime(2026, 1, 1), bad)


def test_renewal_dates_do_not_drift():
    m = load("p04_iso_duration")
    got = m.renewal_dates(datetime(2026, 1, 31), "P1M", until=datetime(2026, 5, 1))
    assert got == [datetime(2026, 1, 31), datetime(2026, 2, 28), datetime(2026, 3, 31), datetime(2026, 4, 30)]
    assert m.renewal_dates(datetime(2026, 1, 1), "P1Y", until=datetime(2026, 1, 1)) == []
