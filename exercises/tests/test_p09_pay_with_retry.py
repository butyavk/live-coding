from decimal import Decimal as D
import pytest
from conftest import load
from tasks.p09_pay_with_retry import TransientError, PayoutFailed


class FakeBank:
    """script: list of outcomes for pay(): 'ok', 'transient', 'timeout_sent', 'timeout_lost', 'boom'."""
    def __init__(self, script):
        self.script, self.payments, self.pay_calls = list(script), {}, 0

    def pay(self, key, amount):
        self.pay_calls += 1
        outcome = self.script.pop(0)
        if outcome == "transient":
            raise TransientError("503")
        if outcome == "boom":
            raise KeyError("bug")
        if outcome in ("ok", "timeout_sent"):
            if key in self.payments:
                raise AssertionError("PAID TWICE")
            self.payments[key] = f"bank_{len(self.payments) + 1}"
            if outcome == "ok":
                return self.payments[key]
        raise TimeoutError("read timeout")

    def get_payment(self, key):
        return self.payments.get(key)


def run(script, sleeps=None, **kw):
    bank, sleeps = FakeBank(script), [] if sleeps is None else sleeps
    result = load("p09_pay_with_retry").pay_with_retry(bank, "po_42", D("760.00"), sleep=sleeps.append, **kw)
    return result, bank, sleeps


def test_first_try():
    result, bank, sleeps = run(["ok"])
    assert result == "bank_1" and sleeps == [] and list(bank.payments) == ["payout:po_42"]


def test_transient_then_ok_with_backoff():
    result, bank, sleeps = run(["transient", "transient", "ok"], base_delay=0.5)
    assert result == "bank_1" and sleeps == [0.5, 1.0] and bank.pay_calls == 3


def test_timeout_but_money_was_sent_is_not_paid_again():
    result, bank, sleeps = run(["timeout_sent"])
    assert result == "bank_1" and bank.pay_calls == 1


def test_timeout_lost_then_retry():
    result, bank, sleeps = run(["timeout_lost", "ok"])
    assert result == "bank_1" and bank.pay_calls == 2 and sleeps == [0.5]


def test_timeout_on_the_last_attempt_still_asks_the_bank():
    result, bank, sleeps = run(["timeout_lost", "timeout_lost", "timeout_sent"], max_attempts=3)
    assert result == "bank_1"                  # the money left on attempt 3: get_payment finds it
    assert bank.pay_calls == 3 and sleeps == [0.5, 1.0]


def test_gives_up_with_cause():
    sleeps = []
    with pytest.raises(PayoutFailed) as e:
        run(["transient"] * 3, sleeps=sleeps, max_attempts=3)
    assert isinstance(e.value.__cause__, TransientError)
    assert sleeps == [0.5, 1.0]                # no wait after the last failure


def test_unknown_errors_are_not_retried():
    with pytest.raises(KeyError):
        run(["boom", "ok"])
