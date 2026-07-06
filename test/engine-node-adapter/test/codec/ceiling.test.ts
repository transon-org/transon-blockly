// §6.5, §16.4 — codec recursion is bounded. The codec walks the document by self-`include`,
// which is host-stack-bound; it caps the engine `include` depth (CODEC_MAX_INCLUDE_DEPTH — 55
// since AD-035/RFC-004, sized with the host recursion budget so the guard still trips below the
// host stack wall for literal nesting), so deep nesting fails *cleanly* with a CodecError
// (mapped from the engine depth error) instead of a raw stack overflow. Nesting within the
// ceiling round-trips normally. Bounds derive from the constant so a future ceiling change
// cannot silently strand them on stale literals.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json } from '@transon/editor-core';
import { encode, decode, CodecError, CODEC_MAX_INCLUDE_DEPTH } from '@transon/editor-core';
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
    const shallow = nest(CODEC_MAX_INCLUDE_DEPTH - 5);
    expect(await decode(engine, await encode(engine, shallow))).toEqual(shallow);
  });

  it('a document past the ceiling fails cleanly with a CodecError (not a stack overflow)', async () => {
    const deep = nest(CODEC_MAX_INCLUDE_DEPTH + 15);
    await expect(encode(engine, deep)).rejects.toBeInstanceOf(CodecError);
    const err = await encode(engine, deep).catch((e: CodecError) => e);
    expect(err).toBeInstanceOf(CodecError);
    expect((err as CodecError).rawEngineError ?? (err as CodecError).message).toMatch(/include depth limit/i);
  });
});
