---
name: review-gate
description: Adversarial pre-merge review — fan review across dimensions, then refute-or-confirm every finding before it blocks merge. Read-only; maker ≠ checker.
---

# review-gate (Cursor adapter)

The procedure is tool-neutral and lives in `harness/workflows/review-gate.md` — read and follow it,
under `AGENTS.md`. This adapter only names how Cursor runs it.

**How to run.** As a multi-agent review pass before merge:

1. **Stage 1 (fan out):** review the diff once per dimension (round-trip correctness · runtime safety ·
   catalog & metadata parity · spec & traceability · harness integrity), recording each candidate with
   its file/line and the SPEC/AD ID it violates.
2. **Stage 2 (adversarially verify):** for each candidate, run an independent pass that tries to
   *refute* it (default to refuted when uncertain; prefer execution — a round-trip corpus case or
   engine run — over textual argument). Escalate trust-critical slices to the `round-trip-reviewer`
   agent (readonly, opus). Drop findings that don't survive.
3. **Stage 3 (verdict):** fold in the deterministic gates + `.coderabbit.yaml`'s PR review; emit
   🔴/🟡/🟢 findings and a merge verdict.

Review-only: never run the gate on a slice you implemented (maker ≠ checker).
