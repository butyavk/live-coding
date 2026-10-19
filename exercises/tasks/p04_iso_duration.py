"""P04. Renewal dates from ISO 8601 durations        Level: medium.    Target time: 20 min.

Plans have durations like "P1W", "P1M", "P3M", "P1Y". Write:

    add_duration(datetime(2026, 1, 31), "P1M")  -> datetime(2026, 2, 28)
    renewal_dates(datetime(2026, 1, 31), "P1M", until=datetime(2026, 5, 1))
        -> [2026-01-31, 2026-02-28, 2026-03-31, 2026-04-30]

- Supported: PnD, PnW, PnM, PnY with a positive integer n. Anything else -> ValueError.
- Months and years clamp to the last day of the month (Jan 31 + P1M = Feb 28, or Feb 29 in a leap year).
  The time of day stays the same.
- `renewal_dates(start, duration, until)`: all period starts that are < until, starting with `start`.
  IMPORTANT: compute each date from the ORIGINAL start (start + k * duration), not from the previous
  date. Otherwise Jan 31 -> Feb 28 -> Mar 28 drifts; the customer expects Mar 31.

ASK FIRST: Mixed durations like "P1M2D"?  A: Not needed; say how you would extend the parser.
           What if duration is None or not a string?  A: ValueError as well.
"""


def add_duration(dt, duration):
    raise NotImplementedError("your code")


def renewal_dates(start, duration, until):
    raise NotImplementedError("your code")
