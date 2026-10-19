// Python drills: write one function, run the checks. Each test is { call, expect } (two Python
// expressions that must be equal and of the same type, also inside lists, tuples, dicts and
// dataclasses: 1.0 is not 1, a defaultdict is not a dict) or { call, raises: "ValueError" }.
// `scale: true` also compares the number of decimal places of every Decimal (12.5 is not 12.50):
// use it only when the question fixes the scale.
// `pre` runs after the reader's code and before the tests (helpers, sample data).
// At build time (npm run exercises) the reference must pass every test and the starter must fail.
//
// Keep this file free of imports and of non-erasable TypeScript.

export interface PyTest {
  call: string;
  expect?: string;
  raises?: string;
}

export interface PyDrill {
  id: string;
  core?: boolean;
  q: string;
  starter: string;
  ref: string;
  pre?: string;
  scale?: boolean;
  tests: PyTest[];
}

export const pyDrills: PyDrill[] = [
  {
    id: "y-group-sum",
    core: true,
    q: "Given payments as dicts {'customer': str, 'amount': Decimal}, return a plain dict (not a defaultdict) customer -> total amount.",
    starter: `from decimal import Decimal


def revenue_by_customer(payments):
    ...
`,
    ref: `from collections import defaultdict
from decimal import Decimal


def revenue_by_customer(payments):
    totals = defaultdict(Decimal)
    for p in payments:
        totals[p["customer"]] += p["amount"]
    return dict(totals)
`,
    pre: `from decimal import Decimal
P = [{"customer": "c1", "amount": Decimal("9.99")}, {"customer": "c2", "amount": Decimal("4.99")}, {"customer": "c1", "amount": Decimal("0.01")}]`,
    tests: [
      {
        call: "revenue_by_customer(P)",
        expect: "{'c1': Decimal('10.00'), 'c2': Decimal('4.99')}",
      },
      {
        call: "revenue_by_customer([])",
        expect: "{}",
      },
    ],
  },
  {
    id: "y-counter",
    core: true,
    q: "Return the k most common channels as (channel, count) pairs; equal counts — alphabetical order.",
    starter: `def top_channels(channels, k):
    ...
`,
    ref: `from collections import Counter


def top_channels(channels, k):
    counts = Counter(channels)
    return sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:k]
`,
    tests: [
      {
        call: "top_channels(['south', 'north', 'north', 'web', 'south'], 2)",
        expect: "[('north', 2), ('south', 2)]",
      },
      {
        call: "top_channels(['north'], 5)",
        expect: "[('north', 1)]",
      },
      {
        call: "top_channels([], 3)",
        expect: "[]",
      },
    ],
  },
  {
    id: "y-dedupe",
    core: true,
    q: "Webhook events arrive at least once. Keep the first delivery of each event_id, in arrival order.",
    starter: `def unique_events(events):
    ...
`,
    ref: `def unique_events(events):
    seen = set()
    out = []
    for e in events:
        if e["event_id"] in seen:
            continue
        seen.add(e["event_id"])
        out.append(e)
    return out
`,
    pre: `E = [{"event_id": "a", "n": 1}, {"event_id": "b", "n": 2}, {"event_id": "a", "n": 3}, {"event_id": "c", "n": 4}, {"event_id": "b", "n": 5}]`,
    tests: [
      {
        call: "[e['n'] for e in unique_events(E)]",
        expect: "[1, 2, 4]",
      },
      {
        call: "unique_events([])",
        expect: "[]",
      },
    ],
  },
  {
    id: "y-latest",
    core: true,
    q: "Events are (subscription_id, timestamp, status). Return subscription_id -> status of its latest event. Equal timestamps — the later one in the list wins.",
    starter: `def latest_status(events):
    ...
`,
    ref: `def latest_status(events):
    best = {}
    for sub_id, ts, status in events:
        if sub_id not in best or ts >= best[sub_id][0]:
            best[sub_id] = (ts, status)
    return {sub_id: status for sub_id, (ts, status) in best.items()}
`,
    pre: `from datetime import datetime as dt
EV = [("s1", dt(2026, 9, 1), "active"), ("s2", dt(2026, 9, 2), "active"), ("s1", dt(2026, 9, 5), "expired"),
      ("s1", dt(2026, 9, 3), "billing_issue"), ("s2", dt(2026, 9, 2), "refunded")]`,
    tests: [
      {
        call: "latest_status(EV)",
        expect: "{'s1': 'expired', 's2': 'refunded'}",
      },
      {
        call: "latest_status([])",
        expect: "{}",
      },
    ],
  },
  {
    id: "y-sort",
    core: true,
    q: "Return payout ids sorted by amount (Decimal) descending; equal amounts — by id ascending.",
    starter: `def order_payouts(payouts):
    ...
`,
    ref: `def order_payouts(payouts):
    return [p["id"] for p in sorted(payouts, key=lambda p: (-p["amount"], p["id"]))]
`,
    pre: `from decimal import Decimal as D
PO = [{"id": "p3", "amount": D("10.00")}, {"id": "p1", "amount": D("25.50")}, {"id": "p2", "amount": D("10.00")}]`,
    tests: [
      {
        call: "order_payouts(PO)",
        expect: "['p1', 'p2', 'p3']",
      },
      {
        call: "order_payouts([])",
        expect: "[]",
      },
    ],
  },
  {
    id: "y-topk",
    core: true,
    q: "totals is a dict customer_id -> revenue. Return the k customer ids with the highest revenue; ties — smaller customer_id first.",
    starter: `def top_customers(totals, k):
    ...
`,
    ref: `import heapq


def top_customers(totals, k):
    best = heapq.nsmallest(k, totals.items(), key=lambda kv: (-kv[1], kv[0]))
    return [customer for customer, _ in best]
`,
    pre: `from decimal import Decimal as D
T = {"c3": D("50"), "c1": D("80"), "c2": D("50"), "c4": D("10")}`,
    tests: [
      {
        call: "top_customers(T, 2)",
        expect: "['c1', 'c2']",
      },
      {
        call: "top_customers(T, 10)",
        expect: "['c1', 'c2', 'c3', 'c4']",
      },
      {
        call: "top_customers({}, 3)",
        expect: "[]",
      },
    ],
  },
  {
    id: "y-overlap",
    core: true,
    q: "Do two periods [a_start, a_end) and [b_start, b_end) overlap? Touching ends do not overlap.",
    starter: `def overlaps(a_start, a_end, b_start, b_end):
    ...
`,
    ref: `def overlaps(a_start, a_end, b_start, b_end):
    return a_start < b_end and b_start < a_end
`,
    pre: `from datetime import date as d`,
    tests: [
      {
        call: "overlaps(d(2026, 9, 1), d(2026, 9, 10), d(2026, 9, 5), d(2026, 9, 20))",
        expect: "True",
      },
      {
        call: "overlaps(d(2026, 9, 1), d(2026, 9, 10), d(2026, 9, 10), d(2026, 9, 20))",
        expect: "False",
      },
      {
        call: "overlaps(d(2026, 9, 5), d(2026, 9, 6), d(2026, 9, 1), d(2026, 9, 30))",
        expect: "True",
      },
    ],
  },
  {
    id: "y-merge",
    q: "periods is a list of (start, end) dates, half-open, in any order. Return the total number of days covered by at least one period.",
    starter: `def covered_days(periods):
    ...
`,
    ref: `def covered_days(periods):
    total = 0
    cur_start = cur_end = None
    for start, end in sorted(periods):
        if cur_end is None or start > cur_end:
            if cur_end is not None:
                total += (cur_end - cur_start).days
            cur_start, cur_end = start, end
        else:
            cur_end = max(cur_end, end)
    if cur_end is not None:
        total += (cur_end - cur_start).days
    return total
`,
    pre: `from datetime import date as d`,
    tests: [
      {
        call: "covered_days([(d(2026, 9, 1), d(2026, 9, 11)), (d(2026, 9, 5), d(2026, 9, 15))])",
        expect: "14",
      },
      {
        call: "covered_days([(d(2026, 9, 1), d(2026, 9, 3)), (d(2026, 9, 3), d(2026, 9, 5)), (d(2026, 9, 10), d(2026, 9, 11))])",
        expect: "5",
      },
      {
        call: "covered_days([(d(2026, 9, 20), d(2026, 9, 25)), (d(2026, 9, 1), d(2026, 9, 10)), (d(2026, 9, 2), d(2026, 9, 3)), (d(2026, 9, 5), d(2026, 9, 20))])",
        expect: "24",
      },
      {
        call: "covered_days([])",
        expect: "0",
      },
    ],
  },
  {
    id: "y-limiter",
    core: true,
    q: "A rate limiter: at most `limit` requests in any `window` seconds. allow(now) returns True and records the request, or returns False and records nothing. The window is (now - window, now]: a request exactly `window` seconds old no longer counts. now only grows.",
    starter: `class RateLimiter:
    def __init__(self, limit, window):
        ...

    def allow(self, now):
        ...
`,
    ref: `from collections import deque


class RateLimiter:
    def __init__(self, limit, window):
        self.limit = limit
        self.window = window
        self.times = deque()

    def allow(self, now):
        while self.times and self.times[0] <= now - self.window:
            self.times.popleft()
        if len(self.times) >= self.limit:
            return False
        self.times.append(now)
        return True
`,
    pre: `def run(times, limit=2, window=10):
    rl = RateLimiter(limit, window)
    return [rl.allow(t) for t in times]`,
    tests: [
      {
        call: "run([0, 1, 2])",
        expect: "[True, True, False]",
      },
      {
        call: "run([0, 1, 10, 11, 12])",
        expect: "[True, True, True, True, False]",
      },
      {
        call: "run([8, 9, 10, 18])",
        expect: "[True, True, False, True]",
      },
      {
        call: "run([5])",
        expect: "[True]",
      },
    ],
  },
  {
    id: "y-split",
    core: true,
    q: "Split an amount (Decimal, cents) into n parts that sum exactly to the amount and differ by at most 0.01; bigger parts first. Each part is a Decimal with two decimals, such as Decimal('10.00').",
    starter: `from decimal import Decimal


def split_amount(amount, n):
    ...
`,
    ref: `from decimal import Decimal


def split_amount(amount, n):
    cents = int(amount * 100)
    base, rest = divmod(cents, n)
    # scaleb(-2) turns cents into dollars and keeps two decimals: 1000 -> Decimal('10.00')
    return [Decimal(base + (1 if i < rest else 0)).scaleb(-2) for i in range(n)]
`,
    pre: `from decimal import Decimal as D`,
    scale: true,
    tests: [
      {
        call: "split_amount(D('100.00'), 3)",
        expect: "[D('33.34'), D('33.33'), D('33.33')]",
      },
      {
        call: "split_amount(D('0.05'), 2)",
        expect: "[D('0.03'), D('0.02')]",
      },
      {
        call: "split_amount(D('10.00'), 7)",
        expect: "[D('1.43')] * 6 + [D('1.42')]",
      },
      {
        call: "sum(split_amount(D('10.00'), 7))",
        expect: "D('10.00')",
      },
      {
        call: "split_amount(D('20.00'), 2)",
        expect: "[D('10.00'), D('10.00')]",
      },
    ],
  },
  {
    id: "y-allocate",
    core: true,
    q: "A payout arrives. Debts are (debt_id, amount_due) oldest first. Pay them in order, partially if money runs out. Return (payments, left_for_merchant), payments as (debt_id, paid) without zero lines. A negative payout raises ValueError.",
    starter: `from decimal import Decimal


def pay_oldest_first(payout, debts):
    ...
`,
    ref: `from decimal import Decimal


def pay_oldest_first(payout, debts):
    if payout < 0:
        raise ValueError("negative payout")
    left = payout
    payments = []
    for debt_id, due in debts:
        if left == 0:
            break
        pay = min(left, due)
        if pay > 0:
            payments.append((debt_id, pay))
            left -= pay
    return payments, left
`,
    pre: `from decimal import Decimal as D
DEBTS = [("a1", D("102.50")), ("a2", D("200.00"))]`,
    tests: [
      {
        call: "pay_oldest_first(D('150.00'), DEBTS)",
        expect: "([('a1', D('102.50')), ('a2', D('47.50'))], D('0.00'))",
      },
      {
        call: "pay_oldest_first(D('102.50'), DEBTS)",
        expect: "([('a1', D('102.50'))], D('0.00'))",
      },
      {
        call: "pay_oldest_first(D('400.00'), DEBTS)",
        expect: "([('a1', D('102.50')), ('a2', D('200.00'))], D('97.50'))",
      },
      {
        call: "pay_oldest_first(D('0'), DEBTS)",
        expect: "([], D('0'))",
      },
      {
        call: "pay_oldest_first(D('-1'), DEBTS)",
        raises: "ValueError",
      },
    ],
  },
  {
    id: "y-months",
    core: true,
    q: "Add n months to a date (n may be negative); if the day does not exist in the target month, use the last day (Jan 31 + 1 month = Feb 28).",
    starter: `from datetime import date


def add_months(d, n):
    ...
`,
    ref: `import calendar
from datetime import date


def add_months(d, n):
    total = d.month - 1 + n
    year, month = d.year + total // 12, total % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)
`,
    pre: `from datetime import date as d`,
    tests: [
      {
        call: "add_months(d(2026, 1, 31), 1)",
        expect: "d(2026, 2, 28)",
      },
      {
        call: "add_months(d(2026, 11, 15), 3)",
        expect: "d(2027, 2, 15)",
      },
      {
        call: "add_months(d(2028, 1, 31), 1)",
        expect: "d(2028, 2, 29)",
      },
      {
        call: "add_months(d(2026, 3, 31), 12)",
        expect: "d(2027, 3, 31)",
      },
      {
        call: "add_months(d(2026, 11, 30), 1)",
        expect: "d(2026, 12, 30)",
      },
      {
        call: "add_months(d(2026, 1, 15), -13)",
        expect: "d(2024, 12, 15)",
      },
    ],
  },
  {
    id: "y-iso",
    q: "Given purchase and refund times as ISO strings like '2026-09-01T10:00:00Z', return the delay in whole days (rounded down).",
    starter: `from datetime import datetime


def refund_delay_days(purchased_at, refunded_at):
    ...
`,
    ref: `from datetime import datetime


def refund_delay_days(purchased_at, refunded_at):
    a = datetime.fromisoformat(purchased_at)    # Python 3.11+ reads the Z suffix as UTC
    b = datetime.fromisoformat(refunded_at)
    return (b - a).days
`,
    tests: [
      {
        call: "refund_delay_days('2026-09-01T10:00:00Z', '2026-09-03T09:00:00Z')",
        expect: "1",
      },
      {
        call: "refund_delay_days('2026-09-01T10:00:00Z', '2026-09-12T10:00:00Z')",
        expect: "11",
      },
      {
        call: "refund_delay_days('2026-09-30T23:00:00Z', '2026-10-01T01:00:00Z')",
        expect: "0",
      },
    ],
  },
  {
    id: "y-decorator",
    core: true,
    q: "Write a decorator count_calls that counts how many times the function was called (in an attribute `calls`) and keeps the function's name.",
    starter: `import functools


def count_calls(func):
    ...
`,
    ref: `import functools


def count_calls(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        wrapper.calls += 1
        return func(*args, **kwargs)
    wrapper.calls = 0
    return wrapper
`,
    pre: `@count_calls
def charge(amount):
    return amount * 2

charge(1); charge(2)`,
    tests: [
      {
        call: "charge.calls",
        expect: "2",
      },
      {
        call: "charge(5)",
        expect: "10",
      },
      {
        call: "charge.__name__",
        expect: "'charge'",
      },
    ],
  },
  {
    id: "y-ttl",
    q: "A tiny cache with expiry: set(key, value) stores a value, and get(key) returns it, or None once ttl seconds have passed since that key was last set (an entry set at t is gone at t + ttl). The clock is injected (a function returning seconds) so tests do not sleep.",
    starter: `class TTLCache:
    def __init__(self, ttl, clock):
        ...

    def set(self, key, value):
        ...

    def get(self, key):
        ...
`,
    ref: `class TTLCache:
    def __init__(self, ttl, clock):
        self.ttl = ttl
        self.clock = clock
        self.data = {}

    def set(self, key, value):
        self.data[key] = (value, self.clock())

    def get(self, key):
        item = self.data.get(key)
        if item is None:
            return None
        value, stored_at = item
        if self.clock() - stored_at >= self.ttl:
            del self.data[key]
            return None
        return value
`,
    pre: `now = [0]
cache = TTLCache(10, lambda: now[0])
cache.set("rate", 1.08)
def at(t, key="rate"):
    now[0] = t
    return cache.get(key)
def put(t, key, value):
    now[0] = t
    cache.set(key, value)`,
    tests: [
      {
        call: "at(5)",
        expect: "1.08",
      },
      {
        call: "at(10)",
        expect: "None",
      },
      {
        call: "at(11, 'missing')",
        expect: "None",
      },
      {
        call: "[put(20, 'fee', 0.15), put(28, 'fee', 0.20), at(29, 'fee'), at(32, 'fee'), at(38, 'fee')]",
        expect: "[None, None, 0.2, 0.2, None]",
      },
    ],
  },
  {
    id: "y-first-dup",
    q: "Return the first id that appears for the second time, or None. O(n).",
    starter: `def first_duplicate(ids):
    ...
`,
    ref: `def first_duplicate(ids):
    seen = set()
    for x in ids:
        if x in seen:
            return x
        seen.add(x)
    return None
`,
    tests: [
      {
        call: "first_duplicate(['a', 'b', 'c', 'b', 'a'])",
        expect: "'b'",
      },
      {
        call: "first_duplicate(['a', 'b'])",
        expect: "None",
      },
      {
        call: "first_duplicate([])",
        expect: "None",
      },
    ],
  },
  {
    id: "y-validate",
    core: true,
    q: "Parse an amount string like '12.5' into Decimal with 2 decimals (half up). Surrounding spaces are allowed. Raise ValueError for empty, non-numeric or negative input, and for 'NaN' and 'Infinity'.",
    starter: `from decimal import Decimal


def parse_amount(s):
    ...
`,
    ref: `from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

CENT = Decimal("0.01")


def parse_amount(s):
    if not isinstance(s, str):
        raise TypeError(f"amount must be a string, got {type(s).__name__}")
    try:
        value = Decimal(s.strip())
    except InvalidOperation as e:
        raise ValueError(f"not an amount: {s!r}") from e
    if not value.is_finite() or value.is_signed():     # is_signed() also catches '-0'
        raise ValueError(f"bad amount: {s!r}")
    try:
        return value.quantize(CENT, rounding=ROUND_HALF_UP)
    except InvalidOperation as e:                       # too many digits for cents, e.g. '1e30'
        raise ValueError(f"amount too large: {s!r}") from e
`,
    pre: `from decimal import Decimal as D`,
    scale: true,
    tests: [
      {
        call: "parse_amount('12.5')",
        expect: "D('12.50')",
      },
      {
        call: "parse_amount(' 0.125 ')",
        expect: "D('0.13')",
      },
      {
        call: "parse_amount('abc')",
        raises: "ValueError",
      },
      {
        call: "parse_amount('')",
        raises: "ValueError",
      },
      {
        call: "parse_amount('-1')",
        raises: "ValueError",
      },
      {
        call: "parse_amount('NaN')",
        raises: "ValueError",
      },
      {
        call: "parse_amount('Infinity')",
        raises: "ValueError",
      },
    ],
  },
  {
    id: "y-batches",
    q: "Split a list into batches of n (the last one may be shorter) — e.g. to insert rows into the database in chunks. Return a list of lists. n must be positive: raise ValueError otherwise.",
    starter: `def batches(items, n):
    ...
`,
    ref: `def batches(items, n):
    if n <= 0:
        raise ValueError("n must be positive")
    return [items[i:i + n] for i in range(0, len(items), n)]
`,
    tests: [
      {
        call: "batches([1, 2, 3, 4, 5], 2)",
        expect: "[[1, 2], [3, 4], [5]]",
      },
      {
        call: "batches([], 3)",
        expect: "[]",
      },
      {
        call: "batches([1], 0)",
        raises: "ValueError",
      },
      {
        call: "batches([1, 2], -1)",
        raises: "ValueError",
      },
    ],
  },
  {
    id: "y-by-month",
    q: "rows are dicts {'start': datetime, 'amount': Decimal}. Return a plain dict 'YYYY-MM' -> total, months sorted.",
    starter: `def revenue_by_month(rows):
    ...
`,
    ref: `from collections import defaultdict
from decimal import Decimal


def revenue_by_month(rows):
    totals = defaultdict(Decimal)
    for r in rows:
        totals[r["start"].strftime("%Y-%m")] += r["amount"]
    return dict(sorted(totals.items()))
`,
    pre: `from datetime import datetime as dt
from decimal import Decimal as D
R = [{"start": dt(2026, 9, 2), "amount": D("9.99")}, {"start": dt(2026, 8, 31, 23, 59), "amount": D("4.99")}, {"start": dt(2026, 9, 30), "amount": D("1.00")}]`,
    tests: [
      {
        call: "revenue_by_month(R)",
        expect: "{'2026-08': D('4.99'), '2026-09': D('10.99')}",
      },
      {
        call: "list(revenue_by_month(R))",
        expect: "['2026-08', '2026-09']",
      },
    ],
  },
  {
    id: "y-reconcile",
    core: true,
    q: "expected and paid are dicts payout_key -> Decimal. Return {'missing': [...], 'unexpected': [...], 'mismatch': [...]}, keys sorted; amounts within 0.01 are a match.",
    starter: `from decimal import Decimal


def reconcile(expected, paid):
    ...
`,
    ref: `from decimal import Decimal


def reconcile(expected, paid):
    missing = sorted(k for k in expected if k not in paid)
    unexpected = sorted(k for k in paid if k not in expected)
    mismatch = sorted(k for k in expected.keys() & paid.keys()
                      if abs(expected[k] - paid[k]) > Decimal("0.01"))
    return {"missing": missing, "unexpected": unexpected, "mismatch": mismatch}
`,
    pre: `from decimal import Decimal as D
EXP = {"mer_01/north/07": D("69.64"), "mer_01/south/08": D("40.10"), "mer_02/north/07": D("10.00")}
PAID = {"mer_01/north/07": D("69.65"), "mer_02/north/07": D("12.00"), "mer_03/north/07": D("5.00")}`,
    tests: [
      {
        call: "reconcile(EXP, PAID)",
        expect: "{'missing': ['mer_01/south/08'], 'unexpected': ['mer_03/north/07'], 'mismatch': ['mer_02/north/07']}",
      },
      {
        call: "reconcile({}, {})",
        expect: "{'missing': [], 'unexpected': [], 'mismatch': []}",
      },
    ],
  },
  {
    id: "y-stock-on-hand",
    q: "Stock on hand without a database. items: [{'id', 'name', 'unit_cost': Decimal}], moves: [{'item_id', 'moved_at': 'YYYY-MM-DD', 'qty'}] (qty is negative when stock goes out), cutoff: 'YYYY-MM-DD'. Return a list of (id, name, units, value) in the order of items, counting only moves before cutoff; value = unit_cost × units. An item with no moves gives (id, name, 0, Decimal('0.00')). A move for an item that is not in items raises ValueError.",
    starter: `from decimal import Decimal


def stock_on_hand(items, moves, cutoff):
    ...
`,
    ref: `from collections import defaultdict
from decimal import Decimal


def stock_on_hand(items, moves, cutoff):
    known = {i["id"] for i in items}
    units = defaultdict(int)                       # item id -> units before cutoff
    for m in moves:
        if m["item_id"] not in known:
            raise ValueError(f"move for unknown item {m['item_id']}")
        if m["moved_at"] < cutoff:                 # ISO dates compare as strings
            units[m["item_id"]] += m["qty"]
    return [(i["id"], i["name"], units[i["id"]], i["unit_cost"] * units[i["id"]]) for i in items]
`,
    pre: `from decimal import Decimal
ITEMS = [{"id": 1, "name": "Notebook", "unit_cost": Decimal("3.50")}, {"id": 2, "name": "Pen", "unit_cost": Decimal("1.20")}, {"id": 3, "name": "Pen", "unit_cost": Decimal("0.80")}, {"id": 4, "name": "Stapler", "unit_cost": Decimal("7.00")}]
MOVES = [{"item_id": 1, "moved_at": "2026-09-01", "qty": 40}, {"item_id": 1, "moved_at": "2026-09-10", "qty": -15}, {"item_id": 2, "moved_at": "2026-09-03", "qty": 100}, {"item_id": 2, "moved_at": "2026-09-20", "qty": -100}, {"item_id": 3, "moved_at": "2026-09-05", "qty": 25}, {"item_id": 3, "moved_at": "2026-10-01", "qty": 5}, {"item_id": 1, "moved_at": "2026-10-02", "qty": -5}]`,
    tests: [
      {
        call: "stock_on_hand(ITEMS, MOVES, '2026-10-01')",
        expect: "[(1, 'Notebook', 25, Decimal('87.50')), (2, 'Pen', 0, Decimal('0.00')), (3, 'Pen', 25, Decimal('20.00')), (4, 'Stapler', 0, Decimal('0.00'))]",
      },
      {
        call: "stock_on_hand(ITEMS, [], '2026-10-01')",
        expect: "[(1, 'Notebook', 0, Decimal('0.00')), (2, 'Pen', 0, Decimal('0.00')), (3, 'Pen', 0, Decimal('0.00')), (4, 'Stapler', 0, Decimal('0.00'))]",
      },
      {
        call: "stock_on_hand([], [], '2026-10-01')",
        expect: "[]",
      },
      {
        call: "stock_on_hand(ITEMS, MOVES + [{'item_id': 9, 'moved_at': '2026-09-01', 'qty': 1}], '2026-10-01')",
        raises: "ValueError",
      },
    ],
  },
  {
    id: "y-parse-csv",
    core: true,
    q: "A payout file comes as CSV text with the header `payout_id,merchant_id,amount_usd,paid_on`. Read it with csv.DictReader and return (good, bad). good: the valid rows as dicts with the same four keys, amount_usd as Decimal and paid_on as date. bad: a (line_number, reason) pair for each invalid row; the header is line 1. Check in this order and report the first problem: 'missing field' (absent or empty), 'bad amount' (not a finite number), 'bad date' (not a real YYYY-MM-DD date).",
    starter: `import csv
import io
from datetime import date
from decimal import Decimal


def parse_payouts(text):
    ...
`,
    ref: `import csv
import io
from datetime import date
from decimal import Decimal, InvalidOperation

FIELDS = ("payout_id", "merchant_id", "amount_usd", "paid_on")


def parse_payouts(text):
    good, bad = [], []
    reader = csv.DictReader(io.StringIO(text))
    for row in reader:
        line = reader.line_num                      # lines read so far; the header is line 1
        if any(not row.get(f) for f in FIELDS):     # a short row gives None, an empty field ''
            bad.append((line, "missing field"))
            continue
        try:
            amount = Decimal(row["amount_usd"])
        except InvalidOperation:
            amount = None
        if amount is None or not amount.is_finite():
            bad.append((line, "bad amount"))
            continue
        try:
            paid_on = date.fromisoformat(row["paid_on"])
        except ValueError:
            bad.append((line, "bad date"))
            continue
        good.append({"payout_id": row["payout_id"], "merchant_id": row["merchant_id"],
                     "amount_usd": amount, "paid_on": paid_on})
    return good, bad
`,
    pre: `from datetime import date as d
from decimal import Decimal as D
CSV = """payout_id,merchant_id,amount_usd,paid_on
po_0101,mer_01,64.69,2026-09-05
po_0102,mer_02,,2026-09-05
po_0103,mer_03,n/a,2026-09-06
po_0104,mer_04,40.10,2026-09-31
po_0105,mer_05,NaN,2026-09-07
po_0106,mer_06,18.00
po_0107,mer_07,7.25,2026-09-08
"""
HEADER = CSV.splitlines()[0]`,
    tests: [
      {
        call: "parse_payouts(CSV)[0]",
        expect: "[{'payout_id': 'po_0101', 'merchant_id': 'mer_01', 'amount_usd': D('64.69'), 'paid_on': d(2026, 9, 5)}, {'payout_id': 'po_0107', 'merchant_id': 'mer_07', 'amount_usd': D('7.25'), 'paid_on': d(2026, 9, 8)}]",
      },
      {
        call: "parse_payouts(CSV)[1]",
        expect: "[(3, 'missing field'), (4, 'bad amount'), (5, 'bad date'), (6, 'bad amount'), (7, 'missing field')]",
      },
      {
        call: "parse_payouts(HEADER)",
        expect: "([], [])",
      },
    ],
  },
  {
    id: "y-webhook-json",
    core: true,
    q: "parse_webhook(body) gets the JSON text of a channel webhook: `{\"event_id\", \"type\", \"occurred_at\", \"transaction\": {\"id\", \"charged_usd\"}}`, all values strings; occurred_at is an ISO time with Z, charged_usd a decimal string. Return a WebhookEvent (in the starter) with occurred_at as an aware datetime and charged_usd as Decimal. Raise ValueError for broken JSON, for a payload or transaction that is not an object, and for a field that is missing or invalid; the message names the field by its path, such as 'transaction.charged_usd'.",
    starter: `import json
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal


@dataclass(frozen=True)
class WebhookEvent:
    event_id: str
    type: str
    occurred_at: datetime
    transaction_id: str
    charged_usd: Decimal


def parse_webhook(body):
    ...
`,
    ref: `import json
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation


@dataclass(frozen=True)
class WebhookEvent:
    event_id: str
    type: str
    occurred_at: datetime
    transaction_id: str
    charged_usd: Decimal


def text(obj, key, path):
    value = obj.get(key)
    if not isinstance(value, str) or not value:
        raise ValueError(f"{path}: missing or not a string")
    return value


def parse_webhook(body):
    payload = json.loads(body)                  # broken JSON: JSONDecodeError, a ValueError
    if not isinstance(payload, dict):
        raise ValueError("payload: not a JSON object")
    tx = payload.get("transaction")
    if not isinstance(tx, dict):
        raise ValueError("transaction: missing or not an object")

    raw_time = text(payload, "occurred_at", "occurred_at")
    try:
        occurred_at = datetime.fromisoformat(raw_time)
    except ValueError as e:
        raise ValueError(f"occurred_at: not an ISO time: {raw_time!r}") from e
    if occurred_at.tzinfo is None:
        raise ValueError(f"occurred_at: no time zone: {raw_time!r}")

    raw_amount = text(tx, "charged_usd", "transaction.charged_usd")
    try:
        charged = Decimal(raw_amount)
    except InvalidOperation as e:
        raise ValueError(f"transaction.charged_usd: not an amount: {raw_amount!r}") from e
    if not charged.is_finite():
        raise ValueError(f"transaction.charged_usd: not an amount: {raw_amount!r}")

    return WebhookEvent(
        event_id=text(payload, "event_id", "event_id"),
        type=text(payload, "type", "type"),
        occurred_at=occurred_at,
        transaction_id=text(tx, "id", "transaction.id"),
        charged_usd=charged,
    )
`,
    pre: `from datetime import datetime as dt, timezone
from decimal import Decimal as D
OK = '{"event_id": "evt_000073", "type": "renewal", "occurred_at": "2026-08-01T01:08:33Z", "transaction": {"id": "t_007820", "charged_usd": "6.99"}}'
CUT = '{"event_id": "evt_000074", "type": "rene'
NO_TX = '{"event_id": "evt_000075", "type": "refund", "occurred_at": "2026-08-01T02:00:00Z"}'
TX_TEXT = '{"event_id": "evt_000076", "type": "renewal", "occurred_at": "2026-08-01T03:00:00Z", "transaction": "t_002200"}'
NO_AMOUNT = '{"event_id": "evt_000077", "type": "renewal", "occurred_at": "2026-08-01T04:18:35Z", "transaction": {"id": "t_002201"}}'
BAD_AMOUNT = '{"event_id": "evt_000078", "type": "renewal", "occurred_at": "2026-08-01T05:00:00Z", "transaction": {"id": "t_002202", "charged_usd": "6,99"}}'
BAD_TIME = '{"event_id": "evt_000079", "type": "purchase", "occurred_at": "2026-08-32T01:00:00Z", "transaction": {"id": "t_002203", "charged_usd": "9.99"}}'
def error(body):
    """The message of the ValueError that parse_webhook(body) raises."""
    try:
        parse_webhook(body)
    except ValueError as e:
        return str(e)
    return "no ValueError"`,
    tests: [
      {
        call: "parse_webhook(OK)",
        expect: "WebhookEvent('evt_000073', 'renewal', dt(2026, 8, 1, 1, 8, 33, tzinfo=timezone.utc), 't_007820', D('6.99'))",
      },
      {
        call: "parse_webhook(CUT)",
        raises: "ValueError",
      },
      {
        call: "parse_webhook('[]')",
        raises: "ValueError",
      },
      {
        call: "'transaction' in error(NO_TX)",
        expect: "True",
      },
      {
        call: "'transaction' in error(TX_TEXT)",
        expect: "True",
      },
      {
        call: "'transaction.charged_usd' in error(NO_AMOUNT)",
        expect: "True",
      },
      {
        call: "'transaction.charged_usd' in error(BAD_AMOUNT)",
        expect: "True",
      },
      {
        call: "'occurred_at' in error(BAD_TIME)",
        expect: "True",
      },
    ],
  },
  {
    id: "y-max-active",
    q: "periods is a list of (start, end) dates, half-open [start, end), in any order. Return the largest number of periods active at the same moment. A period that ends at the moment another one starts is not active together with it.",
    starter: `def max_active(periods):
    ...
`,
    ref: `def max_active(periods):
    events = []
    for start, end in periods:
        events.append((start, +1))
        events.append((end, -1))
    events.sort()                    # at the same moment -1 sorts before +1: an end frees the place first
    active = best = 0
    for _, delta in events:
        active += delta
        best = max(best, active)
    return best
`,
    pre: `from datetime import date
def sep(day):
    return date(2026, 9, day)`,
    tests: [
      {
        call: "max_active([(sep(1), sep(10)), (sep(2), sep(3)), (sep(5), sep(6))])",
        expect: "2",
      },
      {
        call: "max_active([(sep(9), sep(12)), (sep(5), sep(9)), (sep(1), sep(5))])",
        expect: "1",
      },
      {
        call: "max_active([(sep(20), sep(25)), (sep(1), sep(30)), (sep(5), sep(8)), (sep(4), sep(10)), (sep(5), sep(6))])",
        expect: "4",
      },
      {
        call: "max_active([])",
        expect: "0",
      },
    ],
  },
  {
    id: "y-retry",
    q: "Write retry(times, exceptions), a decorator with parameters: @retry(times=3, exceptions=(TimeoutError,)) calls the function at most `times` times in total. Only the listed exceptions are retried; any other error goes up at once. After the last failed attempt, re-raise the last error. Keep the function's name. times below 1 raises ValueError before any call.",
    starter: `import functools


def retry(times, exceptions):
    ...
`,
    ref: `import functools


def retry(times, exceptions):
    if times < 1:
        raise ValueError(f"times must be at least 1, got {times}")

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(1, times + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions:
                    if attempt == times:
                        raise                   # the error of the last attempt, with its traceback
        return wrapper
    return decorator
`,
    pre: `calls = []
def make(outcomes, **options):
    """send_payout decorated with retry(**options). Each call takes the next outcome: an exception is raised, a value is returned."""
    left = iter(outcomes)
    @retry(**options)
    def send_payout(payout_id):
        calls.append(payout_id)
        outcome = next(left)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome
    return send_payout
def attempts(outcomes, **options):
    """Calls send_payout('po_0101') once. Returns (its result or 'ErrorType: message', how many calls ran)."""
    calls.clear()
    try:
        result = make(outcomes, **options)("po_0101")
    except Exception as e:
        result = f"{type(e).__name__}: {e}"
    return result, len(calls)
T = (TimeoutError,)`,
    tests: [
      {
        call: "attempts([TimeoutError('slow'), TimeoutError('slow'), 'sent'], times=3, exceptions=T)",
        expect: "('sent', 3)",
      },
      {
        call: "attempts([TimeoutError('try 1'), TimeoutError('try 2'), TimeoutError('try 3'), 'sent'], times=3, exceptions=T)",
        expect: "('TimeoutError: try 3', 3)",
      },
      {
        call: "attempts([ValueError('bad amount'), 'sent'], times=3, exceptions=T)",
        expect: "('ValueError: bad amount', 1)",
      },
      {
        call: "attempts([ConnectionError('reset'), TimeoutError('slow'), 'sent'], times=3, exceptions=(TimeoutError, ConnectionError))",
        expect: "('sent', 3)",
      },
      {
        call: "make(['sent'], times=1, exceptions=T).__name__",
        expect: "'send_payout'",
      },
      {
        call: "make(['sent'], times=0, exceptions=T)",
        raises: "ValueError",
      },
    ],
  },
  {
    id: "y-state",
    q: "Status (in the starter) is an Enum. Write Subscription: it starts in Status.TRIAL, and move(to) sets status to `to`, given as a Status or as its value such as 'active'. Allowed moves: trial → active or expired; active → billing_issue, expired or refunded; billing_issue → active or expired; expired → active; refunded is final. Any other move, or an unknown value, raises ValueError and leaves the status as it was.",
    starter: `from enum import Enum


class Status(Enum):
    TRIAL = "trial"
    ACTIVE = "active"
    BILLING_ISSUE = "billing_issue"
    EXPIRED = "expired"
    REFUNDED = "refunded"


class Subscription:
    def __init__(self):
        ...

    def move(self, to):
        ...
`,
    ref: `from enum import Enum


class Status(Enum):
    TRIAL = "trial"
    ACTIVE = "active"
    BILLING_ISSUE = "billing_issue"
    EXPIRED = "expired"
    REFUNDED = "refunded"


ALLOWED = {
    Status.TRIAL: {Status.ACTIVE, Status.EXPIRED},
    Status.ACTIVE: {Status.BILLING_ISSUE, Status.EXPIRED, Status.REFUNDED},
    Status.BILLING_ISSUE: {Status.ACTIVE, Status.EXPIRED},
    Status.EXPIRED: {Status.ACTIVE},
    Status.REFUNDED: set(),                     # final
}


class Subscription:
    def __init__(self):
        self.status = Status.TRIAL

    def move(self, to):
        to = Status(to)                         # 'active' -> Status.ACTIVE; 'paused' -> ValueError
        if to not in ALLOWED[self.status]:
            raise ValueError(f"cannot move from {self.status.value} to {to.value}")
        self.status = to
`,
    pre: `def walk(*steps):
    """A new Subscription moved through the steps in order. Returns its final status."""
    sub = Subscription()
    for to in steps:
        sub.move(to)
    return sub.status
def after_refused():
    """The status after a refused move: active, then an attempt to go back to trial."""
    sub = Subscription()
    sub.move(Status.ACTIVE)
    try:
        sub.move(Status.TRIAL)
    except ValueError:
        pass
    return sub.status`,
    tests: [
      {
        call: "walk()",
        expect: "Status.TRIAL",
      },
      {
        call: "walk(Status.ACTIVE, Status.BILLING_ISSUE, Status.ACTIVE, Status.EXPIRED, Status.ACTIVE)",
        expect: "Status.ACTIVE",
      },
      {
        call: "walk('active', 'refunded')",
        expect: "Status.REFUNDED",
      },
      {
        call: "walk(Status.REFUNDED)",
        raises: "ValueError",
      },
      {
        call: "walk('active', 'refunded', 'active')",
        raises: "ValueError",
      },
      {
        call: "walk('paused')",
        raises: "ValueError",
      },
      {
        call: "after_refused()",
        expect: "Status.ACTIVE",
      },
    ],
  },
];
