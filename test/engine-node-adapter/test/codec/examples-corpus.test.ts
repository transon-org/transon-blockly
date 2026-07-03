// Engine docs/example-corpus sweep — §15.8 full coverage, AC-011, AC-035.
//
// Iterates EVERY case of the flat engine example corpus (editorMetadata.docs.examples,
// metadata-contract §2.7 v2.1 — each distinct template exactly once, curated tiers included).
// For each example:
//   1. structural round-trip: decode(engine, encode(engine, template)) deep-equals template
//      (FR-035/036, AC-011).
//   2. execution identity (AC-035): engine.transform(template, data, {marker:'$'}) and
//      engine.transform(decode(encode(template)), data, {marker:'$'}) yield the same
//      {success, output} — even for out-of-surface templates via transon_unsupported
//      exact-preservation (FR-055, AD-004).
//
// The stable test name is `{source}__{example.name}` where source is the owning
// rule/operator/function (from the engine-emitted reference lists) or curated tier.
//
// FR-035/036/039, AC-011 — structural identity.
// AC-035, AD-011, §15.1 — execution identity by construction.
// NFR-047 — docs payload is the examples side (separate from structural catalog).
// §15.8 — "examples from engine metadata" category of round-trip corpus.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json } from '@transon/editor-core';
import { encode, decode, editorMetadata } from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';
import { collectDocsExamples, CORPUS_FLOOR } from './docs-examples.js';

const ALL_EXAMPLES = collectDocsExamples();

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

describe(
  `docs/example-corpus structural round-trip: decode(encode(T)) === T (§15.8, AC-011, FR-035/036)`,
  () => {
    it(`covers the full flat corpus, one sweep entry per case (NFR-047, §15.8)`, () => {
      // Anti-drift: derived from the pinned engine corpus, never hardcoded.
      expect(ALL_EXAMPLES.length).toBe(editorMetadata.docs.examples.length);
      // Anti-truncation ratchet — a shrunken corpus must trip, not pass vacuously.
      expect(ALL_EXAMPLES.length).toBeGreaterThanOrEqual(CORPUS_FLOOR);
    });

    for (const { source, name, template } of ALL_EXAMPLES) {
      // Stable test name: {source}__{name} — corpus names are unique (§2.7).
      it(`${source}__${name}`, async () => {
        const workspace = await encode(engine, template);
        const back = await decode(engine, workspace);
        expect(back).toEqual(template);
      });
    }
  },
);

describe(
  `docs/example-corpus execution identity: transform(T) === transform(decode(encode(T))) (§15.8, AC-035, AD-011)`,
  () => {
    for (const { source, name, template, data } of ALL_EXAMPLES) {
      it(`${source}__${name}`, async () => {
        const back = await decode(engine, await encode(engine, template));
        const input: Json = data ?? null;
        const original = await engine.transform(template, input, { marker: '$' });
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
