#!/usr/bin/env python3
"""Stop hook (Claude Code adapter for `.cursor/hooks/check-docs-consistency.py`).

Nudges the agent to fix traceability drift before finishing — but only when it
touched docs/code/tests *and* the deterministic checker reports a problem, so it
stays quiet during unrelated work. Reuses `harness/scripts/check_traceability.check()`;
the I/O glue is the only thing that differs per tool.

Fail-open: any problem -> emit `{}` (do not block).
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
WATCHED = ("docs/", "packages/", "src/", "test/", "tests/", "examples/", "apps/")


def touched_watched() -> bool:
    try:
        r = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=ROOT, capture_output=True, text=True, timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return True  # can't tell -> err on the side of checking
    for line in r.stdout.splitlines():
        path = line[3:].strip().strip('"')
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        if path.startswith(WATCHED):
            return True
    return False


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        payload = {}

    if payload.get("stop_hook_active"):   # already re-prompted once; don't loop
        print("{}")
        return 0
    if not touched_watched():
        print("{}")
        return 0

    sys.path.insert(0, str(ROOT / "harness" / "scripts"))
    try:
        from check_traceability import check
        problems = check()
    except Exception:
        print("{}")
        return 0
    if not problems:
        print("{}")
        return 0

    reason = "Traceability drift before finishing:\n  - " + "\n  - ".join(problems[:8])
    print(json.dumps({
        "decision": "block",
        "reason": reason,
        "hookSpecificOutput": {"hookEventName": "Stop", "additionalContext": reason},
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
