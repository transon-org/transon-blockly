// Transon block-surface renderer + theme (FR-129, AC-040, AD-033).
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
// `ConstantProvider`'s base (thrasos-inherited) constructor derives several fields from others at
// construction time (e.g. `DUMMY_INPUT_MIN_HEIGHT = TAB_HEIGHT`, `TOP_ROW_MIN_HEIGHT =
// MEDIUM_PADDING`) — so this subclass sets every constant it wants changed explicitly (not just the
// "root" ones) rather than relying on the base constructor picking up an overridden root after the
// fact.
class CompactConstantProvider extends Blockly.blockRendering.ConstantProvider {
  constructor() {
    super();
    // Padding between adjacent elements/rows (base thrasos: SMALL_PADDING=3, MEDIUM_PADDING=5).
    this.SMALL_PADDING = 2;
    this.MEDIUM_PADDING = 3;
    // Puzzle-tab height also sets DUMMY_INPUT_MIN_HEIGHT/DUMMY_INPUT_SHADOW_MIN_HEIGHT (base: 15).
    this.TAB_HEIGHT = 12;
    this.DUMMY_INPUT_MIN_HEIGHT = this.TAB_HEIGHT;
    this.DUMMY_INPUT_SHADOW_MIN_HEIGHT = this.TAB_HEIGHT;
    // Notch height (previous/next connections; base: 4).
    this.NOTCH_HEIGHT = 3;
    // The minimum block height floor (base: 24) and its statement-input-empty derivative.
    this.MIN_BLOCK_HEIGHT = 20;
    this.EMPTY_STATEMENT_INPUT_HEIGHT = this.MIN_BLOCK_HEIGHT;
    // Top/bottom row minimums track MEDIUM_PADDING in the base provider (base: 5 each).
    this.TOP_ROW_MIN_HEIGHT = this.MEDIUM_PADDING;
    this.BOTTOM_ROW_MIN_HEIGHT = this.MEDIUM_PADDING;
    // Inline-input empty height is TAB_HEIGHT + 11 in the base provider.
    this.EMPTY_INLINE_INPUT_HEIGHT = this.TAB_HEIGHT + 11;
    // Field chip (dropdown/text) rect height — keep comfortably taller than the 12px field text
    // (NFR-045 readability floor) while still shrinking from the base 16.
    this.FIELD_BORDER_RECT_HEIGHT = 14;
  }
}

/** thrasos-derived renderer (AD-033/FR-129/AC-040): identical drawing/measurement ALGORITHM, only
 *  the constant provider's vertical geometry is overridden (`makeConstants_`). */
class CompactThrasosRenderer extends Blockly.thrasos.Renderer {
  protected override makeConstants_(): Blockly.blockRendering.ConstantProvider {
    return new CompactConstantProvider();
  }
}

/** Registered renderer name — thrasos-DERIVED (AD-033/AC-040's "thrasos" assertion matches on this
 *  substring), registered once (Blockly registries are singletons, HMR-safe like defineTheme). */
const COMPACT_RENDERER_NAME = 'transon-thrasos-compact';
let compactRendererRegistered = false;
function ensureCompactRendererRegistered(): void {
  if (compactRendererRegistered) return;
  try {
    Blockly.blockRendering.register(COMPACT_RENDERER_NAME, CompactThrasosRenderer);
  } catch (e) {
    // Re-registration (HMR / repeated test mounts in the same module instance) throws "already
    // registered" — idempotent, like registerTransonBlocks()/defineTheme elsewhere in this layer.
    if (!/already registered/i.test(String((e as Error)?.message))) throw e;
  }
  compactRendererRegistered = true;
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
