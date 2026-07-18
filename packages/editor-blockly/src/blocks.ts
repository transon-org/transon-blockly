// Register the metadata-projected palette block definitions into Blockly and load codec-emitted
// workspace JSON. The block definitions are the committed G_palette artifact (AD-026); this module
// only hands them to Blockly's own (de)serialization — it ships NO hand-written translation of
// codec output into workspace JSON (FR-126/AD-032): the envelope wrap is structure-blind (it never
// reads a block's inputs/fields/extraState).

import * as Blockly from 'blockly/core';
import { PALETTE_BLOCKS, TOOLBOX, editorMetadata, type BlockDefinition, type Json } from '@transon/editor-core';
import { registerTransonRuntime } from './runtime.js';

let blocksRegistered = false;

const RULE_TYPE_PREFIX = 'transon_rule_';

/**
 * A palette surface to register: the block definitions (the `G_palette` output `blocks`) plus the
 * docs rules that feed tooltips (FR-078). The committed snapshot surface is the default; a session
 * on the runtime metadata source passes its generated palette + fetched docs instead
 * (RFC-007/FR-139, AD-036).
 */
export interface PaletteSurface {
  blocks: BlockDefinition[];
  /** The metadata docs payload's `rules` list (name + description), for FR-078 tooltips. */
  docsRules?: { name: string; [k: string]: unknown }[];
}

/** Rule name → its metadata description, for block tooltips (FR-078). Built lazily from the docs
 *  payload; missing/empty docs simply yield no tooltip (FR-077, graceful). Rebuilt when a runtime
 *  palette surface is applied (RFC-007). */
let ruleDescriptions: Map<string, string> | undefined;
let docsRulesSource: { name: string; [k: string]: unknown }[] | undefined;
function ruleDescriptionMap(): Map<string, string> {
  if (!ruleDescriptions) {
    ruleDescriptions = new Map();
    const rules = docsRulesSource ?? editorMetadata.docs?.rules ?? [];
    for (const r of rules) {
      const desc = (r as { description?: unknown }).description;
      if (typeof desc === 'string' && desc.trim()) ruleDescriptions.set(r.name, desc);
    }
  }
  return ruleDescriptions;
}

/**
 * The tooltip for a palette block type: `"<rule> — <description>"` (§12.5, OQ-018, FR-078) — the
 * rule name ahead of the metadata description, since the canvas label is title-only and no longer
 * teaches the rule↔JSON mapping (§12.5). Falls back to the rule name ALONE when the rule has no
 * metadata description (FR-077, graceful) — still names the rule rather than showing nothing.
 * Returns `undefined` when the type is not a rule block at all. A rule block type is
 * `transon_rule_<rule>__<variant>`; the rule name has no `__`, so it is the segment before it.
 */
export function ruleTooltip(blockType: string): string | undefined {
  if (!blockType.startsWith(RULE_TYPE_PREFIX)) return undefined;
  const rule = blockType.slice(RULE_TYPE_PREFIX.length).split('__')[0];
  if (!rule) return undefined;
  const desc = ruleDescriptionMap().get(rule);
  return desc ? `${rule} — ${desc}` : rule;
}

// ---- flyout dual label (§12.5, OQ-018) ----
//
// The canvas face shows the title alone (message0/message1 project title-only, codegen.ts); the
// flyout/palette keeps the dual label "<title> (<rule>)" so the rule↔JSON mapping is taught at
// pick time. G_palette carries that dual label as a display-only `flyoutLabel` top-level key on
// the projected def (Blockly's `jsonInit` ignores unknown top-level keys, so it is otherwise
// inert). Rather than duplicating whole block defs per surface, ONE shared Blockly extension
// retargets the block's title field's text at init time, based on `Block.isInFlyout` (the
// standard Blockly signal for "this instance lives in a flyout workspace" — set from
// `Workspace.isFlyout`, true for the palette's flyout workspace and false for the canvas). The
// title is always the first field in message0 (every projected def's message starts with the
// title token, both the single-row and title-own-row/multi-input layouts), so no per-rule field
// name is needed.
const FLYOUT_LABEL_EXTENSION = 'transon_flyout_label';
let flyoutLabelsByType: Map<string, string> | undefined;

/** Registers the shared flyout-label extension once; (re)builds the type→dual-label lookup from
 *  the given palette defs (never per-rule TS — AD-012). */
function ensureFlyoutLabelExtension(blocks: BlockDefinition[]): void {
  flyoutLabelsByType = new Map(
    blocks.filter((d) => typeof d.flyoutLabel === 'string').map((d) => [d.type, d.flyoutLabel as unknown as string]),
  );
  if (Blockly.Extensions.isRegistered(FLYOUT_LABEL_EXTENSION)) return;
  Blockly.Extensions.register(FLYOUT_LABEL_EXTENSION, function (this: Blockly.Block) {
    if (!this.isInFlyout) return;
    const label = flyoutLabelsByType?.get(this.type);
    if (!label) return;
    const title = [...this.getFields()][0];
    if (!(title instanceof Blockly.FieldLabel)) return;
    // Blockly merges adjacent message text into ONE FieldLabel, so the first field may carry the
    // title PLUS a following label — e.g. "Map items", where "items" is the §12.5 face-uniqueness
    // socket label that distinguishes map__items from map__item. Substitute only the title portion
    // ("Map (map) items"), or the flyout would collapse the colliding variants back onto one face.
    // The canvas title is the dual label minus its " (<rule>)" suffix, by construction (G_palette).
    const canvasTitle = label.replace(/ \([^()]*\)$/, '');
    const current = String(title.getValue() ?? '');
    title.setValue(current.startsWith(canvasTitle) ? label + current.slice(canvasTitle.length) : label);
  });
}

/** Register one definition set. `override` re-registers a type that already exists (runtime palette
 *  swap, RFC-007) — Blockly's registry is global, so the last-applied surface wins page-wide. */
function defineBlocks(blocks: BlockDefinition[], override: boolean): void {
  for (const def of blocks) {
    if (Blockly.Blocks[def.type]) {
      if (!override) continue;
      delete Blockly.Blocks[def.type];
    }
    const tip = ruleTooltip(def.type);
    let enriched: typeof def = def;
    if (tip && !(def as { tooltip?: unknown }).tooltip) enriched = { ...enriched, tooltip: tip };
    if (typeof enriched.flyoutLabel === 'string') {
      const existing = (enriched as { extensions?: string[] }).extensions ?? [];
      const extensions = [...existing, FLYOUT_LABEL_EXTENSION] as unknown as Json;
      enriched = { ...enriched, extensions };
    }
    Blockly.defineBlocksWithJsonArray([enriched as unknown as { [k: string]: unknown }]);
  }
}

/**
 * Register the behavior runtime + every committed palette block definition into Blockly. Idempotent.
 * Rule-variant blocks use built-in Blockly field/input types; the structural blocks reference the
 * runtime's custom field + mutators, so the runtime is registered first. Each rule block is enriched
 * with a metadata-derived `tooltip` (FR-078) when the def does not already carry one, and — when the
 * def carries a `flyoutLabel` (§12.5, OQ-018) — the shared flyout-label extension that shows it only
 * inside a flyout workspace, leaving the canvas face title-only.
 */
export function registerTransonBlocks(): void {
  registerTransonRuntime();
  if (blocksRegistered) return;
  blocksRegistered = true;
  ensureFlyoutLabelExtension(PALETTE_BLOCKS);
  defineBlocks(PALETTE_BLOCKS, false);
}

/**
 * Apply a session-generated palette surface (RFC-007/FR-139, AD-036): rebuilds the FR-078 tooltip
 * map from the fetched docs, rebuilds the §12.5 flyout-label lookup, and (re)registers every
 * definition — overriding committed types whose projection changed (e.g. a dropdown whose enum
 * domain grew). Blockly's block registry is global (AD-036 trade-off): the last-applied surface
 * wins for the whole page, so one session per page is the supported dynamic embed shape. Apply
 * BEFORE any document is loaded; existing block instances are not migrated.
 */
export function applyPaletteSurface(surface: PaletteSurface): void {
  registerTransonBlocks(); // runtime + committed baseline first (structural blocks, extension)
  docsRulesSource = surface.docsRules;
  ruleDescriptions = undefined; // rebuild the tooltip map from the new docs on next lookup
  ensureFlyoutLabelExtension(surface.blocks);
  defineBlocks(surface.blocks, true);
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
