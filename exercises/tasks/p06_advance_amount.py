"""P06. How much can we advance?                    Level: easy.  Target time: 15 min.

The platform pays merchants part of their future marketplace payout today. Write

    compute_advance(expected_proceeds, refund_rate, merchant_limit, global_remaining) -> (amount, fee)

All inputs and outputs are Decimal (never float for money).

- amount = the SMALLEST of three numbers:
    1) 70% of expected_proceeds after the refund reserve: 0.70 * expected_proceeds * (1 - refund_rate)
    2) merchant_limit   (the risk limit for this merchant)
    3) global_remaining  (what is left of our total budget)
- Round amount DOWN to cents (we never advance more than allowed).
- If amount < 1.00 -> return (Decimal("0.00"), Decimal("0.00")): not worth a bank transfer.
- fee = 3% of amount, rounded HALF UP to cents.
- Negative inputs, or refund_rate outside [0, 1] -> ValueError.

Example: compute_advance(Decimal("1000"), Decimal("0.05"), Decimal("5000"), Decimal("100000"))
         -> (Decimal("665.00"), Decimal("19.95"))

ASK FIRST: How do I round the amount and the fee?  A: The amount down to cents, the fee half up to cents.
           What if the amount is very small?  A: Below 1.00 we pay nothing: (0.00, 0.00).
           Invalid input?  A: Negative numbers, or refund_rate outside [0, 1] -> ValueError.
"""
from decimal import Decimal


def compute_advance(expected_proceeds, refund_rate, merchant_limit, global_remaining):
    raise NotImplementedError("your code")
