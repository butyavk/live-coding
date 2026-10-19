// Interview-style Python tasks. The full statement, the starting code, the tests and the
// reference live in exercises/ (tasks/<file>.py, tests/test_<file>.py, solutions/<file>.py).
// This file adds the task as an interviewer would explain it (`brief` and a worked `example`),
// a call to try with Run (`code`) and one line to say out loud after solving.
//
// Keep this file free of imports and of non-erasable TypeScript.

export interface PyTask {
  id: string;
  /** Shown instead of the technique, so the label does not give the solution away. */
  difficulty: 'easy' | 'medium' | 'hard';
  file: string;
  brief: string[];
  example: string;
  code: string;
  say: string;
}

export const pyTasks: PyTask[] = [
  {
    id: "d02",
    difficulty: "medium",
    file: "d02_subscription_report",
    brief: [
      "This is a debugging task: the code is already written, but the report is wrong. The product team says the number of active subscribers is too high, it does not change when they pass a different list of transactions, and revenue sometimes shows numbers like 10.290000000000001.",
      "active_at should count, per product, the paid subscriptions active at moment: start <= moment < end, not a trial, not a test purchase, not promo, not refunded by that moment. revenue_by_product should be the sum of revenue_usd per product, without test purchases, exact to the cent, as Decimal.",
      "Click Check, read which tests fail, find each bug and say it out loud: \"The bug is …, because …\". Then fix it.",
    ],
    example: `a subscription that ended exactly at moment should not be active
active now:   {'a': 1}        should be  {}
revenue of 0.10 × 3:  {'a': 0.30000000000000004}    should be  {'a': Decimal('0.30')}`,
    code: `from datetime import datetime, timedelta
from decimal import Decimal

now = datetime(2026, 9, 15)
t = {"product_id": "a", "start_time": now - timedelta(days=30), "end_time": now, "is_trial": False,
     "is_test": False, "channel": "north_market", "refunded_at": None, "revenue_usd": Decimal("0.10")}
print(active_at([t], now))          # should be {}: the period ended exactly now
print(revenue_by_product([t, t, t]))    # should be {'a': Decimal('0.30')}`,
    say: "A mutable default cache, an inclusive end, missing promo and refund filters, and float money.",
  },
  {
    id: "d03",
    difficulty: "hard",
    file: "d03_webhook_delivery",
    brief: [
      "This is a debugging task: we deliver webhooks to our merchants' servers, and the code is already written. Support says merchant A never got some webhooks, even after their endpoint was back up. Merchant B got none at all on a worker that had just served merchant A. And a bug in one payload made the worker sleep for seconds instead of failing fast.",
      "How it should work: deliver events in created_at order. Skip ids that are in seen, and add an id to seen only AFTER a successful send. If the caller does not pass seen, every call starts with an empty set. On TemporaryError, retry — at most max_attempts sends, waiting 1, 2, 4… seconds, and no wait after the last failure; such an event stays out of seen. Any other error goes up immediately. Return the ids delivered in this call.",
      "Click Check, find each bug, say it out loud and fix it.",
    ],
    example: `events e2 (t=2), e1 (t=1); e1 fails twice with TemporaryError, then succeeds
→ ['e1', 'e2'], waits [1.0, 2.0]
a second call for another merchant, without seen → ['e1', 'e2'] again`,
    code: `events = [{"id": "e2", "created_at": 2}, {"id": "e1", "created_at": 1}]
print(deliver_all(events, send=lambda e: None, sleep=print))   # ['e1', 'e2']
print(deliver_all(events, send=lambda e: None, sleep=print))   # a fresh call: should be ['e1', 'e2'] again`,
    say: "The default set is shared between calls, the id is marked before success, every exception is retried, and it sleeps after the final failure.",
  },
  {
    id: "p01",
    difficulty: "hard",
    file: "p01_ttl_cache",
    brief: [
      "A function calls a slow external service, for example to get an exchange rate. We want a cache: a decorator ttl_cache that remembers the result for ttl_seconds.",
      "The first call with some arguments runs the function and stores the result. A call with the same arguments before ttl has passed returns the stored result without running the function. After ttl, run it again. Keyword arguments are part of the key, and f(a=1, b=2) is the same call as f(b=2, a=1). But f(1, b=2) and f(a=1, b=2) are different keys, as in functools.lru_cache.",
      "If max_size is set and the cache is full, remove the entry that was used least recently. Exceptions are not cached. The wrapper has counters hits and misses. The time comes from clock — the tests pass a fake clock.",
    ],
    example: `ttl = 10
rate('EUR') at t=0   → runs        (miss)
rate('EUR') at t=5   → from cache  (hit)
rate('EUR') at t=10  → runs again  (an entry lives while less than 10 seconds have passed)`,
    code: `calls = []

@ttl_cache(ttl_seconds=60)
def rate(currency):
    calls.append(currency)
    return 1.1

print(rate("EUR"), rate("EUR"), calls, rate.hits, rate.misses)   # 1.1 1.1 ['EUR'] 1 1`,
    say: "OrderedDict gives O(1) lookups and LRU eviction; expired entries are removed lazily on access.",
  },
  {
    id: "p02",
    difficulty: "medium",
    file: "p02_event_processor",
    brief: [
      "The sales channels send us webhooks about subscriptions: purchased, renewed, expired, refunded. Delivery is at least once, so the same event can arrive twice. The order is not guaranteed either: an old event can arrive after a newer one.",
      "Write a class EventProcessor. process(event) handles one event and returns True if it is new, or False if we have already seen this event_id — then nothing changes. state(customer) returns the customer's current status: active, expired or refunded, or None if we know nothing about this customer.",
      "If an event is older (smaller ts) than the last event we applied for this customer, it does not change the status, but it still counts as processed. With equal ts, the one processed later wins. An unknown event type is a ValueError, and that event is not marked as processed.",
    ],
    example: `process(e2, refund,  c1, ts=300) → True;  state(c1) = refunded
process(e1, renewal, c1, ts=200) → True;  state(c1) = refunded   # arrived late, not applied
process(e1 again)                → False`,
    code: `p = EventProcessor()
e1 = {"event_id": "e1", "type": "purchase", "customer": "c1", "ts": 100}
print(p.process(e1), p.process(e1), p.state("c1"))   # True False active`,
    say: "In production the dedup set is a unique constraint in the database, not memory of one process.",
  },
  {
    id: "p03",
    difficulty: "medium",
    file: "p03_merge_periods",
    brief: [
      "A customer can have access periods that overlap: they upgraded in the middle of a month, or got a promo on top of a paid plan. Support wants to see when the customer actually had access, without the overlaps.",
      "Write two functions. merge_periods merges periods that overlap or touch (one ends exactly when the next starts) and returns them sorted. total_access returns the total time with access, so overlapping time is counted once.",
      "A period is a (start, end) pair, and the end is not included. An empty list gives [] and timedelta(0). A period with end <= start is a ValueError.",
    ],
    example: `periods (days of September):  1–10, 5–20, 20–25, 30–31
merge_periods → 1–25, 30–31          # 1–10 and 5–20 overlap, 20–25 touches
total_access(1–10, 5–20) → 19 days     # not 9 + 15 = 24`,
    code: `from datetime import datetime, timedelta

def d(day):   # day 1 = 2026-09-01, day 31 = 2026-10-01
    return datetime(2026, 9, 1) + timedelta(days=day - 1)

print(merge_periods([(d(1), d(10)), (d(5), d(20)), (d(20), d(25)), (d(30), d(31))]))
print(total_access([(d(1), d(10)), (d(5), d(20))]))   # 19 days`,
    say: "I sort by start, then one pass: if the next start is <= the current end, I extend the period, otherwise I start a new one. O(n log n) because of the sort.",
  },
  {
    id: "p04",
    difficulty: "medium",
    file: "p04_iso_duration",
    brief: [
      "Subscriptions are sold for periods written in ISO 8601 format: \"P1W\" is a week, \"P1M\" a month, \"P3M\" three months, \"P1Y\" a year. We need to compute renewal dates.",
      "add_duration(dt, duration) returns the date one period later. Months and years stick to the end of the month: January 31 + one month is February 28 (or 29 in a leap year). The time of day stays the same. Anything other than PnD, PnW, PnM or PnY with a positive n is a ValueError.",
      "renewal_dates(start, duration, until) returns every period start that is before until, beginning with start. Compute each one from the original start (start + k periods), not from the previous date — otherwise 31 → 28 → 28.",
    ],
    example: `add_duration(Jan 31, 'P1M') → Feb 28
renewal_dates(Jan 31, 'P1M', until=May 1)
→ Jan 31, Feb 28, Mar 31, Apr 30        # not Mar 28!`,
    code: `from datetime import datetime

print(add_duration(datetime(2026, 1, 31), "P1M"))   # 2026-02-28 00:00:00
print(renewal_dates(datetime(2026, 1, 31), "P1M", until=datetime(2026, 5, 1)))`,
    say: "I compute every date from the original start, so Jan 31 never drifts to the 28th.",
  },
  {
    id: "p05",
    difficulty: "hard",
    file: "p05_daily_actives",
    brief: [
      "This is the same question as SQL Q04 — how many subscriptions are active on each day — but in Python and for a lot of data.",
      "The input is a list of subscriptions (start, end), where the end is not included, and a range of days. A subscription is active on day D if it is active at 00:00 of that day. Return a dict with EVERY day of the range, even if the count is zero.",
      "Speed matters: 200,000 subscriptions over 365 days must take well under 2 seconds. Checking every subscription for every day is 73 million checks — too slow. Check in the browser allows 4 seconds, because Python there is 2–3 times slower.",
    ],
    example: `subscriptions: Sep 1 00:00 – Sep 3 00:00;  Sep 1 10:00 – Sep 5;  Aug 20 – Oct 1
days Sep 1–5 → {1: 2, 2: 3, 3: 2, 4: 2, 5: 1}
# on the 1st the second one has not started yet (10:00); on the 3rd the first one has ended`,
    code: `from datetime import date, datetime

subs = [(datetime(2026, 9, 1), datetime(2026, 9, 3)), (datetime(2026, 9, 2, 12), datetime(2026, 9, 10))]
print(daily_active_counts(subs, date(2026, 9, 1), date(2026, 9, 4)))   # 1st: 1, 2nd: 1, 3rd: 1, 4th: 1`,
    say: "Each subscription adds +1 and −1; a running sum over the days gives all counts in O(n + days).",
  },
  {
    id: "p06",
    difficulty: "easy",
    file: "p06_advance_amount",
    brief: [
      "The platform pays merchants part of their future channel payout today — an advance. The question: how much can we pay out, and what is the fee?",
      "The amount is the smallest of three numbers: 70% of the expected proceeds after a refund reserve (0.7 × proceeds × (1 − refund_rate)), the merchant's risk limit, and what is left of our total budget. Round the amount DOWN to cents — we never pay more than allowed. If it is below 1.00, we pay nothing: (0.00, 0.00).",
      "The fee is 3% of the amount, rounded to cents (half up). Everything is Decimal. Negative inputs, or a refund_rate outside [0, 1], are a ValueError.",
    ],
    example: `proceeds 1000, refund_rate 0.05, limit 5000, budget 100000
→ 0.7 × 1000 × 0.95 = 665.00;  fee 19.95
limit 500 → the limit wins: (500.00, 15.00)
proceeds 1.20, refund_rate 0 → 0.84 < 1.00 → (0.00, 0.00)`,
    code: `from decimal import Decimal

print(compute_advance(Decimal("1000"), Decimal("0.05"), Decimal("5000"), Decimal("100000")))
# (Decimal('665.00'), Decimal('19.95'))`,
    say: "Money is Decimal; the amount rounds down so we never advance more than allowed, the fee rounds half up.",
  },
  {
    id: "p07",
    difficulty: "hard",
    file: "p07_reconcile",
    brief: [
      "Accounting has the invoices we sent and the payments that came in. We need to find which payment paid which invoice.",
      "Both steps take the payments in order of date, then id. First by reference: if a payment has a reference and it is the id of an invoice that is still open, they match — even if the amounts differ. So if two payments refer to the same invoice, the earlier payment gets it. Then guess for the payments that are left: same counterparty, same amount, and the payment date at most 3 days away from the invoice due date. Of those, take the closest date; on a tie, the smaller invoice id.",
      "Each invoice and each payment is used at most once. Return the matches, the unmatched invoices and the unmatched payments, all sorted.",
    ],
    example: `invoices: inv_1 acme 100 due Sep 10;  inv_2 acme 100 due Sep 10;  inv_3 beta 50 due Sep 1
payments: pay_a acme 100 Sep 11;  pay_b acme 60 Sep 20 ref=inv_1;  pay_c beta 50 Sep 9
→ matches: (inv_1, pay_b) by reference, (inv_2, pay_a) by amount and date
→ unmatched: inv_3 and pay_c — they are 8 days apart`,
    code: `from datetime import date
from decimal import Decimal

invoices = [{"id": "inv_1", "counterparty": "acme", "amount": Decimal("100.00"), "due": date(2026, 9, 10)}]
payments = [{"id": "pay_1", "counterparty": "acme", "amount": Decimal("100.00"), "date": date(2026, 9, 11),
             "reference": None}]
print(reconcile(invoices, payments))`,
    say: "I index open invoices by (counterparty, amount), so each payment only looks at real candidates.",
  },
  {
    id: "p08",
    difficulty: "medium",
    file: "p08_rate_limiter",
    brief: [
      "We have a public API, and one API client must not overload it. The rule: at most limit requests in any window of window_seconds seconds, for each key (a key is one API client).",
      "Write a class SlidingWindowLimiter(limit, window_seconds). Its method allow(key, now) is called for every incoming request and answers: let it through (True) or reject it (False). The time now is passed as a parameter, so the tests can use any numbers. Time never goes backwards.",
      "The window slides: at moment now, count the allowed requests from the last window_seconds seconds, that is in the interval (now − window, now]. Rejected requests do not count. Keys are independent. For keys that keep calling, do not keep old timestamps that can no longer change the answer; say what you would do for idle keys.",
    ],
    example: `limit = 3, window = 10
allow('client_1', 0)     → True
allow('client_1', 1)     → True
allow('client_1', 2)     → True
allow('client_1', 3)     → False   # already 3 in the last 10 seconds
allow('client_1', 9.999) → False
allow('client_1', 10)    → True    # the request at 0 left the window (0, 10]
allow('client_1', 10.5)  → False
allow('client_2', 3)     → True    # another key, its own window`,
    code: `limiter = SlidingWindowLimiter(limit=3, window_seconds=10)
print([limiter.allow("client_1", now=t) for t in (0, 1, 2, 3, 10)])   # [True, True, True, False, True]`,
    say: "A deque per key keeps at most `limit` timestamps; a token bucket uses constant memory but allows bursts.",
  },
  {
    id: "p09",
    difficulty: "hard",
    file: "p09_pay_with_retry",
    brief: [
      "We send a payout to a merchant through a bank. The main rule: never pay twice.",
      "The bank client has two methods: pay(key, amount) pays and returns a payment id, and get_payment(key) tells us whether a payment with this key already exists. pay can fail in two ways. TransientError means the bank did nothing for sure, so it is safe to retry. TimeoutError means we do not know whether the money left: first ask get_payment; if the payment exists, return it, otherwise retry.",
      "Use one key for every attempt: f\"payout:{payout_id}\". Call pay at most max_attempts times, and before retry k wait base_delay × 2^(k−1) using the sleep function you get. If every attempt fails, raise PayoutFailed with the last error as the cause. Any other error goes straight up, with no retries.",
    ],
    example: `bank: TransientError, TransientError, success
→ 'bank_1', waits [0.5, 1.0], pay called 3 times
bank: timeout, but the money was sent
→ get_payment finds it → 'bank_1', pay called once`,
    code: `from decimal import Decimal

class Bank:
    def __init__(self):
        self.paid = {}

    def pay(self, key, amount):
        self.paid[key] = "bank_1"
        return "bank_1"

    def get_payment(self, key):
        return self.paid.get(key)

print(pay_with_retry(Bank(), payout_id="po_42", amount=Decimal("760.00"), sleep=print))   # bank_1`,
    say: "After a timeout I first ask the bank whether the payment exists — a blind retry could pay twice.",
  },
  {
    id: "p10",
    difficulty: "medium",
    file: "p10_mrr",
    brief: [
      "Finance wants to see MRR: how much money per month the subscriptions that are active right now bring in, per plan. A yearly subscription counts as price / 12 per month, a weekly one as price × 52 / 12, and so on — see the table in the task.",
      "The input is a list of transactions (the same fields as the transactions table) and a moment as_of. Count only subscriptions active at that moment: not a trial, not a test purchase, not promo, and not refunded by that moment (a refund in the future does not count yet).",
      "Return a dict: plan → MRR. Money is Decimal; add everything up without rounding and round to cents once at the end. Plans with nothing active are not in the result. A duration that is not in the table is a ValueError.",
    ],
    example: `two active monthly subscriptions of prd_03.monthly at 9.99
→ {'prd_03.monthly': Decimal('19.98')}
yearly 59.99 → 5.00 per month;  weekly 2.99 → 12.96 per month`,
    code: `from datetime import datetime
from decimal import Decimal

tx = {"plan_id": "prd_03.monthly", "plan_period": "P1M", "charged_usd": Decimal("9.99"),
      "start_time": datetime(2026, 9, 20), "end_time": datetime(2026, 10, 20), "channel": "north_market",
      "is_trial": False, "is_test": False, "refunded_at": None}
print(mrr_by_plan([tx, tx], as_of=datetime(2026, 9, 30)))   # {'prd_03.monthly': Decimal('19.98')}`,
    say: "I sum in full precision and round once per plan at the end, half up.",
  },
  {
    id: "p11",
    difficulty: "medium",
    file: "p11_sql_and_python",
    brief: [
      "A merchant wants to know their best streak: how many days in a row they had sales. In many interview editors your Python code can query the same database as the SQL part, so this task uses both.",
      "The function gets a database connection con, a merchant id and a date range. Use SQL to get the days on which this merchant had at least one paid sale (revenue_usd > 0, no test purchases). Pass the parameters with ? placeholders, not with an f-string. Then, in Python, find the longest run of consecutive days.",
      "Return (length of the run, first day of the run). If several runs have the same length, return the earliest one. No sales at all gives (0, None).",
    ],
    example: `sales on September 1, 2, 5, 6, 7 and 10
→ (3, date(2026, 9, 5))       # the 5th, 6th and 7th in a row`,
    code: `import db
from datetime import date

con = db.connect()
print(longest_streak(con, "mer_01", date(2026, 9, 1), date(2026, 9, 29)))`,
    say: "SQL filters and returns distinct days; Python finds the longest run in one pass. Parameters are bound, never formatted into the string.",
  },
  {
    id: "p12",
    difficulty: "medium",
    file: "p12_payout_file",
    brief: [
      "South Market, one of our partner marketplaces, sends its monthly payout export as a text file, and the file is messy: a BOM at the start, \";\" between the fields, a decimal comma in the amounts, a header in mixed case with spaces, blank lines, bad rows and a totals line at the end.",
      "Write import_payouts(lines). It reads the lines once, one by one, because real files are large. It returns the good rows as Payout records with a date and a Decimal, and a list of errors: (line number, code) for each bad row. The codes are bad_row, missing_merchant, bad_amount, negative_amount, bad_date and duplicate.",
      "The last line is the partner's total. If it does not match the sum of the good rows, or the file is cut off or broken, raise ImportFailed and import nothing.",
    ],
    example: `1  Payout ID; Merchant ID ;Paid On;Note;AMOUNT
2  spo_1001;mer_03;2026-09-14;;1234,50
3  spo_1003;;2026-09-14;;10,00
4  spo_1001;mer_03;2026-09-14;;1234,50
5  TOTAL;;;;1234,50
→ records: [Payout('spo_1001', 'mer_03', date(2026, 9, 14), Decimal('1234.50'))]
→ errors:  [(3, 'missing_merchant'), (4, 'duplicate')]`,
    code: `import io

text = ("\\ufeffPayout ID; Merchant ID ;Paid On;Note;AMOUNT\\n"
        "spo_1001;mer_03;2026-09-14;;1234,50\\n"
        "spo_1003;;2026-09-14;;10,00\\n"
        "TOTAL;;;;1234,50\\n")
print(import_payouts(io.StringIO(text)))   # one good record, errors [(3, 'missing_merchant')]`,
    say: "I read the file once and keep only the set of imported ids. An id joins it only after the row passes every check, and the total decides whether anything is imported.",
  },
  {
    id: "p13",
    difficulty: "hard",
    file: "p13_fetch_payouts",
    brief: [
      "Our payouts API returns a merchant's payouts page by page. Write fetch_all_payouts(client, merchant_id, since): it asks for the first page, then follows next_cursor until it is None, and returns every payout once, in the order they first appear. The same payout can come on two pages.",
      "The API is not always friendly. A 429 means \"too many requests\": wait the Retry-After seconds and ask for the same page again. A 5xx is a server error: ask again after base_delay, then twice as long, and so on. Each page gets at most max_retries retries; then raise ApiError with the last status. Any other error status raises ApiError at once.",
      "The client and the sleep function are given, so the tests use fakes and check every call and every wait. One more thing: the API sometimes sends back a cursor that was already used. Your loop must not run forever.",
    ],
    example: `page 1: po_1, po_2   next_cursor 'c2'
page 2: 429 Retry-After: 3   → sleep(3), ask for 'c2' again
page 2: po_2, po_3   next_cursor None
→ ['po_1', 'po_2', 'po_3'], sleeps [3]`,
    code: `from datetime import date

class Client:
    def __init__(self, answers):
        self.answers = list(answers)

    def get(self, path, params):
        print("GET", path, params)
        return self.answers.pop(0)

client = Client([Response(200, {}, {"data": [{"id": "po_1"}], "next_cursor": "c2"}),
                 Response(429, {"Retry-After": "3"}, None),
                 Response(200, {}, {"data": [{"id": "po_1"}, {"id": "po_2"}], "next_cursor": None})])
print(fetch_all_payouts(client, "mer_03", date(2026, 9, 1), sleep=print))   # [{'id': 'po_1'}, {'id': 'po_2'}]`,
    say: "Two loops: pages, and the attempts of one page. Retries reset on every page, a 429 waits what the server says, and a cursor I have already used stops the loop with an error.",
  },
  {
    id: "p14",
    difficulty: "medium",
    file: "p14_write_tests",
    brief: [
      "This round is about tests. split_payout splits one South Market bundle payout between several merchants by their shares, in whole cents, so that the parts always add up: each merchant first gets its part rounded down, and the cents that are left go to the largest remainders. The function is already written, and it is correct.",
      "Write the tests for it below the YOUR TESTS line: test_* functions that call split_payout, with plain assert, pytest.raises and, if you like, @pytest.mark.parametrize. A few tests are enough if each one has a reason.",
      "Check runs your tests on the correct function, where all of them must pass. Then it runs them on 6 versions with a planted bug, and each time at least one test must fail. A bug that survives is named only by its area.",
    ],
    example: `split_payout(Decimal("10.00"), {"mer_03": 1, "mer_07": 2})
→ [('mer_03', Decimal('3.33')), ('mer_07', Decimal('6.67'))]
# exact parts 3.333… and 6.666…, rounded down: 3.33 + 6.66 = 9.99
# the spare cent goes to the larger remainder, mer_07`,
    code: `print(split_payout(Decimal("10.00"), {"mer_03": 1, "mer_07": 2}))
for name, test in list(globals().items()):      # runs your tests that take no arguments; Check runs them all
    if name.startswith("test_") and test.__code__.co_argcount == 0:
        test()
        print("passed:", name)`,
    say: "I test each promise of the docstring with a case I can work out by hand, and I pick ids out of alphabetical order, so that a wrong order or a wrong tie-break gives a different answer.",
  },
];
