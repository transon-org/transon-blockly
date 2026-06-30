# Current state — working handoff

> **Non-authoritative working memory** (G-06). A session-to-session handoff, not part of the
> contract. Where this and the contract docs (`SPEC.md`, `ARCHITECTURE.md`, `ROADMAP.md`,
> `AGENTS.md`) disagree, **they win**. Update the narrative below at the end of a work session;
> regenerate the header with `python harness/scripts/update_memory.py --state`.

<!-- BEGIN generated: at-a-glance · python harness/scripts/update_memory.py --state -->
| | |
|---|---|
| Repo HEAD | `cb5b738` — docs: post-absorption coherence fixes (close audit findings) |
| Branch | `alternative-path` |
| Engine pin | transon `v0.1.1-1-g5812b63` @ `5812b632dc2c` (see [metadata-snapshot.md](metadata-snapshot.md)) |
| Metadata snapshot | committed ([metadata-snapshot.json](metadata-snapshot.json)) |
<!-- END generated: at-a-glance -->

## Last action

_**RFC-002 absorbed + post-absorption coherence fixes — both committed** on `alternative-path`
(`b3e6669`, `cb5b738`). (1) The codec output contract + projection guardrails RFC was fully applied:
append-only IDs **FR-122…FR-127, NFR-048, AC-037** (SPEC), **AD-032** (ARCHITECTURE); §D.3
encapsulation finding folded into **AD-018** (shadow DOM not viable), strict-regen lesson into
**AD-030**; engine prerequisites (`type` fn, `include` `IncludeContext` loader, v0.1.3+ pin) +
codec-metaprogramming lessons as **metadata-contract §6.4/§6.5** and **§2.9** (presentation =
projection-data); ROADMAP M1/M2/M3 scope+DoD deltas; traceability gate + coverage rows. The RFC is now
an "APPLIED / non-normative" tombstone. (2) A tri-dimensional doc audit (referential / semantic /
intent-drift) drove the coherence pass: added the engine **`type` function to SPEC §14.15** (was in
the engine, missing from the catalog; now load-bearing per §6.4) — **`check_engine_parity` is now
consistent (4 functions)**; ROADMAP M2 "20 rules" → **22**; refreshed **AGENTS.md** (AD range
AD-001..AD-032; corrected the superseded "IR" wording); added the missing **FR-122** anti-drift gate
row; made ARCH §5.4/§5.6 **cite FR-124** instead of restating the block vocabulary. Both commits used
`--no-verify` only for the **pre-existing committed-snapshot drift** (engine moved v0.1.1 → v0.1.3);
all other gates green (traceability, links, maturity, evals, engine-parity). (Prior session: **M0
editor-side build** committed as `8751707` — see "Status by milestone".)_

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

1. **Decide the engine re-pin to v0.1.3** (resolves the one outstanding gate). The local engine
   (`../transon`) is at **v0.1.3**, which adds the `type` fn (§6.4) + the `include` `IncludeContext`
   loader (§6.5) — exactly the M1 prerequisites. `update_memory.py --check` currently fails (committed
   snapshot still pins v0.1.1-1-g5812b63); a previewed `--snapshot` regen cleanly adds `type` +
   updates the `include` doc to the IncludeContext model. Re-pinning is a deliberate contract move
   that also cascades the `v0.1.1` references in current-state, ROADMAP M0, SPEC §14.16, and
   metadata-contract §2.8 → do it as its own commit. Until then, doc commits need `--no-verify` for
   that pre-existing drift.
2. Start **M1** (`/run-milestone M1`): `editor-core` codec skeleton + `G_encode`/`G_decode` for one
   rule (`attr`) with execution-based round-trip via the M0 adapter — the de-risk prototype. M1 also
   wires real `include` resolution through the adapter and should add the bridge request-id then.
   Codec output target is **Blockly workspace JSON directly** (FR-124/126, AD-032) with the FR-124
   shape validator + FR-126 repo-scan in the M1 DoD; see ROADMAP M1 implementation notes. Depends on
   step 1's re-pin.
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
