"""P13. Fetch every page from the payouts API          Level: hard.  Target time: 25 min.

Our payouts API returns a merchant's payouts page by page. Fetch all of them, and survive rate
limits and server errors.

    payouts = fetch_all_payouts(client, "mer_03", since=date(2026, 9, 1))

The HTTP client is given (the tests pass a fake one):
    client.get(path, params) -> Response(status, headers, json)

    first page:  client.get("/v1/payouts", {"merchant_id": "mer_03", "since": "2026-09-01"})
    next pages:  the same params plus "cursor": the next_cursor of the previous page
    a 200 answer: json = {"data": [{"id": "po_1", ...}, ...], "next_cursor": "c2"}   (None on the last page)

- Return every payout dict, in the order they first appear. The same payout can come on two pages
  (new payouts shift the pages while you read them): return it once.
- 429 Too Many Requests: wait the Retry-After seconds (a header, like "3"), then ask for the same page again.
- 500-599: ask for the same page again.
- Before retry k of a page (k = 1, 2, ...), wait Retry-After after a 429 that has it, otherwise
  base_delay * 2 ** (k - 1). Wait with the sleep function you get: the tests pass a fake one.
- A page gets at most max_retries retries. When they run out, raise ApiError with the last status.
  Do not wait after the last failure.
- Any other status: raise ApiError(status, ...) at once, without retries.
- The API has a bug: sometimes it sends back a cursor that was already used. Do not loop forever.

ASK FIRST: Is the retry limit per page or for the whole run?  A: Per page: every page gets max_retries
               retries. 429s and 5xx share them, and k in the backoff is that same count.
           Is the header always spelled Retry-After?  A: No. Header names are case-insensitive, as in HTTP;
               some servers send retry-after.
           Can Retry-After be a date?  A: Not from this API: always whole seconds, like "3". In production
               you would also cap the wait.
           The same payout on two pages: which copy do I keep?  A: The first one.
           What should happen when a cursor comes back that was already used?  A: Raise ApiError with status
               None. A list that may be incomplete must not look complete.
           Should I parse the amounts?  A: No. Return the payout dicts as the API sends them; a later step
               parses them.
"""
import time
from typing import NamedTuple


class Response(NamedTuple):
    status: int
    headers: dict
    json: dict | None


class ApiError(Exception):
    def __init__(self, status, message=""):
        super().__init__(f"HTTP {status}: {message}" if status is not None else message)
        self.status = status


def fetch_all_payouts(client, merchant_id, since, max_retries=3, base_delay=0.5, sleep=time.sleep):
    raise NotImplementedError("your code")
