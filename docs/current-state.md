# Current state — working handoff

> **Non-authoritative working memory** (G-06). A session-to-session handoff, not part of the
> contract. Where this and the contract docs (`SPEC.md`, `ARCHITECTURE.md`, `ROADMAP.md`,
> `AGENTS.md`) disagree, **they win**. Update the narrative below at the end of a work session;
> regenerate the header with `python harness/scripts/update_memory.py --state`.

<!-- BEGIN generated: at-a-glance · python harness/scripts/update_memory.py --state -->
| | |
|---|---|
| Repo HEAD | `6c2b401` — harness: structurally triggered external review (M-05) |
| Branch | `alternative-path` |
| Engine pin | transon `v0.1.1-1-g5812b63` @ `5812b632dc2c` (see [metadata-snapshot.md](metadata-snapshot.md)) |
| Metadata snapshot | committed ([metadata-snapshot.json](metadata-snapshot.json)) |
<!-- END generated: at-a-glance -->

## Last action

_M-06 landed: `harness/workflows/review-gate.md` (+ thin tool adapters) — an adversarial pre-merge
review-gate that fans review across five dimensions and refutes each finding before it counts; workflow
parity is now gated in `run_evals.py` (D4 L3→L4, 87% → 90%). M-05/M-04 preceded it. The only remaining
non-deferred maturity item is M-08 (loop automations / worktrees → D5 L4, ~93%); everything past that is
lifecycle-gated on code/UI (M-14/M-15, D8 + real coverage)._

## Status by milestone

The authoritative milestone tracker is [`ROADMAP.md`](ROADMAP.md#milestone-tracker); this is the
living read of it.

- **M0 — engine `switch`/`cond` + projection-ready export + Node adapter** — ◐ in progress. The
  **engine half is done**: the sibling `../transon` checkout exports `get_editor_metadata()`
  (`switch`/`cond` rules + projection-ready split catalog/docs, `metadata_version 2.0`) — captured in
  [`metadata-snapshot.json`](metadata-snapshot.json). **Editor-side pending**: the Node→Python
  `EngineProvider` test adapter and the monorepo scaffolding + version pins (AD-021).
- **M1–M5** — ☐ not started.

## Next steps (ordered)

1. Stand up the M0 editor-side Node→Python `transon` `EngineProvider` test adapter
   (`test/engine-node-adapter`) able to run markers `@` and `$` (ROADMAP M0 deliverables).
2. Scaffold the pnpm/Turborepo monorepo + record the locked version pins (AD-021).
3. Pin the engine in CI and flip `check_engine_parity.py --require-engine` + `update_memory.py
   --check --require-engine` on (closes M-09).

## Open blockers / waiting-on

- None blocking M0 — it depends only on owner-controlled inputs (ROADMAP §"Remaining inputs").

## Do-not-relitigate (pointers, not copies)

- Locked decisions → [`ROADMAP.md` §Locked decisions](ROADMAP.md#locked-decisions).
- Architecture decisions `AD-001…AD-031` → [`ARCHITECTURE.md`](ARCHITECTURE.md).
- Golden rules / always-on invariants → [`AGENTS.md`](../AGENTS.md).
