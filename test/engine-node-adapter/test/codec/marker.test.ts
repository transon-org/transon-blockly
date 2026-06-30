// FR-063 — custom marker keys when configured. The codec carries a marker placeholder and the
// runtime substitutes the configured marker, so one committed codec serves any marker without
// regeneration. The default marker is `$`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json } from '@transon/editor-core';
import { encode, decode, blockMap } from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

const MARK = '@@'; // a configured non-default marker

describe('custom marker round-trip (FR-063)', () => {
  it('a rule invocation under a custom marker encodes + round-trips', async () => {
    const t: Json = { [MARK]: 'attr', name: 'a', default: 'x' };
    const ws = await encode(engine, t, MARK);
    expect(ws).toMatchObject({ type: 'transon_rule_attr__name' });
    expect(await decode(engine, ws, MARK)).toEqual(t);
  });

  it('a marker-free object stays a literal object under a custom marker', async () => {
    const t: Json = { a: 1, b: 2 };
    const ws = await encode(engine, t, MARK);
    expect(ws).toMatchObject({ type: 'transon_object_literal' });
    expect(await decode(engine, ws, MARK)).toEqual(t);
  });

  it('the literal-marker escape uses the configured marker', async () => {
    const t: Json = { [MARK]: 'object', fields: { [MARK]: 'v' } };
    expect(await decode(engine, await encode(engine, t, MARK), MARK)).toEqual(t);
  });

  it('the same document executes identically before/after a custom-marker round-trip', async () => {
    const t: Json = { [MARK]: 'attr', name: 'k' };
    const back = await decode(engine, await encode(engine, t, MARK), MARK);
    const input = { k: 42 };
    const a = await engine.transform(t, input, { marker: MARK });
    const b = await engine.transform(back, input, { marker: MARK });
    expect(b.output).toEqual(a.output);
    expect(a.output).toBe(42);
  });

  it('the block map uses the configured marker for rule_name detection', async () => {
    const map = await blockMap(engine, { [MARK]: 'attr', name: 'a' }, MARK);
    const root = map.find((e) => e.template_path === '$');
    expect(root?.rule_name).toBe('attr');
  });

  it('a custom marker does not disturb the default `$` codec', async () => {
    // default still works (regression guard for the substitution)
    expect(await decode(engine, await encode(engine, { $: 'attr', name: 'a' }))).toEqual({ $: 'attr', name: 'a' });
  });
});

// §15.8 custom-marker multi-rule templates: broaden coverage beyond single rules (FR-063).
// These exercise constant-field params (op, name) and nested structures under a non-$ marker.
describe('custom marker multi-rule round-trip (§15.8, FR-063)', () => {
  // chain of attr + expr exercises a constant-field `op` under the custom marker
  it('chain of attr+expr (constant op field) round-trips under custom marker', async () => {
    const t: Json = {
      [MARK]: 'chain',
      funcs: [
        { [MARK]: 'attr', name: 'x' },
        { [MARK]: 'expr', op: '+', value: 1 },
      ],
    };
    const back = await decode(engine, await encode(engine, t, MARK), MARK);
    expect(back).toEqual(t);
    // Execution identity: both branches should produce same output
    const input: Json = { x: 5 };
    const a = await engine.transform(t, input, { marker: MARK });
    const b = await engine.transform(back, input, { marker: MARK });
    expect(b.output).toEqual(a.output);
    expect(a.output).toBe(6);
  });

  // map with a nested object — exercises key+value variant and constant-field param (name)
  it('map with nested object round-trips under custom marker', async () => {
    const t: Json = {
      [MARK]: 'map',
      item: {
        [MARK]: 'object',
        key: { [MARK]: 'call', name: 'str', value: { [MARK]: 'index' } },
        value: { [MARK]: 'item' },
      },
    };
    const back = await decode(engine, await encode(engine, t, MARK), MARK);
    expect(back).toEqual(t);
    // Structural: same template shape preserved
    const input: Json = [10, 20, 30];
    const a = await engine.transform(t, input, { marker: MARK });
    const b = await engine.transform(back, input, { marker: MARK });
    expect(b.success).toBe(a.success);
    expect(b.output).toEqual(a.output);
  });

  // Multi-rule chain through cond+filter — exercises multi-arm templates under custom marker
  it('filter with cond expression round-trips under custom marker', async () => {
    const t: Json = {
      [MARK]: 'filter',
      cond: { [MARK]: 'expr', op: '>', value: 0 },
    };
    const back = await decode(engine, await encode(engine, t, MARK), MARK);
    expect(back).toEqual(t);
    const input: Json = [-1, 0, 1, 2, -3];
    const a = await engine.transform(t, input, { marker: MARK });
    const b = await engine.transform(back, input, { marker: MARK });
    expect(b.output).toEqual(a.output);
  });
});

// FR-123 / §11.4 under a CUSTOM marker: the escape-vs-rule disposition must key off the ACTIVE
// marker, never a hardcoded `$`. Regression for the object/fields escape collision (review SHOULD-FIX).
describe('object/fields escape vs rule under a custom marker (FR-063, FR-123, §11.4)', () => {
  it('payload carrying the ACTIVE marker → escape (transon_object_literal)', async () => {
    const t: Json = { [MARK]: 'object', fields: { [MARK]: 'v' } };
    const ws = await encode(engine, t, MARK);
    expect((ws as { type: string }).type).toBe('transon_object_literal');
    expect(await decode(engine, ws, MARK)).toEqual(t);
  });
  it('payload with a NON-active marker key (`$` when marker is `@@`) → object/fields RULE', async () => {
    // The discriminating case: a hardcoded-`$` check would wrongly treat `{$:1}` as the escape.
    const t: Json = { [MARK]: 'object', fields: { $: 1 } };
    const ws = await encode(engine, t, MARK);
    expect((ws as { type: string }).type).toBe('transon_rule_object__fields');
    expect(await decode(engine, ws, MARK)).toEqual(t);
  });
  it('marker-free payload → object/fields RULE under a custom marker', async () => {
    const t: Json = { [MARK]: 'object', fields: { a: { [MARK]: 'attr', name: 'k' } } };
    const ws = await encode(engine, t, MARK);
    expect((ws as { type: string }).type).toBe('transon_rule_object__fields');
    expect(await decode(engine, ws, MARK)).toEqual(t);
  });
});
