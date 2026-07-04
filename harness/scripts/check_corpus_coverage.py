#!/usr/bin/env python3
"""Round-trip corpus coverage gate for the Transon Visual Editor.

Every rule and every variant in the committed engine-metadata snapshot must be
exercised by at least one entry in the round-trip corpus, and every optional
variant param must be exercised both with and without a value:

1. Per-variant coverage — each ``catalog.rules[*].variants[*]`` in
   ``docs/metadata-snapshot.json`` has >=1 corpus invocation matching it
   exactly one variant, per the exactly-one matching rule (SPEC §15.8,
   SPEC §15.6, FR-040, FR-052/053/054).
2. Optional-param coverage — for each variant, every optional param appears in
   >=1 matching invocation and is absent from >=1 (FR-045/046).

This turns the "require a round-trip corpus case for each touched rule/variant"
review instruction into a binding check: a static reviewer cannot execute the
corpus, but coverage of it is mechanically decidable. The scanner reads the
corpus source lexically (comments stripped, strings/braces tracked) — nested
rule invocations count, and entries matching zero or multiple variants are the
corpus's deliberate out-of-surface cases and credit nothing. Note the
``object``/``fields`` variant is covered by the literal-marker-escape entries
(FR-123, §11.4): the template shape is identical, so its coverage is real.

Pure stdlib, Python 3.9+, no project imports. Run:

  python harness/scripts/check_corpus_coverage.py

Exit 0 when every variant is covered, 1 otherwise (including missing snapshot
or corpus files — the gate fails closed). Also importable: ``check()`` returns
the list of problems.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Dict, FrozenSet, List, Optional, Set, Tuple

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SNAPSHOT = PROJECT_ROOT / "docs" / "metadata-snapshot.json"
CORPUS_FILES = (
    PROJECT_ROOT / "test" / "engine-node-adapter" / "test" / "codec" / "corpus.ts",
)

IDENT_RE = re.compile(r"[A-Za-z_$][A-Za-z0-9_$]*")


def _strip_comments(text: str) -> str:
    """Remove // and /* */ comments, preserving ' " ` string contents and offsets."""
    out: List[str] = []
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        if ch in "'\"`":
            quote, j = ch, i + 1
            while j < n:
                if text[j] == "\\":
                    j += 2
                    continue
                if text[j] == quote:
                    j += 1
                    break
                j += 1
            out.append(text[i:j])
            i = j
        elif text.startswith("//", i):
            j = text.find("\n", i)
            i = n if j == -1 else j
        elif text.startswith("/*", i):
            j = text.find("*/", i)
            i = n if j == -1 else j + 2
        else:
            out.append(ch)
            i += 1
    return "".join(out)


def _read_string(text: str, i: int) -> Tuple[Optional[str], int]:
    """Read a quoted string starting at ``i``; return (contents, index past it)."""
    quote = text[i]
    j = i + 1
    parts: List[str] = []
    while j < len(text):
        if text[j] == "\\" and j + 1 < len(text):
            parts.append(text[j + 1])
            j += 2
            continue
        if text[j] == quote:
            return "".join(parts), j + 1
        parts.append(text[j])
        j += 1
    return None, len(text)


def iter_rule_objects(text: str) -> List[Tuple[str, FrozenSet[str]]]:
    """Every object literal whose top level has a string-valued ``$`` key.

    Returns (rule_name, other_top_level_keys) per invocation, nested ones
    included. A single forward scan with a container stack: keys belong to the
    innermost object frame; commas and brackets inside nested containers never
    leak into the outer frame.
    """
    text = _strip_comments(text)
    results: List[Tuple[str, FrozenSet[str]]] = []
    # Each object frame: {"keys": set, "dollar": str|None, "expect_key": bool}
    stack: List[Optional[dict]] = []  # None marks an array frame
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        if ch in "'\"`":
            _, i = _read_string(text, i)
            continue
        if ch == "{":
            stack.append({"keys": set(), "dollar": None, "expect_key": True})
            i += 1
            continue
        if ch == "[":
            stack.append(None)
            i += 1
            continue
        if ch == "}":
            if stack and stack[-1] is not None:
                frame = stack.pop()
                if frame["dollar"] is not None:
                    results.append((frame["dollar"], frozenset(frame["keys"])))
            elif stack:
                stack.pop()
            i += 1
            continue
        if ch == "]":
            if stack:
                stack.pop()
            i += 1
            continue
        if ch == ",":
            if stack and stack[-1] is not None:
                stack[-1]["expect_key"] = True
            i += 1
            continue
        frame = stack[-1] if stack else None
        if frame is not None and frame["expect_key"]:
            key: Optional[str] = None
            j = i
            if ch in "'\"":
                key, j = _read_string(text, i)
            else:
                m = IDENT_RE.match(text, i)
                if m:
                    key, j = m.group(0), m.end()
            if key is not None:
                k = j
                while k < n and text[k] in " \t\r\n":
                    k += 1
                if k < n and text[k] == ":":
                    frame["expect_key"] = False
                    k += 1
                    if key == "$":
                        while k < n and text[k] in " \t\r\n":
                            k += 1
                        if k < n and text[k] in "'\"":
                            frame["dollar"], k = _read_string(text, k)
                    else:
                        frame["keys"].add(key)
                    i = k
                    continue
                i = j
                continue
        i += 1
    return results


def _match_variant(keys: FrozenSet[str], variants: List[dict]) -> Optional[str]:
    """The exactly-one variant an invocation matches, else None (SPEC §15.6)."""
    matched: List[str] = []
    for variant in variants:
        allowed = {p["name"] for p in variant["params"]}
        required = {p["name"] for p in variant["params"] if p["required"]}
        if required <= keys <= allowed:
            matched.append(variant["id"])
    return matched[0] if len(matched) == 1 else None


def check() -> List[str]:
    problems: List[str] = []
    if not SNAPSHOT.exists():
        return [f"metadata snapshot missing: {SNAPSHOT.relative_to(PROJECT_ROOT)}"]
    try:
        rules = json.loads(SNAPSHOT.read_text(encoding="utf-8"))["catalog"]["rules"]
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        return [f"metadata snapshot unreadable ({exc}) — regenerate with update_memory.py --snapshot"]

    invocations: List[Tuple[str, FrozenSet[str]]] = []
    for corpus in CORPUS_FILES:
        if not corpus.exists():
            problems.append(f"corpus file missing: {corpus.relative_to(PROJECT_ROOT)}")
            continue
        invocations.extend(iter_rule_objects(corpus.read_text(encoding="utf-8")))
    if problems:
        return problems
    if not invocations:
        return ["no rule invocations found in the corpus — did the corpus format change?"]

    # covered[(rule, variant)] -> list of param-key sets from matching invocations
    covered: Dict[Tuple[str, str], List[FrozenSet[str]]] = {}
    by_rule: Dict[str, List[dict]] = {r["name"]: r.get("variants", []) for r in rules}
    for rule_name, keys in invocations:
        variants = by_rule.get(rule_name)
        if not variants:
            continue  # unknown rule — the corpus's deliberate unsupported cases
        variant_id = _match_variant(keys, variants)
        if variant_id is not None:
            covered.setdefault((rule_name, variant_id), []).append(keys)

    for rule in rules:
        for variant in rule.get("variants", []):
            slot = (rule["name"], variant["id"])
            hits = covered.get(slot, [])
            if not hits:
                problems.append(
                    f"{rule['name']}/{variant['id']}: no corpus entry exercises this variant "
                    f"(SPEC §15.8, FR-052/053/054)"
                )
                continue
            for param in variant["params"]:
                if param["required"]:
                    continue
                name = param["name"]
                if not any(name in keys for keys in hits):
                    problems.append(
                        f"{rule['name']}/{variant['id']}: optional param '{name}' never "
                        f"exercised with a value (FR-045/046)"
                    )
                if not any(name not in keys for keys in hits):
                    problems.append(
                        f"{rule['name']}/{variant['id']}: optional param '{name}' never "
                        f"exercised without a value (FR-045/046)"
                    )

    return problems


def main() -> int:
    problems = check()
    if problems:
        print(f"corpus coverage: {len(problems)} issue(s):")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    print("corpus coverage: every rule/variant in the snapshot has corpus coverage.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
