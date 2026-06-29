# Agentic-maturity improvement plan — trackable backlog

> **Status: non-authoritative.** Like [agentic-development.md](agentic-development.md), this is a
> field-manual artifact, **not** part of the contract and **not** checked by any product gate. It
> introduces no FR/NFR/AC. It is a living backlog: edit the checkboxes as items land. Where this and
> the contract docs (`SPEC.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `AGENTS.md`) disagree, **they win**.
> None of the items below require a SPEC change — they harden the *harness*, not the product.

## What this tracks

It merges two sources into one prioritized, checkable list:

1. The harness gaps **G-01 … G-12** from [agentic-development.md §6](agentic-development.md).
2. The enhancement proposals from the agentic-maturity assessment.

**Criticality is defined by maturity-score impact** — how many points each item moves the score
produced by [`scripts/check_maturity.py`](../../scripts/check_maturity.py), against
[`docs/maturity-baseline.json`](../maturity-baseline.json). Each item lists the dimension it lifts,
the level transition, and the point delta, plus an **acceptance criterion the scorer can detect**, so
progress is machine-verifiable, not a matter of opinion.

### How the score moves

The score is `Σ(level × weight) / 34 × 100`. One level step is worth `weight / 34 × 100` points:

| Dimension weight | Points per level step |
|---|---|
| 1.5 (D2 spec/trace, D3 verify/gates) | **+4.4** |
| 1.0 (D1, D4, D5, D6, D7) | **+2.9** |
| 0.5 (D8 proof — lifecycle-gated) | **+1.5** |

### Criticality scale

| Tier | Meaning |
|---|---|
| 🔴 Critical | ≥ +4 pts in one item, **or** gate-integrity (a gate that silently passes is worse than none) |
| 🟠 High | +2.5–4 pts, doable now, no dependency |
| 🟡 Medium | +2.5–3 pts but sequenced behind another item |
| 🟢 Low | score-neutral correctness / polish (the scorer can't see it, but it matters) |
| ⚪ Deferred | lifecycle-gated — premature until code/UI lands (M0–M3); chasing it now is cargo-culting |

---

## Current snapshot

`check_maturity.py` baseline (pre-code): **81% · L4 Optimizing** (`27.5 / 34` weighted) — after
🔴 Critical (M-01, M-02), 🟠 M-03, and M-07 landed (63% → 81%).

| Dim | Level | Weight | Headroom |
|---|---|---|---|
| D1 context engineering | L3 | 1.0 | → L4 needs a documented rule-feedback loop (hard to auto-detect; not pursued) |
| D2 spec & traceability | **L4** | 1.5 | ✅ maxed (M-01) |
| D3 verification & gates · *gated* | **L4** | 1.5 | ✅ via harness evals (M-02); real-coverage evidence deferred (M-15) |
| D4 review / maker ≠ checker | L2 | 1.0 | **→ L3 via M-05 → L4 via M-06** |
| D5 loop & orchestration | **L3** | 1.0 | done to L3 (M-01); **→ L4 via M-08** |
| D6 memory & knowledge | L3 | 1.0 | **→ L4 via M-04** |
| D7 portability & tooling | **L4** | 1.0 | ✅ maxed (M-03 + M-07: `.claude/` adapters + `docs/portability.md`) |
| D8 proof & observability · *gated* | L1 | 0.5 | → L2+ deferred to M3+ (M-14) |

---

## Done

- [x] **CI gate** — `.github/workflows/agentic-checks.yml` runs traceability + harness evals +
  engine-parity + maturity ratchet on every PR/push. *(closes the CI half of **G-01**; lifted D2 L2→L3
  and D3 L2→L3, +8.8 pts: 54% → 63%.)*
- [x] **Maturity scorer + baseline** — `scripts/check_maturity.py` + `docs/maturity-baseline.json`;
  the `--check` ratchet fails CI on regression. *(the L3→L4 self-improvement mechanism for the harness.)*
- [x] **M-01 · Binding git hooks** — `.githooks/pre-commit` (traceability + evals + maturity ratchet)
  and `.githooks/commit-msg` (`Refs:`/`Slice:` trailer on code-touching commits); enable with
  `git config core.hooksPath .githooks`. *(D2 L3→L4, D5 L2→L3, +7.3 pts.)*
- [x] **M-02 · Harness golden-path evals** — `evals/run_evals.py` (maker≠checker, cost-tiered routing,
  skill determinism, loop hooks/recipe) + model-judged `evals/cases/`, run in CI + pre-commit.
  *(closes **G-12**; D3 L3→L4, +4.4 pts.)*
- [x] **M-09 (mechanism)** — `check_engine_parity.py --require-engine` flips skip→fail when the engine
  is absent; CI wired to flip it on once M0 makes `transon` installable. *(gate-integrity; see M-09 below
  for the remaining M0-gated step.)*
- [x] **M-03 · Cross-tool portability (single source + thin adapter)** — root `CLAUDE.md` points Claude
  Code at the canonical `AGENTS.md`; **no** agent/command bodies copied (would duplicate prompts and
  drift). *(D7 L2→L3, +2.9 pts: 75% → 78%.)*
- [x] **M-07 · Full Claude Code adapters + portability doc** — `.claude/{agents,commands,skills,hooks}`,
  `.claude/settings.json`, `.mcp.json`, and [`docs/portability.md`](../portability.md). Every `.cursor`
  mechanism now has a working Claude equivalent: thin adapter bodies read the single source at runtime;
  a `SessionStart` hook injects `AGENTS.md` (always-on parity); read-only roles drop `Write`/`Edit` from
  `tools:`; `model: opus/sonnet` mirrors the cost tiers. Parity is **gated** by a new `run_evals.py`
  check. *(D7 L3→L4, +2.9 pts: 78% → 81% — crosses into L4.)*
- [x] **M-16 · Tool-neutral core + symmetric assessment** *(score-neutral — fairness, not inflation)*.
  Removed the "Claude references Cursor" asymmetry: canonical command/skill/agent-role bodies moved to a
  tool-neutral **`harness/`** core; **both** `.cursor/` and `.claude/` are now thin adapters that
  reference `harness/`, neither references the other. Made `check_maturity.py` tool-symmetric (D1 credits
  the always-on contract per tool — Cursor `alwaysApply` *or* Claude `CLAUDE.md`+SessionStart; advisory-hook
  signal reads both `.cursor/hooks` and `.claude/hooks`). Extended `eval_cross_tool_parity` to enforce
  bidirectional existence, the no-cross-reference rule, and the `harness/` source. Policy ("new tooling →
  both adapters, or an explicit exclusion") recorded in `AGENTS.md` + `docs/portability.md`.

---

## Backlog (ordered by criticality)

### 🔴 Critical

- [x] **M-01 — Binding git hooks (pre-commit + commit-msg).** ✅ *done — see Done above.*  *Gap: **G-01** (hook half), **G-05** spirit.*
  `.githooks/pre-commit` runs `check_traceability.py` + `evals/run_evals.py` + `check_maturity.py --check`
  (+ lint/test once code exists); `.githooks/commit-msg` rejects a code-touching commit lacking a
  `Refs: FR-xxx` / `Slice:` trailer. Enable with `git config core.hooksPath .githooks`.
  - **Impact:** D2 L3→**L4** (+4.4) **and** D5 L2→**L3** (+2.9) = **+7.3 pts**. ✅ landed.
  - **Acceptance:** `check_maturity.py` reports D2 L4 + D5 L3; a trailerless code commit is rejected locally. ✅

- [x] **M-02 — Harness golden-path evals.** ✅ *done — see Done above.*  *Gap: **G-12**.*
  `evals/run_evals.py` asserts the agents behave (maker≠checker, cost-tiered routing, skill determinism,
  loop hooks/recipe); `evals/cases/*.md` hold the model-judged behavioral cases (planner one-task-per-FR,
  implementer refuses ambiguous SPEC, round-trip catches a seeded meaning change — last one gated on M1).
  - **Impact:** D3 L3→**L4** (+4.4). ✅ landed.
  - **Acceptance:** `evals/` present and run in CI; `check_maturity.py` reports D3 L4. ✅

- [~] **M-09 — Engine pin + fail-closed parity.**  *Gap: **G-02**. Mechanism done; flip gated on M0.*
  `check_engine_parity.py --require-engine` now fails (not skips) when the engine is absent, and CI is
  wired to flip it on. **Remaining (M0-gated):** pin a specific `transon` version, `pip install` it in
  CI, and add `--require-engine` to the CI step so parity can never silently no-op.
  - **Impact:** score-neutral, **gate-integrity**. Until the flip, parity still self-skips on a clean clone.
  - **Acceptance:** CI fails if `transon` is absent; the skip path is gone.
  - **Effort:** S (blocked on M0 engine availability for the hard-fail flip).

### 🟠 High (doable now, independent)

- [x] **M-03 — Cross-tool portability (single source + thin adapter).** ✅ *done — see Done above.*  *Proposal P10; approach adjusted to avoid duplication.*
  Two alternatives were weighed against "mirror `.cursor/agents`/`commands` into `.claude/`" (copy the
  bodies — **rejected**, that is the drift the harness forbids) and "extract common parts into shared
  files referenced from both tools" (**rejected for bodies**: no reliable cross-tool transclusion of an
  agent's system prompt, and the two tools' frontmatter/invocation differ — a shared body needs a
  build/sync step that is itself a new, ungated drift source). Chosen approach = the course's
  portable-core + thin-adapter pattern: **one source** (`AGENTS.md` + tool-agnostic gates/hooks/CI) + a
  **thin `CLAUDE.md` pointer**, no copied bodies. Two boundaries make it honest:
  - **Rules** are single-sourced in `AGENTS.md`; the always-on `.cursor/rules` overlap is kept as
    deliberate belt-and-suspenders (a Cursor `alwaysApply` rule must inject its *body* every turn — an
    `@AGENTS.md` reference would trade the always-on guarantee for a few saved lines).
  - **Agent/command/skill orchestration adapters** for Claude Code are deferred to **M-07**, to be
    written as adapters that point at the source, not copies.
  - **Impact:** D7 L2→**L3** (+2.9). ✅ landed (78%).
  - **Acceptance:** ≥2 agent-tool surfaces detected; `check_maturity.py` reports D7 L3. ✅

- [ ] **M-04 — Working memory + committed snapshot.**  *Gaps: **G-06**, **G-07**.*
  Add `docs/current-state.md` (last action / status / next steps, updated end-of-session); commit a
  metadata snapshot and record the exact engine commit it came from; reconcile the ROADMAP milestone
  tracker against reality (e.g. the export already exists).
  - **Impact:** D6 L3→**L4** (+2.9) → ~81%.
  - **Acceptance:** `docs/current-state.md` + a committed `*snapshot*` file exist; `check_maturity.py` reports D6 L4.
  - **Effort:** S.

- [ ] **M-05 — Structurally triggered review.**  *Gap: **G-05**.*
  Add `.coderabbit.yaml` (free external mentor reviewer) and/or a `.github/CODEOWNERS` requiring review
  on trust-critical paths (codec, variant matcher, surface check, marker escape, round-trip).
  - **Impact:** D4 L2→**L3** (+2.9) → ~84%.
  - **Acceptance:** CodeRabbit or CODEOWNERS present; `check_maturity.py` reports D4 L3.
  - **Effort:** S.

### 🟡 Medium (sequenced behind a High item)

- [ ] **M-06 — Adversarial review workflow.**  *Extends M-05; Day-2 `review-gate`.*
  A `.claude/workflows/review-gate` (or `.cursor/`) that fans review across dimensions and adversarially
  verifies findings before merge. Depends on **M-03**/**M-05**.
  - **Impact:** D4 L3→**L4** (+2.9).
  - **Acceptance:** a `*review*` workflow file exists and is wired; `check_maturity.py` reports D4 L4.
  - **Effort:** M.

- [x] **M-07 — Full Claude Code adapters + portability doc.** ✅ *done — see Done above.*  *Extends M-03.*
  `.claude/{agents,commands,skills,hooks}` + `settings.json` + `.mcp.json` + `docs/portability.md`, all
  thin adapters that read the single source at runtime. Parity gated by `run_evals.py`.
  - **Impact:** D7 L3→**L4** (+2.9). ✅ landed (81%, L4).  **Acceptance:** `docs/portability.md` present, ≥2 surfaces, `check_maturity.py` reports D7 L4. ✅

- [ ] **M-08 — Loop automations / worktrees.**  *Extends M-01; Day-2 outer loop.*
  An `automations/` dir (propose-only watchers: drift / CI-triage) and/or documented worktree flow for
  disjoint parallel slices.
  - **Impact:** D5 L3→**L4** (+2.9).  **Acceptance:** D5 L4.  **Effort:** M.

### 🟢 Low (score-neutral correctness / polish)

- [ ] **M-10 — Verify subagent model slugs.**  *Gap: **G-03**.* Confirm the opus/composer slugs resolve
  in the Models UI; a silent fallback collapses the cost-tiered design. *Score-neutral; protects the design.*
- [ ] **M-11 — Tighten hook wiring.**  *Gaps: **G-08**, **G-09**.* Add `"matcher": "requirement-implementer"`
  to `hooks.json`, confirm `stop` `followup_message` injects, keep key-sniffing as fallback only.
- [ ] **M-12 — Centralize watched-path lists.**  *Gap: **G-11**.* Single source for `CODE_DIRS` /
  `WATCHED_PREFIXES` so the gates don't silently skip files when the M0 layout lands.
- [ ] **M-13 — Real coverage signal.**  *Gap: **G-04**.* Pair `check_traceability.py`'s ID-citation
  (necessary, not sufficient) with Vitest coverage once code exists. *Partially overlaps M-02; full
  coverage is lifecycle-gated.*
- [ ] **G-10 — (no action)** Skills are explicit-invocation by design; documented, accepted.

### ⚪ Deferred (lifecycle-gated — revisit at M3+)

- [ ] **M-14 — Proof & observability.** Recorded demos asserting FRs, a11y CI gate (light+dark),
  vision-judge. *Drives D8 L1→L3+ (+1.5/level), but premature before any UI exists.* Keep the Playwright
  MCP hook; defer the rest to M3–M5.
- [ ] **M-15 — Coverage/eval ratchet on real tests.** A coverage ratchet (only-grows) once `editor-core`
  ships. Reinforces D3 L4 with real evidence rather than harness evals alone.

---

## Projected trajectory

| After clearing | Score | Tier |
|---|---|---|
| ~~CI gate + scorer~~ | ~~63%~~ | done |
| ~~🔴 Critical (M-01, M-02)~~ | ~~75%~~ | done |
| ~~🟠 M-03~~ | ~~78%~~ | done |
| ✅ M-07 — **current** | **81%** | **L4 Optimizing** |
| + 🟠 High (M-04, M-05) | ~87% | L4 Optimizing |
| + 🟡 Medium (M-06, M-08) | ~93% | L4 Optimizing |

Beyond ~93%, the only remaining headroom is D8 (proof) and D3's real-coverage evidence — both
correctly **deferred** until code/UI exists. The plan deliberately stops there rather than inflating
the score with premature machinery.

## Re-measuring

```bash
python scripts/check_maturity.py                 # per-dimension levels + evidence
python scripts/check_maturity.py --check          # ratchet vs baseline (CI uses this)
python scripts/check_maturity.py --update-baseline # after an item lands, re-baseline
```

When an item lands: tick its checkbox, run `--update-baseline`, and commit the bumped
`docs/maturity-baseline.json` alongside the change so the ratchet locks in the gain.
