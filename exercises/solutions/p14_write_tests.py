from decimal import Decimal

import pytest

CENT = Decimal("0.01")


def split_payout(amount, shares):
    """The function from the task, unchanged (see the task file for its docstring)."""
    if amount < 0 or amount != amount.quantize(CENT):
        raise ValueError(f"amount must be zero or more, in whole cents: {amount}")
    if any(weight < 0 for weight in shares.values()):
        raise ValueError("weights must be zero or more")
    total = sum(shares.values())
    if total == 0:
        raise ValueError("at least one weight must be above zero")
    cents = int(amount * 100)
    parts, remainders = {}, {}
    for merchant, weight in shares.items():
        parts[merchant], remainders[merchant] = divmod(cents * weight, total)
    left = cents - sum(parts.values())
    # sorted() is stable: on equal remainders the merchants keep the order of `shares`
    for merchant in sorted(shares, key=lambda m: -remainders[m])[:left]:
        parts[merchant] += 1
    return [(merchant, Decimal(parts[merchant]).scaleb(-2)) for merchant in shares]


# ---------------------------------------------------------------- YOUR TESTS below this line
# Each test is worked out by hand, and its ids are NOT in alphabetical order, so "first in shares"
# and "first by id" give different answers.
D = Decimal


def test_three_equal_shares_give_the_spare_cent_to_the_first():
    # 100.00 / 3 = 33.333…: three parts of 33.33 lose a cent; the first merchant gets it
    assert split_payout(D("100.00"), {"mer_09": 1, "mer_02": 1, "mer_05": 1}) == [
        ("mer_09", D("33.34")), ("mer_02", D("33.33")), ("mer_05", D("33.33"))]


def test_the_spare_cent_goes_to_the_largest_remainder_not_to_the_first():
    # 10.00 by 1:2 -> 3.333… and 6.666…: rounded down 3.33 + 6.66, and the larger remainder is mer_07's
    assert split_payout(D("10.00"), {"mer_03": 1, "mer_07": 2}) == [("mer_03", D("3.33")), ("mer_07", D("6.67"))]


def test_equal_remainders_follow_the_order_of_shares_and_so_does_the_result():
    assert split_payout(D("0.01"), {"mer_08": 1, "mer_01": 1}) == [("mer_08", D("0.01")), ("mer_01", D("0.00"))]


def test_zero_amount_and_zero_weight_are_valid():
    assert split_payout(D("0.00"), {"mer_04": 1, "mer_02": 3}) == [("mer_04", D("0.00")), ("mer_02", D("0.00"))]
    assert split_payout(D("5.00"), {"mer_04": 0, "mer_02": 3}) == [("mer_04", D("0.00")), ("mer_02", D("5.00"))]


@pytest.mark.parametrize("amount, shares", [
    (D("100.00"), {"a": 1, "b": 1, "c": 1}),
    (D("0.05"), {"a": 1, "b": 1, "c": 1, "d": 1, "e": 1, "f": 1, "g": 1}),
    (D("1234.57"), {"a": 7000, "b": 2000, "c": 1000}),
    (D("19.99"), {"a": 3, "b": 3, "c": 1}),
])
def test_parts_add_up_and_stay_within_a_cent_of_the_exact_share(amount, shares):
    parts = split_payout(amount, shares)
    assert sum(part for _, part in parts) == amount
    total = sum(shares.values())
    for merchant, part in parts:
        assert abs(part - amount * shares[merchant] / total) < CENT


@pytest.mark.parametrize("amount, shares", [
    (D("-1.00"), {"a": 1}),                 # negative amount
    (D("10.005"), {"a": 1}),                # a fraction of a cent
    (D("10.00"), {"a": 2, "b": -1}),        # a negative weight, although the sum is positive
    (D("10.00"), {"a": 0, "b": 0}),         # the weights add up to zero
    (D("10.00"), {}),                       # no shares at all
])
def test_bad_input_raises_value_error(amount, shares):
    with pytest.raises(ValueError):
        split_payout(amount, shares)
