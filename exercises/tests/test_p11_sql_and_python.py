from datetime import date, timedelta
import ast
import inspect
import re
from conftest import load
import db

CON = db.connect()


def brute(mer, first, last):
    days = {r[0] for r in CON.execute(
        "SELECT CAST(t.start_time AS DATE) FROM transactions t JOIN products p ON p.id = t.product_id "
        "WHERE p.merchant_id = ? AND NOT t.is_test AND t.revenue_usd > 0", [mer]).fetchall()}
    best, best_start, d = 0, None, first
    while d <= last:
        n = 0
        while d + timedelta(days=n) <= last and d + timedelta(days=n) in days:
            n += 1
        if n > best:
            best, best_start = n, d
        d += timedelta(days=1)
    return best, best_start


def test_matches_brute_force_for_every_merchant():
    f = load("p11_sql_and_python").longest_streak
    for i in range(1, 13):
        mer = f"mer_{i:02d}"
        assert f(CON, mer, date(2026, 9, 1), date(2026, 9, 29)) == brute(mer, date(2026, 9, 1), date(2026, 9, 29)), mer


def test_ties_and_window_edges():
    f = load("p11_sql_and_python").longest_streak
    # mer_01 sells on Sep 3-4, 11-12 and 17-18: three runs of 2 days -> the earliest one
    assert f(CON, "mer_01", date(2026, 9, 1), date(2026, 9, 19)) == (2, date(2026, 9, 3))
    # Sep 21, 22, 23: the run ends exactly on last_day, which is included
    assert f(CON, "mer_01", date(2026, 9, 1), date(2026, 9, 23)) == (3, date(2026, 9, 21))
    # mer_12 sells every day from Sep 8 to Sep 22: a run that started before first_day is cut at first_day
    assert f(CON, "mer_12", date(2026, 9, 10), date(2026, 9, 29)) == (13, date(2026, 9, 10))


def test_paid_sales_only_short_window_and_no_sales():
    f = load("p11_sql_and_python").longest_streak
    # mer_12 sells Sep 24-28; on Sep 29 it has only a test purchase, which does not count
    assert f(CON, "mer_12", date(2026, 9, 24), date(2026, 9, 29)) == (5, date(2026, 9, 24))
    assert f(CON, "mer_01", date(2026, 9, 2), date(2026, 9, 2)) == (0, None)     # only a free trial: revenue 0
    assert f(CON, "mer_01", date(2026, 9, 3), date(2026, 9, 3)) == (1, date(2026, 9, 3))
    assert f(CON, "mer_99", date(2026, 9, 1), date(2026, 9, 29)) == (0, None)


class Spy:
    """A connection that records every SQL text and its parameters, then runs them on the real one."""
    def __init__(self, con):
        self.con, self.calls = con, []

    def execute(self, sql, parameters=None):
        self.calls.append((sql, parameters))
        return self.con.execute(sql, parameters) if parameters is not None else self.con.execute(sql)

    def cursor(self):
        return self

    def __getattr__(self, name):
        return getattr(self.con, name)


def test_parameters_are_bound_not_pasted_into_sql():
    f = load("p11_sql_and_python").longest_streak
    spy = Spy(CON)
    first, last = date(2026, 9, 1), date(2026, 9, 29)
    assert f(spy, "mer_01", first, last) == brute("mer_01", first, last)
    assert spy.calls, "run the query with con.execute(sql, [param1, param2, ...])"
    pasted = [str(v) for v in ("mer_01", first, last, last + timedelta(days=1))
              if any(str(v) in sql for sql, _ in spy.calls)]
    assert pasted == [], "these values are inside the SQL text: pass them as ? parameters instead"


# Words that make a string look like SQL. Plain English words such as "from" are left out on purpose,
# so print(f"best run from {day}") is fine.
SQL_WORDS = re.compile(r"\b(select|where|join|group\s+by|order\s+by|merchant_id|start_time|revenue_usd|is_test)\b", re.I)


def _sql_built_by_formatting(tree):
    """Line numbers where an f-string, +, % or .format() builds a string that looks like SQL."""
    names = {}          # NAME = "..." anywhere in the file: the text of that string

    def text(node):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            return node.value
        if isinstance(node, ast.JoinedStr):
            return "".join(text(v) for v in node.values)
        if isinstance(node, ast.BinOp):
            return text(node.left) + " " + text(node.right)
        if isinstance(node, ast.Name):
            return names.get(node.id, "")
        return ""

    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            names[node.targets[0].id] = text(node.value)

    lines = []
    for node in ast.walk(tree):
        if isinstance(node, ast.JoinedStr) and any(isinstance(v, ast.FormattedValue) for v in node.values):
            built = text(node)
        elif isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Mod)):
            built = text(node)
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "format":
            built = text(node.func.value) or "select"     # .format() on something we cannot read: treat it as SQL
        else:
            continue
        if SQL_WORDS.search(built):
            lines.append(node.lineno)
    return sorted(set(lines))


def test_no_string_formatting_in_sql():
    tree = ast.parse(inspect.getsource(load("p11_sql_and_python")))
    lines = _sql_built_by_formatting(tree)
    assert lines == [], f"the SQL is built with an f-string, +, % or .format() on line(s) {lines}: use ? placeholders"
