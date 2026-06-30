// Adapter include-resolution: the codec recurses through the engine's `include` rule,
// so the Node->Python bridge must resolve include fragments by name (AD-010, AD-011).
//
//   FR-119 — the generated codec executes at runtime via the host (here, the adapter).
//   §6.5  — `include` carries only the current context value as `this`; the v0.1.3 loader
//           is called `loader(name, context=IncludeContext)` and must build the sub-
//           transformer via `context.transformer(...)` so a self-`include` recurses and
//           the `max_include_depth` guard accumulates across the include stack.
//
// M0 shipped `collectIncludes` returning `{}` (no codec used includes). M1's codec self-
// `include`s to recurse, so this proves the bridge actually threads the fragment bundle.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json } from '@transon/editor-core';
import { createNodeEngineProvider } from '../src/index.js';

let engine: EngineProvider;

beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});

afterAll(() => {
  engine?.dispose();
});

// A minimal recursive "encoder" fragment: dispatch on JSON type; arrays recurse into
// their items via a self-`include` named "enc"; scalars wrap into a leaf. This is the
// skeleton-walk shape the M1 codec uses (proven against the engine before being pinned).
const enc: Json = {
  $: 'switch',
  key: { $: 'call', name: 'type', value: { $: 'this' } },
  cases: {
    array: {
      $: 'object',
      fields: {
        type: 'transon_array',
        items: {
          $: 'map',
          value: { $: 'this' },
          item: { $: 'include', name: 'enc' },
        },
      },
    },
  },
  default: {
    $: 'object',
    fields: { type: 'transon_literal', value: { $: 'this' } },
  },
};

describe('adapter resolves include fragments by name (FR-119, §6.5)', () => {
  it('threads a self-`include` so a recursive codec walks nested input', async () => {
    const res = await engine.transform(enc, [1, [2, 3]], {
      marker: '$',
      includes: { enc },
    });
    expect(res.status).toBe('ok');
    expect(res.success).toBe(true);
    expect(res.output).toEqual({
      type: 'transon_array',
      items: [
        { type: 'transon_literal', value: 1 },
        {
          type: 'transon_array',
          items: [
            { type: 'transon_literal', value: 2 },
            { type: 'transon_literal', value: 3 },
          ],
        },
      ],
    });
  });

  it('self-`include` recursion terminates: the engine raises a clean depth error, not a stack overflow', async () => {
    // Nest past max_include_depth (50). The engine guards the include stack and raises a
    // TransformationError naming the include chain — never a raw RecursionError.
    let deep: Json = 0;
    for (let i = 0; i < 60; i += 1) deep = [deep];
    const ran = await engine.transform(enc, deep, {
      marker: '$',
      includes: { enc },
    });
    expect(ran.status).toBe('ok');
    expect(ran.success).toBe(false);
    expect(ran.error_type).toBe('TransformationError');
    expect(ran.raw_engine_error).toMatch(/include depth limit/i);
  });
});
