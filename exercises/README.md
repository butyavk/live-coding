# Practise offline

Everything you need to solve the interview tasks of [Live Coding Map](https://butyavk.github.io/live-coding/)
in your own editor, without a browser: the dataset, the task files, the tests and the reference
solutions. The site runs the same tasks on PostgreSQL and Python in the browser; here SQL runs on
DuckDB (PostgreSQL syntax) and Python on your own interpreter, with real pytest.

## What is here

| path | what |
| --- | --- |
| `data/csv/` | the practice dataset: merchants, products, transactions, webhooks, channel payouts, advances, ledger ([SCHEMA.md](SCHEMA.md)) |
| `tasks/sql/q01.sql` … `q15.sql` | SQL tasks: the task, the questions to ask first, the output columns; your query goes at the bottom |
| `tasks/sql/d01.sql` | a debug task: a broken report to fix |
| `tasks/p01_….py` … `p14_….py` | Python tasks: the statement in the docstring, a function or class to write |
| `tasks/d02_….py`, `d03_….py` | Python debug tasks: working code with bugs |
| `tests/` | pytest checks for every task |
| `solutions/` | reference solutions: open them after your tests pass |
| `db.py` | runs SQL files on the dataset, or an interactive SQL prompt |

## Set up

Install [uv](https://docs.astral.sh/uv/getting-started/installation/). It brings the Python
version from `.python-version` and the packages pinned in `uv.lock` (DuckDB and pytest), so
there is nothing else to install.

```bash
cd exercises
uv sync
```

`uv run` also syncs by itself, so `uv sync` is optional.

## SQL tasks

Write your query under `-- your query below` in `tasks/sql/q01.sql`, then:

```bash
uv run db.py tasks/sql/q01.sql             # run every query in the file and print the results
uv run db.py tasks/sql/q01.sql --line 25   # run only the query on line 25
uv run db.py tasks/sql/q01.sql --watch     # run the file again on every save
uv run db.py                               # interactive prompt: \d lists tables, \d name the columns, \q exits
uv run pytest -k q01                       # compare your result with the reference
```

Column names in your output do not need to match the reference: the check compares only the
values, the number of columns and the number of rows. Row order matters only when the task
header has an `ORDER BY:` line. Numbers are compared rounded to three decimals, and a timestamp
exactly at midnight counts as its date. As on the site, the check then runs your query on the
hidden edge-case data too (`../src/runtime/edge.sql`, present when this folder sits inside the
repository), and compares that result as a set of rows.

In VS Code or Cursor, open this folder and press Cmd+Shift+B (Ctrl+Shift+B): it runs the query
under the cursor (`.vscode/tasks.json`).

## Python tasks

Replace `raise NotImplementedError("your code")` in `tasks/p01_ttl_cache.py` with your code, then:

```bash
uv run pytest -k p01          # run the checks for P01
uv run pytest -k p01 -x -vv   # stop at the first failure and show the full comparison
```

A task is skipped while it still has `NotImplementedError("your code")`. P05, P10 and P11 also
read the dataset through `db.connect()`, as in an interview editor where the Python code talks
to the database of the SQL part.

## Debug tasks

D01 (SQL), D02 and D03 (Python) start with working code that gives wrong answers, and a bug
report. Delete the `START: delete this line to run the tests` line, run the tests, and fix one
bug at a time. Say each bug out loud before you fix it: "The bug is …, because …".

## How to practise

- Set a timer to the target time in the task header and talk out loud, as in the interview.
- Ask the questions under `ASK FIRST` before you write code, then read the answers.
- Run your code after every small step, not once at the end.
- The [interview protocol](https://butyavk.github.io/live-coding/start/interview-protocol/) on
  the site has the full routine, and every task has a walkthrough there.

## Check the references

```bash
SOLUTIONS=1 uv run pytest
```

This runs every reference solution through the same tests. For the SQL tasks it also checks
that DuckDB gives the same result as PostgreSQL (`src/data/generated/practice.json`, written by
`npm run exercises` in the repository root). CI runs it on every push.
