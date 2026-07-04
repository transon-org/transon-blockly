#!/usr/bin/env python3
"""Append-only requirement-ID gate for the Transon Visual Editor.

SPEC §21.1: FR/NFR/AC/UC/AD/OQ IDs are append-only — new items take the next
free number; deprecated items are marked in place, never deleted or renumbered.
Until now that rule was prose-only; this gate binds it against a committed
ledger of every ID ever issued (``docs/id-ledger.json``, same pattern as the
maturity ratchet's ``docs/maturity-baseline.json``):

1. Removal/renumbering — an ID present in the ledger but absent from the
   contract docs fails (renumbering is a removal plus an addition, so it is
   caught here).
2. Unregistered additions — an ID in the contract docs but not in the ledger
   fails with instructions to run ``--update``; issuing a new ID therefore
   shows up as an explicit one-line ledger diff in the PR.
3. Next-free-number — ``--update`` refuses to register new IDs that skip
   numbers (each family must extend contiguously from its current maximum),
   so a gap can never become historical fact.

"Defined" uses the same semantics as check_traceability.py: any ID mentioned
in the contract docs (SPEC.md, ARCHITECTURE.md, ROADMAP.md,
metadata-contract.md). Pure stdlib, Python 3.9+, no project imports. Run:

  python harness/scripts/check_append_only_ids.py            # gate (pre-commit + CI)
  python harness/scripts/check_append_only_ids.py --update   # register newly issued IDs

Exit 0 when the ledger and docs agree, 1 otherwise (missing ledger fails
closed — run ``--update`` once to initialize it). Also importable:
``check()`` returns the list of problems.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Set

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DOCS = PROJECT_ROOT / "docs"
LEDGER = DOCS / "id-ledger.json"

ID_RE = re.compile(r"\b(FR|NFR|AC|UC|AD|OQ)-(\d+)\b")
FAMILIES = ("FR", "NFR", "AC", "UC", "AD", "OQ")
CONTRACT_DOCS = ("SPEC.md", "ARCHITECTURE.md", "ROADMAP.md", "metadata-contract.md")


def defined_ids() -> Dict[str, Set[int]]:
    ids: Dict[str, Set[int]] = {family: set() for family in FAMILIES}
    for name in CONTRACT_DOCS:
        path = DOCS / name
        if not path.exists():
            continue
        for match in ID_RE.finditer(path.read_text(encoding="utf-8", errors="ignore")):
            ids[match.group(1)].add(int(match.group(2)))
    return ids


def ledger_ids() -> Dict[str, Set[int]]:
    raw = json.loads(LEDGER.read_text(encoding="utf-8"))
    return {family: set(raw.get(family, [])) for family in FAMILIES}


def _write_ledger(ids: Dict[str, Set[int]]) -> None:
    payload = {
        "_comment": (
            "Every requirement ID ever issued (SPEC §21.1: append-only, deprecate in "
            "place). Maintained by check_append_only_ids.py --update; never edit by hand."
        ),
    }
    payload.update({family: sorted(ids[family]) for family in FAMILIES})
    LEDGER.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def check() -> List[str]:
    defined = defined_ids()
    if not any(defined.values()):
        return ["no requirement IDs found in docs/ — are the contract docs present?"]
    if not LEDGER.exists():
        return [
            f"ID ledger missing: {LEDGER.relative_to(PROJECT_ROOT)} — initialize it with "
            f"`python harness/scripts/check_append_only_ids.py --update`"
        ]
    try:
        ledger = ledger_ids()
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        return [f"ID ledger unreadable ({exc}) — regenerate with --update"]

    problems: List[str] = []
    for family in FAMILIES:
        for num in sorted(ledger[family] - defined[family]):
            problems.append(
                f"{family}-{num}: in the ledger but no longer defined in the contract docs — "
                f"IDs are append-only; deprecate in place, never delete or renumber (SPEC §21.1)"
            )
        for num in sorted(defined[family] - ledger[family]):
            problems.append(
                f"{family}-{num}: defined in the contract docs but not registered in the ID "
                f"ledger — run `python harness/scripts/check_append_only_ids.py --update`"
            )
    return problems


def update() -> int:
    defined = defined_ids()
    if not LEDGER.exists():
        _write_ledger(defined)
        total = sum(len(v) for v in defined.values())
        print(f"id-ledger: initialized {LEDGER.relative_to(PROJECT_ROOT)} with {total} IDs.")
        return 0

    ledger = ledger_ids()
    problems: List[str] = []
    added: List[str] = []
    for family in FAMILIES:
        new = sorted(defined[family] - ledger[family])
        if not new:
            continue
        # SPEC §21.1: new items take the next free number — extend contiguously from the max.
        start = max(ledger[family], default=0) + 1
        expected = list(range(start, start + len(new)))
        if new != expected:
            problems.append(
                f"{family}: new IDs {['%s-%d' % (family, n) for n in new]} do not extend "
                f"contiguously from {family}-{start - 1} — new items take the next free "
                f"number (SPEC §21.1)"
            )
            continue
        ledger[family] |= set(new)
        added.extend(f"{family}-{n}" for n in new)

    if problems:
        print(f"id-ledger: refusing to register {len(problems)} family(ies):")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    if added:
        _write_ledger(ledger)
        print(f"id-ledger: registered {len(added)} new ID(s): {', '.join(added)}")
    else:
        print("id-ledger: no new IDs to register.")
    # Removals still fail the gate — --update never deletes from the ledger.
    remaining = check()
    if remaining:
        print(f"id-ledger: {len(remaining)} problem(s) remain (see the gate):")
        for problem in remaining:
            print(f"  - {problem}")
        return 1
    return 0


def main(argv: List[str]) -> int:
    if "--update" in argv:
        return update()
    problems = check()
    if problems:
        print(f"append-only ids: {len(problems)} issue(s):")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    total = sum(len(v) for v in ledger_ids().values())
    print(f"append-only ids: all {total} issued IDs still defined; no unregistered additions.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
