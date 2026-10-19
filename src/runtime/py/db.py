"""Browser version of db.py: the same practice database as the SQL tab (PostgreSQL), DuckDB-style API.

    con = db.connect()
    rows = con.execute("SELECT id, name FROM products WHERE merchant_id = ?", ["mer_01"]).fetchall()

Placeholders are `?` like in DuckDB; they are sent to PostgreSQL as $1, $2, ... — never pasted into the SQL text.
Every execute runs in its own transaction that is rolled back, so changes to the data do not stay.
"""
import json
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

ROOT = Path("/home/pyodide/lc")


class Error(Exception):
    """A database error (bad SQL, wrong column, ...)."""


class DatabaseUnavailable(RuntimeError):
    """This browser cannot call the database from Python (no WebAssembly stack switching)."""


def _to_pg(sql):
    """Replace ? placeholders with $1, $2, ... outside quotes and comments. Returns (sql, count)."""
    out, n, i, L = [], 0, 0, len(sql)
    while i < L:
        c = sql[i]
        if c in ("'", '"'):
            j = i + 1
            while j < L:
                if sql[j] == c:
                    if j + 1 < L and sql[j + 1] == c:
                        j += 2
                        continue
                    break
                j += 1
            out.append(sql[i:j + 1]); i = j + 1
        elif sql.startswith("--", i):
            j = sql.find("\n", i)
            j = L if j < 0 else j
            out.append(sql[i:j]); i = j
        elif sql.startswith("/*", i):
            j = sql.find("*/", i + 2)
            j = L if j < 0 else j + 2
            out.append(sql[i:j]); i = j
        elif c == "?":
            n += 1
            out.append(f"${n}"); i += 1
        else:
            out.append(c); i += 1
    return "".join(out), n


def _param(v):
    if v is None or isinstance(v, (bool, int, float, str)):
        return v
    if isinstance(v, datetime):
        return v.isoformat(sep=" ")
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, Decimal):
        return str(v)
    if isinstance(v, timedelta):
        return f"{v.total_seconds()} seconds"
    raise TypeError(f"Parameter of type {type(v).__name__} is not supported: {v!r}")


def _value(v, type_id):
    if v is None:
        return None
    if type_id in (20, 21, 23, 26):
        return int(v)
    if type_id == 1700:
        return Decimal(str(v))
    if type_id in (700, 701):
        return float(v)
    if type_id == 16:
        return bool(v)
    if type_id == 1082:
        return date.fromisoformat(v)
    if type_id in (1114, 1184):
        return datetime.fromisoformat(v)
    return v


class Cursor:
    def __init__(self, fields, rows):
        self.description = [(f["name"], f["typeId"], None, None, None, None, None) for f in fields]
        types = [f["typeId"] for f in fields]
        self._rows = [tuple(_value(v, types[k]) for k, v in enumerate(r)) for r in rows]
        self._i = 0
        self.rowcount = len(self._rows)

    def fetchall(self):
        rows, self._i = self._rows[self._i:], len(self._rows)
        return rows

    def fetchone(self):
        if self._i >= len(self._rows):
            return None
        self._i += 1
        return self._rows[self._i - 1]

    def fetchmany(self, size=1):
        rows = self._rows[self._i:self._i + size]
        self._i += len(rows)
        return rows

    def __iter__(self):
        while (r := self.fetchone()) is not None:
            yield r


def _call(sql, params):
    from pyodide.ffi import run_sync, can_run_sync
    import js
    if not can_run_sync():
        raise DatabaseUnavailable(
            "This browser cannot call the database from Python (needs WebAssembly JSPI: "
            "Chrome or Edge 137+). The rest of Python works.")
    return json.loads(run_sync(js.lcSql(sql, json.dumps(params))))


class Connection:
    def execute(self, sql, parameters=None):
        if parameters is not None and not isinstance(parameters, (list, tuple)):
            raise TypeError("parameters must be a list or a tuple: con.execute(sql, [a, b])")
        pg_sql, n = _to_pg(sql)
        params = [_param(p) for p in (parameters or [])]
        if n != len(params):
            raise Error(f"The query has {n} ? placeholder(s), but {len(params)} parameter(s) were passed")
        res = _call(pg_sql, params)
        if res.get("error"):
            e = res["error"]
            msg = e.get("message") or "error"
            if e.get("hint"):
                msg += "\nHINT: " + e["hint"]
            raise Error(msg)
        return Cursor(res["fields"], res["rows"])

    def cursor(self):
        return self

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def connect(*args, **kwargs):
    return Connection()
