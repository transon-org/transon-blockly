# SPEC.md — Transon Visual Template Editor

> **Version:** 1.0 · **Status:** Pre-implementation baseline  
> **Last updated:** 2026-06-23

This document is the source of truth for the **what**: product behavior, use cases,
functional and non-functional requirements, behavioral architecture decisions, the
conceptual domain model, the UX model, rule coverage, and import/export/round-trip
semantics. The **how** (structure, public API, IR, flows) lives in
[`ARCHITECTURE.md`](ARCHITECTURE.md); the metadata **shape** in
[`metadata-contract.md`](metadata-contract.md); **verification** in
[`traceability.md`](traceability.md); and **sequencing** (milestones, readiness, open
questions, future work) in [`ROADMAP.md`](ROADMAP.md).

---

## Conventions

### Requirement keywords

This document uses RFC 2119-style keywords:

- **shall** / **must** — a mandatory requirement; an implementation is non-conforming if it
  is not met.
- **should** — a recommendation; deviations are allowed but must be justified and recorded.
- **may** — genuinely optional.

### Conditioned ("where ...") phrases

Several requirements are conditioned on metadata or engine behavior. These phrases have a
precise, testable meaning:

- **where metadata exposes / where available / where known** — the behavior is mandatory
  *when* the relevant field is present in the metadata
  ([`metadata-contract.md`](metadata-contract.md) §2), and is otherwise not required. The
  test is "field present ⇒ behavior present".
- **where possible** — the behavior is mandatory unless prevented by a documented
  limitation (e.g. the engine does not provide a template location for error mapping); the
  limitation must be recorded, not used as a silent escape hatch.

### Requirement ID allocation (L-1)

Requirement IDs are append-only and never renumbered (§22.2). New requirements added in
later revisions take the next free number in their family, so IDs are not monotonic with
reading order (for example FR-115..FR-138 were inserted into earlier sections §7.1..§7.14).
This is intentional; do not "fix" the ordering by renumbering.

---

## 1. Purpose

This project defines a visual, drag-and-drop editor for authoring **Transon templates**
using **Google Blockly**.

The editor allows users to assemble Transon templates from interlocking visual blocks,
similar to Scratch, while preserving Transon's core model:

```text
JSON input
+ Transon JSON template
→ Transon engine
→ JSON output / side effects
```

The editor is a visual authoring layer over real Transon templates. It must not create a
separate transformation language and must not hide the generated Transon JSON from users.

The primary product goal is to make Transon more accessible to low-code users while
remaining trustworthy for developers who need exact JSON template control, validation,
import/export, and deterministic round-trip behavior.

---

## 2. Problem Statement

Transon templates are powerful because they are JSON-compatible structures composed from
nestable rules.

This has several advantages:

- templates are data, not application source code;
- templates can be stored, generated, validated, diffed, and executed;
- transformation logic can be composed from small rule invocations;
- the engine can remain extensible through rules, operators, and functions;
- documentation examples and executable templates can share the same artifact model.

However, manually authoring complex Transon templates can become difficult for users who
are not comfortable with deeply nested JSON.

Common pain points:

- rule invocation syntax is easy to mistype;
- nested templates can be hard to read;
- rule parameters may themselves be templates;
- dynamic vs constant parameters are not always obvious;
- context-sensitive rules such as `item`, `key`, `value`, `index`, and `parent` require
  understanding the current scope;
- `NO_CONTENT` behavior is powerful but can be hard to reason about visually;
- variable scoping through `set` and `get` can be subtle;
- literal JSON objects and marker-based rule invocations can be confused;
- mutually exclusive parameter groups such as `name` vs `names` need clear UX;
- users need fast feedback from examples, validation, and execution.

This project should provide a focused visual editor that makes Transon template authoring
easier without weakening the underlying template semantics.

---

## 3. Product Scope

Version 1 should support:

- an embeddable Blockly-based visual editor component;
- a sandbox/playground mode with canvas, palette, template JSON, sample input, output,
  errors, and examples;
- a compact editor mode focused on canvas and palette;
- visual blocks for all built-in Transon rules;
- metadata-driven generic blocks for custom/new rules where metadata is complete;
- specialized block variants for important rules whose UX benefits from custom shape or
  labels;
- visual blocks for JSON literals, arrays, and objects;
- visual representation of nested templates;
- import from Transon JSON template;
- export to Transon JSON template;
- strict semantic round-trip for supported templates;
- generated JSON preview;
- editable sample input JSON in sandbox/playground mode;
- live execution preview using a host-provided Transon engine (§11.9, AD-018);
- engine-backed static validation using the actual Transon validation API;
- display of validation and runtime errors;
- mapping errors back to blocks where possible;
- block tooltips derived from generated Transon documentation/editor metadata;
- examples/test cases loaded from the same source artifacts as the documentation/playground
  where possible;
- no backend persistence in v1;
- manual import/export/copy/download workflows.

The editor should be designed as a reusable component that can later be embedded into:

- the Transon documentation site;
- an interactive playground;
- an internal low-code tool;
- a larger transformation-authoring product.

---

## 4. Non-Scope

Version 1 must not become a general workflow automation platform.

The following are explicitly out of scope for v1:

- backend user accounts;
- backend persistence;
- project/template database;
- collaborative editing;
- real-time multi-user editing;
- template marketplace;
- plugin marketplace;
- visual workflow builder unrelated to Transon;
- multi-step workflow orchestration outside Transon template semantics;
- scheduled execution;
- external API calls from the editor except loading documented Transon artifacts;
- arbitrary Python authoring in the UI;
- authoring new Python rules/operators/functions in the visual editor;
- production execution service for stored templates;
- role-based access control;
- approval workflow;
- Git-backed storage;
- JSFiddle-style public sharing links;
- automatic migration of arbitrary unsupported or future Transon syntax;
- direct bidirectional editing of generated JSON unless explicitly approved later;
- hiding the generated JSON from users;
- replacing the Transon documentation site.

The product should remain a visual Transon template editor, not an automation platform,
no-code backend, or general-purpose visual programming environment.

---

## 5. Target Users

### 5.1 Low-Code Template Author

A user who understands the desired JSON transformation but may not be comfortable writing
deeply nested Transon JSON manually.

Responsibilities:

- create templates visually;
- connect rules and values;
- provide sample input data in sandbox/playground mode;
- inspect generated output;
- fix validation/runtime errors;
- copy or export the resulting template.

Needs:

- visual rule categories;
- clear block labels;
- specialized blocks for common concepts;
- tooltips;
- examples;
- safe block connections;
- immediate feedback;
- readable generated JSON.

### 5.2 Developer Integrating Transon

A developer who already understands JSON and needs a safer, faster way to create, debug,
explain, or demonstrate Transon templates.

Responsibilities:

- import existing templates;
- verify generated JSON;
- test templates against sample inputs;
- inspect errors;
- ensure exported templates are valid Transon;
- integrate the editor component into other products.

Needs:

- strict semantic round-trip;
- accurate JSON generation;
- import/export reliability;
- engine-backed validation;
- visibility into rule semantics;
- stable component API;
- no hidden transformation semantics.

### 5.3 Documentation / Example Maintainer

A maintainer responsible for keeping Transon examples, documentation, and the playground
consistent.

Responsibilities:

- maintain rule documentation;
- maintain example corpus;
- ensure examples work in docs and editor;
- expose rule metadata to the editor;
- keep the visual editor aligned with engine releases.

Needs:

- generated metadata reuse;
- minimal duplicate documentation;
- examples attached to rules and parameters;
- compatibility checks against the current engine version;
- validation of examples.

### 5.4 Rule Author / Extension Author

A developer adding a new Transon rule, operator, or function.

Responsibilities:

- implement rule/operator/function behavior in Transon;
- provide structured metadata;
- provide examples/tests;
- ensure the rule can be validated and documented.

Needs:

- clear metadata contract;
- ability for new rules to appear in the editor without editor code changes;
- fallback generic block support;
- optional later specialized UX.

### 5.5 Embedding Application Developer

A developer embedding the editor component into another web application.

Responsibilities:

- configure editor options;
- provide initial template and sample input;
- receive exported template and execution result;
- decide where import/export controls live;
- optionally provide custom metadata.

Needs:

- stable component API;
- clear input/output contracts;
- theming hooks;
- event callbacks;
- version compatibility information;
- documented limitations.

---

## 6. Core Use Cases

### UC-001 — Create a simple template visually

A user opens an empty editor, drags blocks onto the Blockly canvas, connects them, and
creates a valid Transon template.

Example target template:

```json
{
  "$": "attr",
  "name": "customer"
}
```

The editor shows the generated JSON and validates it successfully.

### UC-002 — Build a nested object output

A user visually creates an output object with literal fields and Transon-derived values.

Example target template:

```json
{
  "$": "object",
  "fields": {
    "id": {
      "$": "attr",
      "name": "id"
    },
    "email": {
      "$": "attr",
      "names": ["customer", "email"]
    },
    "source": "crm"
  }
}
```

The editor represents the object as a visual structure, not only as raw text.

### UC-003 — Import existing Transon JSON

A user pastes or uploads a Transon JSON template.

The editor parses it into a Blockly workspace.

If the template is within the supported template surface (§16.10), the workspace is
created and the generated JSON is semantically equivalent to the imported template.

If the template cannot be represented faithfully, the editor reports a clear import error.

### UC-004 — Export generated Transon JSON

A user edits the visual blocks and exports the generated Transon JSON.

The exported template can be used directly with the Transon engine.

### UC-005 — Round-trip a supported template

A user imports a supported template, makes no changes, and exports it.

The exported template is semantically equivalent to the imported template.

The editor does not need to preserve the UI-only/formatting attributes listed in §12.5
(beyond object key ordering where it affects Transon behavior, §16.3).

### UC-006 — Validate template with the engine

A user clicks validation or edits the workspace.

The editor runs Transon static validation in the browser.

Validation errors are displayed in a readable way and linked to generated JSON paths or
corresponding blocks where possible.

### UC-007 — Execute template against sample input

A user provides sample JSON input.

The editor executes the current template through the Transon engine in the browser and
displays the output JSON.

If transformation fails, the editor displays the runtime error and highlights the closest
known template location.

### UC-008 — Use documentation examples

A user opens an example from the docs/example corpus.

The editor loads:

- the example template;
- sample input;
- expected output;
- associated rule documentation.

The user can modify the example and see updated output.

### UC-009 — Learn rule behavior through tooltips

A user hovers over a rule block or parameter.

The editor shows documentation derived from Transon rule/editor metadata.

The tooltip explains what the rule or parameter does and whether the parameter is dynamic
or constant where metadata exposes that distinction.

### UC-010 — Work with context-sensitive iteration rules

A user creates a `map` or `filter` template and uses `item`, `key`, `value`, or `index`
inside the iteration body.

The editor visually allows context-specific accessor blocks only where they make sense or
warns when they are used outside valid scope.

### UC-011 — Represent a literal object containing the marker key

A user needs to emit a JSON object that contains the Transon marker key, for example:

```json
{
  "$": "literal-value"
}
```

Because a dict containing the marker key is normally interpreted as a rule invocation, the
editor must represent this through the `object` rule escape mechanism (canonically
described, with the template example, in §12.4).

### UC-012 — Use all built-in rules

A developer can use any built-in Transon rule through visual blocks, including advanced
rules such as `set`, `get`, `chain`, `zip`, `file`, and `include`.

Advanced rules may be visually separated from common beginner-friendly rules, but they
must be available in v1.

### UC-013 — Add a new rule without editor code changes

A rule author adds a new Transon rule and provides complete metadata.

The editor reads the metadata and creates a generic palette block that can:

- accept the declared parameters;
- mark required inputs;
- generate Transon JSON;
- import matching Transon JSON;
- participate in validation/execution through the engine.

Specialized editor UX may be added later, but basic rule availability does not require
editor code changes.

### UC-014 — Use sandbox/playground mode

A user opens the editor in sandbox mode.

The UI shows the sandbox panels defined in §13.1.

The user can load an example, edit the template visually, edit input data, run the
template, and inspect the generated JSON.

### UC-015 — Use compact embedded editor mode

An embedding application opens the editor in compact editor mode.

The UI focuses on:

- Blockly canvas;
- palette;
- toolbar.

The embedding application may expose template JSON separately or use a visual/JSON/split
view switch.

---

## 7. Functional Requirements

### 7.1 Editor Shell

- **FR-001** The editor shall provide a Blockly-based visual canvas.
- **FR-002** The editor shall provide a generated Transon JSON panel in sandbox mode.
- **FR-003** The editor shall provide a sample input JSON panel in sandbox mode.
- **FR-004** The editor shall provide an execution output JSON panel in sandbox mode.
- **FR-005** The editor shall provide validation and runtime error display.
- **FR-006** The editor shall support manual import of a Transon JSON template.
- **FR-007** The editor shall support manual export/copy/download of a Transon JSON
  template.
- **FR-008** The editor shall support loading built-in examples.
- **FR-009** The editor shall be usable as an embeddable component.
- **FR-010** The editor shall expose enough events or callbacks for an embedding
  application to observe template changes, validation results, and execution results.
- **FR-115** The editor shall support a sandbox/playground mode with the panels defined in
  §13.1 (canvas, palette, generated template JSON, sample input JSON, output JSON,
  examples, and validation/execution controls).
- **FR-116** The editor shall support a compact embedded editor mode focused on canvas
  and palette.
- **FR-117** The embedded editor mode should support view switching between visual, JSON,
  and split views.
- **FR-118** In v1, JSON view may be read-only generated output unless direct JSON
  editing is explicitly approved.

### 7.2 Blockly Workspace

- **FR-011** The editor shall represent Transon templates as Blockly blocks.
- **FR-012** The editor shall support connecting rule outputs into rule parameters.
- **FR-013** The editor shall support nested templates.
- **FR-014** The editor shall support literal JSON scalar blocks:
  - string;
  - number;
  - boolean;
  - null.
- **FR-015** The editor shall support literal JSON array blocks.
- **FR-016** The editor shall support literal JSON object blocks.
- **FR-017** The editor shall visually distinguish rule invocation objects from literal
  objects.
- **FR-018** The editor shall support comments or descriptions on blocks if Blockly
  provides this capability without affecting generated Transon JSON.
- **FR-019** The editor shall not require users to edit raw Blockly workspace
  serialization directly.

### 7.3 Transon JSON Generation

- **FR-020** The editor shall generate valid JSON-compatible Transon templates from the
  Blockly workspace.
- **FR-021** The generated template shall use the configured Transon marker key.
- **FR-022** The default marker key shall be `"$"`.
- **FR-023** A rule block shall generate a dict containing the marker key and rule name.
- **FR-024** Rule parameters shall be generated as sibling keys of the marker key.
- **FR-025** Dynamic rule parameters shall be generated from connected template blocks.
- **FR-026** Constant rule parameters shall be generated as literal values according to
  the Transon rule contract.
- **FR-027** Empty optional parameters shall be omitted from the generated template unless
  explicitly set by the user.
- **FR-028** Generated JSON shall be stable enough for human review and snapshot testing.

### 7.4 Import from Transon JSON

- **FR-029** The editor shall parse imported Transon JSON into a Blockly workspace when
  the template is within the supported template surface (defined in §16.10).
- **FR-030** The editor shall detect rule invocation dicts using the configured marker key.
- **FR-031** The editor shall treat dicts without the marker key as literal JSON objects.
- **FR-032** The editor shall treat dicts with the marker key as rule invocations unless
  represented through the literal-marker escape mechanism.
- **FR-033** The editor shall reject or clearly report unsupported templates that cannot
  be represented faithfully (out-of-surface templates per §16.10).
- **FR-034** The editor shall preserve semantic equivalence during import/export for
  supported templates.
- **FR-035** Import errors shall include a template path or location where possible.
- **FR-036** The editor shall not silently rewrite unsupported templates into a different
  meaning.

### 7.5 Round-trip

- **FR-037** The editor shall support strict semantic round-trip for supported templates:

```text
Transon JSON template
→ Blockly workspace
→ Transon JSON template
```

- **FR-038** Round-trip equivalence shall be defined semantically, not textually.
- **FR-039** The editor does not need to preserve the UI-only/formatting attributes listed
  in §12.5 as part of the Transon template.
- **FR-040** The editor shall clearly report when strict round-trip cannot be guaranteed
  (e.g. for out-of-surface templates per §16.10).
- **FR-041** The editor shall include automated tests for round-trip behavior across all
  built-in rules.

### 7.6 Rule Coverage

The groupings below are for coverage readability only; each rule's canonical toolbox
category is defined once in §13.4.

- **FR-042** The editor shall support all built-in context accessor rules:
  - `this`;
  - `parent`;
  - `item`;
  - `index`;
  - `key`;
  - `value`.
- **FR-043** The editor shall support variable rules:
  - `set`;
  - `get`.
- **FR-044** The editor shall support data access rule:
  - `attr`.
- **FR-045** The editor shall support the collection and structure rules (categorized in
  §13.4 as Objects/Arrays, Iteration, and Composition):
  - `object`;
  - `map`;
  - `filter`;
  - `zip`;
  - `join`;
  - `chain`.
- **FR-046** The editor shall support computation rules:
  - `expr`;
  - `call`;
  - `format`.
- **FR-047** The editor shall support side-effect and composition rules:
  - `file`;
  - `include`.
- **FR-048** The editor shall support all built-in `expr` operators.
- **FR-049** The editor shall support all built-in `call` functions.
- **FR-050** The editor shall derive rule names, parameter names, and help text from
  generated Transon metadata where possible.
- **FR-051** The editor shall visually group rules by category.

### 7.7 Rule Parameter Handling

- **FR-052** The editor shall model required parameters.
- **FR-053** The editor shall model optional parameters.
- **FR-054** The editor shall model mutually exclusive parameter variants.
- **FR-055** The editor shall prevent or warn about incomplete mutually exclusive
  parameter variants.
- **FR-056** The editor shall distinguish dynamic parameters from constant parameters
  where metadata exposes that distinction.
- **FR-057** The editor shall support rule-specific parameter documentation.
- **FR-058** The editor shall support parameter-level examples where available.
- **FR-059** The editor shall not invent parameters not declared by Transon metadata.
- **FR-060** The editor shall reject unknown parameters during import unless they are
  supported through an extension metadata mechanism.

### 7.8 Mutually Exclusive Parameter Variants

- **FR-119** The editor shall represent mutually exclusive parameter groups primarily as
  separate Blockly block variants in the palette, not as a single block showing all
  conflicting parameters.
- **FR-120** A block variant is a visual block that maps to a Transon rule and emits a
  specific valid parameter shape.
- **FR-121** Multiple block variants may map to the same Transon rule.
- **FR-122** Each block variant shall define:
  - Transon rule name;
  - visible parameters;
  - required parameters;
  - optional parameters;
  - generated JSON shape;
  - import-matching rules;
  - contextual helper blocks available inside nested template inputs where applicable.
- **FR-123** The editor shall not expose mutually exclusive parameters in the same block
  unless the UI can prevent invalid combinations.
- **FR-124** When importing JSON, the editor shall select the matching block variant by
  inspecting present parameters.
- **FR-125** If imported parameters match multiple variants, zero variants, or only part
  of a required variant, the editor shall report an import/validation error instead of
  silently choosing a variant.
- **FR-126** Required inputs shall be visually marked on each block variant.
- **FR-127** A block variant with missing required inputs shall be visually invalid.
- **FR-128** The editor shall not export a template as valid while required parameters are
  missing.
- **FR-129** Dropdowns may still be used for small constant choices such as operator name,
  function name, boolean options, or enum-like parameters.

Example `attr` variants:

```text
Get one attribute
→ emits {"$": "attr", "name": ...}

Get deep attribute path
→ emits {"$": "attr", "names": ...}
```

Example `object` variants:

```text
Build object from fixed fields
→ emits {"$": "object", "fields": {...}}

Build object from dynamic key/value
→ emits {"$": "object", "key": ..., "value": ...}
```

Example `map` variants:

```text
Map list items
→ emits {"$": "map", "item": ...}

Map list items and flatten
→ emits {"$": "map", "items": ...}

Map dictionary entries
→ emits {"$": "map", "key": ..., "value": ...}
```

### 7.9 Literal Object and Marker Escaping

- **FR-061** The editor shall support emitting a literal object that contains the marker
  key.
- **FR-062** The editor shall use the Transon `object` rule escape mechanism for literal
  marker-key objects.
- **FR-063** The editor shall clearly distinguish:
  - a rule invocation object;
  - a normal literal object;
  - a literal object that contains the marker key.
- **FR-064** The editor shall include tests for literal objects containing `"$"` when the
  marker is `"$"`.
- **FR-065** The editor shall support custom marker keys if the editor instance is
  configured to use a non-default marker.

### 7.10 Validation

- **FR-066** The editor shall validate templates using the actual Transon engine, provided
  by the host through the runtime boundary (§11.9). Validation is unavailable when no host
  engine is supplied (AD-005, AD-018).
- **FR-067** Static validation shall use `Transformer.validate()` or equivalent engine API.
- **FR-068** Validation results shall be displayed in the UI.
- **FR-069** Validation errors shall include the original engine error message.
- **FR-070** Validation errors should be mapped to the corresponding block where possible.
- **FR-071** Blockly structural constraints may prevent obvious invalid templates before
  engine validation.
- **FR-072** Engine validation shall remain authoritative.
- **FR-073** The editor shall not report a template as valid if engine validation fails.

### 7.11 Execution Preview

- **FR-074** The editor shall execute the current template against sample input JSON through
  the host-provided engine (§11.9).
- **FR-075** Execution shall use the actual Transon engine supplied by the host (AD-005,
  AD-018).
- **FR-076** The editor shall display transformation output as formatted JSON.
- **FR-077** The editor shall display runtime errors.
- **FR-078** Runtime errors shall include the original engine error message.
- **FR-079** Runtime errors should be mapped to the corresponding block where possible.
- **FR-080** The editor shall support examples with expected output.
- **FR-081** The editor should visually indicate whether actual output matches expected
  output for examples.

### 7.12 Documentation and Editor Metadata

- **FR-082** The editor shall consume generated Transon documentation/editor metadata
  where available.
- **FR-083** Rule block labels should use rule titles/names from metadata.
- **FR-084** Rule tooltips should use rule documentation from metadata.
- **FR-085** Parameter tooltips should use parameter documentation from metadata.
- **FR-086** Example loading should use the generated example corpus where available.
- **FR-087** The editor shall handle missing metadata gracefully.
- **FR-088** The editor shall expose the Transon engine/docs metadata version in
  diagnostics.
- **FR-130** The Transon library shall provide sufficient machine-readable metadata for
  rules, operators, functions, parameters, examples, and validation constraints so the
  visual editor can render a functional generic block for newly introduced rules without
  editor code changes. The required fields and the engine-owned export that supplies them are
  specified in [`metadata-contract.md`](metadata-contract.md). This depends on the engine
  editor-metadata export (see that document, §3).
- **FR-131** Specialized editor code may improve UX for selected rules, but a new rule
  shall not require editor code changes for basic availability if its metadata is
  complete.
- **FR-132** The metadata contract shall provide the fields defined in
  [`metadata-contract.md`](metadata-contract.md) §2 (rule, parameter, operator, and
  function metadata). That document is the single source of truth for the metadata shape;
  this requirement must not restate the field list.

### 7.13 Custom Rules, Operators, and Functions

- **FR-089** The editor shall support custom rules, operators, and functions if they are
  present in generated Transon metadata.
- **FR-090** Custom rule blocks shall be generated from metadata where possible.
- **FR-091** Custom rule metadata must declare enough information for the editor to render
  a safe block, as defined by the minimum rule + parameter fields in
  [`metadata-contract.md`](metadata-contract.md) §2 (at minimum: name, parameters,
  `required_params`, `modes`, documentation, and per-parameter `kind`).
- **FR-092** If custom metadata is incomplete, the editor shall either:
  - render a generic advanced rule block with limitations; or
  - reject the custom rule with an actionable error.
- **FR-093** The editor shall not provide a UI for writing Python rule implementation code
  in v1.

### 7.14 Metadata-Driven Block Generation

- **FR-133** The editor shall generate generic Blockly block definitions from Transon
  metadata where possible.
- **FR-134** The editor shall generate toolbox/palette entries from metadata and block
  variant definitions.
- **FR-135** The editor shall support specialized block renderers that override generic
  rendering for selected rules or variants.
- **FR-136** If a specialized renderer is unavailable, the editor shall fall back to a
  generic metadata-generated block when metadata is sufficient.
- **FR-137** Generic metadata-generated blocks shall support:
  - block label;
  - rule description;
  - parameter inputs;
  - required input indicators;
  - optional inputs;
  - mutually exclusive variants;
  - generated JSON export;
  - JSON import where parameter shape matches one declared variant;
  - engine-backed validation and execution.
- **FR-138** Generic metadata-generated blocks shall not claim polished low-code UX; they
  provide baseline compatibility.

### 7.15 Error Mapping

- **FR-094** The editor shall maintain a mapping between generated JSON paths and Blockly
  blocks.
- **FR-095** The editor shall use that mapping to highlight blocks related to validation
  errors.
- **FR-096** The editor shall use that mapping to highlight blocks related to runtime
  errors where the engine provides template location information.
- **FR-097** If exact block mapping is impossible, the editor shall show the nearest known
  parent block.
- **FR-098** Error display shall distinguish the error categories defined in the canonical
  error taxonomy (§17.6) and present them differently to the user.

### 7.16 Import / Export UX

- **FR-099** The editor shall allow users to paste template JSON.
- **FR-100** The editor shall allow users to copy generated template JSON.
- **FR-101** The editor should allow users to download generated template JSON as a file.
- **FR-102** The editor should allow users to load sample input JSON from examples.
- **FR-103** The editor shall not require backend storage for import/export in v1.
- **FR-104** The editor shall warn users about unsaved local changes before replacing the
  workspace.

### 7.17 Component Embedding

- **FR-105** The editor shall be designed as an embeddable component.
- **FR-106** The component shall accept initial template JSON.
- **FR-107** The component shall accept initial sample input JSON.
- **FR-108** The component shall expose current generated template JSON.
- **FR-109** The component shall expose validation status.
- **FR-110** The component shall expose execution status and output.
- **FR-111** The component shall support read-only mode.
- **FR-112** The component should support theming hooks.
- **FR-113** The component should support configurable rule categories.
- **FR-114** The component should support configurable marker key.

---

## 8. Non-Functional Requirements

### 8.1 Correctness

- **NFR-001** The editor shall preserve Transon semantics.
- **NFR-002** The editor shall not silently change template meaning.
- **NFR-003** The generated template shall be executable by the Transon engine.
- **NFR-004** Engine validation shall be the authoritative source of truth. This is the
  canonical statement of the "engine is authoritative" principle referenced by FR-072,
  FR-073, AD-004, §22.4, and §22.6.
- **NFR-005** Import/export behavior shall be covered by automated tests.

### 8.2 Usability

- **NFR-006** The editor shall be understandable for low-code users.
- **NFR-007** Common rules shall be easy to discover.
- **NFR-008** Advanced rules shall remain available without overwhelming beginners.
- **NFR-009** Error messages shall be actionable.
- **NFR-010** Users shall always be able to inspect generated JSON.
- **NFR-011** Tooltips shall be available for rules and parameters where documentation
  exists.
- **NFR-041** Structurally different rule shapes should be represented as separate
  palette blocks instead of hidden dropdown modes.
- **NFR-042** Generic metadata-generated blocks are acceptable for baseline compatibility
  but should not degrade UX for common built-in rules.

### 8.3 Learnability

- **NFR-012** The editor shall support example-driven learning.
- **NFR-013** Examples shall include template, input data, and expected output where
  available.
- **NFR-014** Rule blocks shall explain how they map to Transon JSON.
- **NFR-015** Documentation shown in the editor should stay synchronized with Transon docs
  metadata.

### 8.4 Maintainability

- **NFR-016** The editor shall avoid duplicating Transon rule documentation where metadata
  can be generated.
- **NFR-017** The editor shall avoid hardcoding rule behavior beyond what is necessary for
  visual block shape and UX.
- **NFR-018** Rule/block definitions shall be testable independently.
- **NFR-019** The editor shall have snapshot tests for generated templates.
- **NFR-020** The editor shall have round-trip tests for all built-in rules.
- **NFR-021** The editor shall make it easy to add support for future Transon rules.
- **NFR-043** New rules with complete metadata should be available in the editor without
  editor code changes through generic block generation.

### 8.5 Performance

- **NFR-022** The editor should remain responsive for typical documentation/playground-sized
  templates.
- **NFR-023** Validation should not block editing for long-running operations.
- **NFR-024** Execution preview should debounce frequent edits where auto-run is enabled.
- **NFR-025** Where a host provides an engine runtime, the editor should surface its
  initialization/loading state (status from the host boundary, §11.9). The editor itself does
  not initialize any engine runtime (AD-005, AD-018).
- **NFR-026** Large templates should not make the Blockly canvas unusable within reasonable
  limits.

### 8.6 Security

- **NFR-027** The editor shall not execute arbitrary user-provided Python code outside the
  Transon engine/runtime environment.
- **NFR-028** The editor shall not transmit user template or input data anywhere itself; it
  passes them only to the host-provided engine across the runtime host boundary (§11.9, AD-005,
  AD-018). Whether the engine the data reaches is local is a property of the host the embedder
  chooses and must be disclosed by the host.
- **NFR-029** The editor shall not send user template or input data to a backend service of
  its own in v1. (A host may supply a non-local engine; that is the host's responsibility and
  must be disclosed by the host, §11.9.)
- **NFR-030** The editor shall not persist user templates remotely in v1.
- **NFR-031** If examples are loaded remotely, they shall be treated as data and not
  executable application code.
- **NFR-032** The `file` rule shall not write files to the user's local filesystem during
  browser preview.

### 8.7 Compatibility

- **NFR-033** The editor shall declare compatible Transon engine versions.
- **NFR-034** The editor shall declare compatible metadata schema versions.
- **NFR-035** The editor shall detect version mismatches where possible.
- **NFR-036** The editor should fail safely if rule metadata and engine behavior disagree.
- **NFR-044** Transon should maintain a stable editor metadata schema or versioned metadata
  schema for visual-editor compatibility.

### 8.8 Deployability

- **NFR-037** The editor shall be buildable as a static frontend artifact.
- **NFR-038** The editor shall not require a backend for v1 operation.
- **NFR-039** The editor shall be embeddable into the documentation site or another
  React-powered application.
- **NFR-040** The editor shall be usable in a standalone demo application.

### 8.9 Accessibility

- **NFR-045** The editor should meet baseline accessibility: keyboard navigation where
  Blockly supports it, readable contrast, visible focus states, error messaging that does
  not rely on color alone, and screen-reader labels for major panels where feasible. These
  expectations are verified by the accessibility tests in §21.5.

---

## 9. Architecture Decisions

> Behavioral decisions AD-001..AD-017 are recorded below. Implementation architecture
> decisions AD-018..AD-028 continue the same family and live in
> [`ARCHITECTURE.md`](ARCHITECTURE.md) §3 (the *how*).

### AD-001 — Use Google Blockly for the visual editor

The project shall use Google Blockly as the visual drag-and-drop programming interface.

Rationale:

- mature visual programming toolkit;
- supports interlocking block composition;
- supports custom blocks;
- supports serialization;
- supports toolboxes and categories;
- suitable for representing nested template structures.

### AD-002 — Build an embeddable editor component

The primary deliverable shall be an embeddable editor component/library.

A demo application may be created, but the editor should not be designed only as a
standalone app.

Rationale:

- enables later embedding into the Transon docs site;
- supports reuse in internal tools;
- separates editor logic from hosting application;
- matches the desired target environment.

### AD-003 — Use Transon JSON as the canonical artifact

The executable Transon JSON template shall be the canonical source of truth.

Blockly workspace state is an editable projection of that template, plus optional UI-only
metadata.

Rationale:

- Transon templates are JSON data;
- templates must be executable outside the editor;
- JSON templates can be stored, diffed, validated, copied, and tested;
- the editor must not create a separate language.

### AD-004 — Support strict semantic round-trip

The editor shall support strict semantic round-trip for supported templates.

Rationale:

- developers must trust the visual editor;
- imported templates must not be silently changed;
- generated templates must remain valid Transon templates;
- correctness matters more than preserving visual layout.

### AD-005 — Engine validation/execution runs through a host-provided runtime

The editor shall not bundle or initialize a Transon engine runtime. Instead it consumes a
host-provided engine through the runtime host boundary (§11.9): the host supplies an engine
implementation used for validation and execution, and the editor works without one
(authoring, generation, import/export, and round-trip remain available; validate/run are
disabled). The exact runtime mechanism (in-browser, server, or mock) is the host's
responsibility; the editor is runtime-agnostic. The implementation detail of how the editor
owns no runtime is in [`ARCHITECTURE.md`](ARCHITECTURE.md) §3 (AD-018, AD-021).

Rationale:

- keeps the editor framework- and runtime-agnostic;
- lets hosts choose any engine runtime, a server engine, or a mock;
- validation/execution still use the actual engine when a host provides one;
- supports a no-backend deployment when the host runs the engine locally.

### AD-006 — Use generated Transon documentation/editor metadata

The editor shall consume generated Transon metadata for rule documentation, parameter
documentation, examples, variants, and constraints where possible.

Rationale:

- avoids duplicate documentation;
- keeps editor help synchronized with engine docs;
- enables metadata-driven custom rule support;
- aligns with the existing docs/playground approach.

### AD-007 — Support all built-in rules in v1

The editor shall include visual support for all built-in Transon rules in v1.

Rationale:

- full rule coverage supports strict import/round-trip;
- partial rule support weakens trust;
- advanced users need faithful editor behavior.

Trade-off:

- more complex UX;
- advanced rules must be separated or progressively disclosed to avoid overwhelming
  low-code users.

### AD-008 — Use hybrid block typing

The editor shall use a hybrid typing model.

Structural constraints should be strict where the Transon rule contract is known. Runtime
data type expectations should be advisory where values are dynamic.

Rationale:

- many rule parameters are templates;
- runtime type depends on input data;
- overly strict static typing would reject valid templates;
- loose typing would allow too many invalid structures.

### AD-009 — No backend persistence in v1

The editor shall not include backend storage in v1.

Rationale:

- keeps v1 small;
- avoids authentication and sharing complexity;
- supports static deployment;
- user selected manual import/export first.

### AD-010 — Future JSFiddle-style sharing is out of scope for v1

JSFiddle-style sharing may be added later but is not part of v1.

Rationale:

- requires storage and sharing model;
- requires security and abuse considerations;
- not necessary for initial editor correctness.

### AD-011 — `file` writes are captured side effects provided by the host runtime

The `file` rule shall be representable and executable, but no real filesystem write shall
occur during preview. The host-provided engine captures writes (via the engine `write_file`
delegate) and returns them as `ExecutionResult.filesWritten`; the editor displays them in a
"files produced" view (§13.9, §17.7).

Rationale:

- supports all built-in rules;
- avoids unsafe filesystem behavior;
- makes side effects visible and testable;
- keeps the capture mechanism in the host runtime the editor does not own.

### AD-012 — `include` resolution is provided by the host runtime

The `include` rule shall be supported in the editor. The host-provided engine resolves
includes from sources it controls (loaded examples, embedding configuration, a supplied
include map) via the engine `template_loader` delegate / an `includeLoader` passed across the
host boundary (§11.9). The editor shall report clearly when the host cannot resolve an
include (§18.10).

Rationale:

- `include` is part of the built-in rule surface;
- execution needs an explicit template loader, owned by the host;
- missing include loader should be reported clearly.

### AD-013 — Keep AI development governed by the spec

Behavior-changing implementation must update this `SPEC.md`.

Rationale:

- project semantics are subtle;
- editor behavior must remain aligned with Transon;
- AI-assisted development can otherwise drift from the specification.

### AD-014 — Metadata-driven blocks with specialized variants

The editor shall generate Blockly blocks from Transon rule/operator/function metadata
where possible.

The editor may provide specialized block variants for rules whose visual UX benefits from
a custom shape, labels, contextual helper blocks, or parameter layout.

When a specialized variant exists, it may override the generic metadata-generated
representation. When no specialized variant exists, the editor shall fall back to a
generic metadata-generated block if metadata is sufficient.

Rationale:

- allows new Transon rules to appear in the editor with minimal code changes;
- avoids duplicating docs manually;
- keeps common rules usable for low-code users;
- preserves extensibility for custom rules;
- supports strict import/export by mapping rule parameter shapes to block variants.

### AD-015 — Represent mutually exclusive parameters as block variants

Rules with mutually exclusive parameter groups shall be represented primarily as separate
palette block variants, not as a single block with a hidden mode dropdown.

Rationale:

- visual blocks should expose semantic shape;
- low-code users should choose meaningful palette items, not raw parameter modes;
- the UI prevents invalid parameter combinations before engine validation;
- import/export can map JSON parameter shapes to block variants;
- required parameters are simpler to control per variant.

Trade-off:

- the palette contains more blocks;
- palette organization and naming become more important.

### AD-016 — Transon-owned rule metadata contract

The Transon library shall be the source of truth for rule/operator/function metadata used
by documentation and by the visual editor.

Rationale:

- avoids duplicating rule knowledge in the editor;
- allows new rules to appear in the editor without editor changes;
- keeps documentation, validation, examples, and visual editing aligned;
- supports custom extensions through the same metadata path.

Trade-off:

- Transon must maintain a stable metadata schema;
- rule authors must provide enough structured metadata, not only prose docstrings.

### AD-017 — Support sandbox and compact editor modes

The editor shall support two primary UI modes:

- sandbox/playground mode;
- compact embedded editor mode.

Rationale:

- docs/playground usage needs input/output/template panels;
- embedding applications may only need the visual editor;
- view-mode configuration avoids forcing one layout on all consumers.

---

## 10. Domain Model

### 10.1 TransonTemplate

The canonical executable template.

Conceptual fields:

- `json`;
- `marker`;
- `transon_version`;
- `metadata_version`;
- `created_from_workspace`;
- `round_trip_status`.

The actual exported artifact is the JSON template itself. Additional metadata may be
stored separately but must not be required for execution.

### 10.2 BlocklyWorkspace

The visual editing model.

Conceptual fields:

- `blocks`;
- `connections`;
- `coordinates`;
- `collapsed_state`;
- `comments`;
- `selection`;
- `zoom`;
- `ui_metadata`.

The Blockly workspace is not canonical for Transon execution.

### 10.3 EditorSession

Represents one in-browser editing session.

Fields:

- `workspace`;
- `template_json`;
- `sample_input_json`;
- `execution_output_json`;
- `validation_status`;
- `execution_status`;
- `errors`;
- `selected_example`;
- `marker`;
- `engine_version`;
- `metadata_version`;
- `editor_mode`.

### 10.4 RuleMetadata

Generated metadata describing a Transon rule. Field shapes follow
[`metadata-contract.md`](metadata-contract.md) §2.1.

Fields:

- `name`;
- `title`;
- `description`;
- `category`;
- `advanced`;
- `params` (each a `ParameterMetadata`, §10.5);
- `required_params` (the engine `_required`; the single source of required-ness);
- `modes` (the engine `_modes`; the single source from which `variants` are derived);
- `variants` (derived `RuleVariantMetadata`, §10.6);
- `examples`;
- `constraints`.

Per-parameter dynamic/constant lives in `params[].kind` (§10.5); there is no separate
`parameter_kinds` field.

### 10.5 ParameterMetadata

Generated or derived metadata describing a rule parameter. Field shapes follow
[`metadata-contract.md`](metadata-contract.md) §2.2.

Fields:

- `name`;
- `title`;
- `description`;
- `kind` — one of `dynamic` (accepts a template) or `constant` (literal/dropdown). This
  single field replaces the previously redundant `dynamic`/`constant` booleans;
- `examples`.

Required-ness is not stored per parameter; it is derived from the owning rule's
`required_params` and `modes` (§10.4). This removes the redundant `required`/`optional`
pair.

### 10.6 RuleVariantMetadata

Generated or derived metadata describing one valid parameter shape for a rule.

Fields:

- `id`;
- `rule_name`;
- `title`;
- `description`;
- `required_params`;
- `optional_params`;
- `visible_params`;
- `generated_shape`;
- `import_matcher`;
- `contextual_blocks`;
- `advanced`.

Example:

```yaml
rule: attr
variants:
  - id: one_attribute
    title: Get one attribute
    required_params: [name]
    optional_params: [default]
  - id: deep_attribute_path
    title: Get deep attribute path
    required_params: [names]
    optional_params: [default]
```

### 10.7 BlockDefinition

Editor-side definition of a Blockly block.

Fields:

- `block_type`;
- `label`;
- `source`;
- `rule_name`;
- `variant_id`;
- `renderer`;
- `inputs`;
- `output_type`;
- `category`;
- `advanced`;
- `tooltip`;
- `generator`;
- `import_matcher`.

`source` values:

- `metadata_generic`;
- `metadata_variant`;
- `specialized_builtin`;
- `specialized_custom`.

### 10.8 ExampleCase

A documentation/playground example.

Fields:

- `name`;
- `doc`;
- `tags`;
- `template`;
- `data`;
- `result`;
- `rule`;
- `param`.

### 10.9 ValidationResult

Result of static template validation.

Fields:

- `status`;
- `valid`;
- `error_type`;
- `error_message`;
- `template_path`;
- `block_id`;
- `raw_engine_error`.

### 10.10 ExecutionResult

Result of running a template against sample input.

Fields:

- `status`;
- `success`;
- `output`;
- `error_type`;
- `error_message`;
- `template_path`;
- `block_id`;
- `files_written`;
- `raw_engine_error`.

### 10.11 ImportResult

Result of importing Transon JSON into Blockly.

Fields:

- `status`;
- `success`;
- `workspace`;
- `errors`;
- `warnings`;
- `unsupported_paths`;
- `round_trip_guaranteed`.

### 10.12 JsonPathBlockMap

Mapping between generated template locations and Blockly blocks.

Fields:

- `template_path`;
- `block_id`;
- `rule_name`;
- `parameter_name`;
- `nearest_parent_block_id`.

---

## 11. Configuration and Metadata Model

### 11.1 Metadata Source

The preferred metadata source is Transon itself. The required metadata fields and the
contract between Transon and the editor are specified in
[`metadata-contract.md`](metadata-contract.md).

The editor should not independently maintain the authoritative rule catalog.

The metadata normalization layer and the generic/specialized block generation flows are
implementation detail; see [`ARCHITECTURE.md`](ARCHITECTURE.md) §5.5–§5.6. The behavioral
requirements remain here and in §7.14 (metadata-driven block generation); the normalization
layer is presentation-only because the engine owns semantic metadata (AD-022).

### 11.5 Minimum Rule Metadata Contract

The required rule, parameter, operator, and function metadata fields are defined once in
[`metadata-contract.md`](metadata-contract.md) §2. That document specifies the engine-owned
editor-metadata export (AD-022, [`ARCHITECTURE.md`](ARCHITECTURE.md) §5.8) that supplies
those fields, including per-parameter `kind`.

### 11.6 Minimum Operator Metadata Contract

See [`metadata-contract.md`](metadata-contract.md) §2.3.

### 11.7 Minimum Function Metadata Contract

See [`metadata-contract.md`](metadata-contract.md) §2.4.

### 11.8 Incomplete Metadata

If metadata is incomplete:

- built-in rules are covered by the engine-owned editor-metadata export (AD-022); any
  residual gap is surfaced in diagnostics and fixed engine-side, not worked around silently;
- custom rules may be rejected or rendered as limited generic blocks;
- missing metadata should be visible in diagnostics;
- metadata gaps should be tracked as Transon/library issues.

### 11.9 Runtime Host Boundary

The editor owns no engine runtime (AD-005, AD-018). Validation, execution, include
resolution, and `file`-write capture are provided by the embedding host through an injected
engine across a single boundary. The interface (`TransonEditorHost`, `EngineProvider`) is
defined in [`ARCHITECTURE.md`](ARCHITECTURE.md) §5.2/§5.3. Behavioral expectations:

- the editor passes the generated template, sample input, marker, and an include resolver to
  the host engine, and consumes `ValidationResult` / `ExecutionResult` (the latter including
  captured `file` writes);
- without a host engine, validation/execution are disabled while authoring, generation, and
  import/export remain fully available;
- the host engine is the authoritative validator/executor (NFR-004); the editor must not
  report validity the host did not confirm.

---

## 12. Template / Workspace Model

### 12.1 Canonical Template

The canonical executable artifact is Transon JSON.

Example:

```json
{
  "$": "attr",
  "name": "email"
}
```

### 12.2 Rule Invocation

A rule invocation is represented as a JSON object containing the configured marker key.

Default marker:

```json
"$"
```

Example rule invocation:

```json
{
  "$": "attr",
  "name": "email"
}
```

### 12.3 Literal Object

A literal object without the marker key is walked recursively as a JSON object.

Example:

```json
{
  "name": {
    "$": "attr",
    "name": "name"
  },
  "source": "crm"
}
```

### 12.4 Literal Object Containing Marker Key

A literal object containing the marker key must be emitted through the `object` rule escape
mechanism.

Example intended output:

```json
{
  "$": "literal-value"
}
```

Example template:

```json
{
  "$": "object",
  "fields": {
    "$": "literal-value"
  }
}
```

### 12.5 Workspace Projection

Blockly workspace state is a projection of the Transon template.

The editor may keep UI-only metadata such as:

- block positions;
- collapsed state;
- comments;
- selected block;
- zoom;
- visual grouping;
- whitespace and JSON formatting of the generated text.

This metadata is not part of the executable template and need not be preserved across
round-trip (§7.5). This is the canonical list of what the editor treats as UI-only.

### 12.6 Export Contract

Export produces the canonical Transon JSON template.

It may optionally also produce a separate editor state bundle:

```json
{
  "template": {},
  "workspace": {},
  "editor_metadata": {}
}
```

This bundle is not required in v1.

### 12.7 Import Contract

Import consumes Transon JSON.

For supported templates, import produces a Blockly workspace whose generated JSON is
semantically equivalent to the imported template.

For unsupported templates, import fails with a clear error instead of silently changing
meaning.

---

## 13. Editor UX Model

### 13.1 Sandbox / Playground Mode

Sandbox mode is the full playground/dev/demo experience.

Recommended layout:

```text
┌──────────────────────┬──────────────────────┐
│ Palette              │ Template JSON         │
├──────────────────────┼──────────────────────┤
│ Blockly Canvas       │ Input JSON            │
│                      ├──────────────────────┤
│                      │ Output / Errors       │
└──────────────────────┴──────────────────────┘
```

Sandbox mode includes:

- canvas;
- palette;
- generated template JSON;
- input JSON;
- output JSON;
- validation/runtime errors;
- examples;
- run/validate buttons.

### 13.2 Compact Embedded Editor Mode

Compact editor mode is the embeddable visual editor experience.

Default layout:

```text
┌──────────────────────────────┐
│ Toolbar                      │
├──────────────────────────────┤
│ Palette + Blockly Canvas     │
└──────────────────────────────┘
```

Optional view switch:

```text
View: [ Visual | JSON | Split ]
```

For v1:

- Visual view shows Blockly canvas and palette;
- JSON view may be read-only generated output;
- Split view may show visual editor and generated JSON side by side;
- direct JSON editing and sync back to blocks is future work unless explicitly approved.

### 13.3 Toolbar Actions

The toolbar should include:

- New;
- Import Template;
- Export / Copy Template;
- Validate;
- Run;
- Load Example;
- Reset Example;
- Format JSON;
- Toggle Advanced Blocks;
- Toggle View: Visual / JSON / Split where enabled.

### 13.4 Blockly Toolbox Categories (canonical category set)

This is the single canonical category set and rule-to-category mapping. The rule-coverage
groupings in §7.6 (FR-042..FR-047) and the per-rule subsections in §15 are organized by
*topic* for readability but assign each rule to the category below; they reference this
table rather than defining competing taxonomies.

| Category | Rules / blocks |
|----------|----------------|
| Input / Context | `this`, `parent`, `item`, `index`, `key`, `value` |
| Variables | `set`, `get` |
| Data Access | `attr` |
| Objects / Arrays | `object`; literal array and object blocks |
| Iteration | `map`, `filter` |
| Composition | `chain`, `zip`, `join` |
| Computation | `expr`, `call` |
| Formatting | `format` |
| Side Effects | `file` |
| Includes | `include` |
| Literals | string, number, boolean, null literal blocks |
| Custom | custom rules from metadata |

`Advanced` is an orthogonal progressive-disclosure flag (§13.6), not a mutually exclusive
home category: an advanced rule still belongs to one category above but may be hidden until
advanced blocks are enabled.

### 13.5 Palette Entries as Block Variants

The palette should show block variants, not only raw rule names, grouped by the canonical
categories (§13.4). See §7.8 for the canonical `attr`/`object`/`map` variant examples.

Internally, several palette blocks may generate the same Transon rule with different
parameter shapes.

### 13.6 Progressive Disclosure

Common beginner-friendly blocks should be visible by default.

Advanced blocks may be available under advanced categories or toggles, including:

- `set`;
- `get`;
- `parent`;
- `zip`;
- `file`;
- `include`;
- custom rules.

### 13.7 Generated JSON Panel

The generated JSON panel shall:

- update when blocks change;
- show formatted JSON;
- show invalid generation state if the workspace is incomplete;
- allow copying;
- optionally allow direct editing in a future version.

### 13.8 Sample Input Panel

The sample input panel shall:

- allow editing JSON input;
- validate JSON syntax;
- show syntax errors;
- load from examples when selected.

### 13.9 Output Panel

The output panel shall show:

- transformation result;
- runtime errors;
- captured file outputs;
- expected vs actual result for examples.

### 13.10 Tooltips

Rule and parameter tooltips should be derived from generated Transon metadata.

Tooltips should explain:

- rule purpose;
- parameter purpose;
- whether parameter is required;
- whether parameter is dynamic or constant where known;
- common examples.

---

## 14. Blockly Block Model

### 14.1 Block Output Types

The editor shall use advisory output types such as:

- `template`;
- `scalar`;
- `string`;
- `number`;
- `boolean`;
- `null`;
- `array`;
- `object`;
- `rule`;
- `operator`;
- `function`;
- `parameter`;
- `path`.

These types help the UI but must not override engine validation.

### 14.2 Rule Blocks

Each Transon rule should have one or more corresponding Blockly block variants.

A rule block variant generates:

```json
{
  "$": "<rule-name>",
  "<param>": "<param-template-or-literal>"
}
```

### 14.3 Block Variants

A block variant represents one valid semantic shape of a rule. Each variant's matcher is
derived from the engine modes (§16.9). See §7.8 for the canonical variant examples.

### 14.4 Parameter Inputs

Rule parameters are represented as block inputs.

Required parameters should be visually marked.

Optional parameters should be addable/removable or visually optional.

Mutually exclusive groups should generally become separate block variants.

### 14.5 Dynamic Parameters

Dynamic parameters accept templates.

Example:

```json
{
  "$": "attr",
  "name": {
    "$": "attr",
    "name": "dynamic_key"
  }
}
```

The editor should allow a template block to connect into a dynamic parameter.

### 14.6 Constant Parameters

Constant parameters should accept literal values or dropdowns.

Example:

```json
{
  "$": "expr",
  "op": "add",
  "value": 1
}
```

The `op` value is constant and should be selected from known operators.

### 14.7 Literal Blocks

The editor shall include blocks for:

- string literal;
- number literal;
- boolean literal;
- null literal;
- array literal;
- object literal.

### 14.8 Array Blocks

Array blocks shall support dynamic number of items.

Each item is a template.

### 14.9 Object Blocks

Object blocks shall support dynamic number of fields.

Each field has:

- literal key;
- template value.

If the object contains the marker key, the editor must use or recommend the `object` rule
escape mechanism.

### 14.10 Generic Advanced Rule Block

If metadata exists but no specialized block exists, the editor may render a generic rule
block.

The generic block shall allow parameters declared in metadata.

It shall not allow undeclared parameters unless explicitly enabled for debugging.

### 14.11 Invalid / Unsupported Block

If an imported template cannot be represented using available blocks, the editor may
create an unsupported placeholder block only if that block preserves the original JSON
exactly and blocks editing that would corrupt it.

Otherwise, import shall fail.

### 14.12 Statement Ordering and `set`

Most rule blocks are value-producing: they evaluate to a JSON value that connects into a
parent parameter input. `set` is different — it produces `NO_CONTENT` and its effect is a
side effect on the current scope (it defines a variable that later `get` reads). Its
*position relative to its siblings* is therefore semantically significant, so the block
model must represent ordered evaluation, not only value nesting.

- `set` is modeled as a value block that still occupies an ordered position: as an
  `object` field value, as an array item, or as a `chain` step.
- Evaluation order follows Transon's literal dict/list walking order and `chain` step
  order. The editor shall emit object keys and array items in the visual order of their
  blocks (top-to-bottom / first-to-last), and shall preserve that insertion order on
  import/export so a `set` evaluated before a dependent `get` stays before it (§16.3).
- The editor shall surface this order visually (a `set` placed above/before the blocks
  that read it) so the ordering is inspectable.
- The editor should warn that moving a `set` across `chain`, `map`, `filter`, or
  object/array siblings may change behavior (mirrors §15.2).
- `get` is value-producing and may appear anywhere a value is expected; correctness of
  set-before-get within a scope is the author's responsibility, made visible by the
  ordering rules above.

---

## 15. Transon Rule Coverage

The subsections below are organized by topic for readability; each rule's canonical
toolbox category is defined once in §13.4.

### 15.1 Context Accessors

Rules:

- `this`;
- `parent`;
- `item`;
- `index`;
- `key`;
- `value`.

Requirements:

- context accessor blocks have no parameters;
- `this` is always available;
- `parent` is valid only in non-root scope;
- `item`, `key`, `value`, and `index` are valid only inside relevant `map`/`filter`
  contexts;
- invalid scope should be warned visually or caught by engine validation.

### 15.2 Variables

Rules:

- `set`;
- `get`.

Requirements:

- variable name is dynamic;
- variable name must not use the reserved context names `this`, `item`, `key`, `value`,
  `index` (the editor should validate this before engine validation);
- `get` supports optional `default`;
- editor should explain that variable scope is contextual and order-sensitive;
- editor should warn that moving `set` across `chain`, `map`, `filter`, or object/list
  siblings may change behavior.

### 15.3 Data Access

Rule:

- `attr`.

Recommended block variants:

- Get one attribute;
- Get deep attribute path.

Modes:

- `name`;
- `names`;
- optional `default`.

Requirements:

- editor shall support single key/index access;
- editor shall support deep path access;
- editor shall support default value;
- path segments may be dynamic templates.

### 15.4 Object Construction

Rule:

- `object`.

Recommended block variants:

- Build object from fixed fields;
- Build object from dynamic key/value.

Modes:

- `key` + `value`;
- `fields`.

Requirements:

- editor shall support dynamic key/value object creation;
- editor shall support literal fields mode;
- editor shall support literal marker-key emission through `fields`;
- editor shall show that `NO_CONTENT` key/value results may omit entries.

### 15.5 Iteration

Rules:

- `map`;
- `filter`.

Recommended `map` block variants:

- Map list items;
- Map list items and flatten;
- Map dictionary entries.

`filter` parameter:

- `cond` (required) — the condition template evaluated per element; the element is kept
  when `cond` is truthy. `filter` has a single shape (no variants), unlike `map`.

Requirements:

- editor shall support mapping lists to lists;
- editor shall support mapping lists to flattened lists through `items`;
- editor shall support mapping dicts to dicts through `key` + `value`;
- editor shall support filtering lists and dicts through the required `cond` parameter;
- editor shall mark `filter`'s `cond` input as required (an empty `cond` is invalid);
- editor shall visually expose iteration context blocks (`item`, `index`, `key`, `value`)
  inside map/filter bodies;
- editor should indicate that `NO_CONTENT` results are skipped where applicable.

### 15.6 Zipping

Rule:

- `zip`.

Requirements:

- editor shall support `items` parameter;
- editor shall show that `zip` transposes iterables into rows;
- runtime type errors shall be shown when input items are not iterable.

### 15.7 Joining

Rule:

- `join`.

Parameters:

- `items`;
- `sep`;
- `default`.

Requirements:

- editor shall support joining strings;
- editor shall support joining lists;
- editor shall support joining dicts;
- editor shall show that mixed-type joins are runtime errors;
- editor shall show that `NO_CONTENT` items are omitted;
- editor shall support default output when no items remain.

### 15.8 Chaining

Rule:

- `chain`.

Parameter:

- `funcs`.

Requirements:

- editor shall represent `chain` as an ordered pipeline of templates;
- users shall be able to add, remove, and reorder chain steps;
- editor shall explain that each result becomes `this` for the next step;
- editor shall warn that variable scoping in `chain` can affect behavior.

### 15.9 Expressions

Rule:

- `expr`.

Parameters:

- `op`;
- optional `value`;
- optional `values`.

Recommended block variants:

- Apply operator to current value;
- Apply operator with one value;
- Apply operator to list of values.

Requirements:

- `op` shall be selected from known operators;
- editor shall support unary/current-value mode (the empty mode `()`, matched per §16.9);
- editor shall support binary mode with `value`;
- editor shall support reduce mode with `values`;
- editor shall support aliases and mnemonic names where metadata exposes them.

### 15.10 Function Calls

Rule:

- `call`.

Parameters:

- `name`;
- optional `value`;
- optional `values`.

Recommended block variants:

- Call function on current value;
- Call function with one argument;
- Call function with many arguments.

Requirements:

- `name` shall be selected from known functions where possible;
- editor shall support no-argument/current-`this` mode (the empty mode `()`, matched per
  §16.9);
- editor shall support single value mode;
- editor shall support multiple values mode.

### 15.11 Formatting

Rule:

- `format`.

Parameters:

- `pattern`;
- optional `value`;
- optional `default`.

Requirements:

- editor shall support string format pattern;
- editor shall support optional formatting value;
- editor shall support optional default;
- editor shall display runtime errors for invalid format patterns or missing keys.

### 15.12 File Output

Rule:

- `file`.

Parameters:

- `name`;
- `content`.

Requirements:

- editor shall support the `file` rule visually;
- browser execution shall not write to local filesystem;
- file writes shall be captured in preview output (capture mechanism: §17.7);
- `file` output shall be shown as side-effect result;
- editor shall explain that the rule returns `NO_CONTENT`.

### 15.13 Include

Rule:

- `include`.

Parameters:

- `name`;
- optional `default`.

Requirements:

- editor shall support the `include` rule visually;
- editor shall require an include template loader configuration for execution (loader
  sources are defined canonically in §17.8);
- editor shall report missing include loader clearly;
- editor shall support include examples loaded from docs/example corpus where available;
- include depth/runtime errors shall be shown to the user.

### 15.14 Operators

Built-in `expr` operators shall be supported.

Required groups:

- comparisons:
  - `lt`;
  - `le`;
  - `eq`;
  - `ne`;
  - `ge`;
  - `gt`;
  - `<`;
  - `<=`;
  - `==`;
  - `!=`;
  - `>=`;
  - `>`;
- arithmetic:
  - `add`;
  - `sub`;
  - `mul`;
  - `div`;
  - `mod`;
  - `+`;
  - `-`;
  - `*`;
  - `/`;
  - `%`;
- logical:
  - `and`;
  - `or`;
  - `not`;
  - `&&`;
  - `||`;
  - `!`.

### 15.15 Functions

Built-in `call` functions shall be supported:

- `str`;
- `int`;
- `float`.

---

## 16. Import / Export / Round-trip Rules

### 16.1 Semantic Equivalence

Semantic equivalence means that the imported and exported templates produce the same
result for the same input according to the Transon engine.

Textual JSON equivalence is not required.

"Strict semantic round-trip" (UC-005, §7.5, AD-004) does not mean textual fidelity. The
word "strict" qualifies *coverage*, not the comparison: equivalence is always semantic (as
defined here), and "strict" means it must hold for *every* template within the supported
template surface (§16.10), with no silently-dropped cases. Where it cannot hold, the editor
reports it (FR-040) rather than degrading equivalence.

### 16.2 Stable JSON Formatting

Generated JSON should be formatted consistently for readability.

Recommended behavior:

- two-space indentation;
- valid JSON;
- no comments in exported JSON;
- deterministic ordering where possible.

### 16.3 Key Ordering

JSON object key ordering is not semantically meaningful in JSON, but Transon variable
scoping can be affected by sibling evaluation order in literal dict/list walking.

Therefore, the editor shall preserve insertion order for objects where order can affect
Transon behavior.

### 16.4 Unsupported Import

If import cannot preserve semantic equivalence, the editor shall fail clearly. The
relevant error codes are `import_unsupported` and `json_template` in the canonical error
taxonomy (§17.6); the `import_unsupported` cases are: unknown rule, unknown parameter,
unsupported custom rule metadata, ambiguous marker handling, malformed template, and
unsupported workspace representation.

### 16.5 Marker Handling

The editor shall use the configured marker key to identify rule invocations.

Default:

```json
"$"
```

If a custom marker is configured, all import/export logic shall use that marker. The
literal-marker escape (§12.4, §16.6) is defined relative to the configured marker: the
`object` rule is identified by the configured marker, and the escape is triggered when a
literal field key equals that same configured marker (not a hard-coded `"$"`).

### 16.6 Literal Marker Escape

When a literal output object must contain the marker key, the editor shall use the
`object` rule in `fields` mode (canonical mechanism and example: §12.4).

### 16.7 Workspace Metadata

Workspace metadata may be exported separately in a future bundle format.

It shall not be required to execute the template.

### 16.8 Round-trip Test Corpus

Round-trip tests shall include:

- simple literals;
- literal arrays;
- literal objects;
- literal marker-key objects;
- every built-in rule;
- every mutually exclusive parameter variant;
- nested templates;
- examples from generated docs metadata;
- custom marker configuration;
- import failure cases.

### 16.9 Import Variant Matching

Each rule invocation must match **exactly one** declared variant; zero, multiple, or partial
matches are reported as `import_unsupported` (§17.6, §18.6). This behavioral rule is
referenced by FR-122, FR-124, FR-125, §10.6/§10.7, and the supported surface (§16.10). The
variant `import_matcher` format (derived mechanically from the engine schema
`_required`/`_modes`) and the matching algorithm are implementation detail; see
[`ARCHITECTURE.md`](ARCHITECTURE.md) §5.7.

### 16.10 Supported Template Surface

The "supported template surface" is the normative set of templates the editor can import
and round-trip without changing meaning. It is referenced by FR-029, FR-033, FR-040,
UC-003, and §18.2.

A template is **in surface** when every node is one of:

- a literal JSON scalar (string, number, boolean, null);
- a literal JSON array whose items are in surface;
- a literal JSON object (no marker key) whose values are in surface;
- a literal object that contains the marker key, expressed through the `object`/`fields`
  escape (§12.4);
- an invocation of a built-in rule (§15) whose present parameters match **exactly one**
  declared variant/mode and whose parameter values are in surface;
- an invocation of a custom rule that has complete metadata
  ([`metadata-contract.md`](metadata-contract.md) §2) and matches exactly one variant.

A template is **out of surface** (import shall fail clearly per §18, or fall back to an
exact-preserving unsupported placeholder per §14.11) when any node is:

- an unknown rule with no metadata;
- a rule with a parameter not declared by its metadata (unknown parameter);
- a rule whose present parameters match zero variants or more than one variant
  (ambiguous/partial — §18.6);
- a custom rule with incomplete metadata that cannot be rendered as a safe generic block
  (FR-092);
- not valid JSON, or otherwise not representable without changing meaning.

The surface is bounded by the engine's rule/operator/function catalog, not by a separate
editor list; the engine-parity checks in [`traceability.md`](traceability.md) keep the two
aligned.

---

## 17. Validation and Execution

The behavioral requirements live here: validation (FR-066..073), execution (FR-074..081),
the runtime host boundary (§11.9), the error taxonomy (§17.6), captured `file` writes
(§17.7), and the include loader (§17.8). Engine initialization/status is a property of the
host-provided runtime (AD-005, AD-018), surfaced per NFR-025. The validation flow, execution
flow, and runtime initialization/status model are implementation detail; see
[`ARCHITECTURE.md`](ARCHITECTURE.md) §6.4.

### 17.4 Validation Timing

Validation may run:

- manually through a Validate button;
- automatically after debounced editor changes;
- automatically before execution.

### 17.5 Execution Timing

Execution may run:

- manually through a Run button;
- automatically after debounced changes if enabled by embedding configuration.

Default recommendation:

- manual Run in v1;
- debounced auto-validation;
- optional auto-run for examples.

### 17.6 Error Types (canonical taxonomy)

This is the single canonical error taxonomy for the editor. FR-098 (error display) and
§16.4 (import error categories) reference this list rather than defining their own; §16.4
covers the import subset (`import_unsupported`).

| Code | Category | Raised during |
|------|----------|---------------|
| `json_template` | Invalid JSON in imported template text | import |
| `json_input` | Invalid JSON in sample input | execution setup |
| `import_unsupported` | Out-of-surface template (§16.10): unknown rule, unknown parameter, ambiguous/partial variant match, ambiguous marker handling, malformed template, or unsupported workspace representation | import |
| `template_definition` | Transon definition/validation error (engine `DefinitionError` via `validate()`) | validation |
| `runtime_transformation` | Transon transformation/runtime error (engine `TransformationError` via `transform()`) | execution |
| `include_loader` | Include template could not be resolved (§17.8) | validation/execution |
| `engine_init` | Host engine runtime failed to load or initialize | runtime init |
| `editor_internal` | Unexpected editor error | any |

Captured `file` writes (§17.7) are a side-effect result, not an error category.

### 17.7 Captured File Writes

When preview execution uses the `file` rule:

- no local file shall be written;
- output shall include captured file entries;
- each captured file entry shall include name and content;
- entries whose name or content is `NO_CONTENT` shall be skipped according to engine
  semantics.

### 17.8 Include Loader

For browser preview, include loader may resolve templates from:

- docs examples;
- embedding application configuration;
- user-provided include map;
- future local workspace library.

If no loader is configured, validation/execution shall report that includes cannot be
resolved.

---

## 18. Error Handling

### 18.1 Invalid Imported JSON

If imported template text is not valid JSON:

- show parse error;
- do not replace current workspace;
- preserve unsaved current work.

### 18.2 Unsupported Template Import

If imported JSON is valid but out of the supported template surface (§16.10) and cannot be
represented visually:

- show unsupported template error;
- include template path where possible;
- do not silently alter template meaning.

### 18.3 Unknown Rule

If imported template contains an unknown rule:

- if metadata for the rule exists, render a custom or generic block;
- otherwise reject import or create an unsupported placeholder block only if exact
  preservation is guaranteed.

### 18.4 Unknown Parameter

If imported template contains a parameter unknown to rule metadata:

- reject import or mark the rule block invalid;
- show parameter name and template path.

### 18.5 Incomplete Workspace

If the workspace contains disconnected required inputs:

- generated JSON status is invalid;
- validation is not run or is shown as blocked;
- user sees which required input is missing.

### 18.6 Variant Match Failure

If imported rule parameters match no variant:

- show rule name;
- show present parameters;
- show expected variants where possible.

If imported rule parameters match multiple variants:

- show rule name;
- show conflicting variants;
- do not silently choose one.

If imported rule parameters partially match a variant:

- show missing required parameters;
- mark import invalid or create invalid block state.

### 18.7 Validation Failure

If engine validation fails:

- show error type;
- show error message;
- show template path;
- highlight corresponding block when possible.

### 18.8 Runtime Failure

If transformation fails:

- show error type;
- show error message;
- show template path where available;
- highlight corresponding block when possible;
- preserve previous successful output but mark it stale.

### 18.9 Engine Runtime Failure

If the host-provided engine runtime (§11.9) fails to load or initialize:

- show the runtime initialization error reported by the host;
- keep visual editing, JSON generation, and import/export available;
- disable validation/execution actions;
- suggest retrying initialization where the host supports it.

### 18.10 Include Resolution Failure

If an `include` cannot be resolved (loader sources: §17.8):

- show include name;
- show where it was referenced;
- explain that the browser preview needs an include loader.

### 18.11 File Write Handling

If a template uses `file` (canonical capture mechanism: §17.7):

- browser preview captures file writes;
- no filesystem write occurs;
- captured file writes are shown separately from transformation output.

---

## 19. Observability / Diagnostics

### 19.1 User-Facing Diagnostics

The editor shall expose:

- Transon engine version;
- metadata version;
- marker key;
- validation status;
- execution status;
- host engine runtime status;
- current template size;
- current block count.

### 19.2 Developer Diagnostics

The editor should expose optional developer diagnostics:

- generated template path to block mapping;
- raw engine errors;
- raw validation results;
- import/export timing;
- host engine runtime init timing;
- metadata load status;
- generic vs specialized block renderer used;
- missing metadata warnings.

### 19.3 Logging

In v1, logs are browser-local developer diagnostics.

The editor shall not send logs to a backend service by default.

### 19.4 Error Reporting

Unexpected editor errors should include enough information for bug reports without exposing
user template/input data unless the user explicitly copies it.

---

## 20. Acceptance Criteria

Version 1 is acceptable when all criteria below are met.

### AC-001 — Visual editor loads

A user can open the editor and see a Blockly canvas, generated JSON panel, input JSON
panel, output panel, and toolbar in sandbox mode.

### AC-002 — Simple rule template

A user can create an `attr` rule visually and export valid Transon JSON.

### AC-003 — Nested template

A user can create nested templates visually, including a rule parameter whose value is
another rule.

### AC-004 — Literal object

A user can create a literal object output with multiple fields.

### AC-005 — Literal marker-key object

A user can create a template that emits a literal object containing the marker key.

### AC-006 — All built-in rules available

All built-in Transon rules are available as visual blocks or metadata-generated blocks.

### AC-007 — Operators available

All built-in `expr` operators are selectable.

### AC-008 — Functions available

All built-in `call` functions are selectable.

### AC-009 — Import supported template

A supported Transon JSON template can be imported into Blockly.

### AC-010 — Export generated template

A Blockly workspace can be exported to Transon JSON.

### AC-011 — Strict round-trip

For the supported template corpus, importing and exporting preserves semantic equivalence.

### AC-012 — Validation with engine

The editor validates templates using the Transon engine in browser.

### AC-013 — Runtime execution with engine

The editor executes a template against sample input using the Transon engine in browser.

### AC-014 — Output preview

The editor displays transformation output as formatted JSON.

### AC-015 — Runtime error visibility

A runtime transformation error is displayed clearly.

### AC-016 — Validation error visibility

A validation error is displayed clearly.

### AC-017 — Error-to-block mapping

At least common validation/runtime errors can highlight the corresponding or nearest
Blockly block.

### AC-018 — Example loading

At least one generated docs/example corpus example can be loaded into the editor.

### AC-019 — Example expected output

For loaded examples, the editor can show actual output and expected output.

### AC-020 — Tooltip from metadata

Rule and parameter tooltips are populated from generated metadata where available.

### AC-021 — No backend persistence

The editor works without backend accounts or remote template storage.

### AC-022 — Embeddable component

The editor can be used as an embeddable component with initial template/input and change
callbacks.

### AC-023 — Host engine runtime loading state

The editor shows the host engine runtime's idle, loading, ready, and failed states.

### AC-024 — Captured file writes

A template using `file` does not write to filesystem in browser preview; captured file
outputs are shown in the UI.

### AC-025 — Include loader behavior

A template using `include` either resolves through configured include templates or shows a
clear include-loader error.

### AC-026 — Custom marker

The editor can be configured to use a non-default marker key and import/export templates
accordingly.

### AC-027 — Tests

Automated tests cover:

- JSON generation;
- import;
- export;
- round-trip;
- all built-in rules;
- all built-in operators;
- all built-in functions;
- literal marker-key objects;
- validation errors;
- runtime errors;
- example loading;
- metadata loading.

### AC-028 — Metadata-driven generic block

A new Transon rule with complete metadata can appear in the editor palette as a generic
block without editor code changes.

### AC-029 — Block variants for mutually exclusive parameters

Rules such as `attr`, `object`, `map`, `expr`, and `call` use separate visual block
variants for structurally different parameter shapes.

### AC-030 — Variant import matching

Imported templates select the correct block variant based on present parameters, and
ambiguous/partial variant matches are reported clearly.

### AC-031 — Sandbox mode

Sandbox mode shows the panels defined in §13.1 (canvas, palette, template JSON, input
JSON, output JSON, examples, and validation/execution controls).

### AC-032 — Compact editor mode

Compact editor mode can show the canvas and palette without requiring input/output panels.

---

## 21. Test Strategy

Requirement-to-test coverage, the engine-parity (anti-drift) checks, and the round-trip
corpus are tracked in [`traceability.md`](traceability.md). Every implemented requirement
must be cited by at least one test there.

### 21.1 Unit Tests

Unit tests should cover:

- block-to-template generation;
- template-to-block parsing;
- literal scalar handling;
- array handling;
- object handling;
- marker detection;
- literal marker-key escape;
- rule parameter generation;
- required parameter handling;
- optional parameter handling;
- mutually exclusive block variants;
- variant import matching;
- operator/function dropdown generation;
- metadata parsing;
- generic block generation;
- specialized block override selection;
- path-to-block mapping.

### 21.2 Round-trip Tests

Round-trip tests should cover:

- each built-in rule;
- each rule variant;
- each built-in operator;
- each built-in function;
- nested templates;
- docs/example corpus templates;
- custom marker key;
- literal marker-key object;
- import failure cases.

### 21.3 Engine Integration Tests

Engine integration tests should cover:

- host engine adapter initialization;
- static validation success;
- static validation failure;
- transformation success;
- transformation failure;
- `NO_CONTENT` output behavior;
- captured `file` writes;
- include loader success;
- include loader failure.

### 21.4 UI Tests

UI tests should cover:

- editor renders;
- block can be added;
- block can be connected;
- generated JSON updates;
- input JSON can be edited;
- output updates after run;
- errors are shown;
- examples load;
- tooltips are visible;
- import/export actions work;
- sandbox mode renders expected panels;
- compact editor mode hides sandbox-only panels.

### 21.5 Accessibility Tests

Accessibility tests should cover:

- keyboard navigation where Blockly supports it;
- readable contrast;
- visible focus states;
- error messages not relying only on color;
- screen-reader labels for major panels where feasible.

### 21.6 Metadata Compatibility Tests

Metadata compatibility tests should cover:

- complete metadata creates generic block;
- incomplete metadata creates warning or rejection;
- new rule appears in palette;
- new rule exports JSON correctly;
- new rule imports JSON correctly where variant shape matches;
- version mismatch warnings.

### 21.7 Regression Tests

Regression tests should be added for:

- every bug that changes generated JSON;
- every import/export bug;
- every metadata compatibility issue;
- every engine behavior mismatch;
- every round-trip failure.

---

## 22. AI Development Rules

These rules are intended for AI-assisted development.

### 22.1 SPEC First

Behavior-changing implementation must be reflected in `SPEC.md`.

If implementation and specification conflict, the AI agent must identify the conflict
before coding.

### 22.2 Preserve Requirement IDs

Functional requirement IDs, non-functional requirement IDs, architecture decision IDs,
acceptance criteria IDs, and open question IDs must remain stable.

If requirements change, do not silently renumber existing IDs.

### 22.3 Do Not Invent Transon Semantics

AI agents must not invent rule behavior.

If behavior is unclear, consult the Transon engine specification, generated docs metadata,
tests, or source code.

### 22.4 Engine Is Authoritative

AI agents must treat the Transon engine as authoritative for validation and execution
(canonical principle: NFR-004).

Blockly constraints may improve UX but must not replace engine behavior.

### 22.5 Preserve JSON Canonicality

AI agents must preserve the decision that Transon JSON is the canonical artifact.

Do not make Blockly workspace serialization the only source of truth.

### 22.6 Preserve Strict Round-trip

AI agents must not introduce import/export behavior that silently changes template meaning.

If a template cannot be represented faithfully, the agent must add an explicit
unsupported-template path.

### 22.7 No Backend Persistence in v1

AI agents must not add accounts, backend storage, or sharing links in v1 unless the spec
is updated.

### 22.8 No New Transformation Language

AI agents must not introduce a separate DSL, path syntax, inline expression language, or
non-Transon transformation model.

### 22.9 Use Metadata Where Possible

AI agents should prefer generated Transon metadata over duplicated handwritten
documentation.

### 22.10 Preserve Metadata-Driven Extensibility

AI agents must not make new rule support depend on editor code changes when metadata is
sufficient for generic block generation.

### 22.11 Prefer Block Variants Over Hidden Modes

AI agents should represent structurally different mutually exclusive parameter shapes as
separate block variants unless a spec update approves a mode-switching UX.

### 22.12 Escalate Security Ambiguity

If a change affects engine execution, runtime isolation/sandboxing, file writes, include
loading, remote example loading, or user data transmission, the AI agent must treat it as
security-sensitive and propose a spec update.

### 22.13 Keep UI and Semantics Separate

AI agents must not store UI-only Blockly metadata inside the executable Transon template
unless explicitly approved.

### 22.14 Add Tests for Every Rule Block

Every supported rule block must have tests for generation and import.

### 22.15 Do Not Silently Fix Engine Quirks

If Transon has quirky but documented behavior, the editor must represent it or warn about
it.

AI agents must not "fix" engine behavior in the editor without an explicit architecture
decision.

---

## 23. Open Questions and Future Work

Open questions (with their draft decisions) and future considerations are tracked in
[`ROADMAP.md`](ROADMAP.md). Resolved questions have been folded into the relevant
architecture decisions: OQ-001 and OQ-013 into AD-022, OQ-002 and OQ-014 into AD-024, OQ-010
into AD-025, and OQ-012 into AD-019 (all in [`ARCHITECTURE.md`](ARCHITECTURE.md) §3).

Any future feature must be evaluated against the project goal: keep the product a visual
editor for Transon templates, not a general workflow automation platform.
