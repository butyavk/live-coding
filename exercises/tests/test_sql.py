"""Checks the SQL tasks: your query in tasks/sql/<id>.sql against the reference in solutions/sql/<id>.sql.

    pytest -k q01            # your query for Q01 (skipped while the file has no query yet)
    SOLUTIONS=1 pytest       # the references themselves: they run and match the PostgreSQL results

Your query is the text after the line `-- your query below`. Column names do not matter; the
values, the number of columns and the number of rows do. Numbers are compared rounded to three
decimals, and a timestamp exactly at midnight counts as its date. Row order matters only when the
task header has an `ORDER BY:` line.
A debug task (d01) is skipped while its `START: delete this line` marker is still in the file.

As on the site, a query that matches on the practice data is then run on the edge-case data too
(src/runtime/edge.sql: a copy of the tables in the schema `edge` with a day without activity, a
quiet month, sales on the last day of a month, ties, an unexpected payout and so on) and has to
match the reference there as well; there the row order is not compared.

With SOLUTIONS=1 every reference also has to give the same result here (DuckDB) as on PostgreSQL,
which the site uses: src/data/generated/practice.json holds the PostgreSQL output (and the number
of rows on the edge-case data).
"""
import datetime
import json
import os
import re
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

import pytest

import db

ROOT = Path(__file__).resolve().parent.parent
USE_SOLUTIONS = os.environ.get("SOLUTIONS") == "1"
MARK = "-- your query below"
START = "START: delete this line to run the tests"
TASKS = sorted(p.stem for p in (ROOT / "tasks" / "sql").glob("*.sql"))
PRACTICE = ROOT.parent / "src" / "data" / "generated" / "practice.json"
EDGE_SQL = ROOT.parent / "src" / "runtime" / "edge.sql"
# Queries that change the database are not run on the edge-case data (as in build-exercises.mjs).
CHANGES_DB = re.compile(r"\b(CREATE|INSERT|UPDATE|DELETE|ALTER|DROP|EXPLAIN)\b", re.I)


def _has_code(sql):
    """True when the text has something besides comments and blank lines."""
    no_block = re.sub(r"/\*.*?\*/", "", sql, flags=re.S)
    return any(line.strip() and not line.strip().startswith("--") for line in no_block.splitlines())


def _ordered(task_text):
    return any(line.startswith("-- ORDER BY:") for line in task_text.splitlines())


def _cell(v):
    if v is None:
        return None
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float, Decimal)):
        # Half up, like the browser check (JavaScript's Math.round): 0.0755 -> 0.076, not 0.075.
        return float(Decimal(str(v)).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP))
    if isinstance(v, datetime.datetime):
        # A timestamp exactly at midnight counts as its date, as on the site (pg-setup.js normCell):
        # date_trunc('month', …) or a generate_series of timestamps matches a DATE column.
        if v.time() == datetime.time(0, 0):
            return v.strftime("%Y-%m-%d")
        return v.strftime("%Y-%m-%d %H:%M:%S")
    return str(v)


def _run(sql, edge=False):
    con = db.connect()
    try:
        if edge:
            con.execute(EDGE_SQL.read_text())
            con.execute("SET search_path = 'edge'")
        rows, cols = db.run_sql(con, sql)
    finally:
        con.close()
    return [[_cell(v) for v in r] for r in rows], cols


def _edge_info(task, solution):
    """The PostgreSQL fingerprint of the reference on the edge-case data, {} when unknown, or None
    when the task is not checked there."""
    if not EDGE_SQL.exists() or CHANGES_DB.search(re.sub(r"--[^\n]*", " ", solution)):
        return None
    if not PRACTICE.exists():
        return {}
    pg = json.loads(PRACTICE.read_text())["sqlTasks"].get(task)
    return pg["expected"].get("edge") if pg else {}


def _sort_key(row):
    # Numbers sort as numbers (53 and 53.0 are the same), everything else as text; NULL last.
    def key(v):
        if v is None:
            return (2, 0.0, "")
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            return (0, float(v), "")
        return (1, 0.0, str(v))
    return [key(v) for v in row]


def _same(g, w, tol):
    if tol and isinstance(g, float) and isinstance(w, (int, float)) and not isinstance(w, bool):
        return abs(g - w) <= tol
    return g == w


def _compare(got, want, ordered, tol=0.0):
    """None when equal, else a short explanation. `tol`: allowed difference between numbers."""
    if want and got and len(got[0]) != len(want[0]):
        return f"expected {len(want[0])} columns, got {len(got[0])}"
    if len(got) != len(want):
        return f"expected {len(want)} rows, got {len(got)}"
    if not ordered:
        got, want = sorted(got, key=_sort_key), sorted(want, key=_sort_key)
    for i, (g, w) in enumerate(zip(got, want)):
        if len(g) != len(w) or not all(_same(a, b, tol) for a, b in zip(g, w)):
            where = f"row {i + 1}" if ordered else f"row {i + 1} (after sorting both results)"
            return f"{where}: expected {w}, got {g}"
    return None


@pytest.mark.parametrize("task", TASKS)
def test_sql_task(task):
    task_text = (ROOT / "tasks" / "sql" / f"{task}.sql").read_text()
    solution = (ROOT / "solutions" / "sql" / f"{task}.sql").read_text()
    ordered = _ordered(task_text)
    want, _ = _run(solution)

    if USE_SOLUTIONS:
        assert want, f"{task}: the reference returns no rows"
        if PRACTICE.exists():
            pg = json.loads(PRACTICE.read_text())["sqlTasks"].get(task)
            if pg:
                pg_rows = pg["expected"]["rows"]
                # One cent of slack: DuckDB's AVG of a DECIMAL is a DOUBLE, so ROUND(AVG(x), 2)
                # can land on the other cent (8.325 -> 8.32 there, 8.33 in PostgreSQL).
                problem = _compare(want, pg_rows, ordered, tol=0.0101)
                assert problem is None, f"{task}: DuckDB and PostgreSQL disagree on the reference: {problem}"
        edge = _edge_info(task, solution)
        if edge is not None:
            edge_rows, _ = _run(solution, edge=True)
            assert edge_rows, f"{task}: the reference returns no rows on the edge-case data"
            if edge:
                assert (len(edge_rows), len(edge_rows[0])) == (edge["n"], edge["cols"]), (
                    f"{task}: on the edge-case data DuckDB gives {len(edge_rows)} rows x {len(edge_rows[0])} columns, "
                    f"PostgreSQL {edge['n']} x {edge['cols']}"
                )
        return

    if START in task_text:
        pytest.skip(f"{task}: delete the START line first")
    query = task_text.split(MARK, 1)[1] if MARK in task_text else ""
    if not _has_code(query):
        pytest.skip(f"{task}: no query yet")
    got, _ = _run(query)
    problem = _compare(got, want, ordered)
    assert problem is None, f"{task}: {problem}"

    if _edge_info(task, solution) is not None:
        edge_got, _ = _run(query, edge=True)
        edge_want, _ = _run(solution, edge=True)
        problem = _compare(edge_got, edge_want, ordered=False)
        assert problem is None, (
            f"{task}: matches on the practice data but not on the edge-case data: {problem}. "
            "Think about days with no activity, a month with no sales, the last day of a month, ties, "
            "refunds and periods that end exactly at the moment."
        )
