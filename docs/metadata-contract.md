# metadata-contract.md — Editor Metadata Contract

> **Version:** 1.1 · **Status:** Pre-implementation baseline · **Last updated:** 2026-06-24

> **v1.1.** Per OQ-004 ([`SPEC.md`](SPEC.md) §10.3), `title`, `category`, and `examples` are now
> **required from custom-rule authors** for a rule to render as a safe (non-limited) block. For
> built-in rules these remain editor-owned/presentation fields. See §2.1.

This document is the single source of truth for the **shape** of the machine-readable Transon
metadata the visual editor consumes. Editor behavior is owned by [`SPEC.md`](SPEC.md) and
architecture by [`ARCHITECTURE.md`](ARCHITECTURE.md); sections are cited inline as `§n` and
requirement/decision IDs as `FR-xxx` / `NFR-xxx` / `AD-xxx`.

`SPEC.md` §7.11, §10, FR-081/084/085/088/089/090, and decisions AD-012, AD-014, AD-016 reference
this file instead of restating the field list. When this contract and `SPEC.md` disagree, the
contract is authoritative for the metadata *shape*; `SPEC.md` remains authoritative for editor
behavior.

---

## 1. Why this is a separate document

The metadata-driven architecture (`SPEC.md` §7.11, AD-014) requires Transon to emit rich,
structured metadata for every rule, operator, and function. That metadata is owned by the
Transon library (AD-012), not by the editor, so it is specified here as a contract between the
two repositories. It is delivered by a dedicated engine-owned export (§3).

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
- `required_params` — names that must be present (from the engine `_required` tuple).
- `modes` — the mutually exclusive parameter groups (from the engine `_modes` tuple of tuples).
  This is the source from which block variants and import matchers are derived (`SPEC.md` §7.7;
  matcher format in [`ARCHITECTURE.md`](ARCHITECTURE.md) §5.7).
- `examples` — example cases (from the tagged test corpus). Optional ("where available") for
  built-in rules; **required from the author for custom rules** to render as a safe block
  (OQ-004).

**Custom-rule minimum (OQ-004).** A custom rule is rendered as a safe (non-limited) block only
when it supplies all of: `name`, `description`, `params`, `required_params`, `modes`, per-parameter
`kind` (§2.2), **and** `title`, `category`, `examples`. A custom rule missing any of these is
rendered as a limited generic block or rejected with an actionable error (`SPEC.md` FR-086, §10.3).
Built-in rules need not carry author-supplied `title`/`category`/`examples`: the editor owns those
presentation fields and sources examples from the tagged corpus.

### 2.2 Parameter metadata

A parameter must provide:

- `name`.
- `title` — short label (presentation; may be editor-owned).
- `description` — markdown documentation.
- `kind` — one of `dynamic` (accepts a template) or `constant` (literal / dropdown value),
  emitted by the engine editor-metadata export (§3) from the rule source. This single field
  carries the dynamic/constant distinction; required-ness is derived from the rule's
  `required_params` and `modes`, not stored per-parameter.
- `examples` — parameter-level examples where available.

### 2.3 Operator metadata

An operator must provide: `name`, `alternative` (alias), `kind` (`unary`/`binary`), `types`,
`result`, `doc`, `examples` where available. (Field names are engine-native — the export emits
the keys `Transformer.get_operators()` already produces; see the `transon` proposal
`editor-metadata-export.md` "Resolved decisions" #1.)

### 2.4 Function metadata

A function must provide: `name`, `input`, `output`, `doc`, `examples` where available. (Field
names are engine-native — the export emits the keys `Transformer.get_functions()` already
produces; see the `transon` proposal `editor-metadata-export.md` "Resolved decisions" #1.)

---

## 3. Engine-owned editor-metadata export (AD-012)

Transon provides a dedicated, versioned editor-metadata export — separate from the docs API —
that emits the full §2 contract. Reference:
`transon/editor_metadata.py::get_editor_metadata()` ([`ARCHITECTURE.md`](ARCHITECTURE.md) §5.8).

The export:

- serializes `__rule_schema__` `required` (→ `required_params`) and `modes`;
- emits per-parameter `kind` (`dynamic`/`constant`) declared at the rule source;
- emits operator/function metadata (§2.3/§2.4);
- carries a standalone `metadata_version` (§5).

Because the engine owns this export, the following `SPEC.md` items are satisfied directly,
without an editor-side bridge:

- FR-081 — metadata sufficiency for generic blocks;
- FR-084, FR-088, FR-089 — generic metadata-generated blocks and specialized fallback;
- FR-047, UC-009, §13.10 — dynamic-vs-constant tooltips (from `kind`);
- AC-028 — "new rule appears as a generic block without editor code changes";
- §15.6, FR-053/054/055 — variant import matching (from `modes`).

This work lives in the Transon repository. The engine-parity checks in
[`traceability.md`](traceability.md) guard against drift between the export and the editor.

---

## 4. Editor-side normalization (presentation only)

With the engine-owned export (§3), the editor does not derive semantic fields. Its normalization
layer ([`ARCHITECTURE.md`](ARCHITECTURE.md) §5.5) is limited to **presentation** concerns it
legitimately owns (AD-012):

- mapping rules to canonical palette categories (`SPEC.md` §12.4);
- deriving block variants from the engine `modes` (mechanical; `SPEC.md` §15.6 →
  [`ARCHITECTURE.md`](ARCHITECTURE.md) §5.7);
- palette ordering, labels/titles, colors, and specialized-renderer selection.

The editor must not maintain a parallel semantic source of truth. If the export is ever missing a
§2 field, that is an engine bug surfaced in diagnostics (`SPEC.md` §18.2), not an editor-side
augmentation. An automated parity check guards export↔editor agreement (see
[`traceability.md`](traceability.md)).

---

## 5. Schema versioning (NFR-040, NFR-037, FR-080 diagnostics)

- The editor records the Transon engine version and the metadata schema version it was built
  against (`SPEC.md` §10.2, §18.1, FR-080).
- The metadata schema is versioned independently of the engine release so the editor can detect
  mismatches (NFR-037, NFR-038) and fail safely (NFR-039).
- When the metadata schema changes shape, bump its version; the editor's compatibility check
  (`SPEC.md` §8.7) compares declared compatible ranges.
- A stable, versioned editor metadata schema is required by NFR-040.
