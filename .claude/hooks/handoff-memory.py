#!/usr/bin/env python3
"""Stop hook (Claude Code adapter for `.cursor/hooks/handoff-memory.py`).

Nudges the agent to refresh the working handoff (`docs/current-state.md`) before
finishing — but only when it changed watched files *and* left the handoff untouched,
so it stays quiet during throwaway edits and when the handoff was already updated.
The signal logic is single-sourced in `harness/scripts/update_memory.handoff_nudge`
(the Cursor adapter calls the same function); only the I/O glue differs per tool.

Fires at most once (stop_hook_active guard). Fail-open: any error -> emit `{}`.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "harness" / "scripts"))


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        payload = {}

    if payload.get("stop_hook_active"):   # already re-prompted once; don't loop
        print("{}")
        return 0

    try:
        from update_memory import handoff_nudge
        msg = handoff_nudge()
    except Exception:
        print("{}")
        return 0

    if not msg:
        print("{}")
        return 0

    print(json.dumps({
        "decision": "block",
        "reason": msg,
        "hookSpecificOutput": {"hookEventName": "Stop", "additionalContext": msg},
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
