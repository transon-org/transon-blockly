// §6.5, §16.4 — codec recursion is bounded. The codec walks the document by self-`include`,
// which is host-stack-bound; it caps the engine `include` depth (CODEC_MAX_INCLUDE_DEPTH = 25)
// below the host stack limit, so deep nesting fails *cleanly* with a CodecError (mapped from
// the engine depth error) instead of a raw stack overflow. Nesting within the ceiling
// round-trips normally.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json } from '@transon/editor-core';
import { encode, decode, CodecError } from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

function nest(depth: number): Json {
  let v: Json = 0;
  for (let i = 0; i < depth; i += 1) v = [v];
  return v;
}

describe('codec recursion ceiling (§6.5, §16.4)', () => {
  it('a document within the ceiling round-trips', async () => {
    const shallow = nest(20);
    expect(await decode(engine, await encode(engine, shallow))).toEqual(shallow);
  });

  it('a document past the ceiling fails cleanly with a CodecError (not a stack overflow)', async () => {
    await expect(encode(engine, nest(40))).rejects.toBeInstanceOf(CodecError);
    const err = await encode(engine, nest(40)).catch((e: CodecError) => e);
    expect(err).toBeInstanceOf(CodecError);
    expect((err as CodecError).rawEngineError ?? (err as CodecError).message).toMatch(/include depth limit/i);
  });
});
