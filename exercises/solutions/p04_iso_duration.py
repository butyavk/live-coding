import calendar
import re
from datetime import timedelta

_PATTERN = re.compile(r"P([1-9]\d*)([DWMY])")


def _parse(duration):
    if not isinstance(duration, str):            # None, 12, b"P1M": re would raise TypeError
        raise ValueError(f"duration must be a string, got {duration!r}")
    m = _PATTERN.fullmatch(duration)
    if not m:
        raise ValueError(f"unsupported duration: {duration!r}")
    return int(m.group(1)), m.group(2)


def _add_months(dt, months):
    total = dt.month - 1 + months
    year, month = dt.year + total // 12, total % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def _add(dt, n, unit):
    if unit == "D":
        return dt + timedelta(days=n)
    if unit == "W":
        return dt + timedelta(weeks=n)
    return _add_months(dt, n if unit == "M" else 12 * n)


def add_duration(dt, duration):
    n, unit = _parse(duration)
    return _add(dt, n, unit)


def renewal_dates(start, duration, until):
    n, unit = _parse(duration)
    dates, k = [], 0
    while True:
        current = _add(start, k * n, unit)       # always from the original start: no drift
        if current >= until:
            return dates
        dates.append(current)
        k += 1
