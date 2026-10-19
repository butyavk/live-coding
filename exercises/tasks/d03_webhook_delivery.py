"""D03. DEBUG: webhook delivery to merchants        Target time: 20 min.

BUG REPORT (from support)
  "Merchant A says some webhooks never arrived, even after the endpoint was back up. Merchant B got
   NONE of their webhooks on a worker that had just served merchant A. And a payload bug made the
   worker sleep for seconds instead of failing fast."

What deliver_all SHOULD do (the tests check this):
- Deliver events in created_at order. `seen` holds ids that were already delivered; the caller owns it.
  If the caller does not pass `seen`, every call starts with an empty set.
- An id in `seen` is skipped. An id is added to `seen` only AFTER a successful send.
- send(event) may raise TemporaryError -> retry, at most `max_attempts` sends in total for that event.
  Before retry k (k = 1, 2, ...) wait base_delay * 2 ** (k - 1). Do not wait after the final failure.
- An event that still fails is skipped for now (not in `seen`), so the next run tries it again.
- Any other exception from send is a bug in our payload: let it propagate immediately, no retries.
- Return the list of ids delivered in this call.

ASK FIRST: Who owns seen?  A: The caller. If it is not passed, every call starts with an empty set.

HOW TO PRACTISE: delete the START line, run `uv run pytest -k d03`, fix one bug at a time, say each one out loud.
"""
import time

# START: delete this line to run the tests


class TemporaryError(Exception):
    pass


def deliver_all(events, send, seen=set(), max_attempts=3, base_delay=1.0, sleep=time.sleep):
    delivered = []
    for event in sorted(events, key=lambda e: e["created_at"]):
        if event["id"] in seen:
            continue
        seen.add(event["id"])
        for attempt in range(max_attempts):
            try:
                send(event)
                delivered.append(event["id"])
                break
            except Exception:
                sleep(base_delay * 2 ** attempt)
    return delivered
