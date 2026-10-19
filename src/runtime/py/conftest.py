"""Browser version of tests/conftest.py: the code from the editor is tasks/<task>.py."""
import importlib


def load(task):
    """Import tasks/<task>.py — the code that is in the editor right now."""
    return importlib.import_module(f"tasks.{task}")
