#!/usr/bin/env python3
"""Engine-parity (anti-drift) checker for the Transon Visual Editor.

Asserts the rule / operator / function catalog declared in ``docs/SPEC.md`` §14 matches
the actual Transon engine. The editor must never hand-maintain a catalog that drifts
from the engine (SPEC AD-012, NFR-004, §21.4).

Engine resolution order:
1. ``transon`` importable in the current environment;
2. a sibling checkout at ``../transon`` (or ``$TRANSON_REPO``).

If the engine cannot be imported, the check is **skipped** (exit 0) so the harness is
usable before the engine is wired in; make it required in CI once the engine is
available. It prefers the engine's ``get_editor_metadata()`` export (M0) and falls back
to ``Transformer.get_rules/get_operators/get_functions``.

Pure stdlib, Python 3.9+. Run:

  python scripts/check_engine_parity.py
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import List, Optional, Set, Tuple

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SPEC = PROJECT_ROOT / "docs" / "SPEC.md"
BACKTICK = re.compile(r"`([^`]+)`")

# Tokens that appear in §14 prose but are rule names, not operators/functions.
NON_OPERATOR_TOKENS = {"expr"}
NON_FUNCTION_TOKENS = {"call"}


def _section(text: str, start: str, end: str) -> str:
    start_idx = text.find(start)
    if start_idx == -1:
        return ""
    end_idx = text.find(end, start_idx + len(start))
    return text[start_idx: end_idx if end_idx != -1 else len(text)]


def spec_catalog() -> Tuple[Set[str], Set[str], Set[str], List[str]]:
    problems: List[str] = []
    text = SPEC.read_text(encoding="utf-8", errors="ignore")

    fr040 = re.search(r"\*\*FR-040\*\*(.*?)- \*\*FR-", text, re.DOTALL)
    rules = set(BACKTICK.findall(fr040.group(1))) if fr040 else set()
    if not rules:
        problems.append("could not parse the rule list from FR-040 in docs/SPEC.md")

    operators = set(BACKTICK.findall(_section(text, "### 14.14", "### 14.15"))) - NON_OPERATOR_TOKENS
    if not operators:
        problems.append("could not parse operators from docs/SPEC.md §14.14")

    functions = set(BACKTICK.findall(_section(text, "### 14.15", "\n---"))) - NON_FUNCTION_TOKENS
    if not functions:
        problems.append("could not parse functions from docs/SPEC.md §14.15")

    return rules, operators, functions, problems


def _ensure_engine_importable() -> bool:
    try:
        import transon  # noqa: F401
        return True
    except ImportError:
        pass
    candidates = [os.environ.get("TRANSON_REPO"), str(PROJECT_ROOT.parent / "transon")]
    for candidate in candidates:
        if candidate and (Path(candidate) / "transon" / "__init__.py").exists():
            sys.path.insert(0, candidate)
            try:
                import transon  # noqa: F401
                return True
            except ImportError:
                continue
    return False


def _operator_tokens(operators) -> Set[str]:
    tokens: Set[str] = set()
    for op in operators:
        if op.get("name"):
            tokens.add(op["name"])
        if op.get("alternative"):
            tokens.add(op["alternative"])
    return tokens


def engine_catalog() -> Optional[Tuple[Set[str], Set[str], Set[str]]]:
    if not _ensure_engine_importable():
        return None
    from transon import Transformer
    try:
        from transon import get_editor_metadata
        meta = get_editor_metadata()
        rules = {rule["name"] for rule in meta["rules"]}
        operators = _operator_tokens(meta["operators"])
        functions = {fn["name"] for fn in meta["functions"]}
    except Exception:  # pragma: no cover - fallback when the export is absent
        rules = {rule.__rule_name__ for rule in Transformer.get_rules()}
        operators = _operator_tokens(Transformer.get_operators())
        functions = {fn["name"] for fn in Transformer.get_functions()}
    return rules, operators, functions


def _diff(label: str, spec: Set[str], engine: Set[str]) -> List[str]:
    problems: List[str] = []
    for missing in sorted(engine - spec):
        problems.append(f"{label}: `{missing}` exists in the engine but is missing from docs/SPEC.md")
    for extra in sorted(spec - engine):
        problems.append(f"{label}: `{extra}` is in docs/SPEC.md but not in the engine")
    return problems


def main() -> int:
    spec_rules, spec_operators, spec_functions, parse_problems = spec_catalog()
    if parse_problems:
        print("engine-parity: spec parsing problems:")
        for problem in parse_problems:
            print(f"  - {problem}")
        return 1

    engine = engine_catalog()
    if engine is None:
        print(
            "engine-parity: skipped — transon engine not importable "
            "(install transon or set TRANSON_REPO=../transon). Make this required in CI."
        )
        return 0

    engine_rules, engine_operators, engine_functions = engine
    problems = (
        _diff("rule", spec_rules, engine_rules)
        + _diff("operator", spec_operators, engine_operators)
        + _diff("function", spec_functions, engine_functions)
    )
    if problems:
        print(f"engine-parity: {len(problems)} drift(s) between docs/SPEC.md and the engine:")
        for problem in problems:
            print(f"  - {problem}")
        return 1

    print(
        "engine-parity: consistent "
        f"({len(engine_rules)} rules, {len(engine_operators)} operator tokens, "
        f"{len(engine_functions)} functions)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
