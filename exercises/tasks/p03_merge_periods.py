"""P03. Merge subscription periods                  Level: medium.    Target time: 15 min.

A customer can have overlapping periods (an upgrade in the middle of a month, a promo on top of a
paid plan). Support wants to see WHEN the customer had access, without overlaps.

    merge_periods([(d(1), d(10)), (d(5), d(20)), (d(20), d(25)), (d(30), d(31))])
    -> [(d(1), d(25)), (d(30), d(31))]

- Input: a list of (start, end) datetimes, any order; each period is [start, end).
- Periods that overlap OR touch (end == next start) merge into one.
- Output: sorted by start, no overlaps.
- `total_access(periods) -> timedelta`: total time with access (overlaps counted once).
- An empty list -> [] and timedelta(0). A period with end <= start -> ValueError.

ASK FIRST: Can the input be very large?  A: Up to a million periods: O(n log n) is fine, O(n^2) is not.
           Do periods that only touch (end == next start) merge?  A: Yes, they merge into one.
           Is the input sorted?  A: No, it can be in any order.
           What about a period with end <= start?  A: It is invalid: ValueError.
"""
from datetime import timedelta


def merge_periods(periods):
    raise NotImplementedError("your code")


def total_access(periods) -> timedelta:
    raise NotImplementedError("your code")
