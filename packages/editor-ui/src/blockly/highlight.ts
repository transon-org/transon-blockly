// Error → block highlighting (FR-091..095, AC-017, §16.4, §17.7/§17.8). The skeleton-produced
// JsonPathBlockMap (FR-122) maps a document JSON path → block_id (the path) + nearest_parent. To
// highlight, we need that path to resolve to a live Blockly block, so we build a path→block index by
// walking the rendered workspace via the Blockly API (getInput/inputList/getInputTargetBlock/
// getFieldValue) — NOT the `.inputs`/`.fields` members the codec uses, so this is not a
// codec↔workspace mapping (FR-126/AD-032). The walk reproduces the block_map's path scheme so the
// two share a coordinate system.
//
// NB: today's engine reports an error's location only as a text trail (not a structured path), so a
// precise template_path is rarely available at runtime; the highlighter falls back to the root block
// ("nearest", AC-017). When a path IS present (an editor-detected error, or a future engine that
// reports structured paths), it highlights the exact mapped or nearest-parent block (FR-092..094).

import * as Blockly from 'blockly/core';
import type { JsonPathBlockMap } from '@transon/editor-core';
import type { EditorError } from '../session/errors.js';

const ROOT_PATH = '$';

/** Escape a path segment exactly as the codec's blockMap does (RFC-6901: `~`→`~0`, `/`→`~1`). */
function escapeSeg(seg: string | number): string {
  return String(seg).replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * Build a `documentPath → Blockly.Block` index over the workspace, matching the block_map path
 * scheme: object-literal children are keyed by their KEY field value, array children by index, rule
 * params by the (param-named) input. Constant params are block fields (no child block), so their
 * paths resolve via `nearest_parent_block_id` at highlight time.
 */
export function buildPathIndex(workspace: Blockly.Workspace): Map<string, Blockly.Block> {
  const index = new Map<string, Blockly.Block>();
  const top = workspace.getTopBlocks(false)[0];
  if (top) walk(top, ROOT_PATH, index);
  return index;
}

function walk(block: Blockly.Block, path: string, index: Map<string, Blockly.Block>): void {
  index.set(path, block);
  const type = block.type;
  if (type === 'transon_object_literal') {
    for (let i = 0; block.getInput(`VALUE${i}`); i++) {
      const key = block.getFieldValue(`KEY${i}`) as unknown;
      const child = block.getInputTargetBlock(`VALUE${i}`);
      if (child) walk(child, `${path}/${escapeSeg(String(key ?? ''))}`, index);
    }
  } else if (type === 'transon_array') {
    for (let i = 0; block.getInput(`ITEM${i}`); i++) {
      const child = block.getInputTargetBlock(`ITEM${i}`);
      if (child) walk(child, `${path}/${i}`, index);
    }
  } else if (type.startsWith('transon_rule_')) {
    // rule params are inputs named by the param (FR-124); recurse each connected one
    for (const input of block.inputList) {
      if (!input.name) continue;
      const child = block.getInputTargetBlock(input.name);
      if (child) walk(child, `${path}/${escapeSeg(input.name)}`, index);
    }
  }
  // transon_literal / transon_unsupported: leaves
}

/** Clear all block warnings (called before re-highlighting and on a fresh projection). */
export function clearHighlights(workspace: Blockly.Workspace): void {
  for (const b of workspace.getAllBlocks(false)) b.setWarningText(null);
}

/**
 * Highlight the blocks for a set of errors (FR-092/093/094, AC-017, §17.7/§17.8). For each error
 * with a resolvable `template_path`, warn the mapped block (or its nearest parent); otherwise warn
 * the root block (the nearest available). Idempotent: clears prior warnings first.
 */
export function highlightErrors(
  workspace: Blockly.Workspace,
  blockMap: JsonPathBlockMap | null,
  errors: EditorError[],
): void {
  clearHighlights(workspace);
  if (errors.length === 0) return;
  const index = buildPathIndex(workspace);
  const root = workspace.getTopBlocks(false)[0];
  const byPath = new Map((blockMap ?? []).map((e) => [e.template_path, e] as const));

  for (const err of errors) {
    let target: Blockly.Block | undefined;
    if (err.template_path) {
      const entry = byPath.get(err.template_path);
      target =
        index.get(err.template_path) ??
        (entry?.nearest_parent_block_id ? index.get(entry.nearest_parent_block_id) : undefined);
    }
    target = target ?? root;
    target?.setWarningText(err.message);
  }
}
