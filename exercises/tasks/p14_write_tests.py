"""P14. Write the tests for a payout split            Level: medium.  Target time: 15 min.

Some South Market bundles hold products of several merchants. The marketplace pays the bundle as one
payout, and we split it between the merchants by their agreed shares. split_payout below is written
and correct. Your task is the other half: write the tests for it, the ones you would want to have
before anybody changes this function.

    split_payout(Decimal("10.00"), {"mer_03": 1, "mer_07": 2})
    -> [("mer_03", Decimal("3.33")), ("mer_07", Decimal("6.67"))]

Write pytest test functions below the YOUR TESTS line, at the bottom of this file:
- name them test_..., give them no arguments (@pytest.mark.parametrize is fine), and call split_payout
  by its name;
- use plain assert and pytest.raises;
- write at least 3.

How Check grades your tests:
1. They must all pass on split_payout as it is.
2. Then Check plants 6 different bugs into split_payout, one at a time, and runs your tests again. Each
   bug must make at least one of your tests fail. A bug that survives is named by its area only, for
   example "a bug in how each part is rounded".

ASK FIRST: Can I change split_payout?  A: No. It is correct: only add tests. If you think you see a bug,
               say it out loud.
           May I read the code, or only the docstring?  A: Read both. But test what the docstring
               promises, not how this code happens to do it: the code may be rewritten.
           Exact amounts, or properties like "the parts add up"?  A: Both. Exact amounts for a few small
               cases you can work out by hand, and the sum for more cases.
           How many tests do you expect?  A: Not many: each test should catch something the others miss.

HOW TO PRACTISE: replace test_first with your tests and run `uv run pytest -k p14`. To run only your own tests:
`uv run pytest tasks/p14_write_tests.py`.
"""
from decimal import Decimal

import pytest

CENT = Decimal("0.01")


def split_payout(amount, shares):
    """Split a payout between merchants by their shares.

    amount: a Decimal, zero or more, in whole cents.
    shares: {merchant_id: weight}; weights are whole numbers, zero or more, and at least one is above zero.
            A merchant's exact part is amount * weight / (sum of the weights).
    Returns a list of (merchant_id, Decimal) pairs, in the order of `shares`. The parts are whole cents and
    add up to `amount` exactly:
      1. every merchant first gets its exact part rounded DOWN to the cent;
      2. the cents that are left go one each to the merchants with the largest remainder (the part that was
         rounded away); on equal remainders, to the merchant that comes first in `shares`.
    Raises ValueError for a negative amount, an amount with a fraction of a cent, a negative weight, or
    weights that add up to zero (an empty `shares` included).
    """
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


def test_first():
    raise NotImplementedError("your code")
