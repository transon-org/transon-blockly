// D2 (real-engine integration) — a documentation example loaded into the editor round-trips and,
// when executed, produces output equal to its recorded expected `result` (AC-018/019, FR-075/076).
// This exercises the same seam the editor uses: build the corpus (buildExampleCorpus), load a
// template (encode → forward projection), and run it (engine.transform) — through the REAL engine.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json } from '@transon/editor-core';
import { encode } from '@transon/editor-core';
import { toWorkspaceState } from '@transon/editor-blockly';
import { buildExampleCorpus, runForward } from '@transon/editor-ui';

import { createNodeEngineProvider } from '../../src/index.js';

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

const corpus = buildExampleCorpus();

describe('example loading + expected-vs-actual with the real engine (AC-018/019)', () => {
  it('the corpus is non-empty and drawn from the committed docs (AC-018)', () => {
    expect(corpus.length).toBeGreaterThan(0);
  });

  // A representative spread of examples across families that have a well-defined expected result.
  const picks = ['ExprSimpleValues1', 'OperatorLessThan', 'ConvertValue'];
  for (const name of picks) {
    it(`round-trips + executes to the expected result: ${name} (AC-019)`, async () => {
      const ex = corpus.find((e) => e.name === name);
      expect(ex, `example ${name} present`).toBeTruthy();

      // Load: the example's template projects to the canvas and generates back to itself (import).
      const workspace = toWorkspaceState(await encode(engine, ex!.template)) as Json;
      const forward = await runForward(engine, workspace, '$');
      expect(forward.generation_status).toBe('complete');
      expect(forward.template_json).toEqual(ex!.template); // in-surface round-trip

      // Run: executing the loaded template against the sample input yields the expected result.
      const res = await engine.transform(forward.template_json!, ex!.data ?? null, { marker: '$' });
      expect(res.status).toBe('ok');
      expect(res.success).toBe(true);
      expect(res.output).toEqual(ex!.result);
    });
  }
});
