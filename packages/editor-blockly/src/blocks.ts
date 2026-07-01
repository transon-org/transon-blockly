// Register the metadata-projected palette block definitions into Blockly and load codec-emitted
// workspace JSON. The block definitions are the committed G_palette artifact (AD-026); this module
// only hands them to Blockly's own (de)serialization — it ships NO hand-written translation of
// codec output into workspace JSON (FR-126/AD-032): the envelope wrap is structure-blind (it never
// reads a block's inputs/fields/extraState).

import * as Blockly from 'blockly/core';
import { PALETTE_BLOCKS, TOOLBOX, editorMetadata } from '@transon/editor-core';
import { registerTransonRuntime } from './runtime.js';

let blocksRegistered = false;

const RULE_TYPE_PREFIX = 'transon_rule_';

/** Rule name → its metadata description, for block tooltips (FR-078). Built lazily from the docs
 *  payload; missing/empty docs simply yield no tooltip (FR-077, graceful). */
let ruleDescriptions: Map<string, string> | undefined;
function ruleDescriptionMap(): Map<string, string> {
  if (!ruleDescriptions) {
    ruleDescriptions = new Map();
    for (const r of editorMetadata.docs?.rules ?? []) {
      const desc = (r as { description?: unknown }).description;
      if (typeof desc === 'string' && desc.trim()) ruleDescriptions.set(r.name, desc);
    }
  }
  return ruleDescriptions;
}

/**
 * The metadata tooltip for a palette block type (FR-078, AC-020), or `undefined` when the type is not
 * a rule block or its rule has no metadata description (FR-077, graceful). A rule block type is
 * `transon_rule_<rule>__<variant>`; the rule name has no `__`, so it is the segment before it.
 */
export function ruleTooltip(blockType: string): string | undefined {
  if (!blockType.startsWith(RULE_TYPE_PREFIX)) return undefined;
  const rule = blockType.slice(RULE_TYPE_PREFIX.length).split('__')[0];
  return rule ? ruleDescriptionMap().get(rule) : undefined;
}

/**
 * Register the behavior runtime + every committed palette block definition into Blockly. Idempotent.
 * Rule-variant blocks use built-in Blockly field/input types; the structural blocks reference the
 * runtime's custom field + mutators, so the runtime is registered first. Each rule block is enriched
 * with a metadata-derived `tooltip` (FR-078) when the def does not already carry one.
 */
export function registerTransonBlocks(): void {
  registerTransonRuntime();
  if (blocksRegistered) return;
  blocksRegistered = true;
  for (const def of PALETTE_BLOCKS) {
    if (!Blockly.Blocks[def.type]) {
      const tip = ruleTooltip(def.type);
      const enriched =
        tip && !(def as { tooltip?: unknown }).tooltip ? { ...def, tooltip: tip } : def;
      Blockly.defineBlocksWithJsonArray([enriched as unknown as { [k: string]: unknown }]);
    }
  }
}

/** The committed Blockly `categoryToolbox` projected by G_toolbox (§12.4). */
export function getTransonToolbox(): unknown {
  return TOOLBOX;
}

/**
 * Wrap a single codec-emitted block into a Blockly workspace-serialization document. The wrap is
 * UI-only (§11.5) and structure-blind — it adds the top-level `blocks` envelope Blockly expects and
 * never inspects the block's inputs/fields/extraState (FR-126/AD-032). The optional `id` is a
 * UI-only attribute (§11.5).
 */
export function toWorkspaceState(block: unknown): { blocks: { blocks: unknown[] } } {
  return { blocks: { blocks: [block] } };
}

/**
 * Load a codec-emitted block (the encoder's output) into a Blockly workspace via Blockly's own
 * workspace deserialization (FR-126). Registers the blocks first so the types resolve.
 */
export function loadCodecOutput(block: unknown, workspace: Blockly.Workspace): void {
  registerTransonBlocks();
  Blockly.serialization.workspaces.load(toWorkspaceState(block), workspace);
}
