import io
from datetime import date
from decimal import Decimal as D
import pytest
from conftest import load
from tasks.p12_payout_file import ImportFailed, Payout

BOM = "\ufeff"
# Line numbers on the right. The file comes as an open text file (io.StringIO): one pass, no indexing.
FILE = BOM + "\n".join([
    "Payout ID; Merchant ID ;Paid On;Note;AMOUNT",     # 1  header: BOM, case, spaces
    "spo_1001;mer_03;2026-09-14;;1234,50",             # 2
    "spo_1002;mer_07;2026-09-14;Aug fix;87,10",        # 3
    "",                                                # 4  blank
    "spo_1003;;2026-09-14;;10,00",                     # 5  missing_merchant
    "spo_1004;mer_02;2026-09-14;clawback;-5,00",       # 6  negative_amount
    "spo_1005;mer_02;2026-09-31;;12,00",               # 7  bad_date: September has 30 days
    "spo_1001;mer_03;2026-09-14;;1234,50",             # 8  duplicate of line 2
    "spo_1006;mer_05;2026-09-15;;0,00",                # 9  zero is allowed
    "spo_1007;mer_11;2026-09-15;; 12.50",              # 10 bad_amount: a dot
    "spo_1003;mer_04;2026-09-15;resent;10,00",         # 11 good: the first spo_1003 was bad
    "spo_1008;mer_06;2026-09-15",                      # 12 bad_row: 3 fields
    "   ",                                             # 13 blank
    "TOTAL;;;;1331,60",                                # 14 = 1234.50 + 87.10 + 0.00 + 10.00
]) + "\n"

GOOD = [
    Payout("spo_1001", "mer_03", date(2026, 9, 14), D("1234.50")),
    Payout("spo_1002", "mer_07", date(2026, 9, 14), D("87.10")),
    Payout("spo_1006", "mer_05", date(2026, 9, 15), D("0.00")),
    Payout("spo_1003", "mer_04", date(2026, 9, 15), D("10.00")),
]
BAD = [(5, "missing_merchant"), (6, "negative_amount"), (7, "bad_date"), (8, "duplicate"), (10, "bad_amount"), (12, "bad_row")]


def run(text):
    return load("p12_payout_file").import_payouts(io.StringIO(text))


def test_good_rows_are_typed_and_in_file_order():
    records, _ = run(FILE)
    assert records == GOOD
    assert all(type(r.amount) is D and type(r.paid_on) is date for r in records)   # not float, not str, not datetime


def test_bad_rows_are_reported_with_file_line_numbers():
    _, errors = run(FILE)
    assert errors == BAD                         # the header is line 1, blank lines count


def test_a_bad_row_does_not_block_its_corrected_copy():
    records, errors = run("payout_id;merchant_id;paid_on;amount\n"
                          "spo_1;;2026-09-14;5,00\n"
                          "spo_1;mer_01;2026-09-14;5,00\n"
                          "TOTAL;;;5,00\n")
    assert errors == [(2, "missing_merchant")]
    assert records == [Payout("spo_1", "mer_01", date(2026, 9, 14), D("5.00"))]


def test_columns_are_found_by_name():
    records, errors = run(BOM + " PAYOUT_ID ;Currency;amount;paid on;Merchant Id\n"
                          "spo_2001;USD;12,00;2026-09-15;mer_09\n"
                          "TOTAL;;12,00;;\n")
    assert errors == []
    assert records == [Payout("spo_2001", "mer_09", date(2026, 9, 15), D("12.00"))]


@pytest.mark.parametrize("text, code", [("12.50", "bad_amount"), ("1 234,50", "bad_amount"), ("1.234,50", "bad_amount"),
                                        ("", "bad_amount"), ("ten", "bad_amount"), ("-0,01", "negative_amount")])
def test_amounts_that_are_not_imported(text, code):
    records, errors = run(f"payout_id;merchant_id;paid_on;amount\nspo_1;mer_01;2026-09-14;{text}\nTOTAL;;;0,00\n")
    assert (records, errors) == ([], [(2, code)])


def test_the_total_must_match_the_good_rows():
    with pytest.raises(ImportFailed):
        run(FILE.replace("TOTAL;;;;1331,60", "TOTAL;;;;1331,61"))      # one cent off
    with pytest.raises(ImportFailed):
        run(FILE.replace("TOTAL;;;;1331,60", "TOTAL;;;;2566,10"))      # the duplicate counted twice


@pytest.mark.parametrize("text", [
    "",                                                                      # no header
    "payout_id;merchant_id;paid_on;amount\nspo_1;mer_01;2026-09-14;5,00\n",  # cut off: no totals line
    "payout_id;merchant;paid_on;amount\nspo_1;mer_01;2026-09-14;5,00\nTOTAL;;;5,00\n",   # no merchant_id column
    "payout_id;merchant_id;paid_on;amount\nTOTAL;;;5,00\nspo_1;mer_01;2026-09-14;5,00\n",  # a row after the total
])
def test_a_broken_file_is_not_imported(text):
    with pytest.raises(ImportFailed):
        run(text)


def test_reads_a_one_pass_stream_with_crlf():
    def stream():                                # a generator: it can be read only once, and has no len()
        for line in FILE.splitlines():
            yield line + "\r\n"
    records, errors = load("p12_payout_file").import_payouts(stream())
    assert records == GOOD and errors == BAD
