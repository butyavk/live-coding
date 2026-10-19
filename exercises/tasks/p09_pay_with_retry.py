"""P09. Pay out safely with retries                  Level: hard.  Target time: 25 min.

Send a payout through a bank client and never pay twice.

    payment_id = pay_with_retry(bank, payout_id="po_42", amount=Decimal("760.00"))

The bank client has two methods:
    bank.pay(idempotency_key, amount) -> payment_id
    bank.get_payment(idempotency_key) -> payment_id or None

bank.pay can fail in two ways:
    TransientError  — the bank says the request was NOT processed. Safe to retry.
    TimeoutError    — we do not know. The money may already be sent.

Rules:
- The idempotency key is f"payout:{payout_id}", the same on every attempt.
- After a TimeoutError, first call bank.get_payment(key). If it returns a payment id, return it.
  If it returns None, retry. (get_payment itself does not fail in this exercise.)
- At most `max_attempts` calls to bank.pay. Before retry number k (k = 1, 2, …) wait
  base_delay * 2 ** (k - 1) seconds, using the `sleep` function you get (tests pass a fake one).
- If all attempts fail -> raise PayoutFailed (defined below), with the last error as the cause.
- Any other exception from bank.pay -> do not retry, let it propagate.

ASK FIRST: Does the bank itself honour the idempotency key?  A: Assume NOT — that is why we check get_payment.
"""
import time


class TransientError(Exception):
    pass


class PayoutFailed(Exception):
    pass


def pay_with_retry(bank, payout_id, amount, max_attempts=5, base_delay=0.5, sleep=time.sleep):
    raise NotImplementedError("your code")
