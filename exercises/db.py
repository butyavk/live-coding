"""Practice database: data/csv loaded into an in-memory DuckDB (PostgreSQL-like SQL).

    uv run db.py tasks/sql/q01.sql             # run every query in the file and print each result
    uv run db.py tasks/sql/q01.sql --line 25   # run only the query on line 25
    uv run db.py scratch.sql --watch           # re-run the file every time you save it (Ctrl+C to stop)
    uv run db.py                               # interactive: end a query with ;  \\d = tables, \\d name = columns, \\q = exit

VS Code / Cursor (.vscode/tasks.json): Cmd+Shift+B runs the open .sql file.
Every run starts from a fresh copy of the data, so CREATE TEMP TABLE and friends are safe.
"""
import argparse
import datetime
import os
import re
import shutil
import sys
import time
from decimal import Decimal
from pathlib import Path

import duckdb

ROOT = Path(__file__).parent
CSV = ROOT / "data" / "csv"

SCHEMA = {
    "merchants": "id VARCHAR, name VARCHAR, country VARCHAR, advances_enrolled_at TIMESTAMP",
    "products": "id VARCHAR, merchant_id VARCHAR, name VARCHAR",
    "transactions": """transaction_id VARCHAR, original_transaction_id VARCHAR, customer_id VARCHAR,
        product_id VARCHAR, plan_id VARCHAR, plan_period VARCHAR, channel VARCHAR, is_trial BOOLEAN,
        is_trial_conversion BOOLEAN, renewal_number INTEGER, start_time TIMESTAMP, end_time TIMESTAMP,
        charged_usd DECIMAL(12,2), revenue_usd DECIMAL(12,2), fee_rate DECIMAL(5,4),
        refunded_at TIMESTAMP, is_test BOOLEAN, country VARCHAR""",
    "webhook_events": """event_id VARCHAR, type VARCHAR, customer_id VARCHAR, product_id VARCHAR,
        transaction_id VARCHAR, occurred_at TIMESTAMP, received_at TIMESTAMP""",
    "channel_payouts": """payout_id VARCHAR, merchant_id VARCHAR, channel VARCHAR, period_month DATE,
        amount_usd DECIMAL(12,2), paid_at TIMESTAMP""",
    "advances": """advance_id VARCHAR, merchant_id VARCHAR, channel VARCHAR, period_month DATE,
        amount_usd DECIMAL(12,2), fee_usd DECIMAL(12,2), idempotency_key VARCHAR, created_at TIMESTAMP""",
    "ledger_entries": """entry_id VARCHAR, merchant_id VARCHAR, advance_id VARCHAR, entry_type VARCHAR,
        amount_usd DECIMAL(12,2), created_at TIMESTAMP""",
}


def connect():
    con = duckdb.connect()
    con.execute("SET TimeZone = 'UTC'")
    con.execute("SET integer_division = true")  # 7 / 2 = 3, as in PostgreSQL (DuckDB would give 3.5)
    # DuckDB bug (every version from 0.10.3 to 1.5.6): a correlated
    # EXISTS (… WHERE b.k = a.k AND b.id <> a.id AND b.ts < a.ts) returns no rows while filter
    # pushdown is on. The data is small, so turning that optimizer off costs nothing.
    con.execute("SET disabled_optimizers = 'filter_pushdown'")
    for table, cols in SCHEMA.items():
        con.execute(f"CREATE TABLE {table} ({cols})")
        con.execute(f"COPY {table} FROM '{CSV / (table + '.csv')}' (HEADER, NULLSTR '')")
    return con


def run_sql(con, sql):
    """Used by the tests: (rows, column names)."""
    return con.execute(sql).fetchall(), [d[0] for d in con.description]


# ---------------------------------------------------------------- colours

COLOR = sys.stdout.isatty() and not os.environ.get("NO_COLOR")


def paint(text, code):
    return f"\033[{code}m{text}\033[0m" if COLOR else text


def bold(t):
    return paint(t, "1")


def dim(t):
    return paint(t, "2")


def red(t):
    return paint(t, "31")


# ---------------------------------------------------------------- one file -> statements

def _skip_comment(text, i):
    """If a comment starts at i, return the index right after it; otherwise None."""
    if text.startswith("--", i):
        j = text.find("\n", i)
        return len(text) if j < 0 else j
    if text.startswith("/*", i):
        j = text.find("*/", i + 2)
        return len(text) if j < 0 else j + 2
    return None


def _line(text, i):
    return text.count("\n", 0, i) + 1


def split_statements(text):
    """Every statement that has real code: dicts with sql, start (line where the fragment begins),
    code (line of its first code character) and end (line of its ;). Lines are 1-based.
    A ; inside 'strings', "identifiers" or comments does not split."""
    cuts, start, i, n = [], 0, 0, len(text)
    while i < n:
        c = text[i]
        if c in "'\"":
            j = text.find(c, i + 1)
            i = n if j < 0 else j + 1
            continue
        after = _skip_comment(text, i)
        if after is not None:
            i = after
            continue
        if c == ";":
            cuts.append((start, i + 1))
            start = i + 1
        i += 1
    cuts.append((start, n))

    out = []
    for a, b in cuts:
        k = a
        while k < b:  # find the first code character of the fragment
            if text[k].isspace():
                k += 1
                continue
            after = _skip_comment(text, k)
            if after is None:
                break
            k = after
        if k >= b or text[k] == ";":
            continue  # only comments / blank lines
        end_char = b - 1
        while end_char > k and text[end_char].isspace():
            end_char -= 1
        out.append({"sql": text[a:b], "start": _line(text, a), "code": _line(text, k),
                    "end": _line(text, end_char), "first": text[k:].split("\n", 1)[0].strip()})
    return out


def pick(statements, line):
    """The statement under the cursor; on a blank or comment line, the nearest one (ties: the one above)."""
    for s in statements:
        if s["code"] <= line <= s["end"]:
            return s
    return min(statements, key=lambda s: (min(abs(line - s["code"]), abs(line - s["end"])), s["code"] > line))


# ---------------------------------------------------------------- printing

def fmt(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    s = str(v)
    return s if len(s) <= 40 else s[:39] + "…"


def is_number(v):
    return isinstance(v, (int, float, Decimal)) and not isinstance(v, bool)


def print_table(rows, cols, limit):
    shown = rows if not limit else rows[:limit]
    cells = [[fmt(v) for v in r] for r in shown]
    widths = [max([len(h)] + [len(r[i]) for r in cells]) for i, h in enumerate(cols)]
    screen = shutil.get_terminal_size((10**6, 24)).columns
    too_wide = sum(widths) + 3 * len(widths) > screen

    if too_wide and len(shown) <= 10:  # one block per row, like psql \x
        name_w = max(len(h) for h in cols)
        for n, (raw, r) in enumerate(zip(shown, cells), 1):
            print(dim(f"-[ row {n} ]" + "-" * 40))
            for h, v, x in zip(cols, r, raw):
                print(f"{bold(h.ljust(name_w))} | {dim(v) if x is None else v}")
        return len(shown)

    right = [any(r[i] is not None for r in shown) and all(is_number(r[i]) for r in shown if r[i] is not None)
             for i in range(len(cols))]

    def line(parts):
        return " " + " | ".join(parts)

    def cut(text):
        return text if not too_wide or len(text) <= screen else text[: screen - 1] + "…"

    if too_wide:
        print(dim(f"(wider than the terminal: lines are cut at {screen} characters — select fewer columns)"))
    print(bold(cut(line(h.ljust(w) for h, w in zip(cols, widths)))))
    print(cut("-" + "-+-".join("-" * w for w in widths) + "-"))
    for raw, r in zip(shown, cells):
        parts = [v.rjust(w) if right[i] else v.ljust(w) for i, (v, w) in enumerate(zip(r, widths))]
        if too_wide:
            print(cut(line(parts)))
        else:
            print(line(dim(x) if raw[i] is None else x for i, x in enumerate(parts)))
    return len(shown)


def execute(con, stmt, limit):
    t0 = time.perf_counter()
    try:
        cur = con.execute(stmt["sql"])
        rows = cur.fetchall() if cur.description else []
    except duckdb.Error as e:
        msg = str(e)
        print(red("ERROR: ") + msg)
        m = re.search(r"LINE (\d+):", msg)
        if m:
            print(red(f"  -> line {stmt['start'] + int(m.group(1)) - 1} of the file"))
        return False
    ms = (time.perf_counter() - t0) * 1000
    if not cur.description:
        print(f"OK ({ms:.0f} ms)")
        return True
    cols = [d[0] for d in cur.description]
    shown = print_table(rows, cols, limit)
    word = "row" if len(rows) == 1 else "rows"
    if shown < len(rows):
        print(dim(f"(showing {shown} of {len(rows)} {word} · {ms:.0f} ms · --rows 0 shows all)"))
    else:
        print(dim(f"({len(rows)} {word} · {ms:.0f} ms)"))
    return True


def run_text(text, line=None, limit=50, con=None):
    statements = split_statements(text)
    if not statements:
        print("No query in the file yet: write it below the comments and run again.")
        return True
    if line is not None:
        statements = [pick(statements, line)]
    con = con or connect()
    ok = True
    for s in statements:
        if len(statements) > 1 or line is not None:
            head = s["first"] if len(s["first"]) <= 60 else s["first"][:59] + "…"
            print(bold(f"── line {s['code']}: ") + head)
        ok = execute(con, s, limit) and ok
        if len(statements) > 1:
            print()
    return ok


def watch(path, limit):
    last = object()
    print(f"Watching {path.name}: save the file to run it. Ctrl+C to stop.")
    try:
        while True:
            try:
                stamp = path.stat().st_mtime_ns
            except FileNotFoundError:
                stamp = None
            if stamp != last:
                last = stamp
                print("\033[2J\033[H", end="")
                print(dim(f"{path.name} · {time.strftime('%H:%M:%S')} · Ctrl+C to stop"))
                if stamp is not None:
                    run_text(path.read_text(), limit=limit)
            time.sleep(0.3)
    except KeyboardInterrupt:
        print()


# ---------------------------------------------------------------- interactive

def describe(con, arg):
    if not arg:
        for t in SCHEMA:
            n = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
            print(f"  {t:<15} {n:>6} rows")
        return
    try:
        rows = con.execute(f"DESCRIBE {arg}").fetchall()
    except duckdb.Error as e:
        print(red("ERROR: ") + str(e))
        return
    for r in rows:
        print(f"  {r[0]:<30} {r[1]}")


def interactive(limit):
    try:
        import readline  # noqa: F401  (arrow keys and history)
    except ImportError:
        pass
    con = connect()
    print("Tables:", ", ".join(SCHEMA), "  (\\d = tables, \\d name = columns, \\q = exit)")
    buf = []
    while True:
        try:
            line = input("sql> " if not buf else "...> ")
        except (EOFError, KeyboardInterrupt):
            print()
            break
        cmd = line.strip()
        if not buf and cmd == "\\q":
            break
        if not buf and cmd.startswith("\\d"):
            describe(con, cmd[2:].strip())
            continue
        buf.append(line)
        if line.rstrip().endswith(";"):
            run_text("\n".join(buf), limit=limit, con=con)
            buf = []


def main():
    p = argparse.ArgumentParser(description="Run SQL against the practice data (DuckDB, PostgreSQL syntax).")
    p.add_argument("file", nargs="?", help=".sql file to run; without it: interactive mode")
    p.add_argument("--line", type=int, help="run only the query on this line (VS Code passes the cursor line)")
    p.add_argument("--watch", action="store_true", help="re-run the file on every save")
    p.add_argument("--rows", type=int, default=50, help="rows to print (default 50, 0 = all)")
    a = p.parse_args()

    if not a.file:
        interactive(a.rows)
        return 0
    path = Path(a.file)
    if path.suffix != ".sql":
        print(f"{path.name} is not a .sql file. Open a .sql file in the editor and run again.")
        return 2
    if a.watch:
        watch(path, a.rows)
        return 0
    return 0 if run_text(path.read_text(), line=a.line, limit=a.rows) else 1


if __name__ == "__main__":
    sys.exit(main())
