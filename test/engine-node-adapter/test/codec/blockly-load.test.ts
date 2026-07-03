// FR-126 — the generated ENCODER output loads via Blockly's workspace deserialization without
// error (headless), over the full §15.8 round-trip corpus. The encoder emits Blockly
// workspace-serialization JSON directly (AD-032); @transon/editor-blockly wraps each block in the
// UI-only top-level envelope (§11.5) and hands it to Blockly's own loader — there is NO
// hand-written codec↔workspace translation (the no-codec-mapping repo-scan gates FR-126(c)).
//
// This is the second half of FR-126(b): the FR-124 workspace-shape validator
// (workspace-shape.test.ts) proves the shape; this proves Blockly actually accepts it.
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import type { EngineProvider, Json } from '@transon/editor-core';
import { encode } from '@transon/editor-core';
import { registerTransonBlocks, toWorkspaceState } from '@transon/editor-blockly';
import { createNodeEngineProvider } from '../../src/index.js';
import { M1_CORPUS } from './corpus.js';
import { collectDocsExamples } from './docs-examples.js';

function collectTemplates(): { name: string; template: Json }[] {
  // Flat engine corpus (each case exactly once, §2.7) + the hand-written M1 corpus.
  const out = collectDocsExamples().map(({ source, name, template }) => ({
    name: `${source}__${name}`,
    template,
  }));
  for (const c of M1_CORPUS) out.push({ name: `m1__${c.name}`, template: c.template });
  return out;
}

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
  registerTransonBlocks();
});
afterAll(() => engine?.dispose());

describe('FR-126 — encoder output loads headlessly in Blockly', () => {
  const templates = collectTemplates();
  it(`covers the full corpus (${templates.length} templates)`, () => {
    expect(templates.length).toBeGreaterThan(140);
  });

  for (const { name, template } of templates) {
    it(`loads: ${name}`, async () => {
      const block = await encode(engine, template);
      const ws = new Blockly.Workspace();
      try {
        expect(() => Blockly.serialization.workspaces.load(toWorkspaceState(block), ws)).not.toThrow();
        // A faithful load yields exactly one top block (the document root).
        expect(ws.getTopBlocks(false).length).toBe(1);
      } finally {
        ws.dispose();
      }
    });
  }
});
