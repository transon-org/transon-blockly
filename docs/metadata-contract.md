# metadata-contract.md — Editor Metadata Contract

> **Version:** 2.0 · **Status:** Pre-implementation baseline · **Last updated:** 2026-06-27

> **v2.0 — projection-ready reshape.** The export is now **projection-ready**: it carries
> **pre-derived variant signatures** (§2.5) and **resolved enum domains** (§2.6) so the editor's
> Transon-template projections (`G_*`, `SPEC.md` §7.16, AD-026) are pure maps over data — no editor
> code re-derives variants or binds enums. The export is **split** (NFR-047) into a lean *structural
> catalog* and a separate *examples/docs payload* (§2.7). New §6 records the **required engine work**
> this contract depends on (`switch`/`cond` rules, the projection-ready export, `include`
> default-marker inheritance). The export is **greenfield at engine v0.1.0** (no editor-metadata
> export exists yet). Bumps `metadata_version` (§5).

> **v1.1.** Per OQ-004 ([`SPEC.md`](SPEC.md) §10.3), `title`, `category`, and `examples` are
> **required from custom-rule authors** for a rule to render as a safe (non-limited) block. For
> built-in rules these remain editor-owned/presentation fields. See §2.1.

This document is the single source of truth for the **shape** of the machine-readable Transon
metadata the visual editor consumes. Editor behavior is owned by [`SPEC.md`](SPEC.md) and
architecture by [`ARCHITECTURE.md`](ARCHITECTURE.md); sections are cited inline as `§n` and
requirement/decision IDs as `FR-xxx` / `NFR-xxx` / `AD-xxx`.

`SPEC.md` §7.11, §7.16, §10, FR-081/084/085/088/089/090/116/117, and decisions AD-012, AD-026,
AD-028, AD-029 reference this file instead of restating the field list. When this contract and
`SPEC.md` disagree, the contract is authoritative for the metadata *shape*; `SPEC.md` remains
authoritative for editor behavior.

---

## 1. Why this is a separate document

The template-driven projection architecture (`SPEC.md` §7.16, AD-026) requires Transon to emit
rich, structured, **projection-ready** metadata for every rule, operator, and function. That
metadata is owned by the Transon library (AD-012), not by the editor, so it is specified here as a
contract between the two repositories. It is delivered by a dedicated engine-owned export (§3) and
is the single input from which the generators `G_palette`/`G_toolbox`/`G_encode`/`G_decode` produce
the entire editor surface. The guiding principle (AD-026, `SPEC.md` §9):

> **Metadata carries engine *facts*, precomputed wherever a template would struggle (set algebra
> over modes, enum catalogs). The projection carries *presentation*. Anything that is a deterministic
> function of engine semantics but awkward in template form is computed in Python and emitted as
> data.**

---

## 2. Required metadata fields

This is the single source of truth for the metadata field list; `SPEC.md` FR-081, FR-085, and
§10.2 reference this section.

### 2.1 Rule metadata

A rule must provide:

- `name` — rule name as used after the marker key (e.g. `attr`).
- `title` — short human label (e.g. "Get attribute"). Presentation. **Editor-owned for built-in
  rules; required from the author for custom rules** (OQ-004).
- `description` — markdown documentation (the rule docstring).
- `category` — canonical category from `SPEC.md` §12.4 (or a hint the editor maps). **Editor-owned
  for built-in rules; required from the author for custom rules** (OQ-004).
- `advanced` — boolean: advanced vs beginner-friendly (drives progressive disclosure,
  `SPEC.md` §12.6).
- `params` — ordered list of `ParameterMetadata` (§2.2).
- `variants` — **pre-derived variant signatures** (§2.5): one entry per valid mutually-exclusive
  parameter shape, with ordered visible params each flagged `required`. The engine computes these in
  Python from `_required`/`_modes` and emits them as data; this is the single source consumed by the
  generators and the generated decoder (`SPEC.md` §7.7, FR-116). The raw engine `required`/`modes`
  tuples may also travel as engine-native source, but the editor reads `variants`, not the raw form.
- `examples` — example cases (from the tagged test corpus; examples/docs payload, §2.7). Optional
  ("where available") for built-in rules; **required from the author for custom rules** to render as
  a safe block (OQ-004).

Fields divide across the split payload (§2.7): `name`, `title`, `category`, `advanced`, `params`
(with `kind`/`options`), and `variants` are the **structural catalog**; `description` and `examples`
are the **examples/docs payload**.

**Custom-rule minimum (OQ-004).** A custom rule is rendered as a safe (non-limited) block only
when it supplies all of: `name`, `description`, `params`, `variants`, per-parameter `kind` (§2.2),
**and** `title`, `category`, `examples`. A custom rule missing any of these is rendered as a limited
generic block or rejected with an actionable error (`SPEC.md` FR-086, §10.3). Built-in rules need not
carry author-supplied `title`/`category`/`examples`: the editor owns those presentation fields and
sources examples from the tagged corpus.

### 2.2 Parameter metadata

A parameter must provide:

- `name`.
- `title` — short label (presentation; may be editor-owned).
- `description` — markdown documentation (examples/docs payload, §2.7).
- `kind` — one of `dynamic` (accepts a template) or `constant` (literal / dropdown value),
  emitted by the engine editor-metadata export (§3) from the rule source. This single field
  carries the dynamic/constant distinction; required-ness is conveyed by the pre-derived variant
  signatures (§2.5), not stored per-parameter.
- `options` — for a `constant` parameter with a closed domain, the **resolved enum domain** (§2.6):
  the list of allowed literal values (including aliases). Absent for open constants and for
  `dynamic` params. The projection derives the widget (`dropdown` when `options` present, `field`
  otherwise) from `kind` + `options` via `cond`/`switch` (FR-118), so widget choice is **not** in
  the export (§2.8).
- `examples` — parameter-level examples where available (examples/docs payload, §2.7).

### 2.3 Operator metadata

An operator must provide: `name`, `alternative` (alias), `kind` (`unary`/`binary`), `types`,
`result`, `doc`, `examples` where available. Field names are engine-native — the export emits the
keys `Transformer.get_operators()` already produces. The operator names + aliases are the
**resolved enum domain** for `expr.op` (§2.6).

### 2.4 Function metadata

A function must provide: `name`, `input`, `output`, `doc`, `examples` where available. Field names
are engine-native — the export emits the keys `Transformer.get_functions()` already produces. The
function names are the **resolved enum domain** for `call.name` (§2.6).

### 2.5 Pre-derived variant signatures (FR-116, AD-015, AD-026)

Instead of raw `modes`, each rule carries **pre-derived variant signatures**: one entry per valid
mutually-exclusive parameter shape, listing its **ordered visible params**, each flagged `required`.
The engine computes the set algebra over `_required`/`_modes` once, in Python (where it is trivial),
and emits the result as data; the generators and the generated decoder consume it directly, and the
former editor-side variant derivation/matching is deleted (`ARCHITECTURE.md` §5.7).

```json
"variants": [
  { "id": "name",  "params": [ { "name": "name",  "required": true }, { "name": "default", "required": false } ] },
  { "id": "names", "params": [ { "name": "names", "required": true }, { "name": "default", "required": false } ] }
]
```

The empty mode `()` yields a valid zero-extra-parameter variant (e.g. `expr`/`call` "current value"
forms). Exactly one variant must match an invocation on decode/import; zero/multiple/partial →
`import_unsupported` (`SPEC.md` §15.6, §16.4).

### 2.6 Resolved enum domains (FR-117, AD-026)

A `constant` parameter with a closed domain carries its resolved `options` (§2.2). The engine owns
those catalogs, so this is engine fact, not editor knowledge: `expr.op` → operator names + aliases
(§2.3), `call.name` → function names (§2.4). This removes the hardcoded enum-binding the editor used
to carry.

```json
{ "name": "op", "kind": "constant", "options": ["<", "lt", "<=", "le", "==", "eq", "..."] }
```

### 2.7 Split payload: structural catalog vs examples/docs (NFR-047, OQ-015)

The export is delivered in two parts so projection input stays lean:

- **Structural catalog** — consumed by the generators `G_*`: per-rule `name`, `kind`-tagged
  `params` (with `options` where applicable), pre-derived `variants` (§2.5); operators (§2.3) and
  functions (§2.4); and `metadata_version` (§5). Presentation fields `title`, `category`, and
  `advanced` are **editor-owned for built-in rules** (§2.1, §2.8): the editor supplies them and the
  engine export does **not** emit them (they are not engine facts); for **custom** rules the author
  supplies them (§2.1, OQ-004). They are joined into the catalog the generators see by `name`.
- **Examples/docs payload** — consumed by tooltips/examples UI, not by the generators: rule and
  parameter `description` and `examples` (from the tagged corpus).

The two share rule/param `name` as the join key. The custom-rule minimum (§2.1, OQ-004) still
requires `title`/`category`/`examples`, drawn from whichever part carries them.

### 2.8 The line not to cross — engine stays Blockly-agnostic (AD-016 boundary preserved)

The export states **engine facts only**. It must **not** contain Blockly shapes — colours,
`message0`, field types, placeholder indexing, input-inline hints — those live in the projection
templates. The **input-widget decision** (`input`/`dropdown`/`field`) is *derived in the projection*
via `cond`/`switch` from the facts (`kind` + presence of `options`, FR-118), never baked into the
engine. The engine says "valid invocation facts"; the projection turns facts into widgets.
Likewise **presentation** — `title`, `category`, and `advanced` (progressive disclosure) — is not an
engine fact: the editor owns it for built-in rules and the export omits it (§2.1, §2.7). The engine
verified `get_editor_metadata()` (v0.1.3) accordingly emits neither widget choices nor these
presentation fields.

### 2.9 Editor-owned presentation is projection-template data (not TypeScript)

Editor-owned presentation (`title`/`category`/`advanced`) and the category **order** +
category→**colour** mapping live in a **single committed projection-data file** consumed by the
generators — data, not TypeScript and not inline template literals (`SPEC.md` FR-127, NFR-048). This
fixes the *form* of the editor-owned presentation that §2.7/§2.8 already assign to the editor; the
engine export stays Blockly-agnostic and emits none of it. A completeness check (FR-127) requires
every metadata rule to have a presentation-data entry.

---

## 3. Engine-owned projection-ready export (AD-012, AD-026)

Transon provides a dedicated, versioned editor-metadata export — separate from the docs API — that
emits the full §2 contract. It is **greenfield at engine v0.1.0** (no editor-metadata export exists
yet) and is built directly in the projection-ready shape, skipping any raw intermediate shape. A
reference entry point is `transon`'s `get_editor_metadata()`
([`ARCHITECTURE.md`](ARCHITECTURE.md) §5.8); the function name and module are the engine repo's to
finalize.

The export:

- emits **pre-derived variant signatures** per rule (§2.5) computed from `__rule_schema__`
  (`required`/`modes`) — not raw `modes` left for the consumer to re-derive;
- emits per-parameter `kind` (`dynamic`/`constant`) declared at the rule source, plus **resolved
  enum domains** (`options`) for closed constants (§2.6);
- emits operator/function metadata (§2.3/§2.4);
- is **split** into a structural catalog and an examples/docs payload (§2.7);
- carries a standalone `metadata_version` (§5).

Because the engine owns this export, the following `SPEC.md` items are satisfied directly, without
an editor-side bridge:

- FR-081 — metadata sufficiency for projected blocks;
- FR-084, FR-088, FR-089 — metadata-projected blocks (and metadata-driven richer presentation);
- FR-047, UC-009, §13.10 — dynamic-vs-constant tooltips (from `kind`);
- FR-116, §15.6, FR-053/054/055 — variant signatures + matching (pre-derived, §2.5);
- FR-117, FR-118 — resolved enum domains feeding the projection's widget decision;
- FR-120, AC-028, AC-034 — "new rule appears across every surface without editor code changes".

This work lives in the Transon repository (§6). The engine-parity checks in
[`traceability.md`](traceability.md) guard against drift between the export and the editor.

---

## 4. The editor consumes; it does not normalize (AD-012, AD-026)

With the projection-ready export (§3), the editor derives **no** semantic fields and runs **no**
normalization layer. The catalog is fed, unchanged, to the generators `G_*`, which produce the
palette, toolbox, encoder, and decoder (`ARCHITECTURE.md` §5.4–§5.5). Presentation that used to be
editor-side normalization now lives **in the projection templates** (category→toolbox structure via
`G_toolbox`, labels/colours, the widget decision), driven by the metadata facts — not by editor
code.

The editor must not maintain a parallel semantic source of truth, and must not reintroduce
hand-written variant derivation, enum-binding, or a per-rule block-definition layer
(`SPEC.md` §21.15). If the export is ever missing a §2 field, that is an engine bug surfaced in
diagnostics (`SPEC.md` §18.2), not an editor-side augmentation. An automated parity check guards
export↔editor agreement, and a regeneration check guards that the committed codec artifacts match
the current metadata (AD-030; see [`traceability.md`](traceability.md)).

---

## 5. Schema versioning (NFR-040, NFR-037, FR-080 diagnostics)

- The editor records the Transon engine version and the metadata schema version it was built
  against (`SPEC.md` §10.2, §18.1, FR-080).
- The metadata schema is versioned independently of the engine release so the editor can detect
  mismatches (NFR-037, NFR-038) and fail safely (NFR-039).
- When the metadata schema changes shape, bump its version; the editor's compatibility check
  (`SPEC.md` §8.7) compares declared compatible ranges. The projection-ready reshape (v2.0) is a
  shape change and bumps `metadata_version`.
- A stable, versioned editor metadata schema is required by NFR-040.

---

## 6. Required engine work (cross-repo dependency)

The projection model depends on additions to the Transon engine, **on top of v0.1.0**. They
are owned and tracked in the engine repository (`../transon`; see its
`docs/proposals/editor-metadata-export.md` and roadmap items R-23…R-25); this contract records what
the editor relies on so the two stay in sync. (This editor repo does not implement them.) **Pin the
metadata snapshot to an engine build that provides all of these (v0.1.3+) before building the codec.**

### 6.1 `switch` / `cond` lazy-dispatch rules (required; AD-029, `SPEC.md` FR-118)

A lazy multi-way dispatch where **only the selected branch is evaluated**. `switch`: equality on a
key, cases as a JSON object. `cond`: Lisp-style `[{when, then}, …]` + `default` (subsumes `if`). Used
at runtime inside the generated codec (dispatch on rule name / block type) and to derive the widget
from `kind` + `options`. Must honor `NO_CONTENT` discipline, raise `DefinitionError` (malformed) /
`TransformationError` (bad data), stay stdlib-only, Python 3.9+, and never mutate input/template.
They are ordinary JSON rules (no new transformation language, `SPEC.md` §21.8).

### 6.2 Projection-ready editor-metadata export (required; AD-012, AD-026)

`get_editor_metadata()` in the §2 shape: pre-derived variant signatures (§2.5), resolved enum
domains (§2.6), per-param `kind`, split structural/examples payload (§2.7), and `metadata_version`.
Greenfield at v0.1.0.

### 6.3 `include` default-marker inheritance (small, SPEC-first; AD-027, `SPEC.md` FR-116, OQ-014)

When an `include`d template does not pin its own marker, it inherits the **parent's default
marker** rather than always assuming `"$"`. This keeps staged generator-splitting (the `@`/`$`
phases of the compiler) consistent across `include` boundaries. The engine must **not** gain a
free per-call `marker` argument on `include` (that invites silent misinterpretation), and must
**not** add `eval`/`apply` — the two-pass generate-then-run model (AD-030) avoids it. `quote`/`raw`
is **declined** (OQ-013): the two-marker staging (AD-027) covers literal-`$` emission.

The engine reuses, unchanged, what v0.1.0 already provides: the configurable marker (staging/quoting,
AD-027), `object`/`fields` verbatim keys (the literal-marker escape, `SPEC.md` §11.4), `include` +
`template_loader` + `max_include_depth` (generator splitting + codec recursion), `file` + `file_writer`,
`NO_CONTENT` and `default` params, `_modes`/`_required` (feeding the pre-derived variants), and
`map`/`object`/`join`/`format`/`expr`/`chain` as projection building blocks.

### 6.4 `type` function for node-type dispatch (required; AD-029, `SPEC.md` FR-118)

The codec dispatches **on node type**, not on a brittle structural heuristic: a `switch` keyed by
`{ call: type }` classifies each node so that literal arrays **recurse** and literal marker-looking
strings (e.g. `"{…}"`) stay **scalars**. This relies on the engine `type` function classifying a
node. Without it the dispatch cannot distinguish a literal array from a rule invocation reliably.

### 6.5 `include` `IncludeContext` loader + context passing (required; AD-027, `SPEC.md` FR-116)

Self-recursion through fragments relies on the `include` `IncludeContext` loader. Critically,
**`set`/`get` variables do NOT cross an `include` boundary**: a fragment must receive its context as
the `this` value passed into the include (build a `{…}` context object at the call site and read it
inside the fragment). Reading a parent-scope variable across the include yields `NoContent`. This
constrains how the staged generators (§5.5) and the runtime codec thread context through fragments.

**Host recursion ceiling.** The codec's effective recursion depth is host-stack-bound (~25 levels),
below the engine's `max_include_depth` (default 50); deep nesting beyond that should fail cleanly
with an `include_loader` error (`SPEC.md` §16.4), not a raw stack overflow.
