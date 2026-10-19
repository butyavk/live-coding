import re
from datetime import date, datetime
from decimal import Decimal
from typing import NamedTuple

from tasks.p12_payout_file import ImportFailed, Payout   # same classes as the task and tests

REQUIRED = ("payout_id", "merchant_id", "paid_on", "amount")
AMOUNT = re.compile(r"-?\d+(,\d{1,2})?")        # 1234,50 — no dot, no space, no thousands separator


def parse_amount(text):
    """'1234,50' -> Decimal('1234.50'); None when it is not a number with a decimal comma."""
    return Decimal(text.replace(",", ".")) if AMOUNT.fullmatch(text) else None


def parse_date(text):
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError:
        return None


def check_row(fields, width, col, imported):
    """(code, None) for a bad row, (None, Payout) for a good one. The first code that applies wins."""
    if len(fields) != width or not fields[col["payout_id"]]:
        return "bad_row", None
    payout_id, merchant_id = fields[col["payout_id"]], fields[col["merchant_id"]]
    if not merchant_id:
        return "missing_merchant", None
    amount = parse_amount(fields[col["amount"]])
    if amount is None:
        return "bad_amount", None
    if amount < 0:                               # zero is a valid payout
        return "negative_amount", None
    paid_on = parse_date(fields[col["paid_on"]])
    if paid_on is None:
        return "bad_date", None
    if payout_id in imported:                    # only ids of rows that were imported
        return "duplicate", None
    return None, Payout(payout_id, merchant_id, paid_on, amount)


def import_payouts(lines):
    rows = iter(lines)                           # one pass: works for a file of any size
    first = next(rows, None)
    if first is None:
        raise ImportFailed("empty file: no header")
    names = ["_".join(n.strip().lower().split()) for n in first.lstrip("\ufeff").split(";")]
    missing = [c for c in REQUIRED if c not in names]
    if missing:
        raise ImportFailed(f"missing columns: {', '.join(missing)}")
    col = {c: names.index(c) for c in REQUIRED}

    records, errors, imported = [], [], set()
    total = None
    for number, line in enumerate(rows, start=2):   # the header is line 1; blank lines keep their number
        if not line.strip():
            continue
        if total is not None:
            raise ImportFailed(f"line {number}: a row after the totals line")
        fields = [f.strip() for f in line.split(";")]
        if fields[0].upper() == "TOTAL":
            total = parse_amount(fields[col["amount"]]) if len(fields) == len(names) else None
            if total is None:
                raise ImportFailed(f"line {number}: the totals line has no readable amount")
            continue
        code, payout = check_row(fields, len(names), col, imported)
        if code:
            errors.append((number, code))
        else:
            imported.add(payout.payout_id)       # mark only after the row is known to be good
            records.append(payout)

    if total is None:
        raise ImportFailed("no totals line: the file may be cut off")
    good = sum((r.amount for r in records), Decimal("0"))
    if good != total:
        raise ImportFailed(f"the totals line says {total}, the good rows add up to {good}")
    return records, errors
