# Bugs: (1) `seen=set()` is created once and shared by every call that does not pass it
#           -> a worker that served merchant A then skips merchant B's ids that A already got;
#       (2) the id is added to `seen` before the send succeeds -> failed events are never retried;
#       (3) `except Exception` also retries payload bugs -> catch only TemporaryError;
#       (4) it sleeps after the last failed attempt as well.
import time

from tasks.d03_webhook_delivery import TemporaryError    # same class as the task and the tests


def deliver_all(events, send, seen=None, max_attempts=3, base_delay=1.0, sleep=time.sleep):
    seen = set() if seen is None else seen
    delivered = []
    for event in sorted(events, key=lambda e: e["created_at"]):
        if event["id"] in seen:
            continue
        for attempt in range(1, max_attempts + 1):
            try:
                send(event)
            except TemporaryError:
                if attempt < max_attempts:
                    sleep(base_delay * 2 ** (attempt - 1))
                continue
            seen.add(event["id"])
            delivered.append(event["id"])
            break
    return delivered
