# Editor Metadata Contract

This document is the single source of truth for the machine-readable Transon metadata the
visual editor consumes. The authoritative requirements live in [`SPEC.md`](SPEC.md);
sections are cited inline as `§n` and requirement IDs as `FR-xxx` / `AD-xxx` / `NFR-xxx`.

`SPEC.md` §7.12, §7.14, §11, FR-130..FR-138, AD-006, AD-014, and AD-016 reference this
file instead of restating the field list. When this contract and `SPEC.md` disagree, the
contract is authoritative for the metadata *shape*; `SPEC.md` remains authoritative for
editor behavior.

---

## 1. Why this is a separate document

The metadata-driven architecture (FR-130..FR-138, AD-014) assumes Transon emits rich,
structured metadata for every rule, operator, and function. That metadata is owned by the
Transon library (AD-016, OQ-013), not by the editor, so it is specified here as a contract
between the two repositories. It is delivered by a dedicated engine-owned export (§3).

---

## 2. Required metadata fields

This is the single source of truth for the metadata field list; `SPEC.md` FR-091, FR-132,
and §11.5 reference this section.

### 2.1 Rule metadata

A rule must provide:

- `name` — rule name as used after the marker key (e.g. `attr`).
- `title` — short human label (e.g. "Get attribute"). Presentation; may be editor-owned
  if Transon does not supply it (see OQ-013).
- `description` — markdown documentation (the rule docstring).
- `category` — canonical category from `SPEC.md` §13.4 (or a hint the editor maps).
- `advanced` — boolean: advanced vs beginner-friendly (drives progressive disclosure,
  `SPEC.md` §13.6).
- `params` — ordered list of `ParameterMetadata` (§2.2).
- `required_params` — names that must be present (from the engine `_required` tuple).
- `modes` — the mutually-exclusive parameter groups (from the engine `_modes` tuple of
  tuples). This is the source from which block variants and import matchers are derived
  (`SPEC.md` §7.8; matcher format in [`ARCHITECTURE.md`](ARCHITECTURE.md) §5.7).
- `examples` — example cases (from the tagged test corpus) where available.

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

An operator must provide: `name`, `alternative` (alias), `kind` (`unary`/`binary`),
`types`, `result`, `description`, `examples` where available.

### 2.4 Function metadata

A function must provide: `name`, `input_type`, `output_type`, `description`, `examples`
where available.

---

## 3. Engine-owned editor-metadata export (AD-022)

Transon provides a dedicated, versioned editor-metadata export — separate from the docs API —
that emits the full §2 contract. Reference:
`transon/editor_metadata.py::get_editor_metadata()` (`SPEC.md` AD-016/AD-022;
[`ARCHITECTURE.md`](ARCHITECTURE.md) §5.8).

The export:

- serializes `__rule_schema__` `required` (→ `required_params`) and `modes`;
- emits per-parameter `kind` (`dynamic`/`constant`) declared at the rule source;
- emits operator/function metadata (§2.3/§2.4);
- carries a standalone `metadata_version` (§5).

Because the engine owns this export, the following `SPEC.md` items are satisfied directly,
without an editor-side bridge:

- FR-130, FR-132 — metadata sufficiency for generic blocks;
- FR-133, FR-136, FR-137 — generic metadata-generated blocks;
- FR-056, UC-009, §13.10 — dynamic-vs-constant tooltips (from `kind`);
- AC-028 — "new rule appears as a generic block without editor code changes";
- §16.9, FR-122/124/125 — variant import matching (from `modes`).

This work lives in the Transon repository. The engine-parity checks in
[`traceability.md`](traceability.md) guard against drift between the export and the editor.

---

## 4. Editor-side normalization (presentation only)

With the engine-owned export (§3), the editor does not derive semantic fields. Its
normalization layer ([`ARCHITECTURE.md`](ARCHITECTURE.md) §5.5) is limited to **presentation**
concerns it legitimately owns (`SPEC.md` OQ-013):

- mapping rules to canonical palette categories (`SPEC.md` §13.4);
- deriving block variants from the engine `modes` (mechanical; §16.9 →
  [`ARCHITECTURE.md`](ARCHITECTURE.md) §5.7);
- palette ordering, labels/titles, colors, and specialized-renderer selection.

The editor must not maintain a parallel semantic source of truth. If the export is ever
missing a §2 field, that is an engine bug surfaced in diagnostics (`SPEC.md` §19.2), not an
editor-side augmentation. An automated parity check guards export↔editor agreement
(see [`traceability.md`](traceability.md)).

---

## 5. Schema versioning (NFR-044, NFR-034, FR-088 diagnostics)

- The editor records the Transon engine version and the metadata schema version it was
  built against (`SPEC.md` §10.3 `metadata_version`, §19.1).
- The metadata schema is versioned independently of the engine release so the editor can
  detect mismatches (NFR-034, NFR-035) and fail safely (NFR-036).
- When the metadata schema changes shape, bump its version; the editor's compatibility
  check (`SPEC.md` §8.7) compares declared compatible ranges.
