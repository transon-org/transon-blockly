// The fixed Blockly block vocabulary the codec emits/consumes (FR-124, AD-032).
//
// The encoder output is Blockly workspace-serialization JSON directly — there is no
// editor-defined intermediate representation and no `{type,inputs,fields}` mapping layer
// (AD-032, FR-126). These constants + types describe the *shape* of that data; they carry
// no codec logic (the encode/decode behavior lives entirely in the generated artifacts,
// executed by the host engine).

import type { Json } from '../engine/ports.js';

/**
 * The fixed block-type vocabulary (FR-124). Per-rule blocks are
 * `transon_rule_<rule>__<variant>` (e.g. `transon_rule_attr__name`); the four structural
 * types below cover literals, arrays, marker-free objects, and the out-of-surface
 * placeholder (§13.11).
 */
export const STRUCTURAL_BLOCK_TYPES = [
  'transon_literal',
  'transon_array',
  'transon_object_literal',
  'transon_unsupported',
] as const;

export type StructuralBlockType = (typeof STRUCTURAL_BLOCK_TYPES)[number];

/** A per-rule block type for `rule` + `variant`, e.g. `transon_rule_attr__name`. */
export function ruleBlockType(rule: string, variant: string): string {
  return `transon_rule_${rule}__${variant}`;
}

/** True when `type` is a `transon_rule_<rule>__<variant>` block type. */
export function isRuleBlockType(type: string): boolean {
  return /^transon_rule_[a-z0-9]+__[a-z0-9]+$/.test(type);
}

/**
 * A single Blockly workspace-serialization block node (the subset the M1 codec emits).
 * `inputs` carry connected child blocks (recursive structure); `fields` carry leaf values;
 * `extraState` carries non-input structural data (literal-object keys, the unsupported raw
 * payload). The exact serialization details are implementation-level per FR-124.
 */
export interface WorkspaceBlock {
  type: string;
  fields?: Record<string, Json>;
  inputs?: Record<string, { block: WorkspaceBlock }>;
  extraState?: Record<string, Json>;
}

/**
 * A `JsonPathBlockMap` entry (SPEC §9.12, FR-091/094/122). Produced alongside the
 * workspace as the codec walks; *consumed* for error highlighting in M4 (FR-092/093/095).
 */
export interface JsonPathBlockMapEntry {
  template_path: string;
  block_id: string;
  rule_name?: string;
  parameter_name?: string;
  nearest_parent_block_id?: string;
}

export type JsonPathBlockMap = JsonPathBlockMapEntry[];
