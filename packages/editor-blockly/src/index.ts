// @transon/editor-blockly — the Blockly (Zelos) rendering layer for the Transon Visual Editor.
//
// Responsibility (ARCHITECTURE §5.1): render the metadata-projected palette/toolbox — whose
// committed artifacts live in @transon/editor-core (AD-026) — to the Zelos renderer (AD-017),
// host the finite, rule-agnostic behavior runtime (AD-031), and wire `workspace ⇄ blocks` so
// the generated encoder/decoder read/write real Blockly workspace JSON (AD-032). Engine-free:
// the codec executes through the host EngineProvider in core (AD-008); this package bundles no
// engine and adds only Blockly. Light DOM + scoped CSS, never shadow DOM (AD-018).

export const EDITOR_BLOCKLY_PACKAGE = '@transon/editor-blockly';

export { registerTransonRuntime, BEHAVIOR_PRIMITIVES } from './runtime.js';
export {
  registerTransonBlocks,
  getTransonToolbox,
  toWorkspaceState,
  loadCodecOutput,
  ruleTooltip,
} from './blocks.js';
