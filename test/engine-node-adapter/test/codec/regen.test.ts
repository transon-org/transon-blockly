// FR-119, AD-030 — strict codec-regeneration gate.
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
import { generateCodec, serializeArtifact } from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = join(HERE, '..', '..', '..', '..', 'packages', 'editor-core', 'src', 'codec', 'artifacts');

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
  if (process.env.UPDATE_ARTIFACTS) {
    const { encoder, decoder } = await generateCodec(engine);
    writeFileSync(join(ARTIFACTS, 'encoder.json'), serializeArtifact(encoder));
    writeFileSync(join(ARTIFACTS, 'decoder.json'), serializeArtifact(decoder));
  }
});
afterAll(() => engine?.dispose());

describe('codec regeneration is byte-equal to committed artifacts (FR-119, AD-030)', () => {
  it('encoder.json matches a fresh G_* run', async () => {
    const { encoder } = await generateCodec(engine);
    expect(serializeArtifact(encoder)).toBe(readFileSync(join(ARTIFACTS, 'encoder.json'), 'utf8'));
  });

  it('decoder.json matches a fresh G_* run', async () => {
    const { decoder } = await generateCodec(engine);
    expect(serializeArtifact(decoder)).toBe(readFileSync(join(ARTIFACTS, 'decoder.json'), 'utf8'));
  });
});
