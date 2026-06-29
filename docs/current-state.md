# Current state — working handoff

> **Non-authoritative working memory** (G-06). A session-to-session handoff, not part of the
> contract. Where this and the contract docs (`SPEC.md`, `ARCHITECTURE.md`, `ROADMAP.md`,
> `AGENTS.md`) disagree, **they win**. Update the narrative below at the end of a work session;
> regenerate the header with `python harness/scripts/update_memory.py --state`.

<!-- BEGIN generated: at-a-glance · python harness/scripts/update_memory.py --state -->
| | |
|---|---|
| Repo HEAD | `d482bba` — harness: adversarial pre-merge review-gate workflow (M-06) |
| Branch | `alternative-path` |
| Engine pin | transon `v0.1.1-1-g5812b63` @ `5812b632dc2c` (see [metadata-snapshot.md](metadata-snapshot.md)) |
| Metadata snapshot | committed ([metadata-snapshot.json](metadata-snapshot.json)) |
<!-- END generated: at-a-glance -->

## Last action

_M-08 landed: `harness/automations/` propose-only outer-loop watchers (`drift_watch`, `ci_triage`,
`worktrees.md`) + the scheduled `drift-watch.yml` workflow (D5 L3→L4, 90% → **93%**). **This is the
pre-code maturity ceiling** — every non-deferred backlog item (M-01…M-08) has landed. The remaining
headroom is lifecycle-gated and should NOT be chased now: D8 proof/observability (M-14) and D3
real-coverage evidence (M-15) are premature until UI/tests exist (M3+), and M-09's hard-fail engine-pin
flip waits on M0 making `transon` pip-installable in CI. Next real work is the **product**: M0 editor
side (Node→Python EngineProvider adapter + monorepo scaffolding), per ROADMAP._

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
