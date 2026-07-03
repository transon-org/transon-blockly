// The committed editor-surface artifacts (palette block definitions + toolbox), projected from
// metadata by G_palette/G_toolbox at build time (AD-026, AD-030) and consumed at runtime by
// @transon/editor-blockly to register/render the Zelos surface. Engine-free: these are static
// data the editor loads, not executed (unlike the codec). The generator functions that PRODUCE
// them (generatePalette/generateToolbox) live in codegen.ts and are used only by the regen gate.

import paletteArtifact from './artifacts/palette.json' with { type: 'json' };
import toolboxArtifact from './artifacts/toolbox.json' with { type: 'json' };

import type { Json } from '../engine/ports.js';

/** A Blockly (Zelos) block definition as projected by G_palette (the `defineBlocksWithJsonArray` shape). */
export interface BlockDefinition {
  type: string;
  message0?: string;
  args0?: Json[];
  output?: Json;
  colour?: number | string;
  mutator?: string;
  inputsInline?: boolean;
  tooltip?: string;
  [k: string]: Json | undefined;
}

/** The committed palette block definitions (rule variants + the four structural blocks). */
export const PALETTE_BLOCKS: BlockDefinition[] =
  (paletteArtifact as unknown as { blocks: BlockDefinition[] }).blocks;

/** The committed Blockly `categoryToolbox` (categories in §12.4 order, projected by G_toolbox). */
export const TOOLBOX: Json = toolboxArtifact as unknown as Json;
