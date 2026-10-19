import time

from tasks.p09_pay_with_retry import PayoutFailed, TransientError   # same classes as the task and tests


def pay_with_retry(bank, payout_id, amount, max_attempts=5, base_delay=0.5, sleep=time.sleep):
    key = f"payout:{payout_id}"
    last_error = None
    for attempt in range(1, max_attempts + 1):
        if attempt > 1:
            sleep(base_delay * 2 ** (attempt - 2))
        try:
            return bank.pay(key, amount)
        except TransientError as e:                 # not processed: safe to retry
            last_error = e
        except TimeoutError as e:                   # unknown outcome: ask before paying again
            last_error = e
            existing = bank.get_payment(key)
            if existing is not None:
                return existing
    raise PayoutFailed(f"payout {payout_id} failed after {max_attempts} attempts") from last_error
