// The two-pass generate-then-run staging proof.
//   FR-116 — generator templates are staged with a distinct meta-level marker (`@`).
//   FR-119 — projections compile at build time, then execute at runtime via the host.
//   AD-027 — distinct markers per evaluation phase: `@`-keyed dicts evaluate now,
//            `$`-keyed dicts are inert literal data, deep-copied verbatim.
//   AD-030 — build-time codegen of committed artifacts; runtime execution via the host.
//
// Property under test (not the literal template): under marker `@`, an `@`-rule is
// evaluated now while a `{"$":"this"}` survives verbatim into the emitted `$`-codec;
// the SAME inert structure is then LIVE when the emitted template is run under `$`.
// The exact engine semantics were verified empirically against the pinned engine before
// these literals were chosen (engine `format` + `this`).
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

describe('marker staging: @ evaluates, $ stays inert (FR-116, FR-119, AD-027, AD-030)', () => {
  // A generator-shaped template: the `@`-keyed dicts are evaluated NOW (the "unquotes");
  // the `{"$":"this"}` is inert literal data that must survive into the emitted codec.
  const Gmeta: Json = {
    key: { '@': 'format', pattern: 'transon_rule_{}', value: { '@': 'this' } },
    value: { $: 'this' },
  };

  it('generate pass (marker @): @-rules evaluate, $-structure survives verbatim', async () => {
    const res = await engine.transform(Gmeta, 'attr', { marker: '@' });
    expect(res.status).toBe('ok');
    expect(res.success).toBe(true);

    // The @-`format` was evaluated against the input "attr"; the {"$":"this"} survived
    // inert as a $-bearing codec fragment.
    expect(res.output).toEqual({
      key: 'transon_rule_attr',
      value: { $: 'this' },
    });
  });

  it('run pass (marker $): the emitted $-structure is now LIVE against input', async () => {
    // First, regenerate the emitted codec.
    const generated = await engine.transform(Gmeta, 'attr', { marker: '@' });
    const emitted = generated.output as Json;

    // Sanity: the emitted template still carries the inert {"$":"this"} hole.
    expect(emitted).toMatchObject({ value: { $: 'this' } });

    // Now run the emitted template under `$` against a sample input: the SAME structure
    // that was inert under `@` evaluates here.
    const sampleInput: Json = { demo: 1, label: 'hello' };
    const ran = await engine.transform(emitted, sampleInput, { marker: '$' });
    expect(ran.status).toBe('ok');
    expect(ran.success).toBe(true);

    // The `format` result ("transon_rule_attr") was a plain string, so it passes through;
    // the {"$":"this"} now resolves to the whole input.
    expect(ran.output).toEqual({
      key: 'transon_rule_attr',
      value: sampleInput,
    });
  });

  it('execution results expose camelCase filesWritten (§5.2 naming)', async () => {
    const res = await engine.transform(Gmeta, 'attr', { marker: '@' });
    // No `file` rule here, so the captured map is empty but present and camelCased.
    expect(res.filesWritten).toEqual({});
  });
});
