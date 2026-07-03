// D1.2 (real-engine integration) — the editor-ui forward flow produces the correct canonical
// Transon JSON + a populated block map, executing the REAL generated decoder/blockMap through the
// host engine (FR-019 generation, FR-091/FR-122 block map, §10.4). The store-wiring/gating is unit
// tested with a fake in editor-ui; this proves the codec seam is used correctly end-to-end.
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json } from '@transon/editor-core';
import { encode } from '@transon/editor-core';
import { toWorkspaceState } from '@transon/editor-blockly';
import { runForward, isEmptyWorkspace } from '@transon/editor-ui';
import { createNodeEngineProvider } from '../../src/index.js';

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

/** Encode a document to a bare codec block, then wrap it as a Blockly workspace envelope (what the
 *  store holds — the `serialization.workspaces.save()` shape). */
async function workspaceFor(doc: Json): Promise<Json> {
  return toWorkspaceState(await encode(engine, doc)) as Json;
}

describe('forward flow with the real engine (FR-019/091/122, §10.4)', () => {
  const docs: Array<[string, Json]> = [
    ['attr rule', { $: 'attr', name: 'email' }],
    ['literal array', [1, 'two', true, null]],
    ['nested object with a rule', { a: 1, b: { $: 'attr', name: 'x' } }],
  ];

  for (const [name, doc] of docs) {
    it(`generates canonical JSON equal to the document: ${name}`, async () => {
      const workspace = await workspaceFor(doc);
      expect(isEmptyWorkspace(workspace)).toBe(false);
      const r = await runForward(engine, workspace, '$');
      expect(r.generation_status).toBe('complete');
      expect(r.error).toBeNull();
      // decode(encode(doc)) == doc — the store's forward path reconstructs the document (AC-035).
      expect(r.template_json).toEqual(doc);
      // the block map covers the document root (FR-091/122)
      expect(Array.isArray(r.block_map)).toBe(true);
      expect(r.block_map!.length).toBeGreaterThan(0);
      expect(r.block_map![0]).toMatchObject({ template_path: '$', block_id: '$' });
    });
  }

  it('an empty workspace generates nothing, not an error (§17.5)', async () => {
    const r = await runForward(engine, { blocks: { blocks: [] } }, '$');
    expect(r.generation_status).toBe('empty');
    expect(r.template_json).toBeNull();
    expect(r.error).toBeNull();
  });

  it('the rule block map entry carries the rule name (FR-091)', async () => {
    const r = await runForward(engine, await workspaceFor({ $: 'attr', name: 'email' }), '$');
    const ruleEntry = r.block_map!.find((e) => e.rule_name === 'attr');
    expect(ruleEntry).toBeTruthy();
  });
});
