STATUS = {"purchase": "active", "renewal": "active", "expiration": "expired", "refund": "refunded"}


class EventProcessor:
    def __init__(self):
        self._seen = set()          # production: a unique constraint on event_id, or ids with a TTL
        self._customers = {}        # customer -> (ts of last applied event, status)

    def process(self, event) -> bool:
        if event["event_id"] in self._seen:
            return False
        if event["type"] not in STATUS:
            raise ValueError(f"unknown event type: {event['type']}")
        self._seen.add(event["event_id"])
        last = self._customers.get(event["customer"])
        if last is None or event["ts"] >= last[0]:
            self._customers[event["customer"]] = (event["ts"], STATUS[event["type"]])
        return True

    def state(self, customer):
        last = self._customers.get(customer)
        return last[1] if last else None
