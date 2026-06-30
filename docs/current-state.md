# Current state — working handoff

> **Non-authoritative working memory** (G-06). A session-to-session handoff, not part of the
> contract. Where this and the contract docs (`SPEC.md`, `ARCHITECTURE.md`, `ROADMAP.md`,
> `AGENTS.md`) disagree, **they win**. Update the narrative below at the end of a work session;
> regenerate the header with `python harness/scripts/update_memory.py --state`.

<!-- BEGIN generated: at-a-glance · python harness/scripts/update_memory.py --state -->
| | |
|---|---|
| Repo HEAD | `eb1fe81` — docs: refresh M0 handoff post-commit (8751707) |
| Branch | `alternative-path` |
| Engine pin | transon `v0.1.1-1-g5812b63` @ `5812b632dc2c` (see [metadata-snapshot.md](metadata-snapshot.md)) |
| Metadata snapshot | committed ([metadata-snapshot.json](metadata-snapshot.json)) |
<!-- END generated: at-a-glance -->

## Last action

_**RFC-002 absorbed into the contract docs** (branch `alternative-path`, uncommitted). The codec
output contract + projection guardrails RFC (`docs/proposals/rfc-002-…md`) was fully applied: new
append-only IDs **FR-122…FR-127, NFR-048, AC-037** (SPEC), **AD-032** (ARCHITECTURE) placed in their
cited sections; the §D.3 encapsulation finding folded into **AD-018** (shadow DOM not viable) and the
strict-regen-gate lesson into **AD-030**; engine prerequisites (`type` fn, `include` `IncludeContext`
loader, v0.1.3+ pin) + codec-metaprogramming lessons recorded as **metadata-contract §6.4/§6.5** and
**§2.9** (presentation = projection-data); ROADMAP M1/M2/M3 scope+DoD deltas; traceability gate rows
(workspace-shape validity, repo-scan, headless loads, presentation source-scan) + coverage rows. The
RFC is now an "APPLIED / non-normative" tombstone with a normative-homes table (matches the
`template-driven-editor.md` precedent). Gates green: `check_traceability.py` consistent,
`check_maturity.py` pass, each new ID defined exactly once, no stray non-breaking hyphens. Not yet
committed. (Prior session: **M0 editor-side build** committed as `8751707` — see "Status by milestone".)_

### Prior last action (M0)

_**M0 editor-side build landed** on branch `m0-editor-scaffolding` (uncommitted, in the working tree).
Scaffolded the pnpm/Turborepo monorepo with the AD-021 pins (Node ≥20, pnpm 10.27.0, TS 5.9.3, Vite
6.4.3, Vitest 2.1.9, Turbo 2.10.0, Changesets 2.31.0); stubbed `@transon/editor-core` (deliverable #1)
with the `EngineProvider` port + §9.9/§9.10 result types and a typed `metadata-snapshot.json` loader;
built the test-only Node→Python `transon` adapter (`test/engine-node-adapter`, AD-011/AD-025) — a
long-lived subprocess speaking newline-JSON to `runner.py` — and the `@`/`$` two-pass staging proof
(FR-116/FR-119/AD-027/AD-030). All gates green: typecheck, `pnpm -r test` (13/13), build,
`check_traceability.py`, `check_engine_parity.py` (22 rules/28 ops/3 fns). Engine pin resolved: local
`../transon/.venv` is at `0.1.2` but its metadata export is identical to the pinned `5812b63`, so parity
holds — no checkout/re-pin. **Independent `round-trip-reviewer` sign-off complete**: the staging proof,
no-`eval` discipline, adapter↔engine fidelity, and the FIFO subprocess protocol were all verified
correct via counterfactual tests; the one must-fix — a hardcoded `DEFAULT_VENV_PYTHON` absolute path —
is fixed (the adapter now resolves `<transonRepo>/.venv/bin/python`, proven by the suite passing with
`TRANSON_PYTHON` unset); a stale doc comment in `snapshot.ts` was also corrected. Gates re-run green.
Traceability rows for AD-008/AD-011/AD-027·FR-116/FR-119·AD-030/NFR-047 stay `[~]` on purpose — those
IDs are only *partially* covered by M0 and complete across M1/M2/M4. **M0 editor-side slice committed
as `8751707` on `m0-editor-scaffolding` (not pushed); ROADMAP M0 tracker flipped to ☑.** Deferred
follow-up: add a request-id to the bridge protocol (currently safe, see M1)._

## Status by milestone

The authoritative milestone tracker is [`ROADMAP.md`](ROADMAP.md#milestone-tracker); this is the
living read of it.

- **M0 — engine `switch`/`cond` + projection-ready export + Node adapter** — ☑ done (committed
  `8751707`, not pushed; CI pin flip deferred). Engine half: `../transon` exports
  `get_editor_metadata()` (`switch`/`cond` + projection-ready split catalog/docs, `metadata_version
  2.0`) — captured in [`metadata-snapshot.json`](metadata-snapshot.json). Editor half: monorepo
  scaffolding + AD-021 pins, `@transon/editor-core` stub (`EngineProvider` port + snapshot loader), and
  the Node→Python `test/engine-node-adapter` running markers `@`/`$` — reviewed + gate-green. Only the
  CI engine-pin flip (M-09: `--require-engine`) remains, waiting on `transon` being pip-installable in CI.
- **M1–M5** — ☐ not started. M1 (`editor-core` codec skeleton + `G_encode`/`G_decode` for one rule,
  e.g. `attr`) is the next milestone and consumes the M0 adapter + snapshot.

## Next steps (ordered)

1. Start **M1** (`/run-milestone M1`): `editor-core` codec skeleton + `G_encode`/`G_decode` for one
   rule (`attr`) with execution-based round-trip via the M0 adapter — the de-risk prototype. M1 also
   wires real `include` resolution through the adapter and should add the bridge request-id then.
   **RFC-002 prerequisites now apply to M1:** pin the snapshot to an engine build (**v0.1.3+**)
   providing the `type` fn + `include` `IncludeContext` loader (metadata-contract §6.4/§6.5); the
   codec output target is **Blockly workspace JSON directly** (FR-124/126, AD-032) with the FR-124
   shape validator + FR-126 repo-scan in the M1 DoD; see ROADMAP M1 implementation notes.
2. Commit the RFC-002 docs absorption on `alternative-path` (uncommitted working-tree change).
3. (Optional) push `m0-editor-scaffolding` + open a PR referencing the M0 IDs (one branch/PR per
   milestone) — not yet done.
4. (Deferred, M-09) Pin `transon` in CI and flip `check_engine_parity.py --require-engine` +
   `update_memory.py --check --require-engine` on, once the engine is pip-installable in CI.

## Open blockers / waiting-on

- None blocking M0 — it depends only on owner-controlled inputs (ROADMAP §"Remaining inputs").

## Do-not-relitigate (pointers, not copies)

- Locked decisions → [`ROADMAP.md` §Locked decisions](ROADMAP.md#locked-decisions).
- Architecture decisions `AD-001…AD-032` → [`ARCHITECTURE.md`](ARCHITECTURE.md).
- Golden rules / always-on invariants → [`AGENTS.md`](../AGENTS.md).
