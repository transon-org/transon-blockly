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

// FR-123 refinement (M2): the escape fires ONLY when the `fields` payload contains the marker key.
// A marker-FREE `{$:object, fields:X}` is the `object`/`fields` RULE (it omits NoContent values),
// NOT the escape — it must project to `transon_rule_object__fields` and round-trip as the rule, not
// collapse to a bare literal. Regression for the object/fields escape-collision (§11.4, §15.1).
describe('marker-free {$:object, fields:X} is the object/fields RULE, not the escape (FR-123, §11.4)', () => {
  it('marker-free payload → transon_rule_object__fields (rule), not transon_object_literal', async () => {
    const t = { $: 'object', fields: { a: { $: 'attr', name: 'x' }, b: 'lit' } };
    const ws = await encode(engine, t);
    expect((ws as { type: string }).type).toBe('transon_rule_object__fields');
    expect(await decode(engine, ws)).toEqual(t); // round-trips as the RULE (wrapper preserved)
  });
  it('marker-bearing payload stays the escape → transon_object_literal', async () => {
    const ws = await encode(engine, { $: 'object', fields: { $: 'v', y: 1 } });
    expect((ws as { type: string }).type).toBe('transon_object_literal');
  });
  it('the rule omits NoContent values (semantic distinction the literal would not preserve)', async () => {
    const t = { $: 'object', fields: { missing: { $: 'get', name: 'nope' }, present: { $: 'attr', name: 'x' } } };
    const back = await decode(engine, await encode(engine, t));
    expect(back).toEqual(t);
    // both original and round-tripped execute to {present:'xxx'} (the `missing` NoContent is dropped)
    const a = await engine.transform(t, { x: 'xxx' }, { marker: '$' });
    const b = await engine.transform(back, { x: 'xxx' }, { marker: '$' });
    expect(a.output).toEqual({ present: 'xxx' });
    expect(b.output).toEqual(a.output);
  });
});
