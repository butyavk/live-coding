"""A tiny stand-in for the parts of pytest the task tests use: raises, mark.parametrize, skip, fail.
P14 runs the reader's own tests, so param (a parametrize row with an id) and a no-op fixture decorator
exist too: a file that uses them still imports, and the P14 checker reports what it cannot run."""


class Failed(AssertionError):
    pass


class Skipped(Exception):
    pass


def skip(msg=""):
    raise Skipped(msg)


def fail(msg=""):
    raise Failed(msg)


class RaisesContext:
    def __init__(self, expected, match=None):
        self.expected = expected
        self.match = match
        self.value = None
        self.type = None

    def __enter__(self):
        return self

    def __exit__(self, et, ev, tb):
        name = getattr(self.expected, "__name__", str(self.expected))
        if et is None:
            raise Failed(f"DID NOT RAISE {name}")
        if not issubclass(et, self.expected):
            return False  # a different exception: let it propagate, like pytest
        if self.match is not None:
            import re
            if not re.search(self.match, str(ev)):
                raise Failed(f"Regex {self.match!r} does not match {str(ev)!r}")
        self.value, self.type = ev, et
        return True


def raises(expected, *args, match=None, **kwargs):
    ctx = RaisesContext(expected, match)
    if not args:
        return ctx
    func, args = args[0], args[1:]
    with ctx:
        func(*args, **kwargs)
    return ctx


class _Mark:
    def parametrize(self, argnames, argvalues, ids=None):
        names = [n.strip() for n in argnames.split(",")] if isinstance(argnames, str) else list(argnames)

        def deco(f):
            f.__dict__.setdefault("_lc_params", []).append((names, list(argvalues)))
            return f
        return deco

    def __getattr__(self, name):  # any other mark (slow, skipif, ...) is a no-op here
        def mark(*a, **k):
            if len(a) == 1 and callable(a[0]) and not k:
                return a[0]
            return lambda f: f
        return mark


mark = _Mark()


class ParameterSet:
    """One row of a parametrize table, as pytest.param(*values, id=...) makes it."""

    def __init__(self, values, marks=(), id=None):
        self.values, self.marks, self.id = tuple(values), marks, id

    def __repr__(self):
        return f"ParameterSet(values={self.values!r}, id={self.id!r})"


def param(*values, marks=(), id=None):
    return ParameterSet(values, marks, id)


def fixture(*args, **kwargs):  # @pytest.fixture or @pytest.fixture(scope=...): the function stays as it is
    if len(args) == 1 and callable(args[0]) and not kwargs:
        return args[0]
    return lambda f: f


class approx:
    def __init__(self, expected, rel=1e-6, abs_tol=1e-12):
        self.expected, self.rel, self.abs_tol = expected, rel, abs_tol

    def __eq__(self, other):
        return abs(other - self.expected) <= max(self.rel * abs(self.expected), self.abs_tol)

    def __repr__(self):
        return f"approx({self.expected!r})"
