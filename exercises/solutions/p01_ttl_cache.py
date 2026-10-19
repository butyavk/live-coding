import functools
import time
from collections import OrderedDict


def ttl_cache(ttl_seconds, max_size=None, clock=time.monotonic):
    def decorator(func):
        cache = OrderedDict()          # key -> (stored_at, value); order = recency of use

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            key = (args, tuple(sorted(kwargs.items())))
            now = clock()
            if key in cache:
                stored_at, value = cache[key]
                if now - stored_at < ttl_seconds:
                    cache.move_to_end(key)
                    wrapper.hits += 1
                    return value
                del cache[key]
            wrapper.misses += 1
            value = func(*args, **kwargs)          # an exception propagates and is not stored
            cache[key] = (now, value)
            if max_size is not None and len(cache) > max_size:
                cache.popitem(last=False)          # least recently used
            return value

        wrapper.hits = 0
        wrapper.misses = 0
        return wrapper
    return decorator
