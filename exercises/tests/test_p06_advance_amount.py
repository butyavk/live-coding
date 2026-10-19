from decimal import Decimal as D
import pytest
from conftest import load


def f(*args):
    return load("p06_advance_amount").compute_advance(*map(D, args))


def test_example_and_each_limit_wins():
    assert f("1000", "0.05", "5000", "100000") == (D("665.00"), D("19.95"))
    assert f("1000", "0", "500", "100000") == (D("500.00"), D("15.00"))
    assert f("1000", "0", "5000", "123.45") == (D("123.45"), D("3.70"))


def test_rounding_down_amount_half_up_fee():
    amount, fee = f("33.33", "0.1", "1000", "1000")      # 0.7 * 33.33 * 0.9 = 20.99790
    assert amount == D("20.99")                            # down, never 21.00
    assert fee == D("0.63")                                # 0.6297 -> 0.63
    assert f("1000", "0", "1.50", "100") == (D("1.50"), D("0.05"))     # fee 0.045: an exact half goes up


def test_types_are_decimal():
    amount, fee = f("100", "0", "100", "100")
    assert isinstance(amount, D) and isinstance(fee, D)


def test_small_amounts_are_zero():
    assert f("1.20", "0", "100", "100") == (D("0.00"), D("0.00"))      # 0.84 < 1.00
    assert f("1000", "0", "0.99", "100") == (D("0.00"), D("0.00"))


@pytest.mark.parametrize("args", [("-1", "0", "1", "1"), ("1", "1.5", "1", "1"), ("1", "-0.1", "1", "1"),
                                  ("1", "0", "-1", "1"), ("1", "0", "1", "-1")])
def test_invalid(args):
    with pytest.raises(ValueError):
        f(*args)
