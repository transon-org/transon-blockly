# traceability.md — Requirement Traceability

> **Version:** 2.0 · **Status:** Pre-implementation baseline · **Last updated:** 2026-06-27

> **v2.0 — template-driven projection pivot.** Adds coverage rows for the projection surface
> (`SPEC.md` §7.16, FR-114…FR-121, NFR-046/047, AC-034…AC-036, UC-016, AD-026…AD-031) and extends the
> anti-drift gates: the engine-parity check now compares **pre-derived variant signatures** and
> **resolved enum domains**, a **codec-regeneration** check guards that committed codec artifacts
> match the current metadata (AD-030), and the round-trip corpus is anchored by the
> **round-trip-by-construction** check per rule (AC-035).

Tracks every requirement in [`SPEC.md`](SPEC.md) through to code and tests, per the SPEC-first /
tests-required discipline (`SPEC.md` §21.1, §21.2, §21.13). Architecture is in
[`ARCHITECTURE.md`](ARCHITECTURE.md); the metadata shape in
[`metadata-contract.md`](metadata-contract.md).

> Milestone-level status (M0–M5) lives in [`ROADMAP.md`](ROADMAP.md); this file tracks
> per-requirement-ID coverage.

> **Status legend:** [ ] pending · [~] in progress · [x] done.
> The whole project is **pre-implementation**, so everything below is [ ] until code and tests
> land. Update the row (and add the test reference) in the same change that implements a
> requirement.

## How to keep this current

1. Cite the requirement ID in each test name or comment, e.g.
   `test('imports attr name variant', ...)  // FR-054`.
2. To find an ID's tests, grep the codebase for the ID (e.g. `FR-054`).
3. To list all IDs in the spec, grep `docs/SPEC.md` for `FR-\d+`, `AC-\d+`, etc.
4. Before a PR: every implemented FR must have a referencing test; flag any test that references
   a non-existent or `(deprecated)` ID.

Suggested one-shot check (manual until automated):

```bash
# IDs defined in the spec
grep -oE '\b(FR|AC)-[0-9]+\b' docs/SPEC.md | sort -u > /tmp/spec_ids.txt
# IDs referenced in tests
grep -rhoE '\b(FR|AC)-[0-9]+\b' --include='*.ts' --include='*.tsx' src test \
  | sort -u > /tmp/test_ids.txt
# requirements with no test reference
comm -23 /tmp/spec_ids.txt /tmp/test_ids.txt
```

## Engine-parity checks (anti-drift)

`SPEC.md` declares the Transon engine authoritative (NFR-004, §21.4) and enumerates the
rule/operator/function catalog (FR-040..FR-042, §14.14, §14.15). These hand-lists drift silently
when the engine changes. The following automated checks must exist and pass; they are the primary
defense against spec/engine drift:

| Check | Asserts | Source of truth | Status |
|-------|---------|-----------------|:------:|
| Rule parity | editor supported rule set == the engine rule set | `Transformer.get_rules()` (currently 22: this, parent, item, index, key, value, set, get, attr, object, map, filter, zip, file, join, chain, expr, call, format, include, switch, cond) | [x] `harness/scripts/check_engine_parity.py` |
| Operator parity | editor operator list == engine operators | `transon/operators.py` (`Transformer.get_operators()`) | [x] `harness/scripts/check_engine_parity.py` |
| Function parity | editor function list == engine functions | `transon/functions.py` (`Transformer.get_functions()`) | [x] `harness/scripts/check_engine_parity.py` |
| Variant-signature parity | each rule's pre-derived `variants` are well-formed (ids + `required` flags, params drawn from the rule) | engine editor-metadata export, pre-derived `variants` ([`metadata-contract.md`](metadata-contract.md) §2.5, §3) | [x] `harness/scripts/check_engine_parity.py` |
| Resolved-enum parity | `expr.op`/`call.name` `options` == engine operator/function catalogs | engine export `options` ([`metadata-contract.md`](metadata-contract.md) §2.6) | [x] `harness/scripts/check_engine_parity.py` |
| Metadata export parity | export has the contract shape (split `catalog`/`docs`, per-rule `name`/`params`/`variants`, per-param `kind`, `metadata_version`) | engine `get_editor_metadata()` ([`metadata-contract.md`](metadata-contract.md) §3) | [x] `harness/scripts/check_engine_parity.py` |
| Codec-regeneration | committed codec artifacts (encoder/decoder + palette/toolbox) == re-running `G_*` on the current metadata (compare-only; writes only under `UPDATE_ARTIFACTS=1`) | `G_*` projections + build-time codegen (`SPEC.md` FR-119, AD-030) | [x] encoder/decoder + **toolbox** + **palette**: `test/engine-node-adapter/test/codec/regen.test.ts` |
| Behavior-runtime size | the rule-agnostic behavior runtime gains no per-rule branch as the catalog grows | `SPEC.md` NFR-046, AD-031 | [x] `harness/scripts/check_behavior_runtime_size.py` (+ `--selftest`; rule-dispatch scan + primitive ceiling) + `packages/editor-blockly/test/runtime.test.ts` |
| Workspace-shape validity | encoder output is valid Blockly workspace-serialization JSON over the fixed block vocabulary (`transon_rule_<rule>__<variant>`, `transon_literal`/`transon_array`/`transon_object_literal`/`transon_unsupported`) across the §15.8 corpus | `SPEC.md` FR-124, AD-032 | [x] full §15.8: `test/engine-node-adapter/test/codec/workspace-shape.test.ts` over the M2 corpus + all 147 engine examples |
| `JsonPathBlockMap` produced as the codec walks | the encoder emits the path→block map during the codec walk (not a separate post-pass); every JSON path maps to its block or nearest enclosing block over the §15.8 corpus | `SPEC.md` FR-122, §9.12 | [x] `test/engine-node-adapter/test/codec/blockmap.test.ts` — production + path/parent invariants over all 147 engine examples (rule_name count == marker-bearing nodes; unique escaped paths; parent integrity) |
| No codec↔workspace mapping (repo-scan) | no module under `packages/*/src` maps codec artifacts to/from a `{type, inputs, fields}` block structure | `SPEC.md` FR-126, AD-032 | [x] `harness/scripts/check_no_codec_mapping.py` (+ `--selftest`) |
| Encoder output loads in Blockly | encoder output deserializes via Blockly's workspace loader without error (headless); the decoder consumes Blockly's save output (reverse path) | `SPEC.md` FR-126 | [x] forward (encode→load, 147 examples + M1): `blockly-load.test.ts`; reverse (encode→Blockly load→Blockly save→decode, transparent + type-fidelity): `blockly-resave.test.ts` |
| Palette definitions load | every complete-metadata rule yields a loadable/instantiable Zelos block definition (headless) | `SPEC.md` FR-125 | [x] all 34 defs register + instantiate + structural mutators rebuild inputs: `packages/editor-blockly/test/palette-load.test.ts` |
| Presentation source-scan | no §12.4 category names / order / category→colour map / per-rule title/category/advanced as TypeScript literals under `packages/*/src`; every metadata rule has a presentation-data entry | `SPEC.md` FR-127, NFR-048; [`metadata-contract.md`](metadata-contract.md) §2.9 | [x] `harness/scripts/check_presentation.py` (+ `--selftest`; source-scan + completeness) + `packages/editor-core/test/presentation.test.ts`; data: `packages/editor-core/src/codec/presentation.json` (§2.9) |

A failing parity check means either the engine changed (update the editor + spec together) or the
editor drifted (fix the editor). Never silence the check by editing the expectation without a
corresponding `SPEC.md` change (§21.2).

## Round-trip corpus

Round-trip is the core trust property (`SPEC.md` §7.5, AD-004, AD-011, AC-011). The corpus is
defined in `SPEC.md` §15.8 and must cover: simple literals; literal arrays; literal objects;
literal marker-key objects; every built-in rule; every block variant; nested templates;
docs/example-corpus templates; custom marker configuration; and import-failure cases.

| Corpus group | SPEC ref | Status | Test reference |
|--------------|----------|:------:|----------------|
| Literals (scalar/array/object) | §15.8 | [~] | `test/engine-node-adapter/test/codec/roundtrip.test.ts` (scalar type fidelity, empties, nesting) |
| Literal marker-key object | §15.8, §11.4 | [x] | skeleton-owned escape, marker-bearing payload only (FR-123 M2 refinement): `escape.test.ts` (marker-free `{$:object,fields:X}` → `object/fields` RULE, not the escape); custom-marker escape-vs-rule disposition keys off the active marker: `marker.test.ts` |
| Every built-in rule | §15.8, §14 | [x] | all 22 rules: `test/engine-node-adapter/test/codec/corpus.ts` M2 entries + `roundtrip.test.ts` (structural + execution identity per entry) + `catalog-coverage.test.ts` (FR-040) |
| Every block variant | §15.8, §7.7 | [x] | all rule variants (base, name, names, item, items, key+value, value, values, fields): corpus.ts M2 entries; `catalog-coverage.test.ts` asserts decode case per variant (FR-052/053/054) |
| Nested templates | §15.8 | [x] | `roundtrip.test.ts` (`mixed`, attr-nested) + deep real-world nesting (≥4 levels, e.g. `ExprMonadsComplex`) across the 147 engine examples: `examples-corpus.test.ts` |
| Docs/example-corpus templates | §15.8 | [x] | all 147 engine `docs.{rules,operators,functions}[*].examples` round-trip (structural + execution identity): `test/engine-node-adapter/test/codec/examples-corpus.test.ts` |
| Custom marker configuration | §15.8, FR-063 | [x] | `test/engine-node-adapter/test/codec/marker.test.ts` (runtime marker substitution; one codec serves any marker) |
| Import-failure cases | §15.8, §17 | [x] | ambiguous multi-variant (`expr`/`call` value+values, `map` item+items, `object` key+value+fields), zero-param-with-foreign-key, unknown rule, foreign param, **and non-dict `object.fields` payload** (§15.7) → `transon_unsupported` + exact preservation (AD-004): `test/engine-node-adapter/test/codec/unsupported-variants.test.ts` |
| Round-trip by construction (per rule, generated codec) | §15.1, FR-115, AC-035 | [x] | full catalog (all 22 rules): `test/engine-node-adapter/test/codec/roundtrip.test.ts` (structural + execution identity); `catalog-coverage.test.ts` (FR-040, AC-006, AC-035) |
| Self-hosting projection template | §7.16, FR-121, UC-016, AC-036 | [~] | M3: `G_palette`/`G_toolbox` are in-surface — encode→decode to structural identity, no `transon_unsupported`: `test/engine-node-adapter/test/codec/ac036-selfhosting.test.ts`; full self-hosting UI demo (UC-016, opening a projection in the running editor) is M5 |
| Workspace-shape invariant (per corpus entry) | §15.8, FR-124, AD-032 | [x] | `test/engine-node-adapter/test/codec/workspace-shape.test.ts` (full M2 corpus + all 147 engine examples; 22 rules + all variants + constant fields + out-of-surface + literals) |

## Acceptance criteria coverage (§20)

ACs are the v1 acceptance gate. Each must be demonstrated by at least one test.

| AC | Summary | Status | Test reference |
|----|---------|:------:|----------------|
| AC-001 | Visual editor loads (sandbox panels) | [x] | sandbox renders canvas + generated-JSON + input + output + toolbar + status: `packages/editor-ui/test/sandbox.test.tsx` |
| AC-002 | Simple `attr` rule template | [ ] | |
| AC-003 | Nested template | [ ] | |
| AC-004 | Literal object | [ ] | |
| AC-005 | Literal marker-key object | [ ] | |
| AC-006 | All built-in rules available | [x] | all 22 rules folded into the generated codec: `test/engine-node-adapter/test/codec/catalog-coverage.test.ts` (enc__<name> fragment per rule + decode case per variant); `roundtrip.test.ts` (structural + execution identity) |
| AC-007 | Operators available | [x] | all 28 operator tokens (14 canonical + 14 aliases) round-trip with `fields.op` verbatim: `test/engine-node-adapter/test/codec/operators.test.ts` (FR-041) |
| AC-008 | Functions available | [x] | all 4 function names round-trip with `fields.name` verbatim: `test/engine-node-adapter/test/codec/operators.test.ts` (FR-042) |
| AC-009 | Import supported template | [~] | `attr` + structural via the generated decoder: `test/engine-node-adapter/test/codec/decode.test.ts` (full UI import M4) |
| AC-010 | Export generated template | [~] | generated encoder: `test/engine-node-adapter/test/codec/encode.test.ts` (full UI export M4) |
| AC-011 | Strict semantic round-trip | [x] | full 22-rule catalog: `test/engine-node-adapter/test/codec/roundtrip.test.ts` (structural + execution identity for all corpus entries) |
| AC-012 | Validation with engine | [x] | validate flow via host engine (valid/invalid → template_definition): `test/engine-node-adapter/test/ui/host-exec.test.ts` |
| AC-013 | Runtime execution with engine | [x] | execute flow via host engine: `test/engine-node-adapter/test/ui/host-exec.test.ts` |
| AC-014 | Output preview | [x] | execution output folded into the session + Output panel: `host-exec.test.ts`, `packages/editor-ui/src/components/panels.tsx` |
| AC-015 | Runtime error visibility | [x] | runtime_transformation surfaced + prior output kept stale (§17.8): `test/engine-node-adapter/test/ui/host-exec.test.ts` |
| AC-016 | Validation error visibility | [x] | validation error → template_definition in the error list (FR-095, §16.4): `host-exec.test.ts`, `panels.tsx` |
| AC-017 | Error-to-block mapping | [x] | error→block highlighting via the path-index↔block_map (exact, nearest-parent, or root fallback): `packages/editor-ui/test/highlight.test.ts`; path-index↔block_map agreement over real encoded docs: `test/engine-node-adapter/test/ui/path-index.test.ts` |
| AC-018 | Example loading | [ ] | |
| AC-019 | Example expected output | [ ] | |
| AC-020 | Tooltip from metadata | [ ] | |
| AC-021 | No backend persistence | [ ] | |
| AC-022 | Embeddable component | [ ] | |
| AC-023 | Host engine runtime loading state | [x] | store mirrors `EngineProvider.status` (absent/idle/loading/ready/failed) + StatusBar display (NFR-028): `packages/editor-ui/test/engine-status.test.ts`, `panels.tsx`; the Pyodide host lifecycle idle→loading→ready/failed: `examples/reference-host/test/provider.test.ts` |
| AC-024 | Captured file writes | [x] | `file` writes captured into files_written (no fs write) + Files panel: `test/engine-node-adapter/test/ui/host-exec.test.ts`, `panels.tsx` (FilesPanel) |
| AC-025 | Include loader behavior | [x] | include resolves through configured includes, unresolved → include_loader (§16.6): `test/engine-node-adapter/test/ui/host-exec.test.ts`; dynamic JS callback in the Pyodide host: `examples/reference-host/test/provider.test.ts` |
| AC-026 | Custom marker | [ ] | |
| AC-027 | Tests (generation/import/export/round-trip/...) | [ ] | |
| AC-028 | Metadata-driven generic block (gated on metadata-contract §3) | [x] | a synthetic rule's blocks (constant field + dynamic input, 2 variants) are projected from metadata alone via the committed generators: `test/engine-node-adapter/test/codec/projection-coverage.test.ts` |
| AC-029 | Block variants for mutually exclusive parameters | [x] | per-variant blocks for every multi-variant rule (`attr`/`object`/`map`/`expr`/`call`): `catalog-coverage.test.ts`, `roundtrip.test.ts`; mutually-exclusive groups present together → `transon_unsupported`: `unsupported-variants.test.ts` |
| AC-030 | Variant import matching | [x] | exact per-variant match; ambiguous/partial/foreign → `transon_unsupported` with exact preservation (§15.6): `test/engine-node-adapter/test/codec/unsupported-variants.test.ts` |
| AC-031 | Sandbox mode | [x] | §12.1 panel set present: `packages/editor-ui/test/sandbox.test.tsx` |
| AC-032 | Compact editor mode | [x] | canvas + palette + Visual\|JSON\|Split switch, no required input/output panels: `packages/editor-ui/test/compact.test.tsx` |
| AC-033 | Bidirectional JSON editing (strict in-surface) | [x] | accept/reject decision via encode→surface→round-trip (real engine): `test/engine-node-adapter/test/ui/reverse.test.ts`; controller response — accepted loads + in_sync, rejected leaves workspace UNCHANGED + out_of_sync: `packages/editor-ui/test/sync.test.tsx` |
| AC-034 | Projection coverage: new rule across all surfaces, no editor/projection change | [x] | `generateCodec` projects a synthetic rule via the committed generators + skeleton with a catalog override only (zero projection-file edit); it encodes/decodes/round-trips + field-vs-input disposition: `test/engine-node-adapter/test/codec/projection-coverage.test.ts` (the default codec excludes it — committed artifacts unaffected) |
| AC-035 | Round-trip by construction (generated encoder/decoder, per rule) | [x] | full 22-rule catalog (encoder+decoder from one metadata source; structural + execution identity): `test/engine-node-adapter/test/codec/roundtrip.test.ts`; `catalog-coverage.test.ts` asserts enc + dec arms for all rules/variants |
| AC-036 | Self-hosting projection template loads + round-trips | [~] | M3: `G_palette`/`G_toolbox` in-surface round-trip (`ac036-selfhosting.test.ts`); full editor self-hosting demo M5 |
| AC-037 | Presentation (title/category/advanced/colour) from data, not TypeScript; synthetic-rule projection test | [x] | synthetic `greet` rule → palette block + toolbox category from presentation data, runtime untouched (NFR-046): `test/engine-node-adapter/test/codec/ac037-presentation.test.ts` |
| AC-038 | On-canvas structural mutators (array items / object key-value fields) | [x] | mutator mechanics + editable scalar field (FR-015): `packages/editor-blockly/test/mutator.test.ts`; round-trips identically to JSON-authored (real engine): `test/engine-node-adapter/test/ui/mutator-roundtrip.test.ts`; rule-agnostic (NFR-046, 4 fixed primitives): `check_behavior_runtime_size.py` |

## Functional requirement coverage (§7)

Tracked by SPEC subsection. Expand into per-ID rows as each is implemented; record the
implementing module and the test that cites the ID.

| Subsection | Requirement IDs | Status | Notes |
|------------|-----------------|:------:|-------|
| §7.1 Editor shell and modes | FR-001..FR-011 | [~] | M4 D1 store + D2 shell: sandbox (§12.1) + compact (§12.2) React modes over the EditorController (mount + forward + status), Visual\|JSON\|Split view switch, New/Validate/Run/Toggle toolbar — `packages/editor-ui/test/{sandbox,compact,toolbar,mount}.test.tsx`, `{store,forward,no-engine,engine-status}.test.ts`; FR-011 onChange/onValidate/onExecute wired in the controller; full embedding API (FR-102..110) is M5 |
| §7.2 Blockly workspace | FR-012..FR-018 | [~] | FR-012/013/014 templates/nesting/literals as projected Zelos blocks that load + connect headlessly: `packages/editor-blockly/test/palette-load.test.ts`, `test/engine-node-adapter/test/codec/blockly-load.test.ts`; **FR-015 editable scalar literal** (typed JSON, fidelity-preserving) + on-canvas array/object add-remove (AC-038, §13.13): `packages/editor-blockly/test/mutator.test.ts`; interactive Zelos mount (AD-017/018): `packages/editor-ui/test/mount.test.tsx`; FR-016 rule-vs-literal distinction: `palette.test.ts`; FR-017 comments + FR-018 no-raw-edit M5 |
| §7.3 Transon JSON generation | FR-019..FR-026 | [~] | encoder over `attr` + literals/array/object: `test/engine-node-adapter/test/codec/encode.test.ts` (marker key, params, omit-empty); M4 D1 forward flow (workspace→JSON via `decode`, gated on engine-ready §10.4): `test/engine-node-adapter/test/ui/forward.test.ts` (real engine: generation == document, block map populated), `packages/editor-ui/test/forward.test.ts` (gating/wiring) |
| §7.4 Import from Transon JSON | FR-027..FR-034 | [~] | decoder + unsupported placeholder: `test/engine-node-adapter/test/codec/decode.test.ts`, `encode.test.ts` (out-of-surface → `transon_unsupported`, §13.11); full surface check (§15.7) continues past M1 |
| §7.5 Round-trip | FR-035..FR-039 | [~] | FR-035/036 full 22-rule catalog: `roundtrip.test.ts` (structural + execution identity); **FR-039** automated round-trip tests across all built-in rules: `roundtrip.test.ts` + `examples-corpus.test.ts` (147 engine examples) + `catalog-coverage.test.ts`; **FR-037** (§11.5 UI-only attributes) + **FR-038** (clear report when strict round-trip not guaranteed) are UI-surfacing → M4 |
| §7.6 Rule coverage | FR-040..FR-044 | [~] | FR-040 all 22 rules folded in + CATALOG_RULES metadata-derived: `catalog-coverage.test.ts`; FR-041 all 28 operator tokens (14+14 aliases): `operators.test.ts`; FR-042 all 4 functions: `operators.test.ts`; FR-044 toolbox grouping by §12.4 category + FR-043 metadata-derived rule/category names: `toolbox.test.ts` (`G_toolbox` projection); FR-043 palette labels show title+rule name (OQ-008): `palette.test.ts` |
| §7.7 Rule parameters and variants | FR-045..FR-058 | [~] | FR-045 required params, FR-046 optional omission, FR-052/053/054 variant model + per-variant matching: `roundtrip.test.ts` (all corpus entries), `catalog-coverage.test.ts` (dec case per variant); FR-055 no silent rewrite: unsupported entries in corpus + `encode.test.ts`; FR-047 constant-vs-dynamic distinction + FR-118 field-vs-input disposition: `operators.test.ts` (constant `op`/`name` → `fields`, dynamic params → `inputs`; encoder+decoder, all variants); FR-058 constant-choice UI (M5, pending) |
| §7.8 Literal object / marker escaping | FR-059..FR-063, FR-123 | [x] | skeleton-owned escape, precedence + `transon_object_literal` (FR-059/060/061/062/123); **M2 FR-123 refinement**: escape fires only for a marker-bearing `fields` payload — a marker-free `{<marker>:object,fields:X}` is the `object`/`fields` RULE (`transon_rule_object__fields`), not the escape: `escape.test.ts`; custom marker (FR-063): `marker.test.ts` |
| §7.9 Validation | FR-064..FR-070 | [~] | engine `Transformer.validate()` via host `EngineProvider`, folded into the session + error list (AC-012/016, §16.4 template_definition): `test/engine-node-adapter/test/ui/host-exec.test.ts`, `packages/editor-ui/src/session/validate.ts`; gated when no engine (§10.4); FR-068 incomplete-workspace detection deferred (D-future) |
| §7.10 Execution preview | FR-071..FR-076 | [~] | engine `transform()` via host `EngineProvider`: output + captured `file` writes + `include` loader + runtime errors with stale output (AC-013/014/015/024/025, §16.4/§16.5/§17.8): `test/engine-node-adapter/test/ui/host-exec.test.ts`, `packages/editor-ui/src/session/execute.ts`; `json_input` validation: `packages/editor-ui/test/input.test.tsx`; expected-vs-actual examples M5 |
| §7.11 Documentation, metadata & block generation | FR-077..FR-090, FR-127 | [~] | FR-084/088/089 metadata-projected Zelos block defs (`G_palette`): labels, param inputs, FR-118 widget (dynamic→`input_value`, constant+options→`field_dropdown`, constant→`field_input`), required structure — `test/engine-node-adapter/test/codec/palette.test.ts`; FR-090 baseline-not-polished; FR-127 presentation/category/colour from data (`presentation.json` + `check_presentation.py`); headless load FR-125 in editor-blockly (D3); FR-077..083/085..087 host/diagnostics M4/M5 |
| §7.12 Error mapping | FR-091..FR-095, FR-122 | [x] | `JsonPathBlockMap` produced as the codec walks (FR-091/094/122, §9.12): `blockmap.test.ts`; M4 D4 consumes it — error→block highlighting (exact / nearest-parent FR-094 / root fallback) on the rendered workspace via the path-index↔block_map (FR-092/093, AC-017): `packages/editor-ui/test/highlight.test.ts`, `test/engine-node-adapter/test/ui/path-index.test.ts`; error taxonomy display, not colour-only (FR-095, NFR-045): `packages/editor-ui/src/components/panels.tsx` (ErrorList), `test/input.test.tsx` |
| §7.13 Import / export UX | FR-096..FR-101 | [ ] | |
| §7.14 Component embedding | FR-102..FR-110 | [ ] | component API |
| §7.15 Bidirectional JSON editing | FR-111..FR-113 | [x] | strict in-surface sync via the generated encoder + round-trip gate (AD-024): `tryReverse` (parse→encode→surface check for transon_unsupported→re-decode round-trip) — `test/engine-node-adapter/test/ui/reverse.test.ts` (accept in-surface; reject malformed→json_template, out-of-surface→import_unsupported); FR-111 accepted edit syncs to blocks + in_sync, FR-112/113 rejected edit reported + workspace UNCHANGED + out_of_sync: `packages/editor-ui/test/sync.test.tsx`; editable JSON panel: `packages/editor-ui/src/components/panels.tsx` |
| §7.16 Template-driven projection surface | FR-114..FR-121, FR-124..FR-126 | [~] | Full 22-rule catalog + `G_encode`/`G_decode` projections; FR-118/FR-124 field-vs-input disposition from `kind` (D2): constant params → `fields`, dynamic params → `inputs` via entry enrichment + @-time filtering (`packages/editor-core/src/codec/codegen.ts`); `operators.test.ts`; FR-120 new-rule-from-metadata: `projection-coverage.test.ts`; FR-114 `G_palette`/`G_toolbox` projections committed + byte-equal regen: `regen.test.ts`, `palette.test.ts`, `toolbox.test.ts`; FR-125 headless palette-load + FR-126 encoder-load: `packages/editor-blockly/test/palette-load.test.ts`, `blockly-load.test.ts`; FR-121 M3 projections in-surface (`ac036-selfhosting.test.ts`), full self-hosting demo M5 |

## Non-functional & architecture decisions

NFRs (§8) and ADs ([`ARCHITECTURE.md`](ARCHITECTURE.md) §3) are largely verified by
integration/security tests and review rather than 1:1 unit tests. Key ones expected to have
dedicated tests:

| ID | Summary | Verified by | Status |
|----|---------|-------------|:------:|
| NFR-001..005 / AD-003 / AD-004 | Correctness, semantic preservation, round-trip | round-trip corpus + engine parity | [ ] |
| AD-008 | Engine is a host-provided port; authoring works engine-free | `EngineProvider` mock + integration tests (`packages/editor-core/test/ports.test.ts`, `test/engine-node-adapter/test/adapter.test.ts`) | [~] |
| AD-011 | Execution-based round-trip verification | round-trip corpus (Node engine adapter) (`test/engine-node-adapter/test/adapter.test.ts`, `…/adapter.markers.test.ts`) | [~] |
| NFR-030 / §21.11 | No arbitrary Python outside the engine runtime | engine/runtime isolation tests | [ ] |
| NFR-035 / AD-009 | `file` writes captured, not written to disk | execution tests (AC-024) | [ ] |
| AD-010 | `include` resolved via host loader; missing loader reported | execution tests (AC-025) | [ ] |
| NFR-036..039 / NFR-040 / AD-012 | Metadata schema versioning + mismatch detection | see metadata-contract.md §5; typed snapshot loader (`packages/editor-core/test/snapshot.test.ts`) | [~] |
| AD-026 / FR-114/115/120 / AC-034 | Editor surface = projections of metadata; new rule, no editor/projection change | projection-coverage test + codec-regeneration check | [x] all 22 rules projected from metadata; codec-regeneration byte-equal (`regen.test.ts`); a synthetic rule folds in via a catalog override with no projection change (`projection-coverage.test.ts`, FR-120/AC-034/AC-028) |
| AD-027 / FR-116 | Distinct-marker staging (`@`/`$`); `include` default-marker inheritance; no `eval` | generator staging tests (`test/engine-node-adapter/test/adapter.markers.test.ts`); engine `include` marker test (engine repo) | [~] codec `@`→`$` projection + self-`include` recursion: `…/adapter.markers.test.ts`, `…/adapter.includes.test.ts`, `…/codec/regen.test.ts` |
| AD-028 / FR-117 | Codec = skeleton + projected arms; skeleton owns invariants | codec-skeleton unit tests (recursion/ordering/marker-escape/surface) | [~] skeleton (dispatch/recursion/ordering/unsupported): `test/engine-node-adapter/test/codec/encode.test.ts`, `roundtrip.test.ts`, `ceiling.test.ts` (marker-escape M1-follow-on) |
| AD-029 / FR-118 | `switch`/`cond` lazy dispatch + field-vs-input disposition from `kind` in the generated codec | dispatch + lazy-branch tests; disposition: `operators.test.ts` (all 28 ops + 4 fns with constant param → `fields`, dynamic → `inputs`; decode reverses) | [~] disposition D2 done: `operators.test.ts`; full switch/cond lazy-branch tests (engine repo) pending |
| AD-030 / FR-119 | Build-time codegen of committed artifacts; runtime exec via host | codec-regeneration check + host execution tests (two-pass generate-then-run proven in `test/engine-node-adapter/test/adapter.markers.test.ts`) | [~] committed artifacts + byte-equal regen + host-executed round-trip: `test/engine-node-adapter/test/codec/{regen,roundtrip}.test.ts` |
| AD-031 / NFR-046 | Finite rule-agnostic behavior runtime; no per-rule growth | behavior-runtime size check | [x] runtime (`packages/editor-blockly/src/runtime.ts`: 1 field + 3 structural mutators) + `check_behavior_runtime_size.py` + `packages/editor-blockly/test/runtime.test.ts` |
| AD-032 / FR-124/126 | No hand-written codec↔Blockly mapping; codec emits/consumes workspace JSON directly | workspace-shape validator + encoder-loads-in-Blockly + repo-scan gates | [x] workspace-shape validator + FR-126 Blockly-load (`blockly-load.test.ts`) + repo-scan: `workspace-shape.test.ts`, `check_no_codec_mapping.py` |
| FR-125 | Palette block definitions are valid/loadable Zelos | headless palette-load gate | [x] `packages/editor-blockly/test/palette-load.test.ts` |
| FR-127 / NFR-048 | Presentation/category/colour from metadata or projection data, single committed source | presentation source-scan + completeness check; AC-037 synthetic-rule test | [ ] |
| NFR-047 | Split structural / examples metadata payload | metadata-shape test (structural catalog excludes examples/docs) (`packages/editor-core/test/snapshot.test.ts`) | [~] |

## Open questions

OQ-001..009 were ratified at v1.1 and OQ-010..017 at v2.0; all are folded into requirements. The
decision table and the "folded into" references are in [`ROADMAP.md`](ROADMAP.md) §"Open questions".
No editor open questions remain blocking; the projection requirements (FR-114..121, NFR-046/047,
AC-034..036, UC-016, AD-026..031) and bidirectional-editing requirements (FR-111..113, AC-033) are
tracked in the tables above.
