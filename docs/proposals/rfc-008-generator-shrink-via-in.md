# RFC-008: Generator shrink via the total `in` operator (engine RFC 0007 follow-up)

- **Status:** **Ratified** (2026-07-18; proposed and OQs decided same day — OQ1 session-init
  engine-floor check as a new FR · OQ2 chained unary `!` · OQ3 straight to rewrite, no hotfix ·
  OQ4 `call` menu curation deferred). Slice 1 (re-pin) merged via PR #14. Design record only —
  **not** part of the contract. Where this and `SPEC.md` / `ARCHITECTURE.md` / `ROADMAP.md` /
  `AGENTS.md` disagree, **they win**. No FR/NFR/AC/AD/OQ IDs are registered by this document;
  next-free numbers below are **hints** (§21.1) — verify against the ledger when a slice lands.
- **Type:** Codec-projection refactor + latent round-trip **bug fix** + engine re-pin. Touches the
  generator authoring source (`codegen.ts`), the committed `G_*` generators and codec artifacts
  (AD-030 regen), `presentation.json`, and the metadata snapshot pin.
- **Baseline:** editor 0.2.0 released; engine pin `transon` **v0.2.0** (snapshot metadata 3.0 —
  the re-pin below **executed 2026-07-18** at the maintainer's direction, target 0.2.0 rather
  than 0.2.1, which is docs-only); local engine checkout at **v0.2.1**. Engine RFC 0007 (`../transon/docs/proposals/`
  `0007-builtin-function-library.md`) **shipped in 0.1.8**: 30 `call` functions, a new `split`
  rule, and — the one editor-facing lever it asked for — a **total binary `in` membership
  operator** (`transon/operators.py`: array→element, string→substring, object→**key presence**;
  never raises). The 0.1.8 changelog names this follow-up explicitly: *"`transon-blockly`
  generator shrink via `in`"*. This RFC is that follow-up, designed in the editor repo as engine
  RFC 0007's ownership note requires.

## Problem (one line)

The codec generators build every membership test from a **sentinel idiom**
(`map keys → filter == K → join default:"transon::absent-key" → expr !=`) because the pinned
engine had no membership primitive — the idiom is ~150 sites across the committed artifacts,
dominates their size, costs a list-walk per param per variant per node on every debounced edit,
**and has a reproducible sentinel-collision hole that violates AD-004**.

## Evidence

### 1. The sentinel idiom breaks strict round-trip (AD-004) on collision

Reproduced against the **committed** `encoder.json`/`decoder.json` artifacts with engine v0.2.1
(probe: substitute the FR-063 marker placeholder with `$`, wire the fragment map as
`template_loader`, transform):

| Input document | Encoded as | Decodes back to | Verdict |
|---|---|---|---|
| `{"$": "this"}` | `transon_rule_this__base` | `{"$": "this"}` | ok |
| `{"$": "this", "oops": 1}` | `transon_unsupported` | preserved verbatim | ok |
| `{"$": "this", "transon::absent-key": 1}` | `transon_rule_this__base` | `{"$": "this"}` | **MEANING CHANGED** |
| `{"$": "this", "transon::absent-key": 1, "oops": 2}` | `transon_unsupported` | preserved | ok |

Mechanism: `noForeignKey` joins the surviving foreign keys and compares to the sentinel
`KEY_NIL = "transon::absent-key"`. When the node's **only** foreign key is literally that string,
the join *equals* the sentinel, the guard reads "no foreign key", the variant matches, and the
encoder silently drops the key — an in-code comment asserts "a real param/key name never equals
it", which is true of metadata names but **not of user documents**. The same collision class
exists in the `isEscape` third-key check (`isEmptyNames`). Exotic input, but AD-004 admits no
"exotic" carve-out: the required behavior is `transon_unsupported` with exact preservation.

### 2. Size (measured, committed artifacts)

Each sentinel site is a ~1–1.5 KB pretty-printed subtree; the `in` replacement is one ~120-byte
`expr`. Conservative estimate (nested `allRequiredPresent` interiors not double-counted):

| Artifact | Today | Sentinel sites | Est. after | Δ |
|---|---|---|---|---|
| `artifacts/encoder.json` | 400 KB | 106 | ≈ 250 KB | **−38 %** |
| `artifacts/decoder.json` | 156 KB | 43 | ≈ 123 KB | **−21 %** |
| `generators/G_encode.json` | 34 KB | 5 | ≈ 27 KB | −21 % |
| `generators/G_decode.json` | 13 KB | 2 | ≈ 11 KB | −14 % |

### 3. Runtime cost

Every membership test currently *materializes the key list, filters it, joins it, and compares
strings* — per param, per variant arm tried, per document node, on every debounced
workspace→JSON pass through the Pyodide host. The `in` operator is a single dict/array
membership check in the engine. (Not benchmarked; the asymptotic and constant-factor direction
is not in doubt. NFR-behavior unchanged — this is the same walk, cheaper per step.)

## Prerequisite: re-pin the metadata snapshot (0.1.7 → 0.2.0) — **DONE (2026-07-18, SPEC v2.6)**

The RFC-007 (editor) skew test — 0.1.8 engine vs 0.1.7 pin — is **done and live-verified**
(docs-site runs `metadataSource:"engine"` in production), so the deliberate hold on re-pinning
has served its purpose. The generators cannot emit `in` while the pin predates it. Re-pinning is
its own governed slice, **before** the generator rewrite — executed as described (target
**0.2.0**, the feature release; 0.2.1 is docs-only), all gates + full suite green, live-verified
in the Pyodide reference host (`engine 0.2.0`, `Split (split)` in the default palette, the
`SplitString` corpus example runs and matches). One extra step discovered in execution: the
**pyenv `python3` carries the pinned wheel** that the pre-commit/CI gates verify strictly
against — it must be upgraded (`pip install transon==0.2.0`) in the same move as the snapshot,
or `update_memory.py --check` fails on engine_version drift:

1. `python harness/scripts/update_memory.py --snapshot` against engine **v0.2.1** — refresh the
   engine venv's editable install first or the pin records a null/stale `engine_version`
   (known trap; `update_memory.py --check` catches the drift but not the cause).
2. **`presentation.json` must gain a `split` rule entry** (category, title, paramLabels) —
   `generateToolbox` **fail-louds** on a rule without a presentation category (FR-127), so the
   re-pin does not even build without it. FR-141's `fallbackCategory: "Custom"` covers only the
   *dynamic* path, not the committed artifacts.
3. `dropdownMenus.expr.op` curation: add the `in` entry (label `in`, value `in` — **no alias**:
   its symbol and name are the same token, and `menuFor` fail-louds on a token claimed twice).
   The 30 new `call` names need no curation (identity-menu fallback), but the `call` block's
   dropdown grows from 4 to ~34 entries — acceptable; curate later if the menu wants grouping.
4. Downstream of the pin bump alone (before any generator change): palette/toolbox regen adds
   the `split` rule block, the `in` operator token, and the new function names — the AC-034 /
   AC-037 "new rule folds in by metadata alone" path, now exercised for real.
5. Reference host: its default `micropip.install("transon==<snapshot engine>")` follows the pin
   automatically (AD-025). The Node adapter venv likewise just tracks `../transon`.

## Proposed rewrite (authoring source: `packages/editor-core/src/codec/codegen.ts`)

All membership/emptiness helpers collapse; both sentinels (`KEY_NIL`, `AT_KEY_NIL`) and the
`'@noopt'` / `'__transon_no_marker__'` magic strings are **deleted**, not merely bypassed.
Notation: `IN(a, b)` = `{"$": "expr", "op": "in", "values": [a, b]}` (operand order per
`_in(a, b)` = "a member of b"); `LEN(x)` = `{"$": "call", "name": "length", "value": x}`;
negation = chain into unary `{"$": "expr", "op": "!"}` (mode-1 unary applies to the chained
context; both `in` and `length`-on-container are total, so `cond`/`switch` keys stay safe).

| Helper (today) | Today's shape | Becomes |
|---|---|---|
| `keyPresent(p)` | keys → filter → join sentinel → `!=` | `IN(p, {$:get node})` — direct object-key membership; no key materialization at all |
| `thisHasKey(n)` / `fieldsHasMarkerKey` | same idiom over `this` / `fields` | `IN(n, {$:this})` / `IN(marker, {$:attr fields default:{}})` |
| `decField`/`decInput` presence | same idiom over `blk.fields` / `blk.inputs` | `IN(p, blk.fields)` / `IN(p, blk.inputs)` |
| `allRequiredPresent` | nested join-sentinel with `set _rp` save/restore | `LEN(filter(requiredNamesLit, !IN(this, node))) == 0` — empty required list → `LEN([]) == 0` → vacuously true, preserving the R1 empty-operand fix without the sentinel |
| `isForeignKey` + `noForeignKey` | `set _fk` dance + double filter + join sentinel | foreign = `!IN(this, paramNamesLit)`; `noForeignKey` = `LEN(filter(filter(NODE_KEYS, != marker), foreign)) == 0`. **This is the AD-004 bug fix** — no string in the document can forge "no foreign key" |
| `isEmptyNames(l)` | join sentinel `==` | `LEN(l) == 0` |
| `atHasConstantParams` (@-time) | join `AT_KEY_NIL` sentinel | `@ LEN(AT_CONSTANT_PARAMS) > 0` |
| `P_HAS_OPTIONS` (@-time, G_palette) | join `'@noopt'` sentinel | `@ LEN(options default []) > 0` |
| marker-present checks (encSkeleton, BLOCKMAP_ENCODER) | `attr default:'__transon_no_marker__'` compare | `IN(marker, node)` / its negation |

Then regenerate the committed `G_*.json` (byte-equal to the builders) and the artifacts
(`encoder.json`, `decoder.json`, `blockmap.json`, `palette.json`, `toolbox.json`) — one AD-030
regen commit, gate-verified.

### What the new engine surface does **not** change (declined)

- **No string decomposition.** Engine RFC 0007's flip-side note stands: the projections only
  *compose* `transon_rule_<name>__<id>` and dispatch on the whole key. `split` (rule) /
  `removeprefix` / `regex_*` will not be used to parse block-type names — the blockmap and
  switch-dispatch design is load-bearing (AD-032), and decomposition would reintroduce a parsing
  surface for zero benefit.
- **`@:join sep:''` list concatenation stays** (e.g. `ENC_THEN`'s 2-or-3-item assembly).
  `flatten` would be equivalent, not better; churn without payoff.
- **`multiInput` stays TS-computed** in `enrichForPalette`. It *could* move in-projection now
  that `length` exists, but the enrichment layer is the right home for presentation joins. Do
  update the two now-stale comments that read "(Transon has no length function)"
  (`codegen.ts` ~L573, ~L817).

## Behavior changes (SPEC-first, §21.2 — before any code)

1. **Bug fix (round-trip):** a rule node whose only foreign key equals the historical sentinel
   string now correctly encodes as `transon_unsupported` with exact preservation. Add the probe
   cases to the round-trip corpus (§15.7); note the fix under the ledger (AC hint: **AC-044**).
2. **Codec engine floor:** the committed artifacts (and the `G_*` generators under `@`) now
   require a host engine **≥ 0.1.8** (`in`, `length`). Record in `docs/metadata-contract.md`
   (§5 compatibility) and SPEC §16.4 (NFR hint: **NFR-051**): a pre-0.1.8 host fails codec
   execution outright, and the FR-140 gate does **not** catch it — 0.1.7 also advertises
   metadata 3.0, so the same-major check passes while `in` is absent. **Decided (OQ1):** a
   session-init engine-version check with a clean status-bar diagnostic lands as a new FR
   (hint: **FR-142**) alongside the documented floor.
3. **Vocabulary growth from the re-pin** (independent of the rewrite): `split` block, `expr`
   `in` option, ~30 `call` names — covered by existing FR-114/118/130 machinery; presentation
   additions as listed above.

## Rollout (test-first, per the harness loop)

1. **Slice 1 — re-pin:** snapshot regen + `presentation.json` (`split`, `expr.op` `in` menu) +
   palette/toolbox regen. Gates: `update_memory.py --check`, traceability, engine-parity,
   existing corpus green (committed codec artifacts are byte-identical in this slice — the
   generators didn't change).
2. **Slice 2 — SPEC/contract:** §21.2 edits above, corpus fixtures added (they **fail** against
   the current artifacts — the probe table is the expected-failure evidence), traceability rows.
3. **Slice 3 — rewrite:** `codegen.ts` helpers per the table; regen `G_*` + artifacts; fixtures
   from slice 2 go green; full round-trip corpus + projection/catalog-coverage + regen byte-equal
   gates green.
4. **Review:** this touches the codec, variant matcher, surface check, and marker escape — the
   exact `review-gate` trigger list. Run `harness/workflows/review-gate` on the branch;
   maker ≠ checker.

## Open questions — **all ratified by the maintainer, 2026-07-18**

1. **OQ (engine floor): DECIDED — session-init check as a new FR, with its own §16.4 code.** At
   session ready, once the FR-080 version load reports the host engine version, compare it
   against the declared codec engine floor (one exported constant). Below the floor, surface a
   diagnostic with this contract — a **distinct** taxonomy entry, NOT a reuse of FR-140's
   `metadata_fallback` (that code means "runtime metadata path unusable"; this is an engine
   *capability* incompatibility):
   - **Code:** `engine_floor` (new §16.4 row, raised at *runtime init* only).
   - **Category label:** "Engine version below the editor's supported floor".
   - **Message:** names **both** versions (the host's reported version and the floor) and what
     the floor buys (the codec's total `in`/`length` primitives), so the failure is explained at
     init instead of surfacing as an opaque engine error on the first codec run.
   - **Persistence:** persistent for the session (its own store field, like `metadata_fallback` —
     not wiped by later projections/errors) and **non-blocking**: authoring and raw-JSON handling
     stay available; engine-backed actions fail on such a host exactly as they would anyway.
   - **Unknown version:** an absent/unparsable engine version **never** raises it.

   Lands with slice 2 (SPEC-first; FR hint **FR-142** + the §16.4 `engine_floor` row + AC), on
   top of RFC-007's existing version plumbing. The documentation half (metadata-contract §5
   floor note, SPEC §16.4 row) lands in the same slice.
2. **OQ (negation form): DECIDED — chained unary `!`**, uniformly:
   `{"$":"chain","funcs":[<in/length expr>, {"$":"expr","op":"!"}]}`. Operands are total (`in`,
   `length`), so the boolean is always well-typed; engine mode-1 unary applies to the chained
   context.
3. **OQ (fix sequencing): DECIDED — straight to the rewrite, no interim hotfix.** Slice 1 (the
   re-pin) merged same-day (PR #14), so nothing blocks slices 2–3; the collision needs a
   pathological key (`transon::absent-key`) to trigger, and a sentinel-hardening hotfix would
   compound the disease only to be discarded by the rewrite.
4. **OQ (call dropdown): DECIDED — defer curation.** The 34-entry identity menu is complete and
   functional; grouping needs dropdown machinery beyond today's flat `[[label, value]]` curation
   and belongs to the canvas-UX track (M7 / RFC-006 Tier C), not this one.

## IDs (hints only, next-free per ledger as of 2026-07-18)

FR-142 · NFR-051 · AC-044 · AD-037 (if the engine-floor check becomes contract). RFC-007
consumed FR-139/140/141 · AC-043 · AD-036.
