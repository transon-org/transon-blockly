// @transon/editor-element — the public, framework-agnostic surface (AD-019, AD-020).
//
// createTransonEditor() (a vanilla factory returning a TransonEditorHandle) and the <transon-editor>
// custom element, both mounting the internal React UI (@transon/editor-ui) into a light-DOM
// container (AD-018). ESM is primary; the sibling IIFE entry (src/iife.ts) auto-registers the
// element for <script> usage. Ships no engine (AD-008) — the host supplies an EngineProvider.

export const EDITOR_ELEMENT_PACKAGE = '@transon/editor-element';

export { createTransonEditor } from './create.js';
export type { TransonEditorHandle, CreateTransonEditorOptions } from './create.js';
export {
  registerTransonEditorElement,
  TransonEditorElement,
  TRANSON_EDITOR_TAG,
} from './element.js';

// Re-export the host boundary types so embedders can type their config without depending on the
// internal UI package directly.
export type { TransonEditorHost, ExampleCase, EditorMode } from '@transon/editor-ui';
