// @transon/editor-ui — the internal React UI layer for the Transon Visual Editor.
//
// Responsibility (ARCHITECTURE §5.1): panels, sandbox/compact modes, the EditorSession store
// (§9.3 / §6), theming (light DOM, AD-018), and the interactive Zelos mount (AD-017) that wires
// the live Blockly workspace to the host-executed codec in @transon/editor-core. Engine-free:
// validate/execute and the codec all cross the host EngineProvider boundary (AD-008). React is a
// peer concern bundled by @transon/editor-element (AD-019/AD-020); this package is not published.
//
// Built up across the M4 slices: D1 store, D2 panels/shell/mount, D3 host execution, D4 error
// highlighting, D5 bidirectional sync.

export const EDITOR_UI_PACKAGE = '@transon/editor-ui';

// ---- EditorSession store (D1) ----
export { createEditorStore } from './session/store.js';
export type { EditorStore, Listener } from './session/store.js';
export { emptySession, DEFAULT_MARKER } from './session/types.js';
export type {
  EditorSession,
  EditorMode,
  ValidationStatus,
  ExecutionStatus,
  JsonSyncStatus,
  EngineRuntimeStatus,
  GenerationStatus,
} from './session/types.js';
export { ERROR_CATEGORY, engineErrorCode, codecErrorCode } from './session/errors.js';
export type { ErrorCode, EditorError } from './session/errors.js';
export { engineRuntimeStatus, isEngineReady, applyEngineStatus } from './session/engine-status.js';
export { runForward, applyForward, isEmptyWorkspace, topBlock, debounce } from './session/forward.js';
export type { ForwardResult } from './session/forward.js';
