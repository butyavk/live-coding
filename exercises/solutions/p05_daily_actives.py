from collections import defaultdict
from datetime import datetime, time, timedelta


def _first_midnight_at_or_after(dt):
    midnight = datetime.combine(dt.date(), time())
    return dt.date() if dt == midnight else dt.date() + timedelta(days=1)


def daily_active_counts(subscriptions, first_day, last_day):
    delta = defaultdict(int)                  # day -> change in the active count at 00:00
    for start, end in subscriptions:
        first_active = _first_midnight_at_or_after(start)      # first midnight with start <= midnight
        first_inactive = _first_midnight_at_or_after(end)      # first midnight with midnight >= end
        if first_active < first_inactive:
            delta[first_active] += 1
            delta[first_inactive] -= 1
    # everything that changed before the window is already "in" at first_day
    running = sum(v for day, v in delta.items() if day <= first_day)
    result, day = {}, first_day
    while day <= last_day:
        if day != first_day:
            running += delta.get(day, 0)
        result[day] = running
        day += timedelta(days=1)
    return result
