// Self-contained IIFE entry (AD-020): for plain <script> usage. Importing it auto-registers the
// <transon-editor> custom element and re-exports the vanilla API on a global. Bundles React + the
// internal UI + Blockly; ships NO engine (AD-008) — the host supplies an EngineProvider.

import { createTransonEditor } from './create.js';
import { registerTransonEditorElement, TransonEditorElement, TRANSON_EDITOR_TAG } from './element.js';

registerTransonEditorElement();

// Expose the vanilla factory on a global for non-module consumers.
(globalThis as unknown as { TransonEditor?: unknown }).TransonEditor = {
  createTransonEditor,
  registerTransonEditorElement,
  TransonEditorElement,
  TRANSON_EDITOR_TAG,
};

export { createTransonEditor, registerTransonEditorElement, TransonEditorElement, TRANSON_EDITOR_TAG };
