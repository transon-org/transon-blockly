// AC-044 — Total-membership codec: sentinel-collision honesty (RFC-008, NFR-051, AD-037).
//
// The pre-rewrite codec decided key presence / foreign-key detection / emptiness by joining
// values against a reserved sentinel string (`transon::absent-key`), which a USER DOCUMENT can
// forge: a rule node whose only foreign key was literally that string matched the variant and
// the key was silently dropped through the round-trip — an AD-004 violation, reproduced before
// the NFR-051 rewrite. After the rewrite every structural predicate uses the total `in`/`length`
// primitives (AD-037), so no document value can forge a match:
//
//   (a) sentinel-named foreign key on a zero-param and a param-carrying rule node
//       → transon_unsupported, raw preserved, verbatim round-trip        (AC-044(a))
//   (b) a marker-bearing object/fields node with an extra sentinel-named key is NOT misread
//       as the §11.4 escape (the escape's third-key emptiness check is not forgeable)
//       → falls through to rule dispatch → unsupported, verbatim          (AC-044(b))
//   (c) the committed generators and codec artifacts contain no occurrence of the retired
//       sentinel strings                                                  (AC-044(c))
//
// AC-044(d) — the FR-142 engine-floor diagnostic — is covered in packages/editor-ui
// (test/engine-floor.test.tsx): the floor check is session wiring, not codec behavior.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json } from '@transon/editor-core';
import { encode, decode } from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CODEC = join(HERE, '..', '..', '..', '..', 'packages', 'editor-core', 'src', 'codec');

const SENTINEL = 'transon::absent-key';
// Every sentinel string the AD-037 rewrite retired ('transon::absent-key@gen' is covered by the
// plain-sentinel substring scan).
const RETIRED = [SENTINEL, '@noopt', '__transon_no_marker__'];

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

/** encode → expect the unsupported placeholder with the raw node → decode → verbatim. */
async function expectHonestlyUnsupported(node: Json): Promise<void> {
  const ws = await encode(engine, node);
  expect(ws).toEqual({ type: 'transon_unsupported', extraState: { raw: node } });
  expect(await decode(engine, ws)).toEqual(node);
}

describe('AC-044(a) — a sentinel-named foreign key cannot forge a variant match', () => {
  it('zero-param rule: {$:this, "transon::absent-key":1} → unsupported, verbatim round-trip', async () => {
    await expectHonestlyUnsupported({ $: 'this', [SENTINEL]: 1 });
  });
  it('param rule: {$:attr, name, "transon::absent-key":1} → unsupported, verbatim round-trip', async () => {
    await expectHonestlyUnsupported({ $: 'attr', name: 'a', [SENTINEL]: 1 });
  });
  it('control: the same nodes without the collision key stay in-surface', async () => {
    // in-surface === anything but the unsupported placeholder; the concrete block-type ids are
    // metadata-derived and owned by the projection tests, not hardcoded here (review PR #16).
    expect((await encode(engine, { $: 'this' }) as { type: string }).type).not.toBe('transon_unsupported');
    expect((await encode(engine, { $: 'attr', name: 'a' }) as { type: string }).type).not.toBe('transon_unsupported');
  });
});

describe('AC-044(b) — the escape third-key emptiness check is not forgeable', () => {
  it('{$:object, fields:{$:v}, "transon::absent-key":1} is NOT the escape → unsupported, verbatim', async () => {
    // The exact escape (no extra key) stays the escape; the sentinel-named extra key must make it
    // fall through exactly like any other extra key (FR-123 precedence is EXACT marker+fields).
    await expectHonestlyUnsupported({ $: 'object', fields: { $: 'v' }, [SENTINEL]: 1 });
  });
  it('control: the exact escape without the extra key still round-trips via the escape', async () => {
    const t = { $: 'object', fields: { $: 'v' } };
    expect(await decode(engine, await encode(engine, t))).toEqual(t);
  });
});

describe('AC-044(c) — the retired sentinel strings are gone from generators and artifacts', () => {
  for (const dir of ['generators', 'artifacts']) {
    it(`src/codec/${dir}/*.json contain no retired sentinel`, () => {
      for (const file of readdirSync(join(CODEC, dir)).filter((f) => f.endsWith('.json'))) {
        const text = readFileSync(join(CODEC, dir, file), 'utf8');
        for (const s of RETIRED) {
          expect(text.includes(s), `${dir}/${file} still contains ${JSON.stringify(s)}`).toBe(false);
        }
      }
    });
  }
});
