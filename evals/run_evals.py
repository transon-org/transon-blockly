#!/usr/bin/env python3
"""Golden-path evals for the agent harness itself (M-02, closes G-12).

The product is deterministic JSON⇄JSON, so output/LM-judge evals barely apply to
it — but the *agents* are non-deterministic, and their prompts/config can silently
regress. These are the regression guards for the harness: cheap, deterministic
assertions over `.cursor/agents`, `.cursor/skills`, `.cursor/commands`, and
`hooks.json` that fail loudly if the maker≠checker separation, the cost-tiered
model routing, the skill-determinism flag, or the per-requirement loop recipe
quietly breaks.

This tier runs in CI and in the pre-commit hook. The model-judged behavioral
cases (planner emits one task per FR, implementer refuses an ambiguous SPEC, the
round-trip corpus catches a seeded meaning change) live in `evals/cases/*.md` and
are run by a human / LM-judge — they need a model in the loop and, for the
round-trip case, code that does not exist yet (see `evals/README.md`).

Pure stdlib, Python 3.9+. Run:

  python evals/run_evals.py            # exit 0 if all golden-path evals pass

Also importable: ``check()`` returns the list of failures.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Dict, List

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CURSOR = PROJECT_ROOT / ".cursor"

# The expected maker≠checker topology (the harness's central invariant).
WRITER = "requirement-implementer"
READERS = {"milestone-planner", "round-trip-reviewer"}


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore") if path.exists() else ""


def _frontmatter(path: Path) -> Dict[str, str]:
    """Parse the leading ``--- ... ---`` block into a flat dict (no yaml dep)."""
    text = _read(path)
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    fields: Dict[str, str] = {}
    for line in text[3:end].splitlines():
        if ":" in line:
            key, _, value = line.partition(":")
            fields[key.strip()] = value.strip()
    return fields


def _agents() -> Dict[str, Dict[str, str]]:
    return {
        p.stem: _frontmatter(p)
        for p in sorted((CURSOR / "agents").glob("*.md"))
    }


# --------------------------------------------------------------------------- #
# Eval cases — each returns a list of failure strings (empty == pass)
# --------------------------------------------------------------------------- #

def eval_maker_ne_checker(agents: Dict[str, Dict[str, str]]) -> List[str]:
    """Exactly one agent may write; planner and reviewer are read-only."""
    out: List[str] = []
    writers = {name for name, fm in agents.items() if fm.get("readonly") == "false"}
    if writers != {WRITER}:
        out.append(f"maker≠checker: expected only '{WRITER}' to be writable, got writers={sorted(writers) or 'none'}")
    for reader in READERS:
        if reader not in agents:
            out.append(f"maker≠checker: expected read-only agent '{reader}' is missing")
        elif agents[reader].get("readonly") != "true":
            out.append(f"maker≠checker: '{reader}' must be readonly:true (got {agents[reader].get('readonly')!r})")
    return out


def eval_cost_tiered_routing(agents: Dict[str, Dict[str, str]]) -> List[str]:
    """Every agent declares a model, and the writer's tier differs from the judges'."""
    out: List[str] = []
    for name, fm in agents.items():
        if not fm.get("model"):
            out.append(f"model-routing: agent '{name}' declares no model (cost-tiered routing relies on it)")
    impl = agents.get(WRITER, {}).get("model")
    planner = agents.get("milestone-planner", {}).get("model")
    if impl and planner and impl == planner:
        out.append(f"model-routing: writer and planner share model {impl!r} — the cost tier collapsed")
    return out


def eval_skills_deterministic() -> List[str]:
    """Every skill is explicit-invocation (disable-model-invocation: true)."""
    out: List[str] = []
    skills = sorted((CURSOR / "skills").glob("*/SKILL.md"))
    if not skills:
        out.append("skills: no SKILL.md files found under .cursor/skills/")
    for skill in skills:
        if _frontmatter(skill).get("disable-model-invocation") != "true":
            out.append(f"skills: '{skill.parent.name}' must set disable-model-invocation: true (determinism)")
    return out


def eval_loop_hooks() -> List[str]:
    """hooks.json wires both post-turn loops with bounded loop_limits."""
    out: List[str] = []
    try:
        hooks = json.loads(_read(CURSOR / "hooks.json")).get("hooks", {})
    except json.JSONDecodeError as exc:
        return [f"hooks: hooks.json is unreadable ({exc})"]
    for event in ("stop", "subagentStop"):
        entries = hooks.get(event) or []
        if not entries:
            out.append(f"hooks: no '{event}' hook configured")
            continue
        if not any(isinstance(e.get("loop_limit"), int) for e in entries):
            out.append(f"hooks: '{event}' hook has no integer loop_limit (unbounded nudging)")
    return out


def eval_loop_recipe() -> List[str]:
    """The implement-requirement command still encodes the test-first + trace recipe."""
    out: List[str] = []
    cmd = _read(CURSOR / "commands" / "implement-requirement.md").lower()
    if not cmd:
        return ["loop-recipe: .cursor/commands/implement-requirement.md is missing"]
    if "test" not in cmd or "first" not in cmd:
        out.append("loop-recipe: implement-requirement.md no longer states the test-first rule")
    if "traceability" not in cmd:
        out.append("loop-recipe: implement-requirement.md no longer updates docs/traceability.md")
    return out


def check() -> List[str]:
    agents = _agents()
    if not agents:
        return ["harness: no agents found under .cursor/agents/ — is the harness present?"]
    failures: List[str] = []
    failures += eval_maker_ne_checker(agents)
    failures += eval_cost_tiered_routing(agents)
    failures += eval_skills_deterministic()
    failures += eval_loop_hooks()
    failures += eval_loop_recipe()
    return failures


def main() -> int:
    failures = check()
    if failures:
        print(f"evals: {len(failures)} golden-path failure(s):")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print("evals: harness golden-path checks pass "
          "(maker≠checker · cost-tiered routing · skill determinism · loop hooks · loop recipe).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
