// AC-038 / §13.13 (real-engine round-trip) — a structure built on the canvas via the behavior-
// runtime mutators (array items / object key-value fields) decodes to exactly the same document as
// the equivalent JSON-authored structure (encode→decode). Proves the mutator changes only arity,
// not codec semantics (FR-124/126, NFR-046).
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import type { EngineProvider, Json } from '@transon/editor-core';
import { encode, decode } from '@transon/editor-core';
import { registerTransonBlocks } from '@transon/editor-blockly';
import { createNodeEngineProvider } from '../../src/index.js';

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
  registerTransonBlocks();
});
afterAll(() => engine?.dispose());

interface ArrayBlock extends Blockly.Block {
  addItem_(): void;
}
interface ObjectBlock extends Blockly.Block {
  addField_(): void;
}
interface ScalarField extends Blockly.Field {
  loadState(s: unknown): void;
}

function literal(ws: Blockly.Workspace, value: Json): Blockly.Block {
  const b = ws.newBlock('transon_literal');
  (b.getField('VALUE') as unknown as ScalarField).loadState(value);
  return b;
}

function connect(input: Blockly.Input | null, child: Blockly.Block): void {
  input!.connection!.connect(child.outputConnection!);
}

/** Save the workspace and return the single top block the codec decodes. */
function topBlock(ws: Blockly.Workspace, type: string): Json {
  const saved = Blockly.serialization.workspaces.save(ws) as { blocks: { blocks: Json[] } };
  return saved.blocks.blocks.find((b) => (b as { type?: string }).type === type) as Json;
}

describe('AC-038 — mutator-built structures round-trip identically to JSON-authored', () => {
  it('array: building [1, 2] with the item mutator decodes to [1, 2]', async () => {
    const ws = new Blockly.Workspace();
    try {
      const arr = ws.newBlock('transon_array') as ArrayBlock;
      arr.addItem_();
      arr.addItem_();
      connect(arr.getInput('ITEM0'), literal(ws, 1));
      connect(arr.getInput('ITEM1'), literal(ws, 2));
      const decoded = await decode(engine, topBlock(ws, 'transon_array'));
      const jsonAuthored = await decode(engine, await encode(engine, [1, 2]));
      expect(decoded).toEqual([1, 2]);
      expect(decoded).toEqual(jsonAuthored);
    } finally {
      ws.dispose();
    }
  });

  it('object: building {a:1, b:"x"} with the field mutator + editable keys decodes to {a:1, b:"x"}', async () => {
    const ws = new Blockly.Workspace();
    try {
      const obj = ws.newBlock('transon_object_literal') as ObjectBlock;
      obj.addField_();
      obj.setFieldValue('a', 'KEY0');
      obj.addField_();
      obj.setFieldValue('b', 'KEY1');
      connect(obj.getInput('VALUE0'), literal(ws, 1));
      connect(obj.getInput('VALUE1'), literal(ws, 'x'));
      const decoded = await decode(engine, topBlock(ws, 'transon_object_literal'));
      const jsonAuthored = await decode(engine, await encode(engine, { a: 1, b: 'x' }));
      expect(decoded).toEqual({ a: 1, b: 'x' });
      expect(decoded).toEqual(jsonAuthored);
    } finally {
      ws.dispose();
    }
  });

  it('removing an item shrinks the decoded array', async () => {
    const ws = new Blockly.Workspace();
    try {
      const arr = ws.newBlock('transon_array') as ArrayBlock & { removeItem_(): void };
      arr.addItem_();
      arr.addItem_();
      connect(arr.getInput('ITEM0'), literal(ws, 1));
      connect(arr.getInput('ITEM1'), literal(ws, 2));
      arr.removeItem_(); // drop the last item
      const decoded = await decode(engine, topBlock(ws, 'transon_array'));
      expect(decoded).toEqual([1]);
    } finally {
      ws.dispose();
    }
  });
});
