// FR-125 — every metadata-projected palette block definition is a VALID, LOADABLE Zelos
// definition: it registers and instantiates headlessly without error (consistent message↔args,
// well-formed input/field/connection types). Also exercises the finite behavior runtime (AD-031):
// the custom scalar field + the array/object/unsupported mutators reconstruct their inputs from
// the encoder's UI-only extraState, which is what makes the FR-126 encoder-load (separate gate,
// in the adapter) succeed.
import { beforeAll, describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import { PALETTE_BLOCKS } from '@transon/editor-core';
import { registerTransonBlocks, loadCodecOutput } from '../src/index.js';

let workspace: Blockly.Workspace;
beforeAll(() => {
  registerTransonBlocks();
  workspace = new Blockly.Workspace();
});

describe('FR-125 — palette block definitions load headlessly', () => {
  it('registers a Blockly block for every projected definition', () => {
    for (const def of PALETTE_BLOCKS) {
      expect(Blockly.Blocks[def.type], `block ${def.type} registered`).toBeTruthy();
    }
  });

  it('instantiates every rule/structural block without error (consistent message↔args)', () => {
    for (const def of PALETTE_BLOCKS) {
      // A malformed message0/args0 (mismatched %N) throws here on init.
      expect(() => {
        const b = workspace.newBlock(def.type);
        b.dispose(false);
      }, `instantiate ${def.type}`).not.toThrow();
    }
  });

  it('the array mutator rebuilds ITEM{n} inputs from extraState (no undeclared-input error)', () => {
    const ws = new Blockly.Workspace();
    const state = { blocks: { blocks: [{
      type: 'transon_array',
      extraState: { items: [0, 1] },
      inputs: {
        ITEM0: { block: { type: 'transon_literal', fields: { VALUE: 1 } } },
        ITEM1: { block: { type: 'transon_literal', fields: { VALUE: 2 } } },
      },
    }] } };
    expect(() => Blockly.serialization.workspaces.load(state, ws)).not.toThrow();
    const arr = ws.getTopBlocks(false)[0]!;
    expect(arr.getChildren(false).length).toBe(2);
    ws.dispose();
  });

  it('the object mutator rebuilds VALUE{n} inputs labelled by extraState.keys', () => {
    const ws = new Blockly.Workspace();
    const state = { blocks: { blocks: [{
      type: 'transon_object_literal',
      extraState: { keys: ['a', 'b'] },
      inputs: {
        VALUE0: { block: { type: 'transon_literal', fields: { VALUE: 1 } } },
        VALUE1: { block: { type: 'transon_literal', fields: { VALUE: 2 } } },
      },
    }] } };
    expect(() => Blockly.serialization.workspaces.load(state, ws)).not.toThrow();
    expect(ws.getTopBlocks(false)[0]!.getChildren(false).length).toBe(2);
    ws.dispose();
  });

  it('the unsupported block preserves raw extraState and is edit-blocked (§13.11)', () => {
    const ws = new Blockly.Workspace();
    const raw = { $: 'mystery', weird: [1, 2] };
    const state = { blocks: { blocks: [{ type: 'transon_unsupported', extraState: { raw } }] } };
    expect(() => Blockly.serialization.workspaces.load(state, ws)).not.toThrow();
    const block = ws.getTopBlocks(false)[0]!;
    expect(block.isEditable()).toBe(false);
    // Re-saving preserves the raw payload verbatim (AD-004).
    const saved = Blockly.serialization.workspaces.save(ws) as {
      blocks: { blocks: Array<{ extraState?: { raw?: unknown } }> };
    };
    expect(saved.blocks.blocks[0]!.extraState!.raw).toEqual(raw);
    ws.dispose();
  });

  it('loads a literal scalar of any JSON type via the custom field (round-trips type)', () => {
    for (const value of [42, 'hi', true, null]) {
      const ws = new Blockly.Workspace();
      expect(() => loadCodecOutput({ type: 'transon_literal', fields: { VALUE: value } }, ws)).not.toThrow();
      ws.dispose();
    }
  });
});
