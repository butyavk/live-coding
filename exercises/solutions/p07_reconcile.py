from collections import defaultdict

WINDOW_DAYS = 3


def reconcile(invoices, payments):
    open_invoices = {inv["id"]: inv for inv in invoices}
    matches, unmatched_payments = [], []
    in_order = sorted(payments, key=lambda p: (p["date"], p["id"]))     # both rules use payment order

    # 1) exact references first, so heuristics cannot steal those invoices
    rest = []
    for p in in_order:
        ref = p.get("reference")
        if ref in open_invoices:
            matches.append((ref, p["id"]))
            del open_invoices[ref]
        else:
            rest.append(p)

    # 2) index open invoices by (counterparty, amount) to avoid scanning everything
    by_key = defaultdict(list)
    for inv in open_invoices.values():
        by_key[(inv["counterparty"], inv["amount"])].append(inv)

    for p in rest:                                   # still in payment order
        candidates = [inv for inv in by_key[(p["counterparty"], p["amount"])]
                      if inv["id"] in open_invoices and abs((p["date"] - inv["due"]).days) <= WINDOW_DAYS]
        if not candidates:
            unmatched_payments.append(p["id"])
            continue
        best = min(candidates, key=lambda inv: (abs((p["date"] - inv["due"]).days), inv["id"]))
        matches.append((best["id"], p["id"]))
        del open_invoices[best["id"]]

    return {"matches": sorted(matches),
            "unmatched_invoices": sorted(open_invoices),
            "unmatched_payments": sorted(unmatched_payments)}
