from collections import defaultdict, deque


class SlidingWindowLimiter:
    def __init__(self, limit, window_seconds):
        if limit <= 0 or window_seconds <= 0:
            raise ValueError("limit and window must be positive")
        self.limit = limit
        self.window = window_seconds
        self._hits = defaultdict(deque)        # key -> timestamps of allowed requests, oldest first

    def allow(self, key, now) -> bool:
        hits = self._hits[key]
        while hits and hits[0] <= now - self.window:
            hits.popleft()                     # left the window: can never matter again
        if len(hits) >= self.limit:
            return False
        hits.append(now)
        return True
