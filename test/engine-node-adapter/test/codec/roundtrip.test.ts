// The M1 de-risk pass criterion: round-trip identity for the prototype `attr` rule + the
// structural skeleton, proven by *executing* the generated codec through a real engine.
//
//   FR-035, FR-036, FR-039, AC-011 — import→export preserves meaning (structural identity);
//                                    automated round-trip tests across all built-in rules.
//   AC-002, AC-003, AC-004 — the corpus includes the simple `attr` template, nested templates,
//                            and literal objects/arrays/scalars; each round-trips below.
//   AC-027 — automated tests cover generation, import, export, and round-trip across the
//            full catalog (this suite + encode/decode/examples-corpus/catalog-coverage).
//   AC-035, AD-011, §15.1 — round-trip *by construction*: encoder + decoder derive from one
//                           metadata source; semantic identity is checked by execution.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json } from '@transon/editor-core';
import { encode, decode } from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';
import { M1_CORPUS } from './corpus.js';

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

describe('structural round-trip: decode(encode(T)) === T (FR-035/036/039, AC-011)', () => {
  for (const entry of M1_CORPUS) {
    it(`${entry.name}`, async () => {
      const workspace = await encode(engine, entry.template);
      const back = await decode(engine, workspace);
      expect(back).toEqual(entry.template);
    });
  }
});

describe('execution round-trip by construction (AC-035, AD-011, §15.1)', () => {
  for (const entry of M1_CORPUS) {
    it(`${entry.name} runs identically before/after round-trip`, async () => {
      const back = await decode(engine, await encode(engine, entry.template));
      // Semantic identity: T and decode(encode(T)) produce the same engine output.
      const input: Json = entry.input ?? null;
      const original = await engine.transform(entry.template, input, { marker: '$' });
      const roundtripped = await engine.transform(back, input, { marker: '$' });
      expect(roundtripped.status).toBe('ok');
      expect(roundtripped.success).toBe(original.success);
      expect(roundtripped.output).toEqual(original.output);
    });
  }
});
