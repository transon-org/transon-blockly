#!/usr/bin/env python3
"""SessionStart hook (Claude Code adapter).

Claude Code does not auto-load `AGENTS.md` (only `CLAUDE.md`). Cursor injects the
always-on `.cursor/rules` every turn; to reach parity without copying the rules,
this hook injects `AGENTS.md` as session context — single source, no duplication.

Fail-open: any problem -> emit `{}` and inject nothing.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent


def main() -> int:
    try:
        text = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
    except OSError:
        print("{}")
        return 0
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": text,
        }
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
