// FR-134 (SPEC §7.17, AC-041(b), §11.5) — subtree collapse is UI-only state; the generated Transon
// JSON (decode()) must be byte-identical collapsed vs expanded. `decode.test.ts` proves the decoder
// is the structural inverse of encode (reads fields/inputs by name); this file is the REAL-ENGINE
// proof that `collapsed` — a genuine Blockly `BlockSvg.setCollapsed(true)` + a real
// `serialization.workspaces.save()` — never perturbs the committed decoder artifact's output, over
// several representative templates (a scalar leaf, and structural array/object mutator blocks).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import type { EngineProvider, Json } from '@transon/editor-core';
import { decode, encode } from '@transon/editor-core';
import { registerTransonBlocks, toWorkspaceState } from '@transon/editor-blockly';
import { createNodeEngineProvider } from '../../src/index.js';

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
  registerTransonBlocks();
});
afterAll(() => engine?.dispose());

/** encode(template) -> load into a real (headless) Workspace -> collapse the top block if asked ->
 *  save() -> the single top block's state (what decode() actually consumes). */
async function roundTripBlock(template: Json, collapse: boolean): Promise<Json> {
  const block = await encode(engine, template);
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(toWorkspaceState(block), ws);
    const top = ws.getTopBlocks(false)[0]!;
    if (collapse) top.setCollapsed(true);
    const saved = Blockly.serialization.workspaces.save(ws) as { blocks?: { blocks?: Json[] } };
    return saved.blocks!.blocks![0] as Json;
  } finally {
    ws.dispose();
  }
}

describe('FR-134 — collapsed vs expanded generated JSON is byte-identical (real engine)', () => {
  const templates: Array<[string, Json]> = [
    ['scalar literal', 42],
    ['array of scalars', [1, 2, 3]],
    ['object with nested array (custom field + both mutators)', { a: 1, b: [2, 3] }],
    ['nested object', { outer: { inner: 'x' } }],
  ];

  for (const [name, template] of templates) {
    it(`byte-identical JSON for: ${name}`, async () => {
      const expandedBlock = await roundTripBlock(template, false);
      const collapsedBlock = await roundTripBlock(template, true);

      // Sanity: the fixture really differs only by `collapsed` (UI-only, §11.5) — same block
      // structure otherwise, and the collapsed one actually carries `collapsed: true`.
      expect((collapsedBlock as { collapsed?: boolean }).collapsed).toBe(true);
      expect((expandedBlock as { collapsed?: boolean }).collapsed).toBeUndefined();

      const expandedJson = await decode(engine, expandedBlock);
      const collapsedJson = await decode(engine, collapsedBlock);

      // Byte-identical: exact string equality of the canonical serialization, not just deep-equal.
      expect(JSON.stringify(collapsedJson)).toBe(JSON.stringify(expandedJson));
      expect(collapsedJson).toEqual(template);
    });
  }

  it('collapsing a nested child (not just the top block) still yields byte-identical JSON', async () => {
    const template = { a: 1, b: [2, 3] };
    const block = await encode(engine, template);
    const ws = new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(toWorkspaceState(block), ws);
      const top = ws.getTopBlocks(false)[0]!;
      const expandedJson = await decode(
        engine,
        (Blockly.serialization.workspaces.save(ws) as { blocks: { blocks: Json[] } }).blocks
          .blocks[0]!,
      );

      // Collapse the nested array child (b's value), not the top object.
      const arrayChild = top.getChildren(false).find((b) => b.type === 'transon_array');
      expect(arrayChild).toBeTruthy();
      arrayChild!.setCollapsed(true);
      const collapsedBlock = (
        Blockly.serialization.workspaces.save(ws) as { blocks: { blocks: Json[] } }
      ).blocks.blocks[0]!;
      const collapsedJson = await decode(engine, collapsedBlock);

      expect(JSON.stringify(collapsedJson)).toBe(JSON.stringify(expandedJson));
      expect(collapsedJson).toEqual(template);
    } finally {
      ws.dispose();
    }
  });
});
