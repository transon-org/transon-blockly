# RFC: Template-Driven Editor — the editor surface as projections of Transon metadata

- **Status:** Draft / Proposal (pre-decision)
- **Type:** Architecture pivot (spans `transon-blockly` editor + `transon` engine)
- **Author(s):** TBD
- **Created:** 2026-06-26
- **Supersedes:** the current hand-written TypeScript codec/descriptor/block-generation
  implementation (to be scrapped on a fork branch; see §13).
- **Engine baseline:** Transon **v0.1.0** (published). All "what exists" claims below are
  verified against the `v0.1.0` tag (§8.5).
- **Related docs (to be revised using this RFC):** `docs/SPEC.md`, `docs/ARCHITECTURE.md`,
  `docs/metadata-contract.md`, `docs/traceability.md`, `docs/ROADMAP.md`, and (engine repo)
  `transon/docs/SPECIFICATION.md`, `transon/docs/ROADMAP.md`.

> **How to read this RFC.** §2–§7 are the conceptual proposal. §8–§9 are the concrete engine
> and metadata changes. §11–§12 map the pivot onto existing requirement IDs (append-only).
> §16 collects the decisions still open — these are the questions to resolve while revising
> the other docs.

---

## 1. Abstract

We propose to stop hand-writing the Blockly mapping layer and instead **derive the entire
editor surface — palette, toolbox, encoder, and decoder — as projections of the engine's
editor-metadata, expressed as Transon templates.** The Transon engine becomes the thing that
defines its own visual editor: metadata is the single source of truth, and the projections are
data (templates) executed by the host engine, never bundled into the editor.

The primary model is a **compiler** (metaprogramming): generator templates `G_*` transform
metadata into specialized codec templates, which then transform documents ⇄ Blockly workspaces.
An **interpreter** variant (one fixed metadata-driven codec) is kept as a documented fallback
(§7.4, OQ).

This requires two engine additions on top of v0.1.0 — a lazy **`switch`/`cond`** dispatch rule
and a **projection-ready editor-metadata export** — plus a deliberate reuse of two features
v0.1.0 *already has*: the **configurable marker** (for staging/quoting) and **`include`** (for
modularization and recursion).

---

## 2. Motivation

The current editor hand-maintains the metadata→Blockly mapping in TypeScript (block definitions,
variant descriptors, the JSON⇄IR codec, variant matching). This is correct and tested, but:

- **Two halves drift.** Encode (`deriveVariants` + descriptors) and decode (`matchVariant`)
  independently re-derive variants from the engine `modes`/`required`. Two implementations of
  one truth is a standing round-trip risk.
- **Logic lives in three languages.** Engine semantics (Python) → derivation/codec (TypeScript)
  → block JSON. Each boundary is a place for the catalog to fall out of sync.
- **It under-uses what Transon is.** Transon is a JSON→JSON projection engine; metadata,
  block definitions, documents, and workspaces are all JSON. The mapping layer is *exactly*
  the kind of data-to-data projection Transon exists to express.

The pivot's thesis: **make the metadata the single source and obtain every projection from it,
so encode/decode are inverse by construction and a new rule flows to every surface from one
place.** As a bonus, the editor's visual layer becomes retargetable (swap a template, get a
different renderer or a docs view) and self-describing (the projection templates are themselves
Transon templates, openable in the editor they configure).

---

## 3. Non-goals

- **Not** bundling a Transon engine into the editor. Engine-free remains inviolate (AD-008,
  NFR-004): templates are data; the **host** engine executes them.
- **Not** introducing a new transformation language, DSL, or path syntax (§21.8). All new
  expressiveness is ordinary JSON rules.
- **Not** turning Transon into a general macro system. The metaprogramming we need is small,
  staged, and bounded (§8.4 explicitly declines `eval`).
- **Not** a workflow/no-code platform (§4 scope guard unchanged).

---

## 4. Terminology (read this first — "template" is overloaded)

| Term | Meaning |
|---|---|
| **Document** | The Transon template the *user* is authoring/editing. The *data* moved between representations. |
| **Projection** | A Transon template that *does the moving* (palette / encoder / decoder). The *program*. |
| **Metadata** | The engine's editor-metadata export: the catalog of rules/params/operators/functions. |
| **Codec** | Encoder + decoder together. |
| **Generator `G_*`** | A projection whose *output is another template* (the compiler model). |
| **Meta-level vs object-level** | The generator runs at the meta-level (marker `@`); the emitted codec runs at the object-level (marker `$`). |
| **Catalog layer vs instance layer** | Palette/toolbox consume the *catalog*; encoder/decoder consume/produce *instances* (documents/workspaces). |

The system runs **one template (the document) through another template (the codec)** — the
engine transforming a program with a program. Keeping these two senses of "template" distinct
is essential to the rest of the RFC.

---

## 5. The core idea: one source, many projections

There is exactly one source — **metadata** — and a family of projections off it, in two layers:

| Projection | Input | Output | Layer |
|---|---|---|---|
| **Palette** | metadata (catalog) | block **definitions** (the vocabulary) | catalog / type-level |
| **Toolbox** | metadata (catalog) | category structure | catalog / type-level |
| **Encoder** | a **document** | block **instances** (a workspace) | instance-level |
| **Decoder** | a **workspace** | a **document** | instance-level |

All four are JSON→JSON, therefore all four are expressible as Transon templates. The editor
surface becomes `projection(metadata)`.

---

## 6. Two ways to be rule-aware: compiler vs interpreter

The codec must know each rule's shape (attr/map/expr/…). Two ways to get that knowledge:

- **(A) Interpreter — one fixed codec, metadata as data.** A single rule-agnostic codec walks
  the document while *consulting* metadata, dispatching generically on the marker value.
  Adapts to new rules with zero codegen; the single template is more demanding (dynamic dispatch
  + associative lookups while recursing).
- **(B) Compiler — metadata generates a specialized codec.** A higher-order generator `G` emits
  a specialized codec (a `switch` over known rules, each arm emitting that rule's shape). Two
  stages: **compile** (`metadata → codec`) then **run** (`codec → blocks`). The generated codec
  is flat, inspectable, and rule-by-rule testable; the generator is higher-order (quasiquote).

**This RFC proposes (B) the compiler model as primary** (per the converged direction), and keeps
(A) the interpreter as a documented fallback (OQ-010). Both need the same two underlying
mechanisms (recursion via `include`; runtime dispatch via `switch`), so the fallback is cheap
to keep open.

---

## 7. Architecture

### 7.1 The single source: a projection-ready metadata export

Today's metadata (where it exists post-0.1.0) is *raw*: it ships `modes`/`required_params` and
expects each consumer to re-derive variants and re-bind enums. Under this pivot the export is
**co-designed to be projection-ready** so each projection is a pure map (see §9). Guiding
principle:

> **Metadata carries engine *facts*, precomputed wherever a template would struggle. The
> projection carries *presentation*. Anything that is a deterministic function of engine
> semantics but awkward in template form is computed in Python and emitted as data.**

### 7.2 Generators as projections (compiler model)

```
G_palette(metadata) → palette definitions
G_toolbox(metadata) → toolbox
G_encode (metadata) → encoder   (a Transon template)
G_decode (metadata) → decoder   (a Transon template)
```

Each `G_*` is itself a Transon template whose output is JSON. Because **Transon templates are
JSON and Transon's output is JSON**, the engine can emit its own codecs (homoiconicity). The
generated codecs then run on instances:

```
encoder(document) → workspace
decoder(workspace) → document
```

### 7.3 The nuance: generic skeleton + projected arms

A codec is **not** 100% projected from metadata. Precisely:

> **codec = a fixed generic skeleton + metadata-projected per-rule arms.**

- **Projected from metadata (the holes):** the per-rule dispatch arms — "rule `attr` ↔ this
  block," param↔input wiring, variant selection.
- **Fixed scaffolding (not derivable from metadata):** the generic codec invariants — recursion
  over nested nodes, literal passthrough of non-rule JSON, the **marker-escape** rule, **ordering
  preservation** (object keys, `chain` steps, `set`-before-`get`), and the out-of-surface /
  exact-preserving placeholder path. `G_*` wraps these fixed pieces around the projected arms.

### 7.4 Staging & quoting via distinct markers (the key enabler — already in 0.1.0)

The hard part of the compiler model is **quoting**: `G` must emit a codec that *contains* `$`
markers without executing them. v0.1.0 already supports this with **no new feature**, because
the marker is configurable (`Transformer(template, marker="@")`):

- Run `G` with marker **`@`**. In `G`'s template: `@`-keyed dicts are generator rules (evaluated
  *now* — the "unquotes"); `$`-keyed dicts are inert literal data, deep-copied verbatim into the
  emitted codec (the "quoted" structure).

So the codec is written *mostly literally* (real `$` markers survive), with `@`-holes only where
metadata fills something in. **N evaluation levels = N distinct markers.** (The `object`/`fields`
verbatim-key mode is the alternative escape, but it is all-or-nothing-per-node and verbose; the
two-marker trick is strictly nicer for large literal fragments.)

Illustrative `G_encode` fragment (generator marker `@`, emitting object-level `$`):

```json
{
  "@": "map",
  "items": { "@": "attr", "name": "rules" },
  "key":   { "@": "attr", "name": "name" },
  "value": {
    "$": "object",
    "key":   { "@": "format", "pattern": "transon_rule_{}", "value": { "@": "attr", "name": "name" } },
    "value": { "$": "this" }
  }
}
```

### 7.5 Modularization & recursion via `include` (already in 0.1.0)

To keep `G_*` from ballooning, factor with `include`, mindful of its boundary semantics
(verified at 0.1.0): `include` starts a **separate transformation**, passes **only the current
context value** (`this`), does **not** cross `set`/`get` variables, is bounded by
`max_include_depth`, and resolves names through the host `template_loader`.

- **Thin driver + small fragments:** top-level `G_encode` maps over `metadata.rules` and
  `include`s a per-rule fragment with that rule as `this`. Shared fragments (`emit_value_input`,
  `emit_block_shell`, …) are their own includes.
- **Design every fragment as a pure function of `this`.** Because only the context value
  crosses, marshal all inputs into `this` (reshape with `chain` before the include if needed).
  This is a virtue: fragments become referentially transparent and unit-testable in isolation.
- **Recursion:** the *generated codec* recurses over nested documents via **self-`include`**.
  Distinct from splitting the generator, same rule, different phase/marker.

### 7.6 Round-trip correctness by construction

Encoder and decoder are two directions of one bijection over the supported surface. Because both
are derived from the **same** metadata source, they agree by construction — eliminating the
"two halves drift" risk that motivates the pivot (§2). Round-trip correctness reduces to *"both
directions have a single source: the metadata."*

### 7.7 Engine-free boundary preserved

A Transon template is engine-free **data**. Shipping the projection templates does not ship an
engine; only *executing* them does, and execution is already delegated to the host
`EngineProvider`. So "Transon defines its own editor" is consistent with — indeed an expression
of — AD-008/NFR-004. Recommended execution model: **two passes** (§8.4) — generate the codec as
data, then run it via the host — which needs no inline `eval` and keeps the security surface
closed.

---

## 8. Required engine work (Transon, on top of v0.1.0)

### 8.1 `switch` / `cond` — REQUIRED (new rule)

A **lazy multi-way dispatch** rule. Needed at *runtime* inside the generated codec (dispatch on
rule name when encoding, block type when decoding) and useful generally.

- Recommended primary form — `switch` (equality on a key, cases as a JSON object):

```json
{ "$": "switch",
  "value": { "$": "attr", "name": "control" },
  "cases": { "input": { /* … */ }, "dropdown": { /* … */ }, "field": { /* … */ } },
  "default": { "$": "this" } }
```

- Optional more-general form — `cond` (Lisp-style list of `{when, then}` + `default`), which
  subsumes `if`. **Pick one** primary primitive; do not add `if`+`switch`+`cond` together.
- **Hard requirement: lazy branch evaluation** — only the selected case is walked. This is both
  the point and the safety property (no stray side effects/errors from dead branches), and it is
  what the `object`+`attr` table-lookup hack cannot provide.
- Must honor: `NO_CONTENT` discipline (define no-match / `NO_CONTENT` value behavior), params are
  templates, `DefinitionError` for malformed / `TransformationError` for bad data, stdlib only,
  Python 3.9+, no input/template mutation.

### 8.2 Projection-ready editor-metadata export — REQUIRED (greenfield at 0.1.0)

v0.1.0 has **no** editor-metadata export. This pivot builds it directly in the projection-ready
shape (§9), skipping the raw intermediate shape entirely. Includes the presentation hints
(`_kinds`/`_title`/`_category`/`_advanced`) and the export function (`get_editor_metadata()`),
co-designed with the projection templates.

### 8.3 `quote` / `raw` — OPTIONAL (sugar)

A `{"$": "quote", "value": <JSON>}` that returns its value verbatim. Only worthwhile if the
two-marker staging (§7.4) proves clumsy in practice and single-marker local quoting reads better.
**Recommendation: do not add preemptively;** revisit after the §14 prototype.

### 8.4 `include` marker param / `eval`-`apply` — DISCUSSED, RECOMMENDED AGAINST (for now)

- **Do not add a free `marker` parameter to `include`.** The marker is intrinsic to how the
  *included* template was authored (the loader's concern); letting the caller pick it invites
  silent misinterpretation. If staged generator-splitting needs marker consistency, prefer
  **loader configuration** (no engine change) or, at most, **default marker inheritance** from
  the parent (small, SPEC-first) — not an arbitrary per-call marker.
- A `marker` argument *does* make sense on a hypothetical **`eval`/`apply`** (running a freshly
  *synthesized* template value, which has no pre-bound marker). But `eval` is a real security
  surface (arbitrary template execution from data). The **two-pass generate-then-run** model
  avoids it entirely and is simpler to test. Keep `include` deliberately narrow.

### 8.5 Baseline delta vs v0.1.0 (verified against the `v0.1.0` tag)

| Capability | In v0.1.0? | Action |
|---|---|---|
| Configurable marker (`marker="@"`) | ✅ yes | **Reuse** for staging/quoting (§7.4) |
| `object`/`fields` verbatim-key (literal `$`) | ✅ yes | Reuse (alt. escape) |
| `include` + `template_loader` + depth guard | ✅ yes | Reuse for split + recursion (§7.5) |
| `file` + `file_writer`, `NO_CONTENT`, `default` params | ✅ yes | Reuse |
| `_modes` / `_required` validation | ✅ yes | Reuse (feeds variant derivation) |
| `map`/`object`/`join`/`format`/`expr`/`chain` | ✅ yes | Projection building blocks |
| `switch` / `cond` (lazy dispatch) | ❌ no | **Add** (§8.1) — required |
| Editor-metadata export (`get_editor_metadata`, `_kinds`/`_title`/`_category`) | ❌ no | **Add** (§8.2) — required, greenfield |
| `quote` / `raw` | ❌ no | Optional (§8.3) |
| `eval` / `apply` | ❌ no | Declined (§8.4) |

---

## 9. The projection-ready metadata shape (§8.2 detail)

Precompute in Python (where set algebra is trivial); emit as plain data:

- **Pre-derived variant signatures per rule** — instead of raw `modes`, emit each variant with
  its **ordered visible params**, each flagged `required`. Removes the set algebra from *both*
  encode and decode (and from the importer/docs), and is exactly what a template cannot express
  well.

  ```json
  "variants": [
    { "id": "name",  "params": [ { "name": "name",  "required": true } ] },
    { "id": "names", "params": [ { "name": "names", "required": true } ] }
  ]
  ```

- **Resolved enum domains on the param** — e.g. `expr.op` → operator names (+ aliases),
  `call.name` → function names. The engine owns those catalogs, so this is engine fact, not
  editor knowledge. Removes the hardcoded enum-binding.

  ```json
  { "name": "op", "kind": "constant", "options": ["<", "lt", "<=", "le", "…"] }
  ```

- **Keep** `title`, `category`, `advanced`, `description`, `examples`, and crucially **`kind`**
  (`dynamic`/`constant`).

**The line not to cross (engine stays Blockly-agnostic, AD-016):** do **not** put Blockly shapes
in the export — colours, `message0`, field types, placeholder indexing — those live in the
projection template. The **input-widget decision** (`input`/`dropdown`/`field`) is *derived in
the template* via `switch` from the facts (`kind` + presence of `options`), not baked into the
engine. The engine states "valid invocation facts"; the template turns facts into widgets.

> Bonus: this reshape also deletes the duplicated `deriveVariants`/`matchVariant` derivation and
> benefits the importer and docs site — worth doing even independently of the projection idea.

Optional leanness: split the export into a lean *structural* catalog and a separate heavy
*examples/docs* payload so the projection's input stays small (OQ).

---

## 10. What stays as code (the structure/behavior boundary)

Templates define block **structure**; a small, fixed, **rule-agnostic** runtime handles Blockly
**behavior** that JSON cannot express — field validators, custom field widgets, mutator
interaction UI, drag/connection rules, change events. The crucial property: this runtime is
**finite and does not grow per rule.** New rules ride entirely on metadata + templates; only a
brand-new *interaction primitive* would touch code. (Mirrors the JSON-can't-express-behavior
boundary that motivates the whole design.)

---

## 11. Invariants — preserved and impacted

| Existing invariant | Status under this RFC |
|---|---|
| JSON canonical (AD-003) | Preserved — document JSON is still the source of truth. |
| Strict semantic round-trip (AD-004, §15.7) | **Strengthened** — encode/decode inverse by construction (§7.6). |
| Engine-free (AD-008, NFR-004) | Preserved — templates are data; host executes (§7.7). |
| Variants over hidden modes (AD-015) | Preserved — now sourced from pre-derived variant signatures (§9). |
| Metadata-driven, engine-owned (AD-012) | **Strengthened** — more catalog facts are engine-owned data. |
| Engine is the only Blockly-coupled mapping (AD-016) | Preserved — Blockly shapes stay in templates, not the engine. |
| No new transformation language (§21.8) | Preserved — `switch`/`cond` are ordinary JSON rules. |
| Engine: no string DSLs / pure-JSON templates | Preserved — `switch` cases are JSON objects. |
| Engine: stdlib-only, Py3.9+ | Preserved — new rules add no deps. |

---

## 12. Impact on existing docs & proposed new IDs

IDs are append-only (§21.1). Highest existing: **FR-113, NFR-045, AC-033, UC-015, AD-025,
OQ-009**. Proposed additions (numbers indicative, confirm on adoption):

**Architecture decisions (`docs/ARCHITECTURE.md`):**
- **AD-026 (proposed):** Editor surface is derived as Transon-template projections of engine
  metadata (compiler model primary; interpreter fallback).
- **AD-027 (proposed):** Codec generation uses distinct markers per evaluation phase (`@`
  meta-level, `$` object-level) for quoting/staging; no `eval`.
- **AD-028 (proposed):** Codec = fixed generic skeleton + metadata-projected per-rule arms;
  generic invariants (ordering, marker-escape, out-of-surface path) live in the skeleton.
- **AD-029 (proposed):** Engine `switch`/`cond` rule is the runtime dispatch primitive for
  generated codecs.

**Functional/Non-functional (`docs/SPEC.md`):**
- **FR-114+ (proposed):** projection templates for palette/toolbox/encoder/decoder; metadata
  reshape (pre-derived variants, resolved enums); `switch`/`cond` consumption.
- **NFR-046+ (proposed):** the generic runtime must remain rule-agnostic and not grow per rule
  (§10); projection input leanness (§9).
- **AC-034+ (proposed):** a new rule with complete metadata appears across all surfaces with no
  editor code change (re-stated for the projection model); round-trip-by-construction checks.
- **UC-016+ (proposed):** "open the editor's own projection template inside the editor"
  (self-hosting demo / test).

**Engine repo (`transon/docs/`):** add `switch`/`cond` spec + ROADMAP item; add the
editor-metadata export spec (greenfield), co-designed with §9. Re-bless any metadata snapshot.

**`docs/metadata-contract.md`:** rewrite §2 to the projection-ready shape (§9); bump
`metadata_version`.

**`docs/traceability.md`:** new rows for the above; the deterministic gates
(`check_traceability.py`, `check_engine_parity.py`) must cover the projection templates and the
generated codec per rule.

**`docs/ROADMAP.md`:** resequence milestones around: (M-x) engine `switch` + metadata export;
(M-y) `G_encode`/`G_decode` for one rule end-to-end (§14); (M-z) full catalog; (M-w) palette/
toolbox projections; (M-v) host execution wiring + bidirectional sync.

---

## 13. Migration / reset plan

1. **Fork branch.** Create a pivot branch; the current TypeScript codec/descriptor/block
   generation implementation is **scrapped** there. Keep only `docs/` (no recorded
   implementation progress).
2. **Engine revert.** Pin/return Transon to **published v0.1.0** as the baseline; engine
   additions (§8.1, §8.2) are proposed *against* that baseline as new, versioned work.
3. **Docs pivot.** Using this RFC, revise `SPEC.md`/`ARCHITECTURE.md`/`metadata-contract.md`/
   `traceability.md`/`ROADMAP.md` (and engine docs) per §12, preserving all existing IDs.
4. **Rebuild forward** per the phased plan (§14), test-first, with the gates green.

---

## 14. Validation strategy (de-risk before committing)

**Prototype the smallest closed loop first — one rule, end-to-end:**

1. Author metadata for a single rule (e.g. `attr`) in the projection-ready shape (§9).
2. Write `G_encode` (marker `@`) with the per-rule body factored into an `include`d fragment;
   generate the encoder for `attr`.
3. Run the generated encoder on an `attr` document → workspace JSON.
4. Generate the decoder with `G_decode`; run it on that workspace → document.
5. Assert the round-trip is semantically identity (via engine execution, not text compare).

**Pass criteria:** (a) `$`-structure emits verbatim under marker `@`; (b) `@`-holes splice
correctly; (c) `include` carries everything needed via `this`; (d) self-`include` recursion
terminates within `max_include_depth`; (e) round-trip identity holds. If (a)–(c) fight you, fall
back to the **interpreter** model (§6A), which needs no `$`-emission gymnastics. Only after the
loop closes do we fold over the rest of the catalog (adding fragments, not growing one template).

---

## 15. Risks & trade-offs

- **Two-level metaprogramming in a non-macro language.** Building dynamic-keyed `switch` arms
  whose values are literal-`$` templates, at codec nesting depth, is the sharp edge. Mitigation:
  §14 prototype; interpreter fallback.
- **Debuggability of generated templates.** Generated codecs are data you can inspect/diff/test
  rule-by-rule (a plus), but generator bugs are one level removed. Mitigation: keep `G_*` small
  via `include`; test fragments in isolation.
- **Performance.** Compile step at metadata-load time + recursive include traversal. Likely fine;
  measure. Interpreter avoids the compile step but pays per-node lookup.
- **Engine scope creep.** Adding control flow (`switch`/`cond`) nudges Transon from "templating"
  toward "computation." Bounded and SPEC-first; still pure JSON.
- **Security.** Any future `eval`/`include`-marker/loader-override work is security-sensitive
  (engine execution, `file`, `include`, remote examples). Out of scope here; round-trip-review
  required if revisited.

---

## 16. Open questions (resolve while revising the docs)

- **OQ-010 (proposed): Compiler vs interpreter as the shipped model.** RFC proposes compiler
  primary with interpreter fallback. Confirm, or choose co-equal/interpreter-only.
- **OQ-011 (proposed): Where do projections run** — build-time (CI codegen artifact),
  runtime-in-host (per metadata load), or both? Affects the "new rule with no code change"
  guarantee (AC) and the engine-free wiring.
- **OQ-012 (proposed): `switch` vs `cond`** as the single dispatch primitive (and exact
  `NO_CONTENT`/no-match semantics).
- **OQ-013 (proposed): Add `quote`/`raw`?** Default: no, pending §14.
- **OQ-014 (proposed): `include` marker handling** — loader-config only, default parent
  inheritance, or leave as-is? (RFC: avoid a free per-call `marker` param.)
- **OQ-015 (proposed): Metadata leanness** — split structural catalog from examples/docs payload?
- **OQ-016 (proposed): Reference host & engine execution** — does the host run the projection
  via the same `EngineProvider` used for validation/execution, and how is the v0.1.0 engine
  exposed to it?
- **OQ-017 (proposed): Toolbox/category source** — projected from metadata categories, or a
  separate presentation template?

---

## 17. Appendix

### 17.1 Conceptual flow

```
                    metadata  (single source, projection-ready §9)
                       │
        ┌──────────────┼───────────────┬────────────────┐
        ▼              ▼               ▼                ▼
   G_palette       G_toolbox       G_encode          G_decode      (run with marker @)
        │              │               │                │
        ▼              ▼               ▼                ▼
   palette defs     toolbox        encoder            decoder       (Transon templates, marker $)
                                       │                ▲
                              document ─┘                └─ workspace
                                       └────── round-trip (inverse by construction) ──────┘
```

### 17.2 v0.1.0 rule inventory (verified)

`this, parent, item, key, index, value, set, get, attr, object, map, filter, zip, file, join,
chain, expr, call, format, include` (20 rules). Operators: comparison (`<,<=,==,!=,>=,>`),
arithmetic (`+,-,*,/,%`), logical (`&&,||,!`). Functions: `str, int, float`. No `switch`/`cond`/
`quote`/`eval`; no editor-metadata export.
