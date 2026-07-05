# RFC-003: Canvas density + navigation for large templates

- **Status:** Proposed (2026-07-05); **open questions ratified by the maintainer 2026-07-05** —
  OQ-018 = title-only on canvas (C1+C3), OQ-019 = adaptive layout + manual override, OQ-020 =
  **adopt the minimap now** (overriding this RFC's proposed defer). Nothing here is normative until
  the SPEC/ARCHITECTURE edits land (SPEC-first, §21.2); this document is the review artifact for
  that change set.
- **Type:** Presentation + navigation change set. Everything proposed is **display-only under
  §21.12 (UI ≠ semantics)** — no codec, round-trip, surface, or metadata-contract impact — but two
  proposals **revise ratified decisions** (OQ-008 dual labels; FR-129/§13.10 external-inputs
  layout), so they follow the append-only governance path (§21.1): new IDs, deprecate in place.
- **Baseline:** SPEC v2.0 (2026-06-27), FR-114…FR-132, AD-026…AD-033, OQ-001…OQ-017 all ratified.
  Current renderer: thrasos + committed `transon` theme (FR-129, AC-040, AD-033).

## Problem (one line)

A realistic template shows **~50 blocks maximum** in the viewport, and there is **no way to zoom,
fit, or overview** a larger workspace — big templates are effectively un-navigable and un-scannable.
This is the state **NFR-029** already prohibits (*"large templates should not make the canvas
unusable within reasonable limits"*, §8.5); this RFC is the plan that makes NFR-029 true.

## Root causes (evidence)

Four independent causes, in decreasing order of leverage:

| # | Cause | Where | Status of the underlying decision |
|---|-------|-------|-----------------------------------|
| 1 | **No zoom / pan / fit / minimap.** `Blockly.inject` passes no `zoom` or `move` options; Blockly's defaults are *off*, so the viewport is pinned at 100% and wheel-zoom does nothing. | `packages/editor-ui/src/blockly/mount.ts` (inject call) | Pure gap — §11.5 already reserves `zoom` and `collapsed_state` as preserved UI metadata; nothing conflicts. |
| 2 | **External-inputs staircase + title-own-row.** Every value parameter is an external input (`inputsInline: false`), so each nested expression hangs off the side as its own block; width grows with depth and each level adds a row. Variants with ≥2 value inputs also spend a dedicated first row on the title. | SPEC FR-129, §13.10; `G_palette` in `packages/editor-core/src/codec/codegen.ts` (`P_VARIANT_DEF`, `multiInput`) | Ratified (AD-033). **Proposed for revision** (P-E). |
| 3 | **Long labels.** Every block reads `"<title> (<rule>)"` — e.g. `Build object (object)` says "object" twice — and every parameter socket is prefixed with its raw metadata param name; single-input variants put title + param name on the same row. | SPEC §12.5 / OQ-008; `G_palette` (`P_LABEL`, `P_PARAM_SEG`) | Ratified (OQ-008). **Proposed for revision** (P-C). |
| 4 | **Untuned block metrics.** The thrasos renderer runs on stock constants (paddings, min block height, notch/tab geometry); theme font is 12px. | `packages/editor-ui/src/blockly/theme.ts`; FR-129 | No conflict — FR-129 says "thrasos **by default**, renderer configurable per AD-017"; a thrasos-derived compact renderer stays inside it. |

## Design principle: balanced density (the criterion every proposal must satisfy)

Neither layout extreme works, and the failure modes are opposite:

- **External-only (today):** trivial children waste space. Attaching the literal `"name"` costs a
  full staircase hop — a separate block, a connector, a new row. Width grows with nesting *depth*;
  most of the canvas is whitespace between small blocks.
- **Inline-everything:** complex children destroy readability. An inline input renders the child
  *inside* the parent's outline, so a multiline child balloons the parent's row to the child's full
  height — the parent becomes a thin strip of text wrapped around its biggest child. Width compounds
  **multiplicatively** (a parent must be wider than the *sum* of its inline children plus its own
  label), and reading order breaks: the eye falls into a large embedded structure and the parent's
  remaining parameters resume somewhere far right. Nested outlines-within-outlines are much harder
  to scan than separate blocks joined by connectors, and the child's bulk dominates the parent's
  drag/selection hit area.

**Criterion:** *small children read densely; complex (multiline) children get their own block.*
Because the same socket can hold a two-character literal or a whole subtree, the inline/external
split **cannot be static per block definition** — it must respond to what is actually connected
(or be user-overridable where a heuristic guesses wrong). This criterion drives P-E and bounds P-B
(compact ≠ cramped: minimum touch-target and contrast constraints of NFR-045/§19 still apply).

## Proposals

Lettered P-A…P-E. Each lists the contract edits and new IDs it needs. P-A and P-D are additive
(no ratified decision touched); P-C and P-E revise ratified decisions; P-B is parameter tuning
inside an existing requirement.

### P-A — Navigation package (zoom, pan, fit) — *additive, do first*

Enable Blockly's built-in navigation on the mounted workspace (`mount.ts` inject options):

- `zoom: { controls: true, wheel: true, pinch: true, startScale: 0.9, minScale: 0.2, maxScale: 3 }`
- `move: { scrollbars: true, drag: true, wheel: true }`
- **Zoom-to-fit** affordance (the official `@blockly/zoom-to-fit` plugin, or the equivalent
  `workspace.zoomToFit()` control) so one click frames the whole template.
- **Minimap** (`@blockly/workspace-minimap`) — **ratified into P-A by OQ-020 (2026-07-05: adopt
  now, phase 1/M6)**, so spatial orientation on huge canvases ships together with zoom rather than
  waiting on user feedback.

Zoom/scroll state stays **UI-only** exactly as §11.5 already specifies (`zoom` is listed there as
preserved workspace UI metadata, not canonical for execution). Embedders get the same treatment as
other canvas affordances: on by default, no new host API surface in v1 (a future `TransonMountOptions`
knob is possible but out of scope here).

- **Contract edits:** new **FR-133** (§12, canvas navigation: zoom controls, wheel/pinch zoom,
  zoom-to-fit, **minimap**, pan/scroll); AC covered by **AC-041** (below). §11.5 unchanged (already
  anticipates it).
- **Code:** `mount.ts` + the `@blockly/workspace-minimap` dependency (pinned per AD-021). No
  projection, no artifacts.
- **Gain:** the hard ~50-block viewport cap disappears — visible-block count becomes a
  user-chosen legibility trade instead of a fixed ceiling. Blocks visible scale with 1/s²:
  `startScale 0.9` alone shows ~1.2× more at near-full legibility; 0.5× shows ~4×; `minScale 0.2`
  gives up to ~25× the area — a whole-template overview for any corpus example. Zoom-to-fit turns
  "where is that branch?" from blind scroll-hunting into a one-click overview → spot → zoom-in
  loop (seconds, not minutes). This is the largest single usability win per line of code changed
  in the RFC.

### P-B — Compact block surface (renderer constants + type scale) — *inside FR-129*

Derive a `transon` renderer from thrasos with a tuned `ConstantProvider`: reduced
`MEDIUM_PADDING`/`SMALL_PADDING`, `MIN_BLOCK_HEIGHT`, `DUMMY_INPUT_MIN_HEIGHT`, and notch/tab
geometry; optionally drop the theme font 12px → 11px. FR-129 already says *"thrasos by default,
renderer configurable per AD-017"*, so a thrasos-derived compact renderer is within the existing
requirement — this proposal only pins the *target* so tuning is testable instead of taste-based.

Bounds (the "compact ≠ cramped" line): keep WCAG contrast and focus visibility (NFR-045), keep
connection targets draggable at desktop DPI, and validate against the example corpus visually
(§19.4 Playwright) rather than against a single toy template.

- **Contract edits:** new **NFR-049** (§8.5, density target — e.g. *a single-input rule block
  renders ≤ 28px tall and a typical 20-block example fits a 1440×900 viewport at 100% without
  scrolling*; exact numbers to be pinned during review). FR-129 needs **no text change** (rename of
  the registered renderer is an implementation detail under AD-017).
- **Code:** `editor-ui` theme/renderer module only.
- **Gain:** ~15–25% linear shrink ⇒ **~1.4–1.7× more blocks per screen at unchanged zoom**
  (density scales with the square of the linear cut). Unlike zooming out, this costs no per-block
  legibility — it removes padding whitespace, not glyph size (the optional 11px font is the only
  legibility trade, separable). The gain multiplies with every other proposal: a compact block is
  also a smaller collapsed block (P-D), a shorter label row (P-C), and a tighter inline row (P-E).

### P-C — Label diet — *revises OQ-008 / §12.5*

Today: `"<title> (<rule>)"` on every block **plus** a raw param-name prefix on every socket
(`Get attribute (attr) name ⧉`). OQ-008's rationale — *the rule name keeps developers oriented and
reinforces the JSON mapping (NFR-016)* — is preserved, but relocated off the block face:

- **C1 — canvas blocks show the title only** (`Get attribute`). The rule name moves to:
  - the **tooltip**, prepended to the existing metadata description (machinery already in
    `packages/editor-blockly/src/blocks.ts`, `ruleTooltip`): `attr — Gets an attribute…`;
  - the **flyout/palette**, which keeps the dual label `Get attribute (attr)` — the palette is
    where the name→JSON mapping is *learned*, and flyout width is not the scarce resource.
- **C3 — drop the param-name prefix on single-value-input variants** (the lone socket is
  unambiguous; the tooltip still names it), keep param labels on multi-input rows, and let
  `presentation.json` optionally declare a **short label** per param where the metadata name is
  long (curated presentation data, FR-127 — no TS literals).

Rejected alternative **C2** (rule-name-only on blocks, `attr`): most compact and strongest NFR-016
signal, but hostile to the §12.6 beginner path; recorded here so the decision trail shows it was
considered.

**Ratified (OQ-018, 2026-07-05): C1 + C3 as proposed** — canvas blocks title-only, flyout keeps
the dual label, tooltip carries `"<rule> — <description>"`. The fallback in the contract-edits
note below (dual label nowhere) is thereby **rejected**: if flyout and canvas can't share one
`message0`, the flyout-specific label is the implementation cost we accept.

- **Contract edits:** new **OQ-018** re-answering OQ-008 (deprecate OQ-008's answer in place, ROADMAP
  §"Open questions"); revise **§12.5** (canvas = title-only, flyout = dual label, tooltip carries
  the rule name — cite NFR-016 as satisfied by tooltip + flyout); note in FR-078 (tooltip) that the
  tooltip is now `"<rule> — <description>"`.
- **Code:** `G_palette` projection (`P_LABEL`, `P_PARAM_SEG` conditional) + regenerated committed
  artifacts (`G_palette.json`, `palette.json`) under the strict regen gate (AD-030);
  `presentation.json` short-label key (metadata-contract §2.9 addendum); flyout label needs a
  palette/flyout-specific label field or a flyout-only `labelKey` — the one place P-C touches more
  than the projection, since today flyout and canvas share one `message0`. If keeping them identical
  proves cheaper, fallback: dual label nowhere on blocks, rule name in tooltip + category docs only
  — decide during review (folded into OQ-018).
- **Gain:** `Get attribute (attr) name ⧉` → `Get attribute ⧉` — the label shrinks ~48%
  (25 → 13 characters) on the typical single-input block; canvas-average width drops an estimated
  **20–30%**. The saving **compounds with nesting depth**: in the external-inputs staircase each
  level's horizontal offset includes its parent's label width, so every level of a deep template
  starts that much further left — total staircase width shrinks roughly proportionally at *every*
  depth. Secondary but real: reading cost drops (`Build object (object)` stops saying "object"
  twice; blocks read by function, not by taxonomy).

### P-D — Subtree collapsing — *additive*

Enable Blockly's native block collapsing (inject `collapse: true` + the context-menu items) so a
user can fold any subtree into one small block. This is the single strongest navigation tool for
big templates (a 200-block template becomes ~10 collapsed sections) and §11.5 **already lists**
`collapsed_state` in the preserved UI metadata, so serialization was anticipated from the start.
Collapse state is UI-only: canonical JSON, codec output, and round-trip are untouched (§21.12) —
a collapsed block still serializes its full subtree.

- **Contract edits:** new **FR-134** (§12/§13, collapse/expand any block subtree via context menu;
  collapsed state preserved per §11.5; collapsed blocks show the block label + an ellipsis cue).
- **Code:** `mount.ts` config; verify the custom fields/mutators (AD-031 runtime) render sanely
  when collapsed (test in the AC-041 suite).
- **Gain:** a collapsed subtree's footprint goes from **O(subtree size) to O(1)** — a 200-block
  template reads as ~10 section-sized blocks, so the *effective* template-size ceiling disappears
  entirely: density becomes user-managed detail, not a property of the template. This is
  *semantic* zoom complementing P-A's *geometric* zoom (P-A shrinks everything uniformly; P-D
  hides what you're not working on at full size). It also gives an editing-focus workflow — expand
  only the branch under edit — and, unlike every density proposal, its gain **grows** with
  template size: the bigger the template, the more it wins.

### P-E — Balanced adaptive layout — *revises FR-129 / §13.10 (updates AD-033)*

Replace the static "everything external" rule with the balance criterion above:

- **E-default (static hybrid):** value inputs whose *typical* occupants are scalar-ish (literals,
  short expressions) start **inline**; template-shaped params stay **external**. Derived
  mechanically from metadata param kinds in `G_palette` — no per-rule hand-tuning (AD-026 intact).
- **E-adaptive (the actual fix):** the finite behavior runtime (AD-031 — already rule-agnostic and
  keyed to structural vocabulary, NFR-046) flips a block's `inputsInline` on **connection changes
  only** (never on field edits — damped, so blocks don't jump while typing):
  - every connected child renders single-row → block goes **inline** (dense);
  - any connected child is multiline → block goes **external** (the child gets its own block).
- **E-override:** keep Blockly's per-block "Inline Inputs" context-menu toggle enabled; a manual
  choice wins over the heuristic and persists as UI metadata (§11.5).
- **E1 (folded in):** the ≥2-value-inputs "title takes its own first row" rule (§13.10) becomes
  part of the same adaptive decision: title-own-row only when the block is in external mode.

All of this is `setInputsInline` / row layout — **display-only, §21.12**: the codec reads inputs
and fields by *name*, never by geometry, so round-trip is unaffected by construction. Still, P-E is
the most invasive visual change; it ships behind the AC-041 visual suite and an example-corpus
before/after gallery, and only after A/B/C/D have landed (they may already relieve enough pressure
to shrink E's scope to E-default + E-override).

**Ratified (OQ-019, 2026-07-05): adaptive + manual override** — E-adaptive is the model (with
E-default as a block's initial disposition before anything is connected) and E-override always
wins. The static-hybrid-only fallback is rejected. The phase-4 prototype remains mandatory, but
its job narrows: it no longer chooses *between* static and adaptive, it pins the adaptive
parameters (the "multiline child" threshold and the damping feel) before FR-135/AD-034 are
finalized.

- **Contract edits:** new **AD-034** (updates AD-033 the way AD-033 updated AD-017 — append-only);
  revise **FR-129 + §13.10 + AC-040** (external-inputs wording → balanced adaptive layout; AC-040's
  "all value parameters are external" assertion is replaced by AC-041's mode-dependent assertions);
  new **FR-135** (adaptive inline/external behavior, damping, manual override); new **OQ-019**
  (ratified: adaptive + override; the prototype pins the threshold + damping numbers).
- **Code:** `G_palette` (initial dispositions + regen under AD-030), behavior runtime
  (`packages/editor-blockly/src/runtime.ts`) for the adaptive flip, `mount.ts` for the context-menu
  item. Maker ≠ checker: although §21.12-neutral, the runtime touch sits next to mutator/codec
  surfaces — run the `review-gate` workflow on the branch anyway.
- **Gain:** every inlined leaf eliminates one block outline + one connector + (usually) one row —
  and one full staircase level of horizontal offset. Real templates are leaf-heavy (a large share
  of value sockets hold literals or single-row expressions), so the estimate is a **25–40% total
  footprint cut** on typical corpus examples, on top of everything above; simple expressions like
  `attr "name"` collapse from a two-block staircase to one readable row. This is the only proposal
  that attacks the *structural* space consumer (cause #2, the dominant one) rather than trimming
  around it — and the estimate is deliberately labeled speculative: the phase-4 prototype plus the
  NFR-049 measurement harness replace it with a measured before/after number before the SPEC
  revision is finalized.

## What does NOT change

- **Canonical JSON, codec, round-trip:** G_encode/G_decode untouched; every proposal is §21.12
  display-only. The round-trip corpus and engine-parity gates must stay green with **zero diffs**.
- **Metadata contract:** no engine changes; P-C adds an *optional* curated presentation key
  (§2.9-style, editor-owned data).
- **Engine-free boundary (AD-008), variants-over-modes (AD-015), projection model (AD-026…AD-032):**
  untouched. P-C/P-E are projection-*data* and projection-*template* changes regenerated under the
  AD-030 strict gate — no hand-written block definitions appear anywhere.

## New IDs proposed (next-free per `docs/id-ledger.json`; reserve on acceptance, §21.1)

| ID | Proposal | One-liner |
|----|----------|-----------|
| FR-133 | P-A | Canvas navigation: zoom controls, wheel/pinch, zoom-to-fit, pan/scroll |
| FR-134 | P-D | Collapse/expand block subtrees; state preserved per §11.5 |
| FR-135 | P-E | Balanced adaptive inline/external layout + damping + manual override |
| NFR-049 | P-B | Canvas density target (pinned px numbers; corpus-validated) |
| AC-041 | all | Density + navigation acceptance: mounted-workspace suite asserting zoom/fit/minimap-or-collapse behavior, label forms, and adaptive-layout mode flips over corpus examples (§19.4 Playwright + headless) |
| AD-034 | P-E | Balanced adaptive layout (updates AD-033; append-only) |
| OQ-018 | P-C | Label form (re-answers OQ-008) — **ratified 2026-07-05: title-only canvas, dual-label flyout, rule name in tooltip (C1+C3)** |
| OQ-019 | P-E | Adaptive-layout scope — **ratified 2026-07-05: adaptive + manual override; prototype pins threshold + damping** |
| OQ-020 | P-A | Minimap — **ratified 2026-07-05: adopt `@blockly/workspace-minimap` now (phase 1/M6)**, overriding this RFC's proposed defer |

All three open questions were put to the maintainer and ratified on 2026-07-05 (the ROADMAP
§"Open questions" table gets these rows when the SPEC edits land). OQ-020's original rationale for
deferring (zoom-to-fit + collapse might make a minimap redundant; dependency + viewport chrome) is
recorded above; the maintainer chose immediate spatial orientation over dependency thrift.

## Sequencing

| Phase | Content | Risk | Gate | Gain when it lands |
|-------|---------|------|------|--------------------|
| 1 | **P-A + P-D** (zoom/fit/pan + minimap + collapse) | None — additive config + one pinned plugin dep | AC-041 subset; corpus round-trip unchanged | **Navigation solved outright.** Any-size template becomes traversable (fit → overview → zoom-in, minimap for spatial orientation; collapse = O(1) sections). Visible blocks become user-controlled (~4× at 0.5× zoom, ~25× at fit scale) instead of capped at ~50. |
| 2 | **P-C** (labels; SPEC §12.5 + OQ-018 first, then `G_palette` + regen) | Low | AD-030 regen gate; AC-041 label assertions | ~20–30% average width cut **at full legibility**, compounding with staircase depth; redundancy gone from every label. ~50 baseline → roughly **60–70** legible blocks at 100%. |
| 3 | **P-B** (compact renderer, tuned against corpus) | Low | NFR-049 numbers; NFR-045 a11y intact | ×1.4–1.7 blocks per screen at unchanged zoom, no legibility cost. Cumulative: roughly **85–120** legible blocks at 100%. |
| 4 | **P-E** (prototype E-adaptive on the largest corpus examples → ratify OQ-019 → SPEC revision → implement) | Medium (visual churn) | `review-gate` workflow; AC-041 full suite | Structural fix: ~25–40% footprint cut on leaf-heavy templates; trivial-child staircase hops gone; simple expressions read as one row. Cumulative: roughly **110–170** legible blocks at 100%. |

**Cumulative picture.** Phases 2–4 multiply only approximately (width and height gains overlap),
but the honest envelope is: from **~50 blocks at 100% and no way out** to **~2–3.5× that at 100%
with full legibility**, while phase 1 independently makes even a 500-block template navigable
(overview + collapse) regardless of raw density. Phase 1 delivers the majority of the *complaint
relief* for days of work; phases 2–4 deliver the *density* in increasing cost order. All figures
are pre-measurement estimates — the NFR-049 density harness (below) turns them into tracked
before/after numbers per phase, so each phase's actual gain gets recorded, not assumed.

Phases 1–3 are each a normal `/implement-requirement` slice once the SPEC edits land. Phase 4
starts with a throwaway prototype **before** its SPEC revision is finalized — the heuristic's feel
must be judged on a real large template, not in prose (§21.2 still holds: no production code for
P-E until FR-135/AD-034 are in the SPEC).

## Verification

- **Unchanged-behavior gates:** round-trip corpus, engine parity, traceability — all must pass with
  no corpus diffs (display-only claim is thereby *checked*, not asserted).
- **New AC-041 suite:** mounted-workspace tests (§19.4) — zoom controls present and functional,
  zoomToFit frames the corpus examples, collapse round-trips `collapsed_state` through §11.5
  serialization, canvas labels match the OQ-018-ratified form, adaptive blocks flip modes on
  connect/disconnect and respect the manual override.
- **Density measurement:** a small harness script renders the example corpus at 100% into a fixed
  viewport and reports blocks-visible + workspace bounding box; NFR-049's numbers become a checkable
  regression line, and the ~50-block complaint gets a tracked before/after metric.
