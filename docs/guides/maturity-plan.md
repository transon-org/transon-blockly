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

`check_maturity.py` baseline (pre-code): **63% · L3 Enforced** (`21.5 / 34` weighted).

| Dim | Level | Weight | Headroom |
|---|---|---|---|
| D1 context engineering | L3 | 1.0 | → L4 needs a documented rule-feedback loop (hard to auto-detect; not pursued) |
| D2 spec & traceability | L3 | 1.5 | **→ L4 via M-01** |
| D3 verification & gates · *gated* | L3 | 1.5 | **→ L4 via M-02** |
| D4 review / maker ≠ checker | L2 | 1.0 | **→ L3 via M-05 → L4 via M-06** |
| D5 loop & orchestration | L2 | 1.0 | **→ L3 via M-01 → L4 via M-08** |
| D6 memory & knowledge | L3 | 1.0 | **→ L4 via M-04** |
| D7 portability & tooling | L2 | 1.0 | **→ L3 via M-03 → L4 via M-07** |
| D8 proof & observability · *gated* | L1 | 0.5 | → L2+ deferred to M3+ (M-14) |

---

## Done

- [x] **CI gate** — `.github/workflows/agentic-checks.yml` runs traceability + engine-parity +
  maturity ratchet on every PR/push. *(closes the CI half of **G-01**; lifted D2 L2→L3 and D3 L2→L3,
  +8.8 pts: 54% → 63%.)*
- [x] **Maturity scorer + baseline** — `scripts/check_maturity.py` + `docs/maturity-baseline.json`;
  the `--check` ratchet fails CI on regression. *(the L3→L4 self-improvement mechanism for the harness.)*

---

## Backlog (ordered by criticality)

### 🔴 Critical

- [ ] **M-01 — Binding git hooks (pre-commit + commit-msg).**  *Gap: **G-01** (hook half), **G-05** spirit.*
  Add `.githooks/pre-commit` (runs `check_traceability.py` + `check_maturity.py --check`, and lint/test
  once code exists) and `.githooks/commit-msg` (rejects a code-touching commit lacking a `Refs: FR-xxx`
  / `Slice:` trailer). Wire `git config core.hooksPath .githooks`.
  - **Impact:** D2 L3→**L4** (+4.4) **and** D5 L2→**L3** (+2.9) = **+7.3 pts** → ~71%.
  - **Acceptance:** `check_maturity.py` reports D2 L4 + D5 L3; a trailerless code commit is rejected locally.
  - **Effort:** S.

- [ ] **M-02 — Harness golden-path evals.**  *Gap: **G-12**.*
  Add an `evals/` dir with a few fixtures asserting the agents behave: the planner emits one task per
  FR; the implementer refuses an ambiguous SPEC and proposes the next free ID; a **seeded**
  meaning-changing diff is caught by the round-trip corpus.
  - **Impact:** D3 L3→**L4** (+4.4) → ~75%.
  - **Acceptance:** `evals/` present and run in CI; `check_maturity.py` reports D3 L4.
  - **Effort:** M. *(The one place "evals" genuinely fit a deterministic product — they test the agents, not the output.)*

- [ ] **M-09 — Engine pin + fail-closed parity.**  *Gap: **G-02**.*
  Pin a specific `transon` version (or `TRANSON_REPO`), `pip install` it in CI, and make
  `check_engine_parity.py` **fail** (not skip) when the engine is missing, once M0 lands.
  - **Impact:** score-neutral, **gate-integrity**. Today parity silently no-ops on a clean clone — the
    primary spec/engine-drift defense is load-bearing on a sibling checkout. Critical for *trust* in D3.
  - **Acceptance:** CI fails if `transon` is absent; the skip path is gone.
  - **Effort:** S (blocked on M0 engine availability for the hard-fail flip).

### 🟠 High (doable now, independent)

- [ ] **M-03 — Cross-tool portability (`.claude/` mirror).**  *Proposal P10.*
  Mirror `.cursor/agents` → `.claude/agents`, `.cursor/commands` → `.claude/commands/`, add a one-line
  `CLAUDE.md` pointing at `AGENTS.md`. The harness currently does not load in Claude Code at all.
  - **Impact:** D7 L2→**L3** (+2.9) → ~78%.
  - **Acceptance:** ≥2 agent-tool surfaces detected; `check_maturity.py` reports D7 L3.
  - **Effort:** S–M.

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

- [ ] **M-07 — Portability doc.**  *Extends M-03.*
  `docs/portability.md` describing the shared Node/Python + git core and the per-tool adapters.
  - **Impact:** D7 L3→**L4** (+2.9).  **Acceptance:** D7 L4.  **Effort:** S.

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
| *(baseline today)* | 63% | L3 Enforced |
| 🔴 Critical (M-01, M-02) | ~75% | L3 Enforced |
| + 🟠 High (M-03, M-04, M-05) | ~84% | **L4 Optimizing** |
| + 🟡 Medium (M-06, M-07, M-08) | ~93% | L4 Optimizing |

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
