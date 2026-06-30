# Current state — working handoff

> **Non-authoritative working memory** (G-06). A session-to-session handoff, not part of the
> contract. Where this and the contract docs (`SPEC.md`, `ARCHITECTURE.md`, `ROADMAP.md`,
> `AGENTS.md`) disagree, **they win**. Update the narrative below at the end of a work session;
> regenerate the header with `python harness/scripts/update_memory.py --state`.

<!-- BEGIN generated: at-a-glance · python harness/scripts/update_memory.py --state -->
| | |
|---|---|
| Repo HEAD | `b624a6f` — docs: M2 cleanup — address review NITs + refresh handoff |
| Branch | `m2-full-catalog` |
| Engine pin | transon `v0.1.3` @ `7b6c9342980d` (see [metadata-snapshot.md](metadata-snapshot.md)) |
| Metadata snapshot | committed ([metadata-snapshot.json](metadata-snapshot.json)) |
<!-- END generated: at-a-glance -->

## Last action

_**M2 COMPLETE (`/run-milestone M2`) — ROADMAP ☑, two `round-trip-reviewer` sign-offs, all DoD gates
green; NOT pushed.** Branch `m2-full-catalog` (off `m1-codec-skeleton`). The full 22-rule catalog
round-trips by construction through the generated codec, folded in by metadata + one rule-agnostic
generator change (no skeleton growth per rule, AC-034). **Four reviewed slices:** **D1 (`142bbc9`)** —
catalog fold (`CATALOG_RULES` = metadata-derived) + **empty-operand-safe matcher**: the M1 matcher used
`expr and` over a `$`-runtime list that is EMPTY for the six zero-param rules (`this/parent/item/key/
index/value`) → engine `DefinitionError` (verified); reframed `allRequiredPresent`/`isForeignKey` onto
the join-of-empty membership pattern (`joinNames(...) == KEY_NIL`). **D2 (`3925e18`)** — **field-vs-input
disposition** (FR-118): the only two `kind:"constant"` params (`expr.op`, `call.name`) project to block
`fields` (verbatim scalar, key-based presence), dynamic → `inputs`; `kind` is joined onto variant params
in `generateCodec` (`enrichEntry`) — variant params lack `kind`, only rule-level params carry it — so the
generators branch at `@`-time; operators (28 tokens) + functions (4) round-trip with the constant verbatim
in `fields` (FR-041/042, AC-007/008). **D3 (`6dfacdb`)** — full §15.8 corpus: **all 147** engine
`docs.{rules,operators,functions}[*].examples` round-trip (structural + execution identity); import-failure
(ambiguous multi-variant, foreign param, unknown rule, zero-param+foreign) → `transon_unsupported` + exact
preservation (§15.6/FR-055); multi-rule custom marker; workspace-shape (FR-124) over the full 147 + corpus.
**D4 (`69d1472`)** — **AC-034** proof: a synthetic rule folds into the codec via a new
`generateCodec(engine, rules, catalog?)` override with ZERO projection-file change (constant field + dynamic
input + variant match + unsupported); added `runCodecArtifact` (runs any artifact; the seam for M4's runtime
metadata-source policy). **The example corpus caught a real bug the 1st review under-rated as a NIT — the
`object/fields` escape collision:** the M1 literal-marker escape matched `{$:object, fields:X}` by shape and
encoded it as `transon_object_literal`, shadowing the now-folded-in `object`/`fields` RULE — a marker-FREE
`{$:object, fields:{...}}` decoded to a bare literal, dropping the rule wrapper (round-trip AND semantic
break: the rule omits NoContent, the literal errors; that `TypeError` then crashed `runner.py`'s `json.dumps`
and **hung the suite** → orphaned vitest workers). **Fixed surgically** (skeleton, rule-agnostic): the escape
fires ONLY when the `fields` payload itself contains the **active** marker key (`fieldsHasMarkerKey`, §11.4:
"a literal object that must contain the marker key"); a marker-free payload falls through to the rule arm →
`transon_rule_object__fields`. **SPEC-first:** FR-123 + §11.4 refined; `escape.test.ts` + `marker.test.ts`
(custom-marker discrimination — `{@@:object, fields:{$:1}}` → RULE, proving the active-marker check) lock it.
**Test bridge hardened** so this class of failure can never silently hang again: `runner.py` guards
`json.dumps` (returns a structured `SerializationError` instead of crashing); the adapter adds a 30s
per-request timeout + teardown that fails fast (also fixes the zombie-process accumulation seen mid-session).
**763 tests pass** (757 adapter + 6 editor-core); engine-parity (22/28/4), no-codec-mapping + selftest,
traceability, byte-equal codec-regeneration (AD-030), maturity 93%, evals — all green. **2nd
`round-trip-reviewer` verdict: object/fields fix CORRECT + COMPLETE (incl. custom marker), bridge hardening
SAFE, M2 ready to mark done** (one SHOULD-FIX — committed custom-marker escape test — now landed; one NIT:
`{$:object, fields:<non-dict>}` → `CodecError` not `transon_unsupported`, pre-existing invalid-input behavior,
unchanged by the fix). **Next:** push `m1-codec-skeleton` + `m2-full-catalog` and open PR(s) (one branch/PR
per milestone — neither pushed); then **M3** (`/run-milestone M3`): `G_palette`/`G_toolbox` + Blockly Zelos +
the finite behavior runtime. **M3 watch-outs from M2:** the `object/fields` `fields` param is a map-of-templates
with no metadata `kind` for it — the field/input widget projection must handle it; and `{$:object, fields:X}`
renders as the escape (`transon_object_literal`) only for marker-bearing X, else the `object/fields` rule block._

_**Post-M2 deferred-items audit + cleanup (`47b073d`, round-trip-reviewer-signed-off; not pushed).** Swept all
prior-milestone deferrals; closed the actionable ones. **(c)** the M2-review NIT: `{<marker>:object, fields:X}`
with a NON-dict payload (scalar/list/null/bool) now → `transon_unsupported` + exact preservation (was a raw
`CodecError`) via a skeleton guard `isMalformedObjectFields` (checked before the escape; detects a non-mapping
`fields` with `call type`). **Gotcha (regression I caught + fixed):** `expr and` does NOT short-circuit and
`call type` RAISES on `NoContent`, so the `fields` lookup needs a `{}` default — without it, every non-object
node (`expr`/`this`/unknown) threw. SPEC FR-123/§11.4/§15.7 noted; skeleton-only, rule-agnostic (AC-034 holds);
encoder regenerated byte-equal. **(b)** `JsonPathBlockMap` invariants now hold over all 147 engine examples
(unique escaped paths, parent integrity, rule_name count == marker-bearing dicts). **(a)** traceability accuracy
(workspace-shape-validity + blockmap → [x]; §7.5 pins FR-039 done, FR-037/FR-038 → M4). **915 tests; all gates
green.** Reviewer verdict: correct/complete/regression-free, safe (2 doc/comment NITs fixed). **Only remaining
open item across M0–M2: the by-design M-09 CI engine-pin flip** (`--require-engine`), waiting on `transon`
being pip-installable in CI. Everything else (push/PRs aside) is closed._

### Prior last action (M1)

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
- **M2 — full catalog** — ☑ done (committed `142bbc9`→`69d1472` + the closeout, not pushed; two
  `round-trip-reviewer` sign-offs). All 22 rules + every variant round-trip by construction (147 engine
  examples + corpus); constant-field disposition (FR-118); import-failure → `transon_unsupported`;
  AC-034 synthetic-rule proof; object/fields escape-collision fix (FR-123/§11.4 refined); test bridge
  hardened. 763 tests. See **Last action** for detail.
- **M3–M5** — ☐ not started. M3: `G_palette`/`G_toolbox` + Blockly Zelos + the finite behavior runtime.

## Next steps (ordered)

1. **Push the milestone branches + open PR(s)** (one branch/PR per milestone — none pushed yet):
   `m1-codec-skeleton` (M1) and `m2-full-catalog` (M2, off M1). Reference the covered FR/AC IDs. If M1
   should merge to `main` first, rebase `m2-full-catalog` after.
2. **M3** (`/run-milestone M3`): `editor-blockly` — `G_palette` (block defs) + `G_toolbox` (categories)
   projections rendered to Zelos + the finite rule-agnostic behavior runtime; the committed
   presentation-data file (title/category/advanced + colour); headless palette/encoder-load gates.
   **Watch-outs carried from M2:** (a) the `object/fields` `fields` param is a **map-of-templates** with
   no metadata `kind` modelling it — the field/input widget projection (FR-118/127) must handle it; (b)
   `{<marker>:object, fields:X}` is the escape (`transon_object_literal`) only for a **marker-bearing** X,
   else the `object/fields` rule block — the palette/behavior must mirror that disposition; (c) Blockly
   `13.0.0` is introduced at M3 (AD-021). **Regen flow** (if a generator changes): write generators →
   `pnpm --filter editor-core build` → `UPDATE_ARTIFACTS=1` test → rebuild → repeat (the double-build,
   because run.ts bundles the artifacts) → a normal run must be byte-equal.
3. (Deferred, M-09) Pin `transon` in CI and flip `check_engine_parity.py --require-engine` +
   `update_memory.py --check --require-engine` on, once the engine is pip-installable in CI.

## Open blockers / waiting-on

- None blocking M0 — it depends only on owner-controlled inputs (ROADMAP §"Remaining inputs").

## Do-not-relitigate (pointers, not copies)

- Locked decisions → [`ROADMAP.md` §Locked decisions](ROADMAP.md#locked-decisions).
- Architecture decisions `AD-001…AD-032` → [`ARCHITECTURE.md`](ARCHITECTURE.md).
- Golden rules / always-on invariants → [`AGENTS.md`](../AGENTS.md).
