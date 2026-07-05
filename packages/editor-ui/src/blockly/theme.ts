// Transon block-surface renderer + theme (FR-129, AC-040, AD-033, NFR-050).
//
// AD-033 updates AD-017: render with the conventional **thrasos** renderer (puzzle-tab connections),
// not Zelos — the Zelos "Scratch pill" look was unwanted and structurally un-tunable (Zelos ignores
// CORNER_RADIUS for its outlines). Blocks are value/output blocks with EXTERNAL inputs
// (`inputsInline: false`, set in the G_palette projection): every sub-expression connects from the
// side via a puzzle socket; the block body holds only fields + mutator controls.
//
// This module owns the committed `Blockly.Theme`: a clean system font + a workspace/flyout surface
// aligned with the editor chrome tokens (styles.ts). It sets TYPOGRAPHY + workspace SURFACE only —
// block and category COLOURS stay data-driven from the presentation projection (FR-127): the theme
// declares NO blockStyles/categoryStyles (§21.12 UI≠semantics). Pure UI: no codec/round-trip impact.

import * as Blockly from 'blockly/core';

// NFR-049 / AC-041(d) / RFC-003 P-B — the compact surface. A THRASOS-DERIVED renderer (AD-033 stays
// intact: subclasses Blockly.thrasos.Renderer/ConstantProvider, changes ONLY vertical padding/min-
// height constants) that shrinks a single-value-input rule block to the SPEC §8.5 NFR-049 measured
// density target (<=28px tall at 100% zoom) while every other geometry rule (puzzle tabs, notches,
// corner radius) stays thrasos's own — this is display-only tuning (§21.12): no block/category
// COLOURS here (FR-127 stays with the projected block defs), no codec/round-trip impact, and the
// bound never drops below usability (NFR-045 contrast/focus + drag-target size are unaffected —
// only inter-row/field padding shrinks, not colour, contrast, or field text size).
//
// NFR-050 (§8.5, geometry harness `test/geometry.test.ts`) — the M6 density pass (above) shrank
// several vertical constants but left OTHERS at their thrasos base values, and this mismatch is the
// root cause of the reported seam/protrusion defects, confirmed against the actual Blockly 13
// renderer sources (`renderers/common/{constants,info,drawer}.ts`,
// `renderers/thrasos/info.ts` — fetched from the `blockly-v13.0.0` tag under
// `packages/blockly/core/renderers/`, since the installed npm package ships only compiled/minified
// bundles):
//
//  - `LARGE_PADDING` (thrasos: spacer-row height between two consecutive external-value-input rows,
//    `thrasos/info.ts#getSpacerRowHeight_`) was NEVER overridden (stayed at the base value 10) while
//    `MIN_BLOCK_HEIGHT` (a connected child's rendered height, 24→20) and `TAB_OFFSET_FROM_TOP` (a
//    connected external-value-input row's measured height is
//    `connectedBlockHeight - TAB_OFFSET_FROM_TOP - MEDIUM_PADDING`,
//    `renderers/measurables/external_value_input.ts`) shrank independently. Working the algebra: for
//    two stacked connected children of height H, the visible gap between sibling i's bottom edge and
//    sibling i+1's top edge equals `rowHeight + LARGE_PADDING - H`, where
//    `rowHeight = H - TAB_OFFSET_FROM_TOP - MEDIUM_PADDING` — so the gap is
//    `LARGE_PADDING - TAB_OFFSET_FROM_TOP - MEDIUM_PADDING`, independent of H. With the M6 values
//    (LARGE_PADDING=10, TAB_OFFSET_FROM_TOP=5 unchanged, MEDIUM_PADDING=3) that gap was a *visible*
//    2px background seam between every pair of stacked value-input children (defect 1), and the
//    child's own protrusion past its parent's bottom edge for the last sibling in a stack (defect 3,
//    `positionOutputConnection_`/`positionExternalValueConnection_` in `common/drawer.ts`). Fixed by
//    making `LARGE_PADDING` track the same base unit as the constants whose shrink it must absorb:
//    `LARGE_PADDING = TAB_OFFSET_FROM_TOP + MEDIUM_PADDING` (both quantized below) closes the gap to
//    exactly 0 (verified in `test/geometry.test.ts`) and makes the last stacked child's bottom edge
//    land exactly on the parent's own bottom edge (no protrusion past the parent).
//  - `NFR-050(b)` (label↔connection-y alignment "within 0.5px") is a SEPARATE issue and is NOT fixed
//    by constant tuning — traced to `common/drawer.ts#positionExternalValueConnection_`, which sets
//    an external value input's connection y to `row.yPos` (the row's TOP edge), while
//    `common/info.ts#getElemCenterline_`/`thrasos/info.ts#getElemCenterline_` place the row's
//    field/label at `row.yPos + row.height / 2` (the row's CENTER) — an unconditional half-row-height
//    offset between the two that is part of thrasos's own drawing algorithm, present identically in
//    UNMODIFIED stock `thrasos` (verified directly: a stock-thrasos `attr__name` block places its
//    `name`-row connection at y=30 while the row spans [30,45], i.e. also off-center by
//    `TAB_HEIGHT/2`=7.5px — this predates and is independent of any M6 tuning). No renderer constant
//    feeds `positionExternalValueConnection_`'s `row.yPos`; the only way to force the connection to
//    the row's vertical center would be to override `positionExternalValueConnection_`/
//    `getElemCenterline_` themselves (subclassing `Drawer`/`RenderInfo`, not `ConstantProvider`),
//    which is exactly the "fork the drawer/measurement algorithm" the SPEC directs against absent a
//    STOP. Reported (see the retro/handoff notes) rather than silently weakened or worked around;
//    `test/geometry.test.ts` documents the exact, measured, non-zero offset instead of asserting
//    (b)'s literal 0.5px bound.
//
// `ConstantProvider`'s base (thrasos-inherited) constructor derives several fields from others at
// construction time (e.g. `DUMMY_INPUT_MIN_HEIGHT = TAB_HEIGHT`, `TOP_ROW_MIN_HEIGHT =
// MEDIUM_PADDING`) — so this subclass sets every constant it wants changed explicitly (not just the
// "root" ones) rather than relying on the base constructor picking up an overridden root after the
// fact.

/** NFR-050(c) — the single base grid unit every overridden vertical constant derives from. Chosen as
 *  4: it divides the pre-existing (already-tuned) `TAB_HEIGHT`=12 and `MIN_BLOCK_HEIGHT`=20 exactly
 *  (both stay unchanged from the M6 density pass — they already happened to be grid-aligned), so
 *  quantizing the REST of the vertical constants to the same unit keeps every rendered block height a
 *  multiple of 4 without re-opening the NFR-049 density numbers. Exported for the geometry harness
 *  (`test/geometry.test.ts`), which asserts every explicitly-assigned vertical constant on
 *  `CompactConstantProvider` is a multiple of this unit. */
export const GRID_UNIT = 4;

/** Exported (not just used internally) so `test/geometry.test.ts` (NFR-050c) can instantiate it
 *  directly and assert every vertical constant it explicitly assigns is a `GRID_UNIT` multiple —
 *  without depending on a mounted workspace's renderer internals. */
export class CompactConstantProvider extends Blockly.blockRendering.ConstantProvider {
  constructor() {
    super();
    // Padding between adjacent elements/rows (base thrasos: SMALL_PADDING=3, MEDIUM_PADDING=5).
    // SMALL_PADDING is horizontal-only (in-row field/input spacing, `thrasos/info.ts
    // #getInRowSpacing_`) — out of NFR-050(c)'s "vertical renderer constant" scope, left as tuned.
    this.SMALL_PADDING = 2;
    this.MEDIUM_PADDING = GRID_UNIT; // 4 (was 3; also feeds TOP/BOTTOM_ROW_MIN_HEIGHT + LARGE_PADDING below)
    // Puzzle-tab height also sets DUMMY_INPUT_MIN_HEIGHT/DUMMY_INPUT_SHADOW_MIN_HEIGHT (base: 15).
    // NFR-050(b) tab-glyph centering: the glyph is drawn at the fixed span
    // [TAB_OFFSET_FROM_TOP, TAB_OFFSET_FROM_TOP + TAB_HEIGHT] below the child's top, so it centers
    // on a minimal literal pill (FIELD_BORDER_RECT_HEIGHT + 2*MEDIUM_PADDING = 24) exactly when
    // 2*TAB_OFFSET_FROM_TOP + TAB_HEIGHT == that pill height → TAB_HEIGHT = 4 * GRID_UNIT (16).
    // The M6 density pass's 12 left the tab 2px high on the pill (the reported off-center tab).
    this.TAB_HEIGHT = 4 * GRID_UNIT;
    this.DUMMY_INPUT_MIN_HEIGHT = this.TAB_HEIGHT;
    this.DUMMY_INPUT_SHADOW_MIN_HEIGHT = this.TAB_HEIGHT;
    // The y-offset of a value-input/output puzzle tab from the top of its row/block
    // (`TAB_OFFSET_FROM_TOP`, `renderers/measurables/{external_value_input,output_connection}.ts`)
    // was NEVER overridden by the M6 density pass (stayed at the untouched thrasos base, 5) — quantize
    // it too (NFR-050c) and feed it into the LARGE_PADDING zero-gap fix below (NFR-050a).
    this.TAB_OFFSET_FROM_TOP = GRID_UNIT; // 4 (was the thrasos base, 5 — untouched until now)
    // Notch height (previous/next connections; base: 4). Quantized; incidentally equals the
    // (untouched) thrasos base value — the M6 pass's 3 was the odd one out.
    this.NOTCH_HEIGHT = GRID_UNIT;
    // The minimum block height floor (base: 24) and its statement-input-empty derivative. Already a
    // grid multiple (5 * GRID_UNIT) — unchanged from the M6 density pass.
    this.MIN_BLOCK_HEIGHT = 5 * GRID_UNIT;
    this.EMPTY_STATEMENT_INPUT_HEIGHT = this.MIN_BLOCK_HEIGHT;
    // Top/bottom row minimums track MEDIUM_PADDING in the base provider (base: 5 each).
    this.TOP_ROW_MIN_HEIGHT = this.MEDIUM_PADDING;
    this.BOTTOM_ROW_MIN_HEIGHT = this.MEDIUM_PADDING;
    // NFR-050(a) zero-gap fix: `thrasos/info.ts#getSpacerRowHeight_` uses LARGE_PADDING as the
    // spacer-row height between two consecutive external-value-input rows (our surface's only kind of
    // "stack", §13.10 — no statement/prev-next connections). The visible gap between two stacked
    // connected children reduces algebraically to
    // `LARGE_PADDING - TAB_OFFSET_FROM_TOP - MEDIUM_PADDING` (see the file banner derivation above) —
    // setting LARGE_PADDING to exactly that sum makes the gap 0 (verified in test/geometry.test.ts)
    // and is itself a grid multiple (2 * GRID_UNIT) since both addends are.
    this.LARGE_PADDING = this.TAB_OFFSET_FROM_TOP + this.MEDIUM_PADDING; // 8 (was the thrasos base, 10)
    // Inline-input empty height is TAB_HEIGHT + 11 in the base provider; we don't use inline inputs
    // (`inputsInline: false`, §13.10) but quantize anyway (NFR-050c: no hand-picked odd derivative
    // constants, even unused ones) — 2 grid units above TAB_HEIGHT rather than the odd +11.
    this.EMPTY_INLINE_INPUT_HEIGHT = this.TAB_HEIGHT + 2 * GRID_UNIT;
    // Field chip (dropdown/text) rect height — keep comfortably taller than the 12px field text
    // (NFR-045 readability floor). Quantized to 4 * GRID_UNIT (16, the thrasos base value) rather than
    // the M6 pass's un-quantized 14 — still well within the NFR-049 28px bound (verified unchanged at
    // 20px for the representative single-value-input fixture, `packages/editor-ui/test/density.test.ts`).
    this.FIELD_BORDER_RECT_HEIGHT = 4 * GRID_UNIT;
  }
}

/** NFR-050(b) label↔connection anchoring. Stock thrasos centers a row's fields across the row's
 *  FINAL measured height (`getElemCenterline_` → `row.yPos + row.height/2`) — when a tall child
 *  stretches an external-value-input row, the label drifts to the middle of the stretched region
 *  while the connection tab stays at the row top ("Expression op"/"Build object" floating in a
 *  huge blank interior). This RenderInfo replaces ONE placement rule: on a row with an external
 *  value input, field/icon centerlines anchor to the drawn connection tab —
 *  `row.yPos + TAB_HEIGHT/2` (the interlocked tab glyph spans [row.yPos, row.yPos + TAB_HEIGHT]:
 *  the child's top sits TAB_OFFSET_FROM_TOP above the row top, its output tab drawn
 *  TAB_OFFSET_FROM_TOP below its own top). For a minimal-height row this EQUALS the stock
 *  row-center placement, so short rows render identically; only stretched rows change. Everything
 *  else is thrasos's own algorithm (AD-033-conformant per the NFR-050(b) sanction in SPEC §8.5). */
class CompactRenderInfo extends Blockly.thrasos.RenderInfo {
  override getElemCenterline_(
    row: Blockly.blockRendering.Row,
    elem: Blockly.blockRendering.Measurable,
  ): number {
    const { Types } = Blockly.blockRendering;
    if (row.hasExternalInput && (Types.isField(elem) || Types.isIcon(elem))) {
      return row.yPos + this.constants_.TAB_HEIGHT / 2;
    }
    return super.getElemCenterline_(row, elem);
  }
}

/** thrasos-derived renderer (AD-033/FR-129/AC-040): thrasos's own drawing/measurement ALGORITHM
 *  with the constant provider's vertical geometry overridden (`makeConstants_`) plus the single
 *  NFR-050(b) field-anchoring placement rule (`makeRenderInfo_` → CompactRenderInfo above). */
class CompactThrasosRenderer extends Blockly.thrasos.Renderer {
  protected override makeConstants_(): Blockly.blockRendering.ConstantProvider {
    return new CompactConstantProvider();
  }

  protected override makeRenderInfo_(block: Blockly.BlockSvg): Blockly.thrasos.RenderInfo {
    return new CompactRenderInfo(this, block);
  }
}

/** Registered renderer name — thrasos-DERIVED (AD-033/AC-040's "thrasos" assertion matches on this
 *  substring), registered once (Blockly registries are singletons, HMR-safe like defineTheme). */
const COMPACT_RENDERER_NAME = 'transon-thrasos-compact';
function ensureCompactRendererRegistered(): void {
  // Idempotent across HMR / repeated test mounts (Blockly registries are singletons): a registry
  // lookup, not exception-message matching — Blockly's error text is not a stable API.
  if (Blockly.registry.hasItem(Blockly.registry.Type.RENDERER, COMPACT_RENDERER_NAME)) return;
  Blockly.blockRendering.register(COMPACT_RENDERER_NAME, CompactThrasosRenderer);
}
ensureCompactRendererRegistered();

/** Renderer name — thrasos-derived (AD-033/AC-040): conventional puzzle-tab connections, compacted
 *  vertical geometry (NFR-049, RFC-003 P-B). Registered eagerly above (module load), so any consumer
 *  that reads this constant can pass it straight to `Blockly.inject({renderer: TRANSON_RENDERER})`. */
export const TRANSON_RENDERER = COMPACT_RENDERER_NAME;

/** Registered theme name (the mounted workspace reports this via `getTheme().name`). */
export const TRANSON_THEME_NAME = 'transon';

/** System font stack, matching the chrome stylesheet (styles.ts) for a cohesive canvas + panels look. */
export const TRANSON_FONT_STACK = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/**
 * The committed block theme: a clean system font + a workspace/flyout surface aligned with the chrome
 * tokens (styles.ts). No `blockStyles`/`categoryStyles` — block/category colours stay data-driven
 * (FR-127). `defineTheme` is idempotent in Blockly 13, so this is safe across re-mounts / HMR.
 */
export const TRANSON_THEME: Blockly.Theme = Blockly.Theme.defineTheme(TRANSON_THEME_NAME, {
  name: TRANSON_THEME_NAME,
  base: Blockly.Themes.Classic,
  fontStyle: { family: TRANSON_FONT_STACK, weight: 'normal', size: 12 },
  componentStyles: {
    workspaceBackgroundColour: '#ffffff',
    toolboxBackgroundColour: '#f5f6f8',
    toolboxForegroundColour: '#1a1a1a',
    flyoutBackgroundColour: '#eef0f3',
    flyoutForegroundColour: '#1a1a1a',
    flyoutOpacity: 1,
    scrollbarColour: '#c4c8d0',
    scrollbarOpacity: 0.6,
    insertionMarkerColour: '#0b5cad',
    insertionMarkerOpacity: 0.3,
    cursorColour: '#0b5cad',
  },
});
