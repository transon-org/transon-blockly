// Literal-marker escape — the codec-skeleton-owned `{<marker>:object, fields:X}` escape (§11.4).
//   FR-059/060/061 — emit/distinguish a literal object that contains the marker key.
//   FR-062        — literal objects containing "$" when the marker is "$".
//   FR-123        — the escape is skeleton-owned, matches EXACTLY marker + fields, and takes
//                   precedence over the (M2) `object` rule arm; any extra key falls through.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider } from '@transon/editor-core';
import { encode, decode } from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

describe('literal-marker escape encode (FR-059/061/123, §11.4)', () => {
  it('`{$:object, fields:{$:"v"}}` → transon_object_literal of the literal object `{$:"v"}`', async () => {
    const ws = await encode(engine, { $: 'object', fields: { $: 'v' } });
    expect(ws).toMatchObject({ type: 'transon_object_literal', extraState: { keys: ['$'] } });
  });
  it('a marker-key literal object distinguishes from a rule invocation and a normal literal object', async () => {
    const ruleBlock = await encode(engine, { $: 'attr', name: 'a' });
    const normalObj = await encode(engine, { a: 1 });
    const escaped = await encode(engine, { $: 'object', fields: { $: 'v' } });
    expect((ruleBlock as { type: string }).type).toBe('transon_rule_attr__name');
    expect((normalObj as { type: string }).type).toBe('transon_object_literal');
    expect((escaped as { type: string }).type).toBe('transon_object_literal');
  });
  it('precedence is EXACT marker+fields: an extra key falls through to surface handling (FR-123)', async () => {
    // `object` is not projected in M1, so a non-escape marker object is out of surface.
    const node = { $: 'object', fields: {}, extra: 1 };
    expect(await encode(engine, node)).toEqual({ type: 'transon_unsupported', extraState: { raw: node } });
  });
});

describe('literal-marker escape decode + round-trip (FR-060/062, §11.4)', () => {
  it('decodes a marker-bearing object-literal back to the escape form', async () => {
    const ws = await encode(engine, { $: 'object', fields: { $: 'v' } });
    expect(await decode(engine, ws)).toEqual({ $: 'object', fields: { $: 'v' } });
  });
  it('round-trips a literal object containing "$" (FR-062)', async () => {
    const t = { $: 'object', fields: { $: 'x', y: [1, 2] } };
    expect(await decode(engine, await encode(engine, t))).toEqual(t);
  });
  it('executes to the intended literal marker-key object', async () => {
    const t = { $: 'object', fields: { $: 'v' } };
    const out = await engine.transform(t, null, { marker: '$' });
    expect(out.output).toEqual({ $: 'v' }); // the escape yields the literal `{"$":"v"}`
    const back = await decode(engine, await encode(engine, t));
    expect((await engine.transform(back, null, { marker: '$' })).output).toEqual({ $: 'v' });
  });
});
