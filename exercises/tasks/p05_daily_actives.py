"""P05. Daily active subscriptions, fast             Level: hard.      Target time: 20 min.

Same question as SQL Q04, but in Python and for a lot of data.

    daily_active_counts(subscriptions, first_day=date(2026, 9, 1), last_day=date(2026, 9, 30))
    -> {date(2026, 9, 1): 1068, date(2026, 9, 2): 1063, ...}

- `subscriptions`: a list of (start, end) datetimes, period [start, end).
- A subscription is active on day D if it is active at 00:00 of D: start <= D 00:00 < end.
- Return a dict with EVERY day from first_day to last_day inclusive (0 if nobody is active).
- Must handle 200,000 subscriptions and 365 days in well under 2 seconds.
  The naive "for each day, for each subscription" is 73 million checks — too slow.
  (Check in the browser allows 4 seconds: Python there is 2-3 times slower.)

ASK FIRST: Is a subscription that starts at 10:00 active on that day?  A: No: active on day D means active at 00:00 of D.

HINT (read only if stuck): each subscription adds +1 on the first day it is active and -1 on the first
day it is no longer active. Sort or bucket these changes, then walk the days with a running sum.
"""


def daily_active_counts(subscriptions, first_day, last_day):
    raise NotImplementedError("your code")
