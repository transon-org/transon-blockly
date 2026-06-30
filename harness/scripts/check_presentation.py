#!/usr/bin/env python3
"""FR-127 / NFR-048 gate: editor-owned presentation is *data*, not TS literals — and complete.

The editor-owned presentation (per-rule ``title``/``category``/``advanced`` + the toolbox
category **order** + the category→**colour** map) lives in **exactly one** committed
projection-data file — ``packages/editor-core/src/codec/presentation.json``
(``metadata-contract.md`` §2.9) — consumed by the ``G_palette``/``G_toolbox`` projections
(AD-026). The engine export is Blockly-agnostic and emits none of it (§2.8). This gate makes
that contract binding with two checks (``traceability.md``):

1. **Source-scan (FR-127, NFR-048).** No SPEC §12.4 category name appears as a TypeScript
   **string literal** under ``packages/*/src``. The category set/order/colours and per-rule
   category must originate only from ``presentation.json``; a category name quoted in a ``.ts``
   source is the fingerprint of a hardcoded enumeration → fail. (Test fixtures under
   ``packages/*/test`` are out of scope — FR-127 scopes the ban to ``src``.)

2. **Completeness (FR-127).** Every rule in the pinned metadata snapshot has a
   ``presentation.json`` entry, every rule's ``category`` is a declared + coloured category,
   and ``categoryOrder`` / ``categoryColour`` agree. A missing rule would silently drop a
   projected block/category → fail loudly.

Pure stdlib, Python 3.9+, no project imports. Run::

  python harness/scripts/check_presentation.py            # scan + completeness
  python harness/scripts/check_presentation.py --selftest  # prove it catches violations

Exit 0 when clean, 1 otherwise. Also importable: ``scan(root, categories)`` and
``completeness(presentation, rule_names)`` return the list of problems.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
from pathlib import Path
from typing import Dict, List

REPO = Path(__file__).resolve().parents[2]
PRESENTATION = REPO / "packages" / "editor-core" / "src" / "codec" / "presentation.json"
SNAPSHOT = REPO / "docs" / "metadata-snapshot.json"


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _quoted_category_re(categories: List[str]) -> "re.Pattern[str]":
    """A regex matching any category name inside a single- or double-quoted TS string."""
    alt = "|".join(re.escape(c) for c in sorted(categories, key=len, reverse=True))
    # "Iteration" or 'Iteration' (the exact category string, quote-delimited)
    return re.compile(rf"""(?P<q>['"])(?:{alt})(?P=q)""")


_BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)


def _strip_comments(text: str) -> str:
    """Remove TS comments, preserving line numbers. A category name in a comment is prose, not a
    hardcoded enumeration — the FR-127 ban is on category literals in *code*."""
    text = _BLOCK_COMMENT.sub(lambda m: "\n" * m.group(0).count("\n"), text)  # keep line count
    return "\n".join(re.sub(r"//.*", "", line) for line in text.splitlines())


def scan(root: Path, categories: List[str]) -> List[str]:
    """Flag every `.ts`/`.tsx` file under `<root>/packages/*/src` that quotes a category name in
    code (comments are stripped first)."""
    pattern = _quoted_category_re(categories)
    problems: List[str] = []
    for pkg_src in sorted(root.glob("packages/*/src")):
        for path in sorted(pkg_src.rglob("*.ts")) + sorted(pkg_src.rglob("*.tsx")):
            text = _strip_comments(path.read_text(encoding="utf-8"))
            for lineno, line in enumerate(text.splitlines(), 1):
                if pattern.search(line):
                    rel = path.relative_to(root)
                    problems.append(f"{rel}:{lineno}: category-name string literal — "
                                    f"presentation/category/colour must come from presentation.json (FR-127): {line.strip()}")
    return problems


def completeness(presentation: dict, rule_names: List[str]) -> List[str]:
    """Every metadata rule has an entry; categories are declared + coloured; order==colour keys."""
    problems: List[str] = []
    rules: Dict[str, dict] = presentation.get("rules", {})
    order: List[str] = presentation.get("categoryOrder", [])
    colour: Dict[str, object] = presentation.get("categoryColour", {})

    missing = [n for n in rule_names if n not in rules]
    if missing:
        problems.append(f"rules missing a presentation entry (FR-127): {', '.join(missing)}")

    for name, p in rules.items():
        cat = p.get("category")
        if cat not in order:
            problems.append(f"rule '{name}' category '{cat}' is not in categoryOrder (FR-127)")
        if not p.get("title"):
            problems.append(f"rule '{name}' has no title (FR-127)")
        if not isinstance(p.get("advanced"), bool):
            problems.append(f"rule '{name}' advanced is not a boolean (FR-127)")

    order_set, colour_set = set(order), set(colour)
    for cat in order_set - colour_set:
        problems.append(f"category '{cat}' in categoryOrder has no colour (NFR-048)")
    for cat in colour_set - order_set:
        problems.append(f"category '{cat}' has a colour but is not in categoryOrder (NFR-048)")

    structural: Dict[str, object] = presentation.get("structuralBlocks", {})
    for cat in set(structural) - order_set:
        problems.append(f"structuralBlocks category '{cat}' is not in categoryOrder (FR-127)")
    return problems


def check() -> List[str]:
    presentation = _load_json(PRESENTATION)
    snapshot = _load_json(SNAPSHOT)
    rule_names = [r["name"] for r in snapshot["catalog"]["rules"]]
    categories = presentation.get("categoryOrder", [])
    return scan(REPO, categories) + completeness(presentation, rule_names)


def _selftest() -> int:
    cats = ["Input / Context", "Iteration", "Custom"]
    # (1) source-scan catches a quoted category name in a src .ts
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        src = root / "packages" / "demo" / "src"
        src.mkdir(parents=True)
        (src / "clean.ts").write_text("export const x = 'Get attribute';\n", encoding="utf-8")
        (src / "bad.ts").write_text('const cats = ["Iteration", "Custom"];\n', encoding="utf-8")
        # A category name in a comment is prose, not a hardcoded enumeration — must NOT flag.
        (src / "comment.ts").write_text(
            '// the "Iteration" category groups map/filter\n/* "Custom" rules live here */\nexport const y = 1;\n',
            encoding="utf-8",
        )
        problems = scan(root, cats)
        assert any("bad.ts" in p for p in problems), f"scan missed the violation: {problems}"
        assert not any("clean.ts" in p for p in problems), f"scan false-positived clean.ts: {problems}"
        assert not any("comment.ts" in p for p in problems), f"scan false-positived a comment: {problems}"
    # (2) completeness catches a missing rule + an uncoloured ordered category
    pres = {
        "categoryOrder": ["Iteration", "Custom"],
        "categoryColour": {"Iteration": 120},  # Custom uncoloured
        "rules": {"map": {"title": "Map", "category": "Iteration", "advanced": False}},
    }
    problems = completeness(pres, ["map", "filter"])
    assert any("filter" in p for p in problems), f"completeness missed the missing rule: {problems}"
    assert any("Custom" in p for p in problems), f"completeness missed the uncoloured category: {problems}"
    print("check_presentation selftest: OK")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--selftest", action="store_true", help="prove the gate catches violations")
    args = ap.parse_args()
    if args.selftest:
        return _selftest()
    problems = check()
    if problems:
        print("check_presentation: FAIL", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 1
    print("check_presentation: clean (presentation is data + complete).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
