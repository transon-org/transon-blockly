// JsonPathBlockMap — produced alongside the workspace as the codec walks (FR-091/094/122, §9.12).
// Consuming it for highlighting is M4 (FR-092/093/095); here we prove it is produced correctly,
// including over the full §15.8 engine-example corpus (the flat docs.examples corpus, §2.7).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json, JsonPathBlockMapEntry } from '@transon/editor-core';
import { blockMap, editorMetadata } from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';
import { collectDocsExamples, CORPUS_FLOOR } from './docs-examples.js';

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

const byPath = (m: JsonPathBlockMapEntry[]) => new Map(m.map((e) => [e.template_path, e]));

/** Count marker-bearing dicts in a template — the nodes the block-map tags with `rule_name`. */
function countRuleNodes(t: Json): number {
  if (Array.isArray(t)) return t.reduce<number>((s, x) => s + countRuleNodes(x), 0);
  if (t && typeof t === 'object') {
    const self = Object.prototype.hasOwnProperty.call(t, '$') ? 1 : 0;
    return self + Object.values(t).reduce<number>((s, x) => s + countRuleNodes(x as Json), 0);
  }
  return 0;
}

/** Every flat-corpus engine example, exactly once (NFR-047 split: the `docs` payload, §2.7). */
const DOCS_EXAMPLES = collectDocsExamples();

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

  it('block_id is unique even for object keys containing the path separator (escaped, RFC 6901)', async () => {
    // `{"a/b":1}` and `{"a":{"b":2}}` must not collide: the `/` in the key is escaped to `~1`.
    const map = await blockMap(engine, { 'a/b': 1, a: { b: 2 } });
    const ids = map.map((e) => e.block_id);
    expect(new Set(ids).size).toBe(ids.length); // all block_ids unique
    const m = byPath(map);
    expect(m.has('$/a~1b')).toBe(true); // the key "a/b"
    expect(m.has('$/a/b')).toBe(true); // the nested a → b
    expect(m.get('$/a~1b')).not.toEqual(m.get('$/a/b'));
  });
});

// FR-091/094/122, §9.12 — the block-map holds its invariants over the full §15.8 engine corpus,
// not just hand-picked nodes (the prior reviewer's coverage SHOULD-FIX). These are structural
// invariants that scale to every real corpus template.
describe('JsonPathBlockMap invariants over the flat engine corpus (§15.8, FR-091/094/122)', () => {
  it('walks the full flat corpus, one entry per case (NFR-047, §2.7)', () => {
    // Anti-drift: derived from the pinned engine corpus, never hardcoded.
    expect(DOCS_EXAMPLES.length).toBe(editorMetadata.docs.examples.length);
    // Anti-truncation ratchet — a shrunken corpus must trip, not pass vacuously.
    expect(DOCS_EXAMPLES.length).toBeGreaterThanOrEqual(CORPUS_FLOOR);
  });

  for (const { source, name, template } of DOCS_EXAMPLES) {
    it(`${source}__${name}`, async () => {
      const map = await blockMap(engine, template);
      // (1) a root entry exists and is the document root.
      const m = byPath(map);
      expect(m.get('$')).toMatchObject({ template_path: '$', block_id: '$' });
      // (2) block_id === template_path, and all block_ids are unique (FR-094, RFC-6901 paths).
      const ids = map.map((e) => e.block_id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const e of map) expect(e.block_id).toBe(e.template_path);
      // (3) every nearest_parent_block_id refers to a real entry (parent integrity, FR-094).
      for (const e of map) {
        if (e.nearest_parent_block_id !== undefined) expect(m.has(e.nearest_parent_block_id)).toBe(true);
      }
      // (4) STRUCTURAL-WALK check: the map descends to every depth and tags every marker-bearing
      // dict with rule_name (not a disposition check — the escape's literal `{$:'v'}` payload is
      // also a marker-bearing dict and is tagged here; escape-vs-rule disposition is verified in
      // escape.test.ts / unsupported-variants.test.ts). Catches a walk that stops descending.
      const ruleEntries = map.filter((e) => e.rule_name !== undefined).length;
      expect(ruleEntries).toBe(countRuleNodes(template));
    });
  }
});
