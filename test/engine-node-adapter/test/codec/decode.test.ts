// G_decode arm — structural inverse for attr + the skeleton (FR-114/126).
//   FR-027/032/036, AC-009/010 — import in-surface workspace → Transon document; the decoder
//   reads the variant from the block *type* and reconstructs params from inputs by name,
//   without re-deriving the field/input disposition (FR-126).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider } from '@transon/editor-core';
import { decode } from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

describe('decode is the structural inverse of encode (FR-114/126, AC-009/010)', () => {
  it('transon_rule_attr__name → {$:attr,name:...}', async () => {
    const ws = { type: 'transon_rule_attr__name', inputs: { name: { block: { type: 'transon_literal', fields: { VALUE: 'a' } } } } };
    expect(await decode(engine, ws)).toEqual({ $: 'attr', name: 'a' });
  });
  it('transon_rule_attr__names with optional DEFAULT → {$:attr,names,default}', async () => {
    const ws = {
      type: 'transon_rule_attr__names',
      inputs: {
        names: { block: { type: 'transon_array', inputs: { ITEM0: { block: { type: 'transon_literal', fields: { VALUE: 'p' } } } } } },
        default: { block: { type: 'transon_literal', fields: { VALUE: null } } },
      },
    };
    expect(await decode(engine, ws)).toEqual({ $: 'attr', names: ['p'], default: null });
  });
  it('transon_literal/array/object_literal decode to their JSON', async () => {
    expect(await decode(engine, { type: 'transon_literal', fields: { VALUE: 7 } })).toEqual(7);
    expect(await decode(engine, { type: 'transon_array', inputs: { ITEM0: { block: { type: 'transon_literal', fields: { VALUE: 1 } } } } })).toEqual([1]);
    const obj = { type: 'transon_object_literal', extraState: { keys: ['k'] }, inputs: { VALUE0: { block: { type: 'transon_literal', fields: { VALUE: 9 } } } } };
    expect(await decode(engine, obj)).toEqual({ k: 9 });
  });
  it('transon_unsupported reproduces the stored raw node exactly', async () => {
    const raw = { $: 'no_such_rule', x: 1 };
    expect(await decode(engine, { type: 'transon_unsupported', extraState: { raw } })).toEqual(raw);
  });
});
