"""P07. Match payments to invoices                  Level: hard.             Target time: 25 min.

    reconcile(invoices, payments) -> {"matches": [(invoice_id, payment_id), ...],
                                      "unmatched_invoices": [...], "unmatched_payments": [...]}

invoice: {"id": "inv_1", "counterparty": "acme", "amount": Decimal("100.00"), "due": date(2026, 9, 10)}
payment: {"id": "pay_1", "counterparty": "acme", "amount": Decimal("100.00"), "date": date(2026, 9, 11),
          "reference": "inv_1" or None}

Rules, in this order. Both rules take the payments in payment order: by date, then by id.
1. Reference: if payment["reference"] equals an unmatched invoice id, match them (the amount may differ:
   partial payments are handled elsewhere). References are applied in payment order, so when two
   payments refer to the same invoice, the earlier payment gets it.
2. Heuristic: for each payment still unmatched, in payment order, find unmatched invoices with the
   same counterparty, the same amount, and |payment date - due date| <= 3 days.
   Pick the one with the smallest date difference; tie -> smallest invoice id.
- Every invoice and every payment is used at most once.
- All three lists are sorted (matches by invoice id).

ASK FIRST: Can a reference point to an invoice of another counterparty?  A: Yes, trust the reference.
           What if the reference points to an invoice that is already matched?  A: Treat the payment as having no reference.
                                                       References are applied in payment order (date, then id).
           What if a payment has no reference?  A: Same counterparty, same amount, at most 3 days from the due date; the closest date wins, then the smallest invoice id.
"""


def reconcile(invoices, payments):
    raise NotImplementedError("your code")
