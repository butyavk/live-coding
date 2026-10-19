"""P08. Rate limiter for a public API               Level: medium.    Target time: 15 min.

    limiter = SlidingWindowLimiter(limit=3, window_seconds=10)
    limiter.allow("client_1", now=0.0)   # True
    ...

- `allow(key, now) -> bool`: True if this request is allowed. In ANY window of `window_seconds`
  there can be at most `limit` allowed requests per key. A request at time t counts inside the window
  (t - window_seconds, t]  — so a request exactly window_seconds later is allowed again.
- Rejected requests do not count.
- Keys are independent. `now` never goes backwards.
- Memory: do not keep timestamps that can no longer matter, for keys that keep calling.
  Say what you would do for idle keys.

ASK FIRST: Fixed windows (per minute on the clock) or sliding?  A: Sliding. Then say the trade-off of a token bucket.
           Do rejected requests count toward the limit?  A: No.
           Is a request exactly window_seconds after another one inside the window?  A: No: the window is (now - window_seconds, now], so it is allowed again.
"""


class SlidingWindowLimiter:
    def __init__(self, limit, window_seconds):
        raise NotImplementedError("your code")

    def allow(self, key, now) -> bool:
        raise NotImplementedError("your code")
