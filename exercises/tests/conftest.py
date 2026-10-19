import importlib, os, sys
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
USE_SOLUTIONS = os.environ.get("SOLUTIONS") == "1"   # SOLUTIONS=1 pytest  -> checks the reference solutions
TODO_MARK = 'raise NotImplementedError("your code")'
DEBUG_MARK = "START: delete this line to run the tests"

def load(task):
    """Import tasks/<task>.py (or solutions/<task>.py when SOLUTIONS=1)."""
    pkg = "solutions" if USE_SOLUTIONS else "tasks"
    if not USE_SOLUTIONS:
        text = (ROOT / "tasks" / f"{task}.py").read_text()
        if TODO_MARK in text or DEBUG_MARK in text:
            pytest.skip(f"{task}: not started yet")
    return importlib.import_module(f"{pkg}.{task}")
