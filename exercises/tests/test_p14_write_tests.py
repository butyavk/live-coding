"""P14 grades YOUR tests: the test_* functions in tasks/p14_write_tests.py.

1. They must all pass on the correct split_payout.
2. Each planted bug below is put in place of split_payout, one at a time; at least one of your tests
   must then fail. The message names only the area of a bug that survives.
Runs the same under real pytest and under the site's small pytest stand-in (parametrize, raises).
"""
import inspect
import traceback
import types
from decimal import ROUND_HALF_UP, Decimal

import pytest
from conftest import load

TASK = "p14_write_tests"
CENT = Decimal("0.01")


# ---------------------------------------------------------------- the planted bugs
def planted(bug):
    """split_payout with one bug in it (bug=None: the correct function)."""
    def split_payout(amount, shares):
        if amount < 0 or amount != amount.quantize(CENT) or (bug == "zero" and amount == 0):
            raise ValueError("bad amount")
        if bug != "weights" and any(w < 0 for w in shares.values()):
            raise ValueError("weights must be zero or more")
        total = sum(shares.values())
        if total == 0:
            raise ValueError("at least one weight must be above zero")
        if bug == "rounding":                    # each part rounded on its own: the sum can miss a cent
            parts = {m: (amount * w / total).quantize(CENT, ROUND_HALF_UP) for m, w in shares.items()}
        else:
            cents = int(amount * 100)
            base, rest = {}, {}
            for m, w in shares.items():
                base[m], rest[m] = divmod(cents * w, total)
            if bug == "leftover":                # the spare cents go to the first merchants, as in an equal split
                order = list(shares)
            elif bug == "ties":                  # equal remainders broken by merchant id, not by position
                order = sorted(shares, key=lambda m: (-rest[m], m))
            else:
                order = sorted(shares, key=lambda m: -rest[m])
            for m in order[:cents - sum(base.values())]:
                base[m] += 1
            parts = {m: Decimal(c).scaleb(-2) for m, c in base.items()}
        result = list(parts.items())
        return sorted(result) if bug == "order" else result
    return split_payout


BUGS = {
    1: ("rounding", "A bug in how each part is rounded"),
    2: ("leftover", "A bug in which merchants get the cents that are left over"),
    3: ("ties", "A bug in how equal remainders are broken"),
    4: ("zero", "A bug at the edge of the valid amounts"),
    5: ("weights", "A bug in the checks of the input"),
    6: ("order", "A bug in the order of the result"),
}


# ---------------------------------------------------------------- collecting and running your tests
def cases(f):
    """[(label, kwargs)] for one test function: one case, or one per row of @pytest.mark.parametrize."""
    tables = []
    for mark in getattr(f, "pytestmark", []):                  # real pytest
        if getattr(mark, "name", "") == "parametrize":
            names = mark.kwargs.get("argnames", mark.args[0] if mark.args else "")
            values = mark.kwargs.get("argvalues", mark.args[1] if len(mark.args) > 1 else [])
            tables.append((names, values))
    tables += getattr(f, "_lc_params", [])                     # the site's pytest stand-in
    out = [("", {})]
    for names, values in tables:
        if isinstance(names, str):
            names = [n.strip() for n in names.split(",") if n.strip()]
        rows = []
        for label, kw in out:
            for i, v in enumerate(values):
                vals = tuple(v.values) if type(v).__name__ == "ParameterSet" else (tuple(v) if len(names) > 1 else (v,))
                rows.append((f"{label}[{i}]", {**kw, **dict(zip(names, vals))}))
        out = rows
    return out


def your_tests(mod):
    """[(name, function, kwargs)]: every test_* function defined in your file, every parametrize row."""
    found = []
    for name, f in list(vars(mod).items()):
        if name.startswith("test_") and isinstance(f, types.FunctionType) and f.__module__ == mod.__name__:
            for label, kw in cases(f):
                found.append((name + label, f, kw))
    return found


def why(e, f, mod):
    """One line: the error and the line of your test where it happened."""
    msg = (str(e).strip().splitlines() or [""])[0][:160]
    text = type(e).__name__ + (f": {msg}" if msg else "")
    where = [fs for fs in traceback.extract_tb(e.__traceback__) if fs.filename == mod.__file__ and fs.name == f.__name__]
    if where:
        text += f" (line {where[-1].lineno}: {(where[-1].line or '').strip()[:120]})"
    return text


def failures(mod, tests):
    """[(name, why)] for each of your tests that fails, with whatever split_payout is in place now."""
    out = []
    for name, f, kw in tests:
        missing = [p for p, spec in inspect.signature(f).parameters.items()
                   if p not in kw and spec.default is inspect.Parameter.empty and spec.kind not in (spec.VAR_POSITIONAL, spec.VAR_KEYWORD)]
        if missing:
            out.append((name, f"it takes {', '.join(missing)}: fixtures do not work here, use plain values or parametrize"))
            continue
        try:
            f(**kw)
        except KeyboardInterrupt:
            raise
        except BaseException as e:                             # pytest.raises fails with an exception outside Exception
            if type(e).__name__ != "Skipped":
                out.append((name, why(e, f, mod)))
    return out


def plant(mod, fake):
    """Puts `fake` in place of split_payout (and of any other name for it). Returns the undo function."""
    real = mod.split_payout
    names = [n for n, v in vars(mod).items() if v is real]
    fake.__name__ = fake.__qualname__ = "split_payout"
    fake.__doc__, fake.__module__ = real.__doc__, real.__module__
    for n in names:
        setattr(mod, n, fake)

    def undo():
        for n in names:
            setattr(mod, n, real)
    return undo


def ready(mod):
    """Your tests, after the two checks every bug test needs: there are tests, and they pass on the real thing."""
    tests = your_tests(mod)
    if not tests:
        pytest.fail("No tests yet: write test_* functions below the YOUR TESTS line.")
    if failures(mod, tests):
        pytest.fail("Fix your tests first: they must pass on the correct split_payout (see the test above).")
    return tests


# ---------------------------------------------------------------- the checks you see
def test_you_wrote_at_least_three_tests():
    n = len(your_tests(load(TASK)))
    if n < 3:
        pytest.fail(f"Found {n} test{'' if n == 1 else 's'} below the YOUR TESTS line. Write at least 3 test_* functions "
                    "that call split_payout (each parametrize row counts as one).")


def test_your_tests_pass_on_the_correct_function():
    mod = load(TASK)
    tests = your_tests(mod)
    if not tests:
        pytest.fail("No tests yet: write test_* functions below the YOUR TESTS line.")
    failed = failures(mod, tests)
    if failed:
        lines = [f"{name}: {reason}" for name, reason in failed[:4]] + ([f"… and {len(failed) - 4} more"] if len(failed) > 4 else [])
        which = "Your only test fails" if len(tests) == 1 else \
            f"{len(failed)} of your {len(tests)} tests {'fails' if len(failed) == 1 else 'fail'}"
        pytest.fail(f"{which} on the correct split_payout. The function is right, so fix the test: " + " | ".join(lines))


@pytest.mark.parametrize("bug", sorted(BUGS))
def test_your_tests_catch_planted_bug(bug):
    mod = load(TASK)
    tests = ready(mod)
    key, hint = BUGS[bug]
    undo = plant(mod, planted(key))
    try:
        caught = failures(mod, tests)
    finally:
        undo()
    if not caught:
        pytest.fail(f"{hint} survived: all your tests still pass with it. Which promise of the docstring does no test check yet?")
