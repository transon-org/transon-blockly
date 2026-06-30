// JsonPathBlockMap — produced alongside the workspace as the codec walks (FR-091/094/122, §9.12).
// Consuming it for highlighting is M4 (FR-092/093/095); M1 only proves it is produced correctly.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider, JsonPathBlockMapEntry } from '@transon/editor-core';
import { blockMap } from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

const byPath = (m: JsonPathBlockMapEntry[]) => new Map(m.map((e) => [e.template_path, e]));

describe('JsonPathBlockMap production (FR-091/122, §9.12)', () => {
  it('maps a rule node and each of its parameters with paths + names', async () => {
    const map = await blockMap(engine, { $: 'attr', name: 'a', default: 'x' });
    const m = byPath(map);
    expect(m.get('$')).toMatchObject({ template_path: '$', block_id: '$', rule_name: 'attr' });
    expect(m.get('$/name')).toMatchObject({ template_path: '$/name', parameter_name: 'name', nearest_parent_block_id: '$' });
    expect(m.get('$/default')).toMatchObject({ parameter_name: 'default', nearest_parent_block_id: '$' });
    // the rule node itself is not a parameter
    expect(m.get('$')?.parameter_name).toBeUndefined();
  });

  it('every entry has template_path + block_id; block_id is the JSON path', async () => {
    const map = await blockMap(engine, { a: 1, b: [2, { $: 'attr', name: 'c' }] });
    for (const e of map) {
      expect(typeof e.template_path).toBe('string');
      expect(e.block_id).toBe(e.template_path);
    }
    const m = byPath(map);
    expect([...m.keys()].sort()).toEqual(['$', '$/a', '$/b', '$/b/0', '$/b/1', '$/b/1/name']);
  });

  it('nested nodes map to the nearest enclosing block (FR-094)', async () => {
    const map = await blockMap(engine, [1, { $: 'attr', names: ['k'] }]);
    const m = byPath(map);
    expect(m.get('$/1')).toMatchObject({ rule_name: 'attr', nearest_parent_block_id: '$' });
    expect(m.get('$/1/names')).toMatchObject({ parameter_name: 'names', nearest_parent_block_id: '$/1' });
    expect(m.get('$/1/names/0')).toMatchObject({ nearest_parent_block_id: '$/1/names' });
  });

  it('a scalar document yields a single root entry', async () => {
    const map = await blockMap(engine, 'scalar');
    expect(map).toHaveLength(1);
    expect(map[0]).toMatchObject({ template_path: '$', block_id: '$' });
  });
});
