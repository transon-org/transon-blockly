// M5 D5 + RFC-004 — self-hosting in the RUNNING EDITOR (UC-016, AC-036, AC-042, FR-121). The
// editor's projection templates AND the committed codec artifacts they generate are ordinary
// Transon-authorable JSON documents, so they open through the same editor paths a user template
// uses and round-trip to identity:
//   - import  → the §7.15 reverse gate (tryReverse) ACCEPTS them (in-surface + round-trip faithful),
//   - open + regenerate → encode → forward projection reproduces the exact document.
//
// AC-036 requires AT LEAST ONE projection template (satisfied at M3/M5 by palette + toolbox).
// AC-042 (RFC-004, AD-035) strengthens the bar to ALL of them: every file in
// packages/editor-core/src/codec/generators/ and …/codec/artifacts/ opens — including the deepest
// generator G_encode (nesting depth 41), previously un-openable below the old ceiling of 25.
// Enabled by the engine's per-level recursion budget (engine ≥ 0.1.7, R-32) + the ceiling raise to
// CODEC_MAX_INCLUDE_DEPTH = 55 + the hosts' 1400-frame recursion budget (metadata-contract §6.5).
//
// The clean-failure contract stays: nesting beyond the ceiling fails as `runtime_transformation`
// (a codec/runtime LIMIT, §16.4 — never `import_unsupported`), locked below with a synthetic
// document one level past the ceiling.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json } from '@transon/editor-core';
import { encode, CODEC_MAX_INCLUDE_DEPTH, GENERATOR_SOURCES, GENERATOR_FILES } from '@transon/editor-core';
import { toWorkspaceState } from '@transon/editor-blockly';
import { tryReverse, runForward } from '@transon/editor-ui';
import { createNodeEngineProvider } from '../../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CODEC = join(HERE, '..', '..', '..', '..', 'packages', 'editor-core', 'src', 'codec');
const artifact = (name: string): Json =>
  JSON.parse(readFileSync(join(CODEC, 'artifacts', name), 'utf8')) as Json;

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

// AC-042: EVERY committed codec file — the four @-staged generators (from the same in-memory
// source the regen gate pins to disk) and the five committed artifacts (read from disk, the
// canonical bytes).
const OPENABLE: Array<[string, Json]> = [
  ['G_encode', GENERATOR_SOURCES[GENERATOR_FILES.encode]!],
  ['G_decode', GENERATOR_SOURCES[GENERATOR_FILES.decode]!],
  ['G_palette', GENERATOR_SOURCES[GENERATOR_FILES.palette]!],
  ['G_toolbox', GENERATOR_SOURCES[GENERATOR_FILES.toolbox]!],
  ['encoder.json', artifact('encoder.json')],
  ['decoder.json', artifact('decoder.json')],
  ['blockmap.json', artifact('blockmap.json')],
  ['palette.json', artifact('palette.json')],
  ['toolbox.json', artifact('toolbox.json')],
];

describe('UC-016 — the editor opens every committed codec file (AC-036, AC-042, FR-121)', () => {
  for (const [name, template] of OPENABLE) {
    it(`${name}: the §7.15 import gate accepts it (in-surface, round-trip faithful)`, async () => {
      const outcome = await tryReverse(engine, JSON.stringify(template), '$');
      // Accepted ⟺ in-surface (no transon_unsupported) AND decode(encode(T)) == T (AD-024).
      expect(outcome.status, `tryReverse(${name})`).toBe('accepted');
      if (outcome.status === 'accepted') expect(outcome.document).toEqual(template);
    });

    it(`${name}: opening it regenerates the exact same document (forward)`, async () => {
      const workspace = toWorkspaceState(await encode(engine, template)) as Json;
      const forward = await runForward(engine, workspace, '$');
      expect(forward.generation_status).toBe('complete');
      expect(forward.template_json).toEqual(template);
    });
  }
});

describe('past the ceiling: clean runtime-limit failure, never import_unsupported (§6.5, §16.4)', () => {
  // A literal document nested one level past the ceiling: the engine's include depth-limit guard
  // trips (clean TransformationError) and the gate labels it a runtime LIMIT — the same taxonomy
  // AD-035 mandates for a caught host recursion overflow (unit-locked in editor-ui errors.test.ts).
  it('a document nested past CODEC_MAX_INCLUDE_DEPTH is rejected as runtime_transformation', async () => {
    let doc: Json = 'leaf';
    for (let i = 0; i < CODEC_MAX_INCLUDE_DEPTH + 1; i++) doc = { k: doc };
    const outcome = await tryReverse(engine, JSON.stringify(doc), '$');
    expect(outcome.status).toBe('rejected');
    if (outcome.status === 'rejected') {
      expect(outcome.error.code).toBe('runtime_transformation');
      expect(outcome.error.message.toLowerCase()).toContain('depth limit');
    }
  });

  // Cheap lower-bound sanity on the ceiling: a document's structural depth is a LOWER bound on
  // the include depth its walk needs (rule-dense nodes cost ~2 include levels each — G_encode is
  // 41 deep but needs 52; measured, AD-035). The REAL regression guard is the OPENABLE loop above
  // (every committed file through the live engine); this pin just fails fast and legibly if a
  // codec regeneration ever deepens a committed file past what the ceiling could even in
  // principle clear.
  it(`the ceiling (${CODEC_MAX_INCLUDE_DEPTH}) exceeds every committed file's structural depth`, () => {
    const depth = (v: Json): number =>
      Array.isArray(v)
        ? 1 + Math.max(0, ...v.map(depth))
        : v !== null && typeof v === 'object'
          ? 1 + Math.max(0, ...Object.values(v).map(depth))
          : 0;
    const deepest = Math.max(...OPENABLE.map(([, t]) => depth(t)));
    expect(deepest).toBeLessThan(CODEC_MAX_INCLUDE_DEPTH);
  });
});
