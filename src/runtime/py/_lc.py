"""Runner for the Python exercises: Run (exec the editor code) and Check (run the task's tests).

Tests run with pytest-style assertion messages: asserts in the test file are rewritten so a failure shows
both sides of the comparison, like pytest does.
"""
import ast
import copy
import importlib
import io
import json
import linecache
import os
import sys
import time
import traceback
import types
from contextlib import redirect_stderr, redirect_stdout

import pytest

ROOT = "/home/pyodide/lc"
MAX_REPR = 400


# ---------------------------------------------------------------- helpers
def _purge():
    for name in list(sys.modules):
        if (name in ("tasks", "conftest", "db", "solutions") or name.startswith(("tasks.", "solutions.", "test_"))):
            del sys.modules[name]
    importlib.invalidate_caches()
    linecache.clearcache()


def _write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def _rel(path):
    return path[len(ROOT) + 1:] if path and path.startswith(ROOT + "/") else path


def _frames(tb):
    out = []
    for fs in traceback.extract_tb(tb):
        fn = fs.filename or ""
        if not fn.startswith(ROOT + "/") or fn.startswith(ROOT + "/_lc/"):
            continue
        out.append({"file": _rel(fn), "line": fs.lineno, "name": fs.name, "code": (fs.line or "").strip()})
    return out


def _exc(e):
    if isinstance(e, SyntaxError) and not isinstance(e, (ImportError,)):
        frames = [{"file": _rel(e.filename or ""), "line": e.lineno, "name": "<module>", "code": (e.text or "").strip()}] \
            if e.filename else []
        msg = f"{type(e).__name__}: {e.msg}"
    else:
        frames = _frames(e.__traceback__)
        msg = "".join(traceback.format_exception_only(type(e), e)).strip()
    text = ""
    if frames:
        text = "Traceback (most recent call last):\n" + "".join(
            f'  File "{f["file"]}", line {f["line"]}, in {f["name"]}\n' + (f"    {f['code']}\n" if f["code"] else "")
            for f in frames)
    cause = e.__cause__ or (None if e.__suppress_context__ else e.__context__)
    if cause is not None and not isinstance(e, AssertionError):
        cmsg = "".join(traceback.format_exception_only(type(cause), cause)).strip()
        text = f"(caused by {cmsg})\n" + text
    return {"type": type(e).__name__, "message": msg, "frames": frames, "text": text + msg}


def _r(v):
    try:
        s = repr(v)
    except Exception as e:  # a broken __repr__ in user code
        s = f"<repr failed: {e!r}>"
    return s if len(s) <= MAX_REPR else s[:MAX_REPR] + f"… ({len(s)} chars)"


def _diff(left, right):
    lines = []
    if isinstance(left, dict) and isinstance(right, dict):
        miss = [k for k in right if k not in left]
        extra = [k for k in left if k not in right]
        diff = [k for k in left if k in right and left[k] != right[k]]
        if miss:
            lines.append("  keys missing on the left:  " + _r(miss[:8]) + (" …" if len(miss) > 8 else ""))
        if extra:
            lines.append("  extra keys on the left:    " + _r(extra[:8]) + (" …" if len(extra) > 8 else ""))
        for k in diff[:6]:
            lines.append(f"  [{_r(k)}]: {_r(left[k])} != {_r(right[k])}")
        if len(diff) > 6:
            lines.append(f"  … and {len(diff) - 6} more different values")
    elif isinstance(left, (list, tuple)) and isinstance(right, (list, tuple)):
        if len(left) != len(right):
            lines.append(f"  lengths: {len(left)} != {len(right)}")
        for i, (a, b) in enumerate(zip(left, right)):
            if a != b:
                lines.append(f"  first difference at index {i}: {_r(a)} != {_r(b)}")
                break
        else:
            if len(left) > len(right):
                lines.append(f"  left has extra items from index {len(right)}: {_r(left[len(right):][:3])}")
            elif len(right) > len(left):
                lines.append(f"  left is missing items from index {len(left)}: {_r(right[len(left):][:3])}")
        if type(left) is not type(right):
            lines.append(f"  types: {type(left).__name__} vs {type(right).__name__}")
    elif isinstance(left, (set, frozenset)) and isinstance(right, (set, frozenset)):
        if left - right:
            lines.append("  only on the left:  " + _r(sorted(left - right, key=repr)[:8]))
        if right - left:
            lines.append("  only on the right: " + _r(sorted(right - left, key=repr)[:8]))
    elif type(left) is not type(right) and left is not None and right is not None:
        lines.append(f"  types: {type(left).__name__} vs {type(right).__name__}")
    return lines


def _lc_fail(full, part, is_cmp, left, right, msg):
    lines = []
    if msg is not None:
        lines.append(str(msg))
    lines.append("assert " + full)
    if part != full:
        lines.append("failed part: " + part)
    if is_cmp:
        lines.append("  left:  " + _r(left))
        lines.append("  right: " + _r(right))
        lines += _diff(left, right)
    else:
        lines.append("  value: " + _r(left))
    return AssertionError("\n".join(lines))


class _Rewriter(ast.NodeTransformer):
    """assert a == b and c  ->  _l1 = a; _r1 = b; if not (_l1 == _r1): raise _lc_fail(...); ...same for c."""

    def __init__(self):
        self.n = 0

    def visit_Assert(self, node):
        full = ast.unparse(node.test)
        test = node.test
        parts = test.values if isinstance(test, ast.BoolOp) and isinstance(test.op, ast.And) else [test]
        out = []
        for p in parts:
            self.n += 1
            part = ast.unparse(p)
            msg = copy.deepcopy(node.msg) if node.msg is not None else ast.Constant(None)
            if isinstance(p, ast.Compare) and len(p.ops) == 1:
                ln, rn = f"_lc_l{self.n}", f"_lc_r{self.n}"
                out += [
                    ast.Assign(targets=[ast.Name(ln, ast.Store())], value=p.left),
                    ast.Assign(targets=[ast.Name(rn, ast.Store())], value=p.comparators[0]),
                    ast.If(test=ast.UnaryOp(ast.Not(), ast.Compare(ast.Name(ln, ast.Load()), p.ops, [ast.Name(rn, ast.Load())])),
                           body=[ast.Raise(exc=ast.Call(ast.Name("_lc_fail", ast.Load()), [
                               ast.Constant(full), ast.Constant(part), ast.Constant(True),
                               ast.Name(ln, ast.Load()), ast.Name(rn, ast.Load()), msg], []), cause=None)],
                           orelse=[]),
                ]
            else:
                vn = f"_lc_v{self.n}"
                out += [
                    ast.Assign(targets=[ast.Name(vn, ast.Store())], value=p),
                    ast.If(test=ast.UnaryOp(ast.Not(), ast.Name(vn, ast.Load())),
                           body=[ast.Raise(exc=ast.Call(ast.Name("_lc_fail", ast.Load()), [
                               ast.Constant(full), ast.Constant(part), ast.Constant(False),
                               ast.Name(vn, ast.Load()), ast.Constant(None), msg], []), cause=None)],
                           orelse=[]),
                ]
        for s in out:
            ast.copy_location(s, node)
        return out


def _case_id(names, values):
    if len(names) == 1:
        values = (values,)
    parts = []
    for v in values:
        s = v if isinstance(v, str) else repr(v)
        parts.append(s if len(s) <= 30 else s[:28] + "…")
    return "-".join(parts)


# ---------------------------------------------------------------- Run
def run(task, code):
    """Execute the editor code as __main__. stdout/stderr go to the page as they come."""
    _purge()
    path = f"{ROOT}/tasks/{task}.py" if task else f"{ROOT}/scratch.py"
    _write(path, code)
    ns = {"__name__": "__main__", "__file__": path, "__builtins__": __builtins__}
    t0 = time.perf_counter()
    err = None
    try:
        exec(compile(code, path, "exec"), ns)
    except SystemExit as e:
        if e.code not in (None, 0):
            err = _exc(e)
    except BaseException as e:
        err = _exc(e)
    finally:
        sys.stdout.flush(); sys.stderr.flush()
    return json.dumps({"error": err, "ms": round((time.perf_counter() - t0) * 1000)})


# ---------------------------------------------------------------- Check
def check(task, code, test_module):
    _purge()
    task_path = f"{ROOT}/tasks/{task}.py"
    _write(task_path, code)
    try:
        compile(code, task_path, "exec")
    except SyntaxError as e:
        return json.dumps({"collect_error": _exc(e), "results": [], "out": "", "ms": 0})
    path = f"{ROOT}/tests/{test_module}.py"
    with open(path, encoding="utf-8") as f:
        src = f.read()
    tree = _Rewriter().visit(ast.parse(src, path))
    ast.fix_missing_locations(tree)
    mod = types.ModuleType(test_module)
    mod.__file__ = path
    mod.__dict__["_lc_fail"] = _lc_fail
    sys.modules[test_module] = mod
    t0 = time.perf_counter()
    buf = io.StringIO()
    try:
        with redirect_stdout(buf), redirect_stderr(buf):
            exec(compile(tree, path, "exec"), mod.__dict__)
    except BaseException as e:
        return json.dumps({"collect_error": _exc(e), "results": [], "out": buf.getvalue()[-4000:],
                           "ms": round((time.perf_counter() - t0) * 1000)})

    results = []
    for name, f in list(mod.__dict__.items()):
        if not name.startswith("test_") or not isinstance(f, types.FunctionType):
            continue
        cases = [({}, name)]
        for names, values in getattr(f, "_lc_params", []):
            cases = [({**kw, **dict(zip(names, v if len(names) > 1 else (v,)))},
                      f"{tid}[{_case_id(names, v)}]") for kw, tid in cases for v in values]
        for kwargs, tid in cases:
            out = io.StringIO()
            t1 = time.perf_counter()
            status, err = "pass", None
            try:
                with redirect_stdout(out), redirect_stderr(out):
                    f(**kwargs)
            except pytest.Skipped as e:
                status, err = "skip", {"type": "Skipped", "message": str(e), "frames": [], "text": str(e)}
            except Exception as e:
                if type(e).__name__ == "DatabaseUnavailable":
                    status, err = "skip", {"type": "Skipped", "message": str(e), "frames": [], "text": str(e)}
                else:
                    status, err = "fail", _exc(e)
            except BaseException as e:  # KeyboardInterrupt, SystemExit, RecursionError is Exception
                status, err = "fail", _exc(e)
            results.append({"name": tid, "status": status, "error": err,
                            "out": out.getvalue()[-4000:], "ms": round((time.perf_counter() - t1) * 1000)})
    return json.dumps({"results": results, "collect_error": None, "out": buf.getvalue()[-4000:],
                       "ms": round((time.perf_counter() - t0) * 1000)})
