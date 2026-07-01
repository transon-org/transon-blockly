# Current state — working handoff

> **Non-authoritative working memory** (G-06). A session-to-session handoff, not part of the
> contract. Where this and the contract docs (`SPEC.md`, `ARCHITECTURE.md`, `ROADMAP.md`,
> `AGENTS.md`) disagree, **they win**. Update the narrative below at the end of a work session;
> regenerate the header with `python harness/scripts/update_memory.py --state`.

<!-- BEGIN generated: at-a-glance · python harness/scripts/update_memory.py --state -->
| | |
|---|---|
| Repo HEAD | `1cf0be6` — editor: M5 review — depth-cap CodecError is a runtime limit, not "unsupported" |
| Branch | `m5-react-embedding` |
| Engine pin | transon `v0.1.3` @ `7b6c9342980d` (see [metadata-snapshot.md](metadata-snapshot.md)) |
| Metadata snapshot | committed ([metadata-snapshot.json](metadata-snapshot.json)) |
<!-- END generated: at-a-glance -->

## Last action

_**M5 COMPLETE (`/run-milestone M5`) — ROADMAP ☑, `round-trip-reviewer`-signed-off, all DoD gates green;
NOT pushed.** Branch `m5-react-embedding` (off `m4-editor-ui`). The complete consumer-facing surface:
React entry, examples, embedding, progressive disclosure, self-hosting, accessibility. **SPEC-first
(`26691ee`):** ratified **FR-128** (theming = scoped `--transon-*` CSS custom properties, chrome-only;
block/category colours stay data-driven, FR-127) + **AC-039** (accessibility baseline binds the §19.5
suite to a checkable DoD) — both were `should`-level with no contract/DoD; user-approved the minimal
designs. **Slices:** **D0 (`4404b3d`)** `@transon/editor-react` — `<TransonEditor ref>` with React as a
**PEER** (internals + Blockly bundled, React/engine external; a build test proves peer-not-bundled,
AD-019) + embedding callbacks carry the engine `ValidationResult`/`ExecutionResult` payloads
(`validate.ts`/`execute.ts` now RETURN the result; the controller threads it — FR-011/105/106).
**D1 (`b68b1f6`)** embedding config over the one `EditorControllerOptions` funnel: read-only (FR-107,
gates reverse edits + New), chrome-only CSS-var theming (FR-108/128, only `--transon-*` keys on the shell
root), configurable §12.4 categories (FR-109, `filterToolbox` over a COPY, unknown names reported),
custom-marker import+export round-trip (FR-110/AC-026, real engine), `<transon-editor>` event payloads in
`detail` (FR-011). **D2 (`0ddb2bd`)** `buildExampleCorpus` (147 raw docs examples → **89 content-deduped**
`ExampleCase`; the 44 dups are one example under several operators) + Examples picker + `loadExample`
(template+input+expected; InputPanel re-keyed on `selected_example`) + OutputPanel expected-vs-actual with
a **non-colour** ✓matches/✗differs label (FR-009/075/076/079/099, AC-018/019); new session field
`expected_output_json`. **D3 (`2edf480`)** toolbar Import (file → §7.15 gate)/Copy/Download (Blob,
canonical-only §11.6) + FR-101 `confirmReplace` unsaved guard (empty ws → no prompt) + no-backend
(FR-096…101, AC-021). **D4 (`5a49cfb`)** metadata tooltips (FR-078/AC-020 via `ruleTooltip` enriching
palette defs in `blocks.ts`, graceful FR-077), engine+metadata versions in the StatusBar (FR-080,
`loadEngineVersions`, NFR-040 mismatch flag), FR-058 dropdown cited, **§12.6 progressive disclosure**
(`progressiveToolbox`: advanced-blocks toggle + palette search — **data-driven from committed
`presentation.json`, NO `G_toolbox` regen** → codec byte-unchanged; via `mount.setToolboxView`→
`updateToolbox` + `controller.setPaletteView` + Toolbar toggle/search). **D5 (`630186f`)** self-hosting
through the running editor (UC-016): the §7.15 import gate ACCEPTS `G_palette`/`G_toolbox` (in-surface +
round-trip faithful) + forward regenerates them identically; the deepest `G_encode`/`G_decode` exceed the
host-stack recursion ceiling (§6.5) → rejected cleanly. **D6 (`689a50c`)** accessibility: committed scoped
light-DOM stylesheet (`styles.ts`: AA-contrast `--transon-*` tokens + `:focus-visible`, injected by the
mount) + ARIA audit (labels on every panel/region, canvas `role=region`, status `role=status`/`aria-live`,
textareas labelled) + deterministic jsdom **axe-core** scan (0 critical/serious ARIA violations).
**Real-browser verified** via the reference-host (Playwright MCP): axe **0 violations incl. contrast**,
`:focus-visible` 2px outline, and the in-browser **Pyodide engine reaches `ready`** — closing M4 watch-out
(c) that Pyodide load was CI-unverified. **Independent `round-trip-reviewer` (maker≠checker): SAFE TO
MERGE** — verified **codec byte-identity** (editor-core tree hash IDENTICAL to M4 `282fce6`, zero
drift/regen), refuted every concern (marker consistency under 5 adversarial probes, faithful self-hosting,
un-weakened import gate + `guardReplace` can't skip the surface check, purely-additive callbacks/
`expected_output_json`); one SHOULD-FIX — the §6.5 depth-cap `CodecError` was mislabelled
`import_unsupported` (≡ a §15.7 surface violation) — **fixed (`1cf0be6`)** → `runtime_transformation`
(faithful to the engine `TransformationError`) + a D5 assertion. **1551 tests** (core 12 + blockly 20 +
ui 92 + element 12 + react 5 + adapter 1403 + reference-host 7); typecheck + no-codec-mapping +
behavior-runtime-size + presentation + engine-parity + traceability + maturity + evals — all green.
**Key M5 mechanics learned:** the three surfaces share ONE `EditorControllerOptions` (config lands once);
editor-react must BUNDLE the private internals (editor-ui is `private:true`) while keeping react a peer;
docs example names are NOT unique (dedupe by content); an uncontrolled InputPanel needs a `key` to reflect
a programmatic example-input load; progressive disclosure stays FR-127-clean by reading `presentation.json`
(not a TS rule list); a `<footer role=status>` trips axe (footer's implicit contentinfo) → use a `div`;
the depth ceiling makes the editor's own G_encode/G_decode un-openable (clean reject), so AC-036 scopes to
palette/toolbox ("at least one"). **Next:** push `m1`/`m2`/`m3`/`m4`/`m5` + open PR(s) — **M0–M5 all
complete**, none pushed. Remaining known item: the by-design M-09 CI engine-pin flip (`--require-engine`),
waiting on `transon` pip-installable in CI. **M5 follow-ups (non-blocking):** the Playwright/axe browser
checks were run live via MCP (verified) but NOT committed as a CI job — a `@playwright/test` +
`@axe-core/playwright` e2e job against the built reference-host would make contrast/keyboard/Pyodide checks
CI-gated; real engine errors still carry only a text location trail (highlighting falls back to root) —
structured paths need an engine change._

### Prior last action (M4)

_**M4 COMPLETE (`/run-milestone M4`) — ROADMAP ☑, `round-trip-reviewer`-signed-off, all DoD gates green;
NOT pushed.** Branch `m4-editor-ui` (off `m3-editor-blockly`). The runnable editor in both UI modes,
wired to a host engine that runs user templates **and** the projection codecs (AD-030). Three new
packages: `@transon/editor-ui` (private React UI), `@transon/editor-element` (public, ESM + IIFE), and
`examples/reference-host` (the Pyodide demo host, AD-025). **SPEC-first (`1902f64`):** resolved the design
STOPs — §10.4/§17.9 corrected so the visual⇄JSON projection is **engine-gated** (the prior "engine-free
generation" was superseded pre-pivot text; under AD-026/030 generation/import run the codec through the
host engine), ARCH §6/§6.4 encode/decode naming fixed (forward=`decode`, reverse=`encode`), and AC-038 +
§13.13 on-canvas mutators moved out of "Future". **Slices:** **D0 (`4da6c18`)** scaffold + AD-021 pins
(React 18.3.1, @vitejs/plugin-react 5.2.0, jsdom 27.4.0); **D1 (`58b6dd6`)** the framework-agnostic
`EditorSession` store (§9.3 + flow fields) + forward projection (workspace→JSON via core `decode`+`blockMap`,
gated on engine-ready) + §16.4 taxonomy; **D2 (`204c0ac`)** the React shell (sandbox §12.1 / compact §12.2
over the `EditorController`) + the interactive light-DOM Zelos mount (AD-017/018 — **Blockly 13 `inject`
works under jsdom** with the En locale + SVG/canvas stubs in `test/setup.ts`) + editable
`field_transon_scalar` (FR-015) + AC-038 +/- mutators (**object keys became editable `KEY{i}` fields
collected back into `extraState.keys`**, decoder contract unchanged); **D3 (`b9703d2`)** validate/execute
via the host (AC-012…016) + captured `file` writes (AC-024) + include loader pre-resolved map & dynamic JS
callback (AC-025) + `json_input` validation + engine status (AC-023) + the Pyodide `createPyodideHost`
(glue mirrors `runner.py` over a JSON-string boundary, no `eval`); **D4 (`8f698a4`)** error→block
highlighting via a path-index↔block_map walk (Blockly API only, scan-clean) resolving exact/nearest-parent/
root (FR-091…095, AC-017); **D5 (`e32e04a`)** strict §7.15 sync (`tryReverse`: parse→encode→surface-check→
round-trip gate; accept loads, reject leaves the workspace unchanged — FR-111…113, AC-033, AD-024); **D6
(`8b0b9ba`)** `createTransonEditor()` + `<transon-editor>` (light DOM, ESM + self-contained IIFE, **ships no
engine** AD-019/020/008, AC-022) + the runnable Pyodide playground. **Independent `round-trip-reviewer`
(maker≠checker) refuted every concern except one MUST-FIX** — the §7.15 surface check matched the bare
token `transon_unsupported` ANYWHERE in the serialized block, so an in-surface document whose *data*
contained that string was wrongly rejected (FR-111 break) — **fixed (`98e70eb`)** with a structural
block-type walk (`Object.values` + `.type`, gate-clean) + a 4-case regression; reviewer also confirmed
scalar type-fidelity, object-key round-trip, path-index, forward unwrap, and the no-engine IIFE all sound.
**Key M4 mechanics learned:** an empty Blockly workspace serializes to `{}` (save() omits empty sections);
the store's `workspace` is the Blockly ENVELOPE, the codec's `decode` takes the unwrapped top block;
`setWarningText` needs a RENDERED (injected) workspace to register a WARNING icon (headless doesn't); an
out-of-surface doc round-trips too (via the exact-preserving placeholder), so the SURFACE CHECK (not the
round-trip gate) rejects it; the editor-ui↔adapter dep must stay one-directional (a circular dev-dep
breaks turbo `^build`) — the §7.15 controller integration mocks `tryReverse` instead. **1477 tests**
(core 12 + blockly 16 + ui 41 + element 12 + adapter 1389 + reference-host 7); build + typecheck + all gates
green. **Next:** push `m1`/`m2`/`m3`/`m4` + open PR(s); then **M5** (`/run-milestone M5`): `@transon/
editor-react`, example expected-vs-actual UX, import/export UX (FR-096…110), full embedding API
(FR-102…110), accessibility, the self-hosting demo. **M5 watch-outs from M4:** (a) the JSON-panel
controlled-textarea reflects `template_json` only while in_sync (preserves the edit while out_of_sync);
(b) real engine errors carry only a text location trail (not a structured path), so highlighting falls
back to the root block — structured paths would need an engine change; (c) the Pyodide host's real
in-browser load is unverified by CI (jsdom can't load Pyodide) — verify it in a browser / M5 Playwright;
(d) the IIFE no-engine assertion skips if `dist/iife.js` is absent (the dep+source scans always run)._

### Prior last action (M3)

_**M3 COMPLETE (`/run-milestone M3`) — ROADMAP ☑, `round-trip-reviewer`-signed-off, all DoD gates green;
NOT pushed.** Branch `m3-editor-blockly` (off `m2-full-catalog`). The metadata catalog is projected to the
full Blockly surface — palette + toolbox + the finite rule-agnostic behavior runtime — folded in by metadata
+ the `G_palette`/`G_toolbox` projections + the committed `presentation.json`, with **no per-rule code**
(AC-037/NFR-046). **Slices:** **D0 (`12b2751`)** — new `@transon/editor-blockly` package (Blockly `13.0.0`
pinned, AD-021; engine-free, loads the committed artifacts) + `presentation.json` (metadata-contract §2.9
single source: per-rule title/category/advanced + categoryOrder + categoryColour + structuralBlocks/
structuralTitles/unsupportedColour) + typed loader + `check_presentation.py` (FR-127/NFR-048 source-scan that
strips comments + completeness). **D1 (`e17b28f`)** — `G_toolbox` (single-stage `@`-marker projection — the
toolbox is loaded, not executed) → committed `artifacts/toolbox.json`: 13 §12.4 categories in order, colours
from data, block-type names derived in-projection. **D2 (`16d59ca`)** — `G_palette` → committed
`artifacts/palette.json`: 34 Zelos defs (30 rule variants + 4 structural). The FR-118 widget decision is made
IN the projection via `@:cond` (dynamic→`input_value`, constant+options→`field_dropdown` from the resolved
enum, constant→`field_input`), mirroring the encoder's `kind`-based disposition so palette block == encoder
block; label "<title> (<rule>)" (OQ-008); colour = category colour; `object/fields` → single value input (M2
STOP-3). **D3a (`3b2e515`)** — the behavior runtime (`packages/editor-blockly/src/runtime.ts`): the ONLY
first-party Blockly code — a custom `field_transon_scalar` (any JSON scalar) + 3 structural mutators
(array/object/unsupported) that rebuild ITEM{n}/VALUE{n} inputs from the encoder's UI-only extraState in
`loadExtraState` (Blockly runs it BEFORE attaching connections). Keyed by structural vocabulary, NEVER by rule
name (NFR-046). `blocks.ts`: registerTransonBlocks + the structure-blind envelope wrap (`toWorkspaceState`,
§11.5). + FR-125 gate (all 34 defs register + instantiate headlessly) + FR-126 forward gate (the full
147-example + M1 corpus encode→loads in headless Blockly, 1 top block each). **One rule-agnostic skeleton
change drove this:** the encoder's array arm now emits `extraState.items` (item indices) so the array mutator
can rebuild ITEM{n} — Blockly ERRORS on a connection to an undeclared input (verified), and counting inputs
in TS would violate the no-codec-mapping scan (FR-126c); symmetric with object_literal's extraState.keys,
decode ignores it → round-trip unchanged, encoder.json regenerated byte-equal. **D3b (`cd18877`)** — the
NFR-046 `check_behavior_runtime_size.py` gate (no rule-name dispatch literal + a bounded primitive count ==
the declared BEHAVIOR_PRIMITIVES list; found+fixed: the field register went through an alias the count regex
missed → register directly) + AC-037 (a synthetic `greet` rule projects into palette+toolbox from data,
runtime untouched) + AC-036 (G_palette/G_toolbox are in-surface — encode→decode to identity, no
transon_unsupported). **Independent `round-trip-reviewer` (maker≠checker) refuted nothing in M3 scope; one
SHOULD-FIX:** Blockly's save() drops an empty `inputs:{}`, so a Blockly-resaved empty array (no inputs key)
made the array decoder throw → **fixed (`f4de4c8`)** with the decoder reading `inputs default:{}`
(behavior-preserving — ignored when inputs is present; decoder.json regenerated byte-equal) + promoted to the
**FR-126 reverse-path gate** `blockly-resave.test.ts` (217: encode→Blockly load→SAVE→decode over the full
corpus + structural edge cases, proving the decoder consumes Blockly's actual save output incl. scalar TYPE
FIDELITY 42/false/null/3.5). One NIT (the runtime-size scan only catches `case`/`===` dispatch, not a
bracket/object-literal dispatch table) acknowledged-by-design. **New gates wired into pre-commit + CI:**
check_presentation, check_behavior_runtime_size, and the previously-unwired check_no_codec_mapping. **1387
tests** (1364 adapter + 12 core + 11 blockly); all gates green. **Next:** push `m1`/`m2`/`m3` + open PR(s);
then **M4** (`/run-milestone M4`): editor-ui + element shell, host execution wiring, error highlighting from
the `JsonPathBlockMap`, the **interactive Zelos render into a light-DOM scoped container (AD-017/AD-018, needs
jsdom/browser)** + strict bidirectional JSON sync (§7.15). **M4 watch-outs from M3:** (a) the reverse path is
codec-proven (`blockly-resave`) but the editor SYNC wiring (accept/reject in-surface edits, EditorSession) is
M4; (b) the structural mutators provide state hooks only — the visual gear/⊕/⊖ mutator UI is M4/future; (c)
`field_transon_scalar` holds any JSON scalar headlessly — its editable widget + validation UI is M4._

### Prior last action (M2)

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
- **M3 — `editor-blockly`: `G_palette`/`G_toolbox` + Zelos + behavior runtime** — ☑ done (committed
  `12b2751`→`f4de4c8`, not pushed; `round-trip-reviewer` sign-off). The full catalog projects to Blockly
  (committed `palette.json`/`toolbox.json` from `G_palette`/`G_toolbox`) + the finite rule-agnostic behavior
  runtime (`@transon/editor-blockly`: 1 field + 3 structural mutators). FR-125 (palette-load) + FR-126
  (encoder-load, both directions) + FR-127/NFR-048 (presentation-from-data) + NFR-046 (runtime-size) + AC-036
  (self-hosting in-surface) + AC-037 (synthetic-rule-from-data) all gated. 1387 tests. See **Last action**.
- **M4 — `editor-ui` + `editor-element`: shell + host execution + bidirectional sync** — ☑ done
  (committed `1902f64`→`98e70eb`, not pushed; `round-trip-reviewer` sign-off). The runnable editor in
  sandbox + compact modes over the `EditorController`/`EditorSession` store; interactive light-DOM Zelos
  mount (AD-017/018, jsdom); host validate/execute (AC-012…016/024/025); error→block highlighting
  (AC-017); strict §7.15 bidirectional sync (AC-033); editable scalar field (FR-015) + on-canvas
  array/object mutators (AC-038); `createTransonEditor()` + `<transon-editor>` (ESM + IIFE, no engine,
  AC-022); the Pyodide reference host (AD-025). One reviewer must-fix (§7.15 surface check) fixed +
  regression-locked. 1477 tests. See **Last action**.
- **M5 — `editor-react` + examples + embedding + accessibility + self-hosting** — ☑ done (committed
  `26691ee`→`1cf0be6`, not pushed; `round-trip-reviewer`-signed-off, codec byte-unchanged). New public
  `@transon/editor-react` (React peer); full embedding config (read-only/theming FR-128/categories/marker);
  examples corpus (89 deduped) with expected-vs-actual; import/copy/download + unsaved guard; tooltips +
  version diagnostics; §12.6 progressive disclosure (data-driven, no regen); self-hosting through the
  editor (UC-016); accessibility (§19.5, real-browser axe-verified: 0 violations incl. contrast, Pyodide
  `ready`). **1551 tests**; all gates green. See **Last action**.

## Next steps (ordered)

1. **Push the milestone branches + open PR(s)** — **all of M0–M5 are complete and NOT pushed** (one
   branch/PR per milestone): `m0-editor-scaffolding` (M0), `m1-codec-skeleton` (M1), `m2-full-catalog`
   (M2, off M1), `m3-editor-blockly` (M3, off M2), `m4-editor-ui` (M4, off M3), `m5-react-embedding`
   (M5, off M4). Reference the covered FR/AC IDs. If they should merge to `main` in order, rebase each
   after the prior lands.
2. **M5 follow-ups (non-blocking polish, optional).** (a) Commit the accessibility BROWSER layer as a CI
   job — a `@playwright/test` + `@axe-core/playwright` e2e against the built `examples/reference-host`
   (contrast, keyboard nav, visible focus, real Pyodide load, browser self-hosting demo). It was run LIVE
   via the Playwright MCP and passed (axe 0 violations incl. contrast; Pyodide `ready`), but is not yet a
   committed gate. (b) Structured error→block highlighting still falls back to the root block because real
   engine errors carry only a text location trail — a structured template-path would need an engine change.
3. (Deferred, M-09) Pin `transon` in CI and flip `check_engine_parity.py --require-engine` +
   `update_memory.py --check --require-engine` on, once the engine is pip-installable in CI.

**Regen flow** (only if a codec generator changes — M5 did NOT): write generators →
`pnpm --filter editor-core build` → `UPDATE_ARTIFACTS=1` test → rebuild (double-build, run.ts bundles the
artifacts) → a normal run must be byte-equal.

## Open blockers / waiting-on

- None blocking M0 — it depends only on owner-controlled inputs (ROADMAP §"Remaining inputs").

## Do-not-relitigate (pointers, not copies)

- Locked decisions → [`ROADMAP.md` §Locked decisions](ROADMAP.md#locked-decisions).
- Architecture decisions `AD-001…AD-032` → [`ARCHITECTURE.md`](ARCHITECTURE.md).
- Golden rules / always-on invariants → [`AGENTS.md`](../AGENTS.md).
