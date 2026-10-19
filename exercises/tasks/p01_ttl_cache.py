"""P01. TTL cache decorator                        Level: hard.    Target time: 20 min.

Write a decorator `ttl_cache(ttl_seconds, max_size=None, clock=time.monotonic)`.

    @ttl_cache(ttl_seconds=60)
    def get_exchange_rate(currency): ...

- The first call with some arguments runs the function and stores the result.
- A call with the same arguments within `ttl_seconds` returns the stored result without running the function.
- After `ttl_seconds` the entry has expired: the next call runs the function again.
- Keyword arguments are part of the key: f(1, b=2) and f(1, b=3) are different; f(a=1, b=2) and f(b=2, a=1) are the same.
  As in functools.lru_cache, f(1, b=2) and f(a=1, b=2) are different keys: a positional argument is not a keyword one.
- `max_size`: when the cache is full, remove the least recently USED entry (LRU).
- The wrapper exposes counters: `wrapper.hits` and `wrapper.misses`.
- `clock` returns the current time in seconds; tests pass a fake clock.

ASK FIRST: Is an entry exactly at ttl_seconds still valid?   A: No — valid while now - stored_at < ttl_seconds.
           Do we cache exceptions?                          A: No, an exception is not stored.
           Is f(1, b=2) the same entry as f(a=1, b=2)?      A: No. Like functools.lru_cache: positional and keyword
                                                               arguments are different keys; only the order of keywords does not matter.
"""
import time


def ttl_cache(ttl_seconds, max_size=None, clock=time.monotonic):
    raise NotImplementedError("your code")
