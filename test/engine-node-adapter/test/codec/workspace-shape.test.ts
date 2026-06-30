// FR-124, AD-032 — the encoder output is valid Blockly workspace-serialization JSON over
// the fixed block vocabulary. The validator below asserts shape only (it performs no
// codec↔workspace mapping, so it does not live under packages/*/src — FR-126). It must
// catch a malformed-but-plausible block, not just reject obvious garbage.
//
// §15.8: workspace-shape invariant is validated over BOTH the M2 structural corpus AND
// all 147 engine docs/example-corpus templates (FR-124, §15.8).
// The examples include ≥4-level nesting (e.g. ExprMonadsComplex, MapListToList at depth 7).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json, CatalogEntry } from '@transon/editor-core';
import { encode, STRUCTURAL_BLOCK_TYPES, editorMetadata } from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';
import { M1_CORPUS } from './corpus.js';

/** A single engine-docs example entry (NFR-047: docs side). */
interface DocsExample {
  name: string;
  template: Json;
  data: Json;
  result: Json;
}

/**
 * Collect all 147 examples from editorMetadata.docs.{rules,operators,functions}.
 * Returns [{source, example}] — source is the rule/op/fn name for stable test naming.
 */
function collectAllDocsExamples(): { source: string; example: DocsExample }[] {
  const out: { source: string; example: DocsExample }[] = [];
  for (const entry of editorMetadata.docs.rules) {
    for (const ex of ((entry as CatalogEntry & { examples?: DocsExample[] }).examples ?? [])) {
      out.push({ source: entry.name, example: ex });
    }
  }
  for (const entry of editorMetadata.docs.operators) {
    for (const ex of ((entry as CatalogEntry & { examples?: DocsExample[] }).examples ?? [])) {
      out.push({ source: entry.name, example: ex });
    }
  }
  for (const entry of editorMetadata.docs.functions) {
    for (const ex of ((entry as CatalogEntry & { examples?: DocsExample[] }).examples ?? [])) {
      out.push({ source: entry.name, example: ex });
    }
  }
  return out;
}

const DOCS_EXAMPLES = collectAllDocsExamples();

const STRUCTURAL = new Set<string>(STRUCTURAL_BLOCK_TYPES);
// Variant IDs may contain `+` (e.g. `key+value` from map/object/expr/call metadata).
const RULE_BLOCK = /^transon_rule_[a-z0-9]+__[a-z0-9+]+$/;
const ALLOWED_KEYS = new Set(['type', 'fields', 'inputs', 'extraState']);

/** Validate a single workspace block-serialization node over the fixed vocabulary. */
function validateBlock(block: Json, path = '$'): string[] {
  const errors: string[] = [];
  if (block === null || typeof block !== 'object' || Array.isArray(block)) {
    return [`${path}: block must be an object`];
  }
  const b = block as Record<string, Json>;
  const type = b.type;
  if (typeof type !== 'string') errors.push(`${path}: missing/invalid 'type'`);
  else if (!STRUCTURAL.has(type) && !RULE_BLOCK.test(type)) errors.push(`${path}: unknown block type '${type}'`);
  for (const key of Object.keys(b)) {
    if (!ALLOWED_KEYS.has(key)) errors.push(`${path}: unexpected key '${key}'`);
  }
  if (b.inputs !== undefined) {
    if (typeof b.inputs !== 'object' || b.inputs === null || Array.isArray(b.inputs)) {
      errors.push(`${path}.inputs: must be an object`);
    } else {
      for (const [name, conn] of Object.entries(b.inputs as Record<string, Json>)) {
        const c = conn as Record<string, Json> | null;
        if (!c || typeof c !== 'object' || !('block' in c)) {
          errors.push(`${path}.inputs.${name}: must be { block: <block> }`);
        } else {
          errors.push(...validateBlock(c.block, `${path}.inputs.${name}.block`));
        }
      }
    }
  }
  if (b.fields !== undefined && (typeof b.fields !== 'object' || b.fields === null || Array.isArray(b.fields))) {
    errors.push(`${path}.fields: must be an object`);
  }
  if (b.extraState !== undefined && (typeof b.extraState !== 'object' || b.extraState === null || Array.isArray(b.extraState))) {
    errors.push(`${path}.extraState: must be an object`);
  }
  return errors;
}

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

describe('FR-124 workspace-shape validator over the §15.8 corpus (AD-032)', () => {
  for (const entry of M1_CORPUS) {
    it(`${entry.name} encodes to valid workspace JSON`, async () => {
      const ws = await encode(engine, entry.template);
      expect(validateBlock(ws)).toEqual([]);
    });
  }

  it('rejects a malformed-but-plausible block (unknown type / misplaced field)', () => {
    expect(validateBlock({ type: 'transon_rule_attr', inputs: {} }).length).toBeGreaterThan(0); // missing __variant
    expect(validateBlock({ type: 'transon_literal', value: 1 }).length).toBeGreaterThan(0); // misplaced top-level value
    expect(validateBlock({ type: 'transon_array', inputs: { ITEM0: { notBlock: {} } } }).length).toBeGreaterThan(0);
  });
});

describe(
  'FR-124 workspace-shape validator over 147 engine docs/example-corpus templates (§15.8, FR-124)',
  () => {
    it('has exactly 147 engine example templates to validate (NFR-047)', () => {
      expect(DOCS_EXAMPLES).toHaveLength(147);
    });

    for (const { source, example } of DOCS_EXAMPLES) {
      // Stable test name: {source}__{example.name} — unique across the whole docs corpus.
      // Examples include ≥4-level nesting (ExprMonadsComplex / MapListToList at depth 7).
      it(`${source}__${example.name} encodes to valid workspace JSON`, async () => {
        const ws = await encode(engine, example.template);
        expect(validateBlock(ws)).toEqual([]);
      });
    }
  },
);
