#!/usr/bin/env python3
"""`stop` hook: nudge the agent to fix traceability drift before finishing.

Only speaks up when the agent touched the docs or code/tests *and* the deterministic
traceability checker reports a problem — so it stays quiet during unrelated work. The
``loop_limit`` in ``hooks.json`` caps how many times it re-prompts.

Pure stdlib; imports ``harness/scripts/check_traceability.py`` directly (no subprocess).
"""
import json
import subprocess
import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent.parent
WATCHED_PREFIXES = ("docs/", "packages/", "src/", "test/", "tests/", "examples/", "apps/")


def touched_watched_files() -> bool:
    """True if any watched path has uncommitted changes (so the agent touched it)."""
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return True  # can't tell -> err on the side of checking
    for line in result.stdout.splitlines():
        path = line[3:].strip().strip('"')
        if " -> " in path:  # renames: "old -> new"
            path = path.split(" -> ", 1)[1]
        if path.startswith(WATCHED_PREFIXES):
            return True
    return False


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        payload = {}

    if payload.get("status") not in (None, "completed"):
        print("{}")
        return 0

    if not touched_watched_files():
        print("{}")
        return 0

    sys.path.insert(0, str(PROJECT_DIR / "harness" / "scripts"))
    try:
        from check_traceability import check
    except ImportError:
        print("{}")
        return 0

    problems = check()
    if not problems:
        print("{}")
        return 0

    details = "\n".join(f"  - {p}" for p in problems)
    followup = (
        "Traceability is inconsistent: every requirement ID cited in code/tests or in "
        "`docs/traceability.md` must be defined in the contract docs, and every FR/AC "
        "marked done must have a test that cites its ID. Fix these, then re-run "
        "`python harness/scripts/check_traceability.py`:\n" + details
    )
    print(json.dumps({"followup_message": followup}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
