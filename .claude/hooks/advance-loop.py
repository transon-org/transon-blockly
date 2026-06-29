#!/usr/bin/env python3
"""SubagentStop hook (Claude Code adapter for `.cursor/hooks/advance-requirement-loop.py`).

Wired in `.claude/settings.json` with `matcher: requirement-implementer`, so the
identity check the Cursor hook does by key-sniffing is handled by the matcher.
After the implementer completes, run the deterministic traceability gate; if it is
red, block so the loop stays on the same requirement until it is green.

Reuses `scripts/check_traceability.check()`. Fail-open: any problem -> `{}`.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent


def main() -> int:
    try:
        json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        pass

    sys.path.insert(0, str(ROOT / "scripts"))
    try:
        from check_traceability import check
        problems = check()
    except Exception:
        print("{}")
        return 0

    if not problems:
        print("{}")
        return 0

    reason = ("Requirement not yet consistent — stay on it and fix before advancing:\n  - "
              + "\n  - ".join(problems[:8]))
    print(json.dumps({
        "decision": "block",
        "reason": reason,
        "hookSpecificOutput": {"hookEventName": "SubagentStop", "additionalContext": reason},
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
