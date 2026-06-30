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
