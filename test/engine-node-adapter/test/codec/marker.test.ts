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
