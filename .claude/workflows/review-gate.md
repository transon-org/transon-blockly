---
name: review-gate
description: Adversarial pre-merge review — fan review across dimensions, then refute-or-confirm every finding before it blocks merge. Read-only; maker ≠ checker.
---

# review-gate (Claude Code adapter)

The procedure is tool-neutral and lives in `harness/workflows/review-gate.md` — read and follow it,
under `AGENTS.md`. This adapter only names how Claude Code runs it.

**How to run.** Drive it with the **Workflow** tool's review pattern — a pipeline that mirrors the two
stages of the canonical body:

1. **Stage 1 (fan out):** one agent per dimension (round-trip correctness · runtime safety · catalog &
   metadata parity · spec & traceability · harness integrity), each returning structured findings.
2. **Stage 2 (adversarially verify):** for every finding, spawn independent refuters (prompted to
   *refute*, default-refuted-when-uncertain); a finding survives only if refutation fails. Escalate
   trust-critical slices to the `round-trip-reviewer` subagent (read-only, opus).
3. **Stage 3 (verdict):** fold in the deterministic gates + `.coderabbit.yaml`'s PR review; emit
   🔴/🟡/🟢 findings and a merge verdict.

Review-only: never run the gate on a slice you implemented (maker ≠ checker).
