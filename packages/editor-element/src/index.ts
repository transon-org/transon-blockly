// @transon/editor-element — the public, framework-agnostic surface (AD-019, AD-020).
//
// Exposes createTransonEditor() (a vanilla factory returning a TransonEditorHandle) and the
// <transon-editor> custom element, both mounting the internal React UI (@transon/editor-ui) into a
// light-DOM container (AD-018). ESM is primary; a sibling IIFE entry (src/iife.ts, added in D6)
// auto-registers the element for <script> usage. Ships no engine (AD-008) — the host supplies an
// EngineProvider.
//
// Built up in M4 slice D6.

export const EDITOR_ELEMENT_PACKAGE = '@transon/editor-element';
