// FR-126 (reverse path) — the decoder consumes Blockly workspace-serialization JSON directly:
// encode → Blockly LOAD → Blockly SAVE → decode reproduces the document. This exercises the
// decoder against Blockly's *actual* save output (which differs from direct encoder output —
// notably it DROPS an empty `inputs:{}` and adds UI-only id/x/y), proving the codec is transparent
// to a real Blockly serialization round-trip. Complements the forward FR-126 gate
// (blockly-load.test.ts: encode→load only).
//   FR-037 — UI-only attributes (§11.5: block ids, x/y positions, UI extraState) need not be
//            preserved: decode drops them here without changing document meaning.
//
// NB: the interactive editor reverse-sync (§7.15 accept/reject in-surface edits, the EditorSession
// store) is M4; this is the codec-level decoder-consume guarantee (FR-126) only.
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import type { EngineProvider, Json } from '@transon/editor-core';
import { encode, decode } from '@transon/editor-core';
import { collectDocsExamples } from './docs-examples.js';
import { registerTransonBlocks, toWorkspaceState } from '@transon/editor-blockly';
import { createNodeEngineProvider } from '../../src/index.js';
import { M1_CORPUS } from './corpus.js';

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
  registerTransonBlocks();
});
afterAll(() => engine?.dispose());

// encode → Blockly load → Blockly save → unwrap the single top block.
async function blocklyResave(template: Json): Promise<Json> {
  const block = await encode(engine, template);
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(toWorkspaceState(block), ws);
    const saved = Blockly.serialization.workspaces.save(ws) as { blocks?: { blocks?: Json[] } };
    return saved.blocks!.blocks![0] as Json;
  } finally {
    ws.dispose();
  }
}

describe('FR-126 reverse path — decode after a real Blockly save', () => {
  // Structural edge cases where Blockly's save normalization is most likely to bite.
  const edge: Array<[string, Json]> = [
    ['empty array', []],
    ['nested empty array', [[]]],
    ['array of scalars (type fidelity)', [42, 'hi', true, null, 3.5]],
    ['nested array', [[1], [2, 3]]],
    ['empty object', {}],
    ['object', { a: 1, b: 'x' }],
    ['object of scalar types', { n: 42, s: 'hi', b: false, z: null }],
    ['array of objects', [{ a: 1 }, { b: 2 }]],
    ['out-of-surface (unsupported preserves raw)', { $: 'attr', name: 'a', names: ['b'] }],
  ];
  for (const [name, template] of edge) {
    it(`resave round-trips: ${name}`, async () => {
      expect(await decode(engine, await blocklyResave(template))).toEqual(template);
    });
  }

  // Full §15.8 corpus: a Blockly save/load is transparent to the decoder (same result as a
  // direct decode of the encoder output). Flat engine corpus (each case exactly once, §2.7).
  const corpus: { name: string; template: Json }[] = collectDocsExamples().map(
    ({ source, name, template }) => ({ name: `${source}__${name}`, template }),
  );
  for (const c of M1_CORPUS) corpus.push({ name: `m1__${c.name}`, template: c.template });

  for (const { name, template } of corpus) {
    it(`Blockly save is transparent to decode: ${name}`, async () => {
      const direct = await decode(engine, await encode(engine, template));
      const viaBlockly = await decode(engine, await blocklyResave(template));
      expect(viaBlockly).toEqual(direct);
    });
  }
});
