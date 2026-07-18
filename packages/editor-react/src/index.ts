// @transon/editor-react — the native React surface for the Transon Visual Editor (AD-019).
//
// Exposes `<TransonEditor {...options} ref={handle} />` with React as a PEER dependency: the host
// React app supplies its single React + react-dom instance (this package externalizes them). The
// internal UI (@transon/editor-ui) and the Blockly behavior runtime are bundled in; no engine is
// bundled (AD-008) — the host supplies an EngineProvider via `host`.

export const EDITOR_REACT_PACKAGE = '@transon/editor-react';

export { TransonEditor } from './TransonEditor.js';
export type { TransonEditorProps, TransonEditorRef } from './TransonEditor.js';

// Re-export the host boundary + config types so consumers can type their embedding config without
// depending on the internal UI package directly.
export type {
  TransonEditorHost,
  ExampleCase,
  EditorMode,
  EditorController,
  TransonTheme,
  ToolboxCategoryConfig,
  ToolbarActionId,
} from '@transon/editor-ui';

// Example-corpus derivation (FR-132, SPEC v2.8): hosts overriding `host.examples` should derive
// their corpus from the engine docs payload here — a hand-mapped corpus drops the `rule`/`tier`
// joins and the picker degrades to a flat, group-less list.
export { buildExampleCorpus, buildExampleCorpusFromDocs } from '@transon/editor-ui';
export type { EditorDocs, EditorMetadata } from '@transon/editor-core';

// Engine-port types (AD-008): a host implements `EngineProvider` to supply the runtime; the
// validation/execution result shapes and `Json` type it returns are part of that contract.
export type {
  EngineProvider,
  Json,
  ValidationResult,
  ExecutionResult,
} from '@transon/editor-core';
