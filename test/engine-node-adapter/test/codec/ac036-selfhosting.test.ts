// AC-036 / FR-121 (M3 partial) — self-hosting: the editor's own projection templates are valid
// IN-SURFACE Transon templates (§15.7) that round-trip through the very codec they configure.
//
// M3 introduces the G_palette / G_toolbox projections; this proves they are in-surface — they
// encode→decode to structural identity with NO out-of-surface (transon_unsupported) fallback, so
// the editor could open and round-trip its own surface generators. The full self-hosting UI demo
// (opening a projection in the running editor, UC-016) lands in M5.
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json } from '@transon/editor-core';
import { encode, decode, GENERATOR_SOURCES, GENERATOR_FILES } from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';

// Walk a workspace block tree and collect every block type (test-only; reading inputs/fields in a
// test file is fine — the FR-126 no-mapping scan governs packages/*/src, not tests).
function blockTypes(node: Json, acc: string[] = []): string[] {
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    const b = node as { type?: string; inputs?: Record<string, { block?: Json }> };
    if (typeof b.type === 'string') acc.push(b.type);
    for (const v of Object.values(b.inputs ?? {})) if (v?.block) blockTypes(v.block, acc);
  }
  return acc;
}

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

describe('AC-036 — the M3 projection templates are in-surface and round-trip (FR-121)', () => {
  // The M3 surface projections (committed generator data == the typed builders, regen-gated).
  for (const file of [GENERATOR_FILES.palette, GENERATOR_FILES.toolbox]) {
    it(`${file} round-trips through the codec with no out-of-surface fallback`, async () => {
      const template = GENERATOR_SOURCES[file]!;
      const workspace = await encode(engine, template);
      // In-surface: no exact-preserving unsupported placeholder anywhere in the projection.
      expect(blockTypes(workspace)).not.toContain('transon_unsupported');
      // Strict semantic round-trip (decode(encode(T)) == T).
      const back = await decode(engine, workspace);
      expect(back).toEqual(template);
    });
  }
});
