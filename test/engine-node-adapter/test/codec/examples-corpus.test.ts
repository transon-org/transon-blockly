// Engine docs/example-corpus sweep — §15.8 full coverage, AC-011, AC-035.
//
// Iterates ALL 147 examples from editorMetadata.docs.{rules,operators,functions}[*].examples.
// For each example:
//   1. structural round-trip: decode(engine, encode(engine, template)) deep-equals template
//      (FR-035/036, AC-011).
//   2. execution identity (AC-035): engine.transform(template, data, {marker:'$'}) and
//      engine.transform(decode(encode(template)), data, {marker:'$'}) yield the same
//      {success, output} — even for out-of-surface templates via transon_unsupported
//      exact-preservation (FR-055, AD-004).
//
// The stable test name is `{source}__{example.name}` where source is the rule/operator/function
// name, ensuring uniqueness across sources that share example names.
//
// FR-035/036/039, AC-011 — structural identity.
// AC-035, AD-011, §15.1 — execution identity by construction.
// NFR-047 — docs payload is the examples side (separate from structural catalog).
// §15.8 — "examples from engine metadata" category of round-trip corpus.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json, CatalogEntry } from '@transon/editor-core';
import { encode, decode, editorMetadata } from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';

/** A single engine-docs example entry. */
interface DocsExample {
  name: string;
  template: Json;
  data: Json;
  result: Json;
  doc?: string;
}

/**
 * Collect all 147 examples from editorMetadata.docs.{rules,operators,functions}.
 * Returns [{source, example}] where source is the containing rule/op/fn name.
 */
function collectAllExamples(): { source: string; category: string; example: DocsExample }[] {
  const collected: { source: string; category: string; example: DocsExample }[] = [];

  for (const entry of editorMetadata.docs.rules) {
    const examples = (entry as CatalogEntry & { examples?: DocsExample[] }).examples ?? [];
    for (const ex of examples) {
      collected.push({ source: entry.name, category: 'rule', example: ex });
    }
  }
  for (const entry of editorMetadata.docs.operators) {
    const examples = (entry as CatalogEntry & { examples?: DocsExample[] }).examples ?? [];
    for (const ex of examples) {
      collected.push({ source: entry.name, category: 'op', example: ex });
    }
  }
  for (const entry of editorMetadata.docs.functions) {
    const examples = (entry as CatalogEntry & { examples?: DocsExample[] }).examples ?? [];
    for (const ex of examples) {
      collected.push({ source: entry.name, category: 'fn', example: ex });
    }
  }
  return collected;
}

const ALL_EXAMPLES = collectAllExamples();

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

describe(
  `docs/example-corpus structural round-trip: decode(encode(T)) === T (§15.8, AC-011, FR-035/036)`,
  () => {
    it(`has exactly 147 examples across all docs sources (NFR-047, §15.8)`, () => {
      // rules: 118, operators: 17, functions: 12 = 147
      expect(ALL_EXAMPLES).toHaveLength(147);
    });

    for (const { source, example } of ALL_EXAMPLES) {
      // Stable test name: {source}__{example.name} — unique across the whole corpus.
      it(`${source}__${example.name}`, async () => {
        const workspace = await encode(engine, example.template);
        const back = await decode(engine, workspace);
        expect(back).toEqual(example.template);
      });
    }
  },
);

describe(
  `docs/example-corpus execution identity: transform(T) === transform(decode(encode(T))) (§15.8, AC-035, AD-011)`,
  () => {
    for (const { source, example } of ALL_EXAMPLES) {
      it(`${source}__${example.name}`, async () => {
        const back = await decode(engine, await encode(engine, example.template));
        const input: Json = example.data ?? null;
        const original = await engine.transform(example.template, input, { marker: '$' });
        const roundtripped = await engine.transform(back, input, { marker: '$' });
        // Both should have the same status, success flag, and output —
        // whether the template is in-surface or was preserved via transon_unsupported.
        expect(roundtripped.status).toBe(original.status);
        expect(roundtripped.success).toBe(original.success);
        expect(roundtripped.output).toEqual(original.output);
      });
    }
  },
);
