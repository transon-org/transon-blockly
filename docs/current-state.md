# Current state — working handoff

> **Non-authoritative working memory** (G-06). A session-to-session handoff, not part of the
> contract. Where this and the contract docs (`SPEC.md`, `ARCHITECTURE.md`, `ROADMAP.md`,
> `AGENTS.md`) disagree, **they win**. Update the narrative below at the end of a work session;
> regenerate the header with `python harness/scripts/update_memory.py --state`.

<!-- BEGIN generated: at-a-glance · python harness/scripts/update_memory.py --state -->
| | |
|---|---|
| Repo HEAD | `4efc0e2` — editor: M1 T5 — literal-marker escape (FR-059/060/061/062/123, §11.4) |
| Branch | `m1-codec-skeleton` |
| Engine pin | transon `v0.1.3` @ `7b6c9342980d` (see [metadata-snapshot.md](metadata-snapshot.md)) |
| Metadata snapshot | committed ([metadata-snapshot.json](metadata-snapshot.json)) |
<!-- END generated: at-a-glance -->

## Last action

_**M1 codec slice committed (`d4c550e`) — round-trip-reviewer-signed-off, all gates green.** Branch
`m1-codec-skeleton`. (0) **Engine re-pin to v0.1.3** committed (`197d034`) — the M1 prerequisite (`type`
fn + `include` `IncludeContext` loader); cascaded `v0.1.1`→`v0.1.3` doc refs. (1) **T0 adapter fix**
committed (`bb9c0d9`): the v0.1.3 `include` loader is `loader(name, context=…)` → must build via
`context.transformer(…)` (self-`include` recursion + depth guard); added the `EngineProvider.transform`
`includes` bundle channel + fixed `collectIncludes`. (2) **The M1 codec slice landed (`d4c550e`):**
`packages/editor-core/src/codec/` = `codegen.ts` (the `@`-staged
`G_encode`/`G_decode` arms projected from `attr` metadata + fixed skeleton + `generateCodec`/`serializeArtifact`),
`run.ts` (engine-free encode/decode via the host port, `CODEC_MAX_INCLUDE_DEPTH=25`), `vocabulary.ts`
(block types + `WorkspaceBlock`/`JsonPathBlockMap`), committed `artifacts/{encoder,decoder}.json`;
codec tests live in `test/engine-node-adapter/test/codec/` (round-trip structural+execution, encode,
decode, workspace-shape, ceiling, regen) + `harness/scripts/check_no_codec_mapping.py` (FR-126). The
**de-risk is proven**: `decode(encode(T)) == T` structurally AND by execution (AC-035) over the M1
corpus; per-rule arms are projected from metadata (AD-026) with **byte-equal regen** (AD-030);
out-of-surface → `transon_unsupported`; deep nesting fails cleanly with a `CodecError` (§6.5 — found +
fixed a real raw-stack-overflow via the `maxIncludeDepth` cap). **Independent `round-trip-reviewer`
found 2 must-fix correctness bugs — both fixed + independently re-verified (sign-off: round-trip sound,
safe to merge for the M1 prototype scope):** (#1) presence was decided
by comparing a param's VALUE to a sentinel, so a valid `attr` whose `default` equalled the sentinel
string was silently dropped (AC-035/AD-004 break); (#2) variant matching only checked required-present
+ first-match, so ambiguous (`name`+`names`) / foreign-param `attr` nodes were silently rewritten
instead of → `transon_unsupported`. **Fix:** presence is now KEY-based (the codec `set`s the node,
compares key NAMES against generation-time-known param names; no value sentinel — `ABSENT` deleted),
and variant matching is EXACT (all required present AND no foreign key → else the cond default →
unsupported); decode `decInput` is key-based too. Also hardened the FR-126 scan (bracket/destructuring
access) and fixed a dead regex in `isRuleBlockType`. Regression coverage added (sentinel-default,
ambiguous, foreign). **107 tests pass**; typecheck + build + all gates green (parity 4 fns, traceability,
no-codec-mapping + selftest, snapshot-drift, maturity 93%, evals). Traceability rows + ROADMAP M1
tracker (☐→◐) updated. **Key codec mechanics learned** (load-bearing):
`map`/`filter` iterate `this` (not a `value` source — chain into `this` first); `set` stores `this` (no
`value` param); `include` passes only `this` (navigate via `chain` before recursing); `switch.cases`
must be a literal mapping (merge fixed+generated cases at codegen time, not via runtime `join`); `join`
merges dicts; `object key+value` builds a single dynamic-key dict; `object/fields` omits NO_CONTENT
values (drives optional-param omission); **presence/membership must be KEY-based** (a value-sentinel
collides — review #1) and the engine `!`/`not` operator does NOT negate (use `!=` / restructure).
Reviewer signed off (maker≠checker). **Since `d4c550e`:** (a) **`a913514`** — committed the
`G_encode`/`G_decode` generators as inspectable projection DATA (`src/codec/generators/*.json`);
`generateCodec` now runs the committed JSON (load-bearing), TS builders are the gate-verified authoring
source, regen holds them byte-equal. (b) **`4efc0e2`** — **T5 literal-marker escape** (FR-059/060/061/062/123):
the skeleton owns the `{<marker>:object,fields:X}` escape (exact shape, precedence over rule dispatch →
`transon_object_literal`; decode re-wraps when content carries the marker); centralized the inspected
DOCUMENT marker as `DOC_MARKER`. (c) **`d3280df`** — **T7 `JsonPathBlockMap`** (FR-091/094/122): a fixed,
metadata-free block-map encoder (`artifacts/blockmap.json`) walks the document and emits a segment tree;
`run.ts` flattens it into the flat map (the main codec is untouched). **+ FR-063 custom marker:** the codec
carries a marker placeholder (`DOC_MARKER_PLACEHOLDER`); `run.ts` substitutes the configured marker
(default `$`) at runtime, so one codec serves any marker. (d) **`db451c0`** — should-fix from the 2nd
reviewer pass: `block_id`/`template_path` now use RFC-6901 escaping (assembled in `run.ts`) so paths are
unique even for keys containing `/`. **M1 is COMPLETE (ROADMAP ☑):** the 2nd independent `round-trip-reviewer`
pass signed off escape + custom marker + blockMap as sound; **133 tests; all gates green** (parity 4 fns,
traceability, no-codec-mapping + selftest, snapshot-drift, maturity 93%, evals). **Next:** push
`m1-codec-skeleton` + open a PR referencing the M1 IDs (one branch/PR per milestone — not yet done), then
**M2** (`/run-milestone M2`): fold the full 22-rule catalog by extending `generateCodec`'s `M1_RULES` list +
the committed `G_*` arms (no skeleton change, AC-034; watch field-`kind` disposition, FR-118).
(Prior: RFC-002 absorption + coherence fixes committed `b3e6669`/`cb5b738`; M0 editor build `8751707`.)_

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
- **M1 — `editor-core` codec skeleton + `G_encode`/`G_decode` for `attr`** — ☑ done (committed, not
  pushed; two `round-trip-reviewer` sign-offs). Codec in `packages/editor-core/src/codec/`;
  engine-executed tests in `test/engine-node-adapter/test/codec/`. `decode(encode(T)) == T` structurally
  + by execution (AC-035); arms projected from committed-JSON generators with byte-equal regen
  (AD-026/030); literal-marker escape (FR-059…063/123), exact-variant surface check (§15.7),
  `JsonPathBlockMap` (FR-091/094/122), custom marker (FR-063); workspace-shape + FR-126 gates pass; clean
  recursion ceiling (§6.5). 133 tests.
- **M2–M5** — ☐ not started. M2 folds the full 22-rule catalog in by extending `generateCodec`'s
  `M1_RULES` list + the committed `G_*` arms (the M1 mechanism already supports it; no skeleton change,
  AC-034; watch field-`kind` disposition, FR-118).

## Next steps (ordered)

1. **Push `m1-codec-skeleton` + open a PR** referencing the M1 IDs (one branch/PR per milestone — M1 is
   ☑ done, reviewed, all gates green, but **not pushed**). 11+ commits from `197d034` (re-pin) through
   `db451c0` (blockMap path fix).
2. **M2** (`/run-milestone M2`): fold the full 22-rule catalog by extending `generateCodec`'s `M1_RULES`
   list + adding the committed `G_*` arms (no skeleton change; AC-034). The mechanism is proven; the new
   work is per-rule metadata coverage + the full §15.8 round-trip corpus. **Watch:** field-`kind` params
   — `attr` is all-dynamic (all value inputs); other rules have `kind:"field"` params that need the
   field-vs-input disposition in `G_encode` (FR-118), and operators/functions via resolved enums.
   Regen flow when a generator changes: write generators → rebuild (dist imports them) → regenerate
   artifacts → rebuild (the double-build, or `UPDATE_ARTIFACTS=1` twice).
3. (Deferred, M-09) Pin `transon` in CI and flip `check_engine_parity.py --require-engine` +
   `update_memory.py --check --require-engine` on, once the engine is pip-installable in CI.

## Open blockers / waiting-on

- None blocking M0 — it depends only on owner-controlled inputs (ROADMAP §"Remaining inputs").

## Do-not-relitigate (pointers, not copies)

- Locked decisions → [`ROADMAP.md` §Locked decisions](ROADMAP.md#locked-decisions).
- Architecture decisions `AD-001…AD-032` → [`ARCHITECTURE.md`](ARCHITECTURE.md).
- Golden rules / always-on invariants → [`AGENTS.md`](../AGENTS.md).
