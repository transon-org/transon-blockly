// D4 (real-engine) — the editor-ui path→block index shares a coordinate system with the codec's
// JsonPathBlockMap (FR-091/094/122): for a real encoded document loaded into Blockly, every block_map
// path resolves to the exact block (dynamic params / structural nodes) or, for a constant param
// (a block field, no child block), to its nearest_parent_block_id. This is the STOP-E correctness
// proof — without it, error→block highlighting (AC-017) would target the wrong block.
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import type { EngineProvider, Json } from '@transon/editor-core';
import { encode, blockMap } from '@transon/editor-core';
import { registerTransonBlocks, loadCodecOutput } from '@transon/editor-blockly';
import { buildPathIndex } from '@transon/editor-ui';
import { createNodeEngineProvider } from '../../src/index.js';

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
  registerTransonBlocks();
});
afterAll(() => engine?.dispose());

async function indexFor(doc: Json): Promise<Map<string, Blockly.Block>> {
  const ws = new Blockly.Workspace();
  loadCodecOutput(await encode(engine, doc), ws);
  const idx = buildPathIndex(ws);
  ws.dispose();
  return idx;
}

describe('path index ↔ block_map agreement (FR-091/094, AC-017)', () => {
  it('every block_map path of an all-dynamic document resolves to an exact block', async () => {
    const doc = { x: { $: 'attr', name: 'a' }, y: [1, 2] };
    const idx = await indexFor(doc);
    for (const entry of await blockMap(engine, doc)) {
      expect(idx.has(entry.block_id), `path ${entry.block_id} should index a block`).toBe(true);
    }
  });

  it('a constant param resolves via nearest_parent (field, no own block); others resolve exactly', async () => {
    const doc = { $: 'expr', op: 'add', values: [1, 2] };
    const idx = await indexFor(doc);
    const bm = await blockMap(engine, doc);
    // every path is reachable (exact or nearest parent) — highlighting never loses its target
    for (const entry of bm) {
      const reachable = idx.has(entry.block_id) || idx.has(entry.nearest_parent_block_id ?? '$');
      expect(reachable, `path ${entry.block_id} should be reachable`).toBe(true);
    }
    // the constant `op` is a field (no child block) — only its parent (the expr block) resolves
    const opEntry = bm.find((e) => e.parameter_name === 'op');
    expect(opEntry).toBeTruthy();
    expect(idx.has(opEntry!.block_id)).toBe(false);
    expect(idx.has(opEntry!.nearest_parent_block_id!)).toBe(true);
  });

  it('the root and rule nodes index to their blocks', async () => {
    const idx = await indexFor({ $: 'attr', name: 'email' });
    expect(idx.get('$')?.type).toBe('transon_rule_attr__name');
    expect(idx.get('$/name')?.type).toBe('transon_literal');
  });
});
