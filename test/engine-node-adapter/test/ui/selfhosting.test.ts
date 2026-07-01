// M5 D5 — self-hosting in the RUNNING EDITOR (UC-016, AC-036, FR-121). The editor's own projection
// templates are ordinary Transon templates, so the in-surface ones open through the same editor
// paths a user template uses and round-trip to identity:
//   - import  → the §7.15 reverse gate (tryReverse) ACCEPTS them (in-surface + round-trip faithful),
//   - open + regenerate → encode → forward projection reproduces the exact generator.
// This extends the M3 codec-level proof (codec/ac036-selfhosting.test.ts, palette/toolbox) to the
// editor session seam. AC-036 requires AT LEAST ONE projection template; the palette + toolbox
// generators satisfy it.
//
// The G_encode / G_decode generators are the editor's DEEPEST self-referential templates: encoding
// them exceeds the codec's host-stack recursion ceiling (CODEC_MAX_INCLUDE_DEPTH = 25, §6.5 — below
// the engine's 50). That is NOT a surface violation; it is the documented clean-failure behavior, so
// the editor REJECTS them with a CodecError instead of crashing. Locked below.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json } from '@transon/editor-core';
import { encode, GENERATOR_SOURCES, GENERATOR_FILES } from '@transon/editor-core';
import { toWorkspaceState } from '@transon/editor-blockly';
import { tryReverse, runForward } from '@transon/editor-ui';
import { createNodeEngineProvider } from '../../src/index.js';

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

// The in-surface projection templates the editor can open (proven in-surface at M3).
const OPENABLE: Array<[string, Json]> = [
  ['G_palette', GENERATOR_SOURCES[GENERATOR_FILES.palette]!],
  ['G_toolbox', GENERATOR_SOURCES[GENERATOR_FILES.toolbox]!],
];
// The deepest generators — exceed the host-stack recursion ceiling (§6.5), rejected cleanly.
const TOO_DEEP: Array<[string, Json]> = [
  ['G_encode', GENERATOR_SOURCES[GENERATOR_FILES.encode]!],
  ['G_decode', GENERATOR_SOURCES[GENERATOR_FILES.decode]!],
];

describe('UC-016 — the editor opens its own projection templates (AC-036, FR-121)', () => {
  for (const [name, template] of OPENABLE) {
    it(`${name}: the §7.15 import gate accepts it (in-surface, round-trip faithful)`, async () => {
      const outcome = await tryReverse(engine, JSON.stringify(template), '$');
      // Accepted ⟺ in-surface (no transon_unsupported) AND decode(encode(T)) == T (AD-024).
      expect(outcome.status, `tryReverse(${name})`).toBe('accepted');
      if (outcome.status === 'accepted') expect(outcome.document).toEqual(template);
    });

    it(`${name}: opening it regenerates the exact same template (forward)`, async () => {
      const workspace = toWorkspaceState(await encode(engine, template)) as Json;
      const forward = await runForward(engine, workspace, '$');
      expect(forward.generation_status).toBe('complete');
      expect(forward.template_json).toEqual(template);
    });
  }
});

describe('the deepest generators fail cleanly at the recursion ceiling (§6.5), not a crash', () => {
  for (const [name, template] of TOO_DEEP) {
    it(`${name}: the import gate rejects it with a clean error (host-stack ceiling)`, async () => {
      const outcome = await tryReverse(engine, JSON.stringify(template), '$');
      // A CodecError from the depth cap is caught by the gate → rejected, workspace unchanged.
      expect(outcome.status).toBe('rejected');
    });
  }
});
