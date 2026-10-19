import time
from typing import NamedTuple

from tasks.p13_fetch_payouts import ApiError, Response   # same classes as the task and tests

PATH = "/v1/payouts"


def header(headers, name):
    """HTTP header names are case-insensitive: Retry-After and retry-after are the same header."""
    for key, value in headers.items():
        if key.lower() == name.lower():
            return value
    return None


def get_page(client, params, max_retries, base_delay, sleep):
    """One page, with its own retry count. Returns the json of the 200 answer."""
    retries = 0
    while True:
        r = client.get(PATH, params)
        if r.status == 200:
            return r.json
        if r.status != 429 and not 500 <= r.status <= 599:
            raise ApiError(r.status, "not retried")                 # 400, 401, 404 …: retrying will not help
        if retries == max_retries:
            raise ApiError(r.status, f"still failing after {max_retries} retries")   # no wait after the last one
        retries += 1
        wait = header(r.headers, "Retry-After") if r.status == 429 else None
        sleep(int(wait) if wait is not None else base_delay * 2 ** (retries - 1))


def fetch_all_payouts(client, merchant_id, since, max_retries=3, base_delay=0.5, sleep=time.sleep):
    params = {"merchant_id": merchant_id, "since": since.isoformat()}
    payouts, seen_ids, used = [], set(), set()
    cursor = None
    while True:
        page = get_page(client, params if cursor is None else {**params, "cursor": cursor}, max_retries, base_delay, sleep)
        for item in page["data"]:
            if item["id"] not in seen_ids:                          # the first copy wins
                seen_ids.add(item["id"])
                payouts.append(item)
        used.add(cursor)
        cursor = page["next_cursor"]
        if cursor is None:
            return payouts
        if cursor in used:
            raise ApiError(None, f"the API sent cursor {cursor!r} again: the pages loop")
