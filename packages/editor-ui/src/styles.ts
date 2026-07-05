// Scoped light-DOM stylesheet (AD-018: light DOM + scoped CSS prefix, never shadow). Injected once
// into the document head; every selector is prefixed with `.transon-editor` / `.transon-editor-shell`
// so it cannot leak into the host page. It carries two things: (1) chrome THEME — colours driven by
// `--transon-*` custom properties with contrast-conscious defaults (NFR-045: readable contrast) and a
// visible `:focus-visible` outline (NFR-045: visible focus); theme props (FR-108/FR-128) override the
// vars — and (2) shell LAYOUT — the §12.1 sandbox two-pane / §12.2 compact structure plus an NFR-025
// responsive fallback. The layout half is load-bearing: without it the panels collapse into a flat
// stack and the Blockly canvas mounts into a 0px container (AD-017); block/category colours stay
// data-driven (FR-127) and are never expressed here.

export const TRANSON_STYLE_ID = 'transon-editor-styles';

export const TRANSON_CSS = `
.transon-editor-shell {
  /* Chrome-only theming tokens (FR-128) with readable defaults. Foreground on background is
     #1a1a1a on #ffffff (~16:1) and error/muted tones clear WCAG AA on the panel background. */
  --transon-bg: #ffffff;
  --transon-fg: #1a1a1a;
  --transon-panel-bg: #f5f6f8;
  --transon-border: #c4c8d0;
  --transon-accent: #0b5cad;         /* AA on white */
  --transon-error: #b00020;          /* AA on the panel background */
  --transon-match: #0a6b2e;          /* AA green */
  --transon-muted: #4a4f57;          /* AA muted text */
  --transon-focus: #0b5cad;
  color: var(--transon-fg);
  background: var(--transon-bg);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 14px;
}
.transon-editor-shell .transon-panel-title,
.transon-editor-shell .transon-panel-subtitle { font-weight: 600; }
.transon-editor-shell .transon-panel {
  background: var(--transon-panel-bg);
  border: 1px solid var(--transon-border);
  border-radius: 4px;
}
.transon-editor-shell .transon-toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.transon-editor-shell .transon-muted,
.transon-editor-shell .transon-gated { color: var(--transon-muted); }
.transon-editor-shell .transon-error-category { font-weight: 600; color: var(--transon-error); }
.transon-editor-shell .transon-match[data-match="match"] { color: var(--transon-match); }
.transon-editor-shell .transon-match[data-match="differ"] { color: var(--transon-error); }
.transon-editor-shell .transon-statusbar [data-mismatch] { color: var(--transon-error); font-weight: 600; }

/* The on-canvas +/- mutator buttons (editor-blockly runtime.ts) are Blockly FieldImages — the
   only <image> fields in the transon surface — rendered as button chips. A pointer cursor gives
   them click affordance (FieldImage has no hover/CSS state of its own). */
.transon-editor .blocklyDraggable image { cursor: pointer; }

/* Visible focus for keyboard users on every interactive control (NFR-045). */
.transon-editor-shell button:focus-visible,
.transon-editor-shell select:focus-visible,
.transon-editor-shell textarea:focus-visible,
.transon-editor-shell input:focus-visible,
.transon-editor-shell [tabindex]:focus-visible {
  outline: 2px solid var(--transon-focus);
  outline-offset: 1px;
}

/* ---- Shell layout (§12.1 sandbox two-pane, §12.2 compact; NFR-025 responsive) --------------------
   The rules above are theme/colour/focus only. These give the shell its structure: a full-height flex
   column (toolbar · body · status bar) whose body splits into the canvas + the scrolling panel stack,
   and — critically — a SIZED Blockly canvas. An unsized container renders a 0px workspace (AD-017), so
   the flat, "no CSS" look is really a missing-layout look. */
.transon-editor-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 480px;      /* usable floor when the host container is unsized (e.g. an inline element) */
  box-sizing: border-box;
  overflow: hidden;
}
.transon-editor-shell *,
.transon-editor-shell *::before,
.transon-editor-shell *::after { box-sizing: border-box; }

.transon-editor-shell .transon-toolbar {
  padding: 8px;
  border-bottom: 1px solid var(--transon-border);
  background: var(--transon-panel-bg);
}
.transon-editor-shell .transon-statusbar {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  padding: 4px 8px;
  border-top: 1px solid var(--transon-border);
  background: var(--transon-panel-bg);
  font-size: 12px;
  color: var(--transon-muted);
}

/* Body fills the space between toolbar and status bar. min-height:0 lets its flex children shrink and
   scroll instead of overflowing the shell (the canonical flexbox overflow fix). */
.transon-editor-shell .transon-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  gap: 8px;
  padding: 8px;
}

/* Sandbox (§12.1): canvas on the left, the scrolling panel stack on the right. */
.transon-editor-shell .transon-body.transon-sandbox { flex-direction: row; }
.transon-editor-shell .transon-canvas-col {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  display: flex;
}
.transon-editor-shell .transon-side-col {
  flex: 0 1 clamp(320px, 34%, 460px);
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
}

/* Compact (§12.2): canvas beside the optional JSON / split view. */
.transon-editor-shell .transon-body.transon-compact { flex-direction: row; }
.transon-editor-shell .transon-body.transon-compact > .transon-panel { flex: 1 1 0; min-width: 0; }

/* The Blockly mount MUST have a real size or the injected workspace collapses to 0px (AD-017). It
   fills its column and never drops below a usable floor; position:relative anchors Blockly's own
   absolutely-positioned injection div + flyout. */
.transon-editor-shell .transon-canvas {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 320px;
  position: relative;
  border: 1px solid var(--transon-border);
  border-radius: 4px;
  overflow: hidden;
}

/* Panels: consistent padding + internal spacing; a panel's code/textarea body grows within it. */
.transon-editor-shell .transon-panel {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.transon-editor-shell .transon-panel-title,
.transon-editor-shell .transon-panel-subtitle { margin: 0; }

/* Code + editable JSON/input areas: monospace, full width, scroll rather than stretch the panel. */
.transon-editor-shell .transon-code,
.transon-editor-shell .transon-code-input {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.4;
  width: 100%;
  margin: 0;
  padding: 6px;
  background: var(--transon-bg);
  color: var(--transon-fg);
  border: 1px solid var(--transon-border);
  border-radius: 4px;
}
.transon-editor-shell pre.transon-code { white-space: pre-wrap; overflow: auto; max-height: 220px; }
.transon-editor-shell textarea.transon-code-input { resize: vertical; min-height: 96px; }
.transon-editor-shell .transon-example-select { width: 100%; }

/* Errors + files: readable lists (their state already carries text labels, not colour alone, NFR-045). */
.transon-editor-shell .transon-errors,
.transon-editor-shell .transon-files {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.transon-editor-shell .transon-error { display: flex; gap: 8px; align-items: baseline; }

/* Responsive (NFR-025): on a narrow container drop the two-pane split to one scrolling column so the
   canvas and panels stay usable. */
@media (max-width: 900px) {
  .transon-editor-shell .transon-body.transon-sandbox { flex-direction: column; overflow: auto; }
  .transon-editor-shell .transon-side-col { flex: 0 0 auto; overflow: visible; }
  .transon-editor-shell .transon-canvas-col { min-height: 320px; }
}
`;

/**
 * Inject the scoped stylesheet once (idempotent, keyed by id). Called by the interactive mount so all
 * three surfaces (React, `createTransonEditor()`, `<transon-editor>`) get it. No-op when there is no
 * document (e.g. a non-DOM test that only exercises the store).
 */
export function ensureTransonStyles(doc: Document | undefined = globalThis.document): void {
  if (!doc || doc.getElementById(TRANSON_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = TRANSON_STYLE_ID;
  style.textContent = TRANSON_CSS;
  doc.head.appendChild(style);
}
