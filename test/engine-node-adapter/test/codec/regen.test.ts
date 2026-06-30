// FR-115, FR-119, AD-030 — strict codec-regeneration gate.
//
// FR-115: the encoder and decoder are GENERATED from metadata (not hand-written): the
// `@`-staged generators (`G_encode`/`G_decode`) run over the pinned metadata and the
// generator sources are committed as data (AD-026, AD-030).
//
// The committed encoder/decoder artifacts must be byte-equal to a fresh run of the `@`-staged
// generators over the pinned metadata. The gate *compares only* (fails on drift) and writes
// the artifacts solely under `UPDATE_ARTIFACTS=1`, so a normal run can never rubber-stamp a
// wrong artifact (AD-030). Regenerate with `UPDATE_ARTIFACTS=1 pnpm --filter ... test`.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider } from '@transon/editor-core';
import {
  generateCodec,
  serializeArtifact,
  stableStringify,
  GENERATOR_SOURCES,
} from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CODEC = join(HERE, '..', '..', '..', '..', 'packages', 'editor-core', 'src', 'codec');
const ARTIFACTS = join(CODEC, 'artifacts');
const GENERATORS = join(CODEC, 'generators');

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
  if (process.env.UPDATE_ARTIFACTS) {
    // The @-staged generators are committed as data first (so generateCodec can run them),
    // then the artifacts those generators produce.
    for (const [file, template] of Object.entries(GENERATOR_SOURCES)) {
      writeFileSync(join(GENERATORS, file), stableStringify(template));
    }
    const { encoder, decoder, blockmap } = await generateCodec(engine);
    writeFileSync(join(ARTIFACTS, 'encoder.json'), serializeArtifact(encoder));
    writeFileSync(join(ARTIFACTS, 'decoder.json'), serializeArtifact(decoder));
    writeFileSync(join(ARTIFACTS, 'blockmap.json'), serializeArtifact(blockmap));
  }
});
afterAll(() => engine?.dispose());

describe('committed generators match the authoring source (FR-114/115, AD-026)', () => {
  for (const [file, template] of Object.entries(GENERATOR_SOURCES)) {
    it(`generators/${file} is byte-equal to its typed source`, () => {
      expect(stableStringify(template)).toBe(readFileSync(join(GENERATORS, file), 'utf8'));
    });
  }
});

describe('codec regeneration is byte-equal to committed artifacts (FR-119, AD-030)', () => {
  it('encoder.json matches a fresh G_* run', async () => {
    const { encoder } = await generateCodec(engine);
    expect(serializeArtifact(encoder)).toBe(readFileSync(join(ARTIFACTS, 'encoder.json'), 'utf8'));
  });

  it('decoder.json matches a fresh G_* run', async () => {
    const { decoder } = await generateCodec(engine);
    expect(serializeArtifact(decoder)).toBe(readFileSync(join(ARTIFACTS, 'decoder.json'), 'utf8'));
  });

  it('blockmap.json matches a fresh build', async () => {
    const { blockmap } = await generateCodec(engine);
    expect(serializeArtifact(blockmap)).toBe(readFileSync(join(ARTIFACTS, 'blockmap.json'), 'utf8'));
  });
});
