// Encoder behavior over the fixed block vocabulary (FR-124).
//   FR-117, FR-019 — literal passthrough + node-type dispatch (scalars → transon_literal).
//   FR-022, §15.3 — arrays/objects recurse; order preserved.
//   FR-114/115/118/120, FR-023/024/025, AC-029 — attr arm, both variants, optional default
//                                                 omitted when absent, dynamic param recursion.
//   FR-031/034/038, §13.11 — out-of-surface node → transon_unsupported, exact preservation.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider } from '@transon/editor-core';
import { encode } from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

describe('literal passthrough + dispatch (FR-117, FR-019)', () => {
  it('a string scalar encodes to one transon_literal carrying the exact value', async () => {
    expect(await encode(engine, 'hello')).toEqual({ type: 'transon_literal', fields: { VALUE: 'hello' } });
  });
  it('number vs string fidelity is preserved (0 !== "0")', async () => {
    expect(await encode(engine, 0)).toEqual({ type: 'transon_literal', fields: { VALUE: 0 } });
    expect(await encode(engine, '0')).toEqual({ type: 'transon_literal', fields: { VALUE: '0' } });
  });
  it('null/bool route to transon_literal', async () => {
    expect(await encode(engine, null)).toEqual({ type: 'transon_literal', fields: { VALUE: null } });
    expect(await encode(engine, true)).toEqual({ type: 'transon_literal', fields: { VALUE: true } });
  });
});

describe('array + object recursion, order preserved (FR-022, §15.3)', () => {
  it('a literal array → transon_array with indexed inputs in order', async () => {
    expect(await encode(engine, [1, 2])).toEqual({
      type: 'transon_array',
      inputs: {
        ITEM0: { block: { type: 'transon_literal', fields: { VALUE: 1 } } },
        ITEM1: { block: { type: 'transon_literal', fields: { VALUE: 2 } } },
      },
    });
  });
  it('a marker-free object → transon_object_literal with ordered keys', async () => {
    const ws = await encode(engine, { a: 1, b: 2 });
    expect(ws).toMatchObject({ type: 'transon_object_literal', extraState: { keys: ['a', 'b'] } });
    expect((ws as { inputs: Record<string, unknown> }).inputs).toHaveProperty('VALUE0');
    expect((ws as { inputs: Record<string, unknown> }).inputs).toHaveProperty('VALUE1');
  });
});

describe('attr arm: variants, optional default, recursion (FR-114/118/120, FR-023/024/025, AC-029)', () => {
  it('name variant → transon_rule_attr__name with NAME input only when no default', async () => {
    expect(await encode(engine, { $: 'attr', name: 'a' })).toEqual({
      type: 'transon_rule_attr__name',
      inputs: { name: { block: { type: 'transon_literal', fields: { VALUE: 'a' } } } },
    });
  });
  it('names variant → transon_rule_attr__names; names value recurses into transon_array', async () => {
    const ws = await encode(engine, { $: 'attr', names: ['a', 'b'] });
    expect(ws).toMatchObject({ type: 'transon_rule_attr__names' });
    expect((ws as { inputs: { names: { block: { type: string } } } }).inputs.names.block.type).toBe('transon_array');
  });
  it('optional default present → DEFAULT input; absent → omitted (FR-025)', async () => {
    const withDefault = await encode(engine, { $: 'attr', name: 'x', default: 'anon' });
    expect((withDefault as { inputs: Record<string, unknown> }).inputs).toHaveProperty('default');
    const without = await encode(engine, { $: 'attr', name: 'x' });
    expect((without as { inputs: Record<string, unknown> }).inputs).not.toHaveProperty('default');
  });
  it('a dynamic param value that is itself a rule recurses into a rule block', async () => {
    const ws = await encode(engine, { $: 'attr', name: { $: 'attr', name: 'inner' } });
    expect((ws as { inputs: { name: { block: { type: string } } } }).inputs.name.block.type).toBe('transon_rule_attr__name');
  });
});

describe('out-of-surface placeholder (FR-031/034/038, §13.11)', () => {
  it('an unknown rule → transon_unsupported preserving the original node exactly', async () => {
    const node = { $: 'no_such_rule', x: 1, y: [2, 3] };
    expect(await encode(engine, node)).toEqual({ type: 'transon_unsupported', extraState: { raw: node } });
  });

  // review #2: variant matching is EXACT — ambiguous / foreign-param `attr` nodes are
  // out-of-surface and must not be silently rewritten into a rule block (AD-004, FR-050/055).
  it('ambiguous attr (name + names) → transon_unsupported, not a silently-rewritten rule block', async () => {
    const node = { $: 'attr', name: 'a', names: ['b'] };
    expect(await encode(engine, node)).toEqual({ type: 'transon_unsupported', extraState: { raw: node } });
  });
  it('attr with a foreign parameter → transon_unsupported (no silent drop)', async () => {
    const node = { $: 'attr', name: 'a', bogusparam: 1 };
    expect(await encode(engine, node)).toEqual({ type: 'transon_unsupported', extraState: { raw: node } });
  });
});

describe('presence is key-based, not value-based (review #1: FR-035/025, AD-004)', () => {
  it('a default whose VALUE equals the internal presence sentinel is NOT dropped', async () => {
    // The old value-sentinel matcher dropped this present `default`; the key-based matcher keeps it.
    const ws = await encode(engine, { $: 'attr', name: 'x', default: '__transon_absent__' });
    expect((ws as { inputs: Record<string, unknown> }).inputs).toHaveProperty('default');
    expect((ws as { inputs: { default: { block: { fields: { VALUE: unknown } } } } }).inputs.default.block.fields.VALUE)
      .toBe('__transon_absent__');
  });
  it('an attr whose name VALUE equals the sentinel still matches the name variant', async () => {
    const ws = await encode(engine, { $: 'attr', name: '__transon_absent__' });
    expect((ws as { type: string }).type).toBe('transon_rule_attr__name');
  });
});
