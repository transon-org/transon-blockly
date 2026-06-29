# harness/ — the tool-neutral harness core

Canonical, tool-agnostic definitions the agent harness runs on. `.cursor/` and `.claude/` are thin
adapters that reference these files at runtime; the gates, git hooks, and CI (`scripts/`, `.githooks/`,
`.github/`) are tool-agnostic too. The full cross-tool map is [`docs/portability.md`](../docs/portability.md).

- `agents/` — subagent role bodies (milestone-planner · requirement-implementer · round-trip-reviewer)
- `commands/` — command procedures (run-milestone · implement-requirement)
- `skills/` — skill procedures (transon-authoring · blockly-authoring · round-trip-review · spec-traceability)

## Harness governance (the rules for changing the harness)

These **harden the harness, not the product** — harness changes need *no SPEC change*; product behavior
still goes SPEC-first (§21.2). Ratified in the maturity work (M-03 / M-07 / M-16):

1. **Single source.** A command / skill / agent-role *body* lives once, here in `harness/`. `.cursor/`
   and `.claude/` carry only tool-specific frontmatter + "read the `harness/` body and follow it" — they
   reference the core, **never each other**. Don't copy a body into a tool; copying re-creates the drift
   the harness exists to prevent.
2. **Both tools, equally.** Any new command / skill / subagent / hook lands in `harness/` **and both**
   `.cursor/` and `.claude/` adapters — or carries an **explicit, documented exclusion** (record it in
   `docs/portability.md`). Cursor and Claude Code are first-class peers, in operation *and* in assessment.
3. **Gated, not hoped.** `evals/run_evals.py` (cross-tool parity) and `scripts/check_maturity.py --check`
   (maturity ratchet — tool-symmetric) bind in the pre-commit hook and CI. A red gate is a STOP: fix it,
   never weaken or bypass it.
4. **Docs split by role.** `AGENTS.md` + `harness/` + the adapters *operate*; `docs/portability.md` and
   the guides under `docs/guides/` *describe and track* — they reference the operating contract, never
   restate it.
