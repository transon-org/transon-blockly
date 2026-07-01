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

/** Renderer name — thrasos is a built-in (auto-registered by blockly/core), conventional puzzle tabs. */
export const TRANSON_RENDERER = 'thrasos';

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
