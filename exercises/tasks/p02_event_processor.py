"""P02. Idempotent webhook processor               Level: medium.    Target time: 20 min.

Channel webhooks arrive at least once and not always in order. Write `EventProcessor`:

    p = EventProcessor()
    p.process({"event_id": "e1", "type": "purchase", "customer": "c1", "ts": 100})  # -> True
    p.process({"event_id": "e1", ...})   # same id again -> False, nothing changes
    p.state("c1")                        # -> "active"

- `process(event) -> bool`: False if this event_id was already processed, True otherwise.
- The status of a customer comes from the event type:
      purchase, renewal -> "active";  expiration -> "expired";  refund -> "refunded"
- Out of order: if an event is OLDER (smaller ts) than the last event applied for that customer,
  it does not change the status. It still counts as processed (True, and a repeat returns False).
- Equal ts: the later-processed event wins.
- `state(customer)` returns the status or None for an unknown customer.
- Unknown event type -> ValueError (and the event is NOT marked as processed).

ASK FIRST: Is the processed-ids set allowed to grow forever?  A: Yes for this exercise; say how you would limit it in production.
           Can events arrive out of order?  A: Yes. An older event must not overwrite a newer status, but it still counts as processed.
           Two events for a customer with the same ts?  A: The one processed later wins.
           Unknown event type?  A: ValueError, and the event is not marked as processed.
"""


class EventProcessor:
    def __init__(self):
        raise NotImplementedError("your code")

    def process(self, event) -> bool:
        raise NotImplementedError("your code")

    def state(self, customer):
        raise NotImplementedError("your code")
