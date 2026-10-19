from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP

CENT = Decimal("0.01")
ADVANCE_SHARE = Decimal("0.70")
FEE_RATE = Decimal("0.03")
MIN_ADVANCE = Decimal("1.00")


def compute_advance(expected_proceeds, refund_rate, merchant_limit, global_remaining):
    if min(expected_proceeds, merchant_limit, global_remaining) < 0:
        raise ValueError("amounts must not be negative")
    if not Decimal(0) <= refund_rate <= Decimal(1):
        raise ValueError("refund_rate must be between 0 and 1")
    by_proceeds = ADVANCE_SHARE * expected_proceeds * (1 - refund_rate)
    amount = min(by_proceeds, merchant_limit, global_remaining).quantize(CENT, rounding=ROUND_DOWN)
    if amount < MIN_ADVANCE:
        return Decimal("0.00"), Decimal("0.00")
    fee = (amount * FEE_RATE).quantize(CENT, rounding=ROUND_HALF_UP)
    return amount, fee
