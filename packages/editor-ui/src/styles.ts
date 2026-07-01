// Scoped light-DOM stylesheet (AD-018: light DOM + scoped CSS prefix, never shadow). Injected once
// into the document head; every selector is prefixed with `.transon-editor` / `.transon-editor-shell`
// so it cannot leak into the host page. Colours are driven by `--transon-*` custom properties with
// contrast-conscious defaults (NFR-045: readable contrast), and interactive elements have a visible
// `:focus-visible` outline (NFR-045: visible focus). Theme props (FR-108/FR-128) override the vars.

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

/* Visible focus for keyboard users on every interactive control (NFR-045). */
.transon-editor-shell button:focus-visible,
.transon-editor-shell select:focus-visible,
.transon-editor-shell textarea:focus-visible,
.transon-editor-shell input:focus-visible,
.transon-editor-shell [tabindex]:focus-visible {
  outline: 2px solid var(--transon-focus);
  outline-offset: 1px;
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
