#!/usr/bin/env python3
"""`subagentStop` hook: gate and self-advance the per-requirement loop.

After a `requirement-implementer` subagent completes, run the deterministic
traceability gate and inject a follow-up that either:
- keeps the loop on the SAME requirement until the gate is green, or
- advances to the next requirement once it is green.

Stays silent (`{}`) for any other subagent, for non-completed stops, and when it
cannot identify the subagent — so it never disrupts planner/reviewer/explore runs.
The follow-up chain is capped by `loop_limit` in hooks.json.

Pure stdlib; imports `harness/scripts/check_traceability.py` directly (no subprocess).
"""
import json
import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent.parent
TARGET_AGENT = "requirement-implementer"
IDENTITY_KEYS = (
    "subagent_type",
    "subagentType",
    "agent_type",
    "agent_name",
    "subagent_name",
    "name",
    "type",
)


def _is_target(payload) -> bool:
    for key in IDENTITY_KEYS:
        value = payload.get(key)
        if isinstance(value, str) and (value == TARGET_AGENT or TARGET_AGENT in value):
            return True
    return False


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        print("{}")
        return 0

    if payload.get("status") != "completed" or not _is_target(payload):
        print("{}")
        return 0

    sys.path.insert(0, str(PROJECT_DIR / "harness" / "scripts"))
    try:
        from check_traceability import check
    except ImportError:
        print("{}")
        return 0

    problems = check()
    if problems:
        details = "\n".join(f"  - {p}" for p in problems)
        message = (
            "The traceability gate is failing after that requirement. Do NOT move on "
            "yet — fix these and re-run `python harness/scripts/check_traceability.py`:\n" + details
        )
    else:
        message = (
            "Gate green for that requirement. If the current milestone still has unchecked "
            "requirements in docs/traceability.md, implement the next one with the "
            "`requirement-implementer` subagent (one requirement per run) and keep "
            "`python harness/scripts/check_engine_parity.py` green. If none remain, stop and "
            "complete the milestone Definition of Done."
        )

    print(json.dumps({"followup_message": message}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
