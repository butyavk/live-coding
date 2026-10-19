"""P12. Import a partner payout file             Level: medium.  Target time: 20 min.

South Market sends its monthly payout export as a text file. Turn it into clean records and a report
of the bad rows.

    records, errors = import_payouts(lines)

lines: any iterable of str, for example an open text file. Real exports are large: read the lines
once, one by one, and do not build a list of all of them. A line may end with LF or CRLF.

    Payout ID; Merchant ID ;Paid On;Note;AMOUNT        (the file may start with a BOM, U+FEFF)
    spo_1001;mer_03;2026-09-14;;1234,50
    spo_1002;mer_07;2026-09-14;Aug fix;87,10

    spo_1003;;2026-09-14;;10,00
    TOTAL;;;;1321,60

Here spo_1003 is a bad row (no merchant), and the total 1321,60 matches the two good rows.

- Line 1 is the header. Find the columns by name: payout_id, merchant_id, paid_on and amount, after
  you strip each name, lower-case it and replace spaces with "_". Ignore other columns.
- Fields are separated by ";". Strip spaces around every field. Skip blank lines.
- Amounts use a decimal comma: 1234,50 is Decimal("1234.50"). Dates are YYYY-MM-DD.
- The last non-blank line is the totals line: its first field is TOTAL, its amount is in the amount column.
- Every other line is one payout. A good row becomes Payout(payout_id, merchant_id, paid_on, amount),
  with a date and a Decimal. A bad row is not imported: add (line_number, code) to errors, with the
  first code that applies:
      bad_row           the wrong number of fields, or an empty payout_id
      missing_merchant  an empty merchant_id
      bad_amount        not a number written with a decimal comma
      negative_amount   below zero
      bad_date          not a real date
      duplicate         a payout_id that was already imported
- Return (records, errors), both in file order. Line numbers are those of the file.
- Raise ImportFailed and import nothing if there is no header, a required column is missing, there is
  no totals line, a row comes after the totals line, or the total does not match.

ASK FIRST: Does the total include the rows I reject?  A: No. The partner holds those rows back and counts
               each payout once, so the total must equal the sum of the rows you import.
           A payout id appears twice: which row wins?  A: The first row that was imported. A later row with
               that id is a duplicate, even an exact copy. If the first row was bad, a later good row is imported.
           Can an amount have a thousands separator, like 1.234,50?  A: Not in this export. A dot or a space
               inside an amount is bad_amount: do not guess what it means.
           Is a zero amount allowed?  A: Yes. Only an amount below zero is negative_amount.
           How do I count lines?  A: As an editor does: the header is line 1, and blank lines count.
           Should I check merchant ids against our merchants table?  A: Not here: only that the field is
               not empty. A later step checks them.
"""
from datetime import date
from decimal import Decimal
from typing import NamedTuple


class Payout(NamedTuple):
    payout_id: str
    merchant_id: str
    paid_on: date
    amount: Decimal


class ImportFailed(Exception):
    pass


def import_payouts(lines):
    raise NotImplementedError("your code")
