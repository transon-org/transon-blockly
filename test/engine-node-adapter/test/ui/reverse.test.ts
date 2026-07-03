// D5 (real engine) — strict bidirectional JSON reverse path (§7.15, AD-024, FR-111..113). tryReverse
// runs the generated encoder + decoder through the host engine to decide accept/reject: a valid
// in-surface edit is accepted; malformed JSON → json_template; out-of-surface → import_unsupported.
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { EngineProvider } from '@transon/editor-core';
import { tryReverse } from '@transon/editor-ui';
import { createNodeEngineProvider } from '../../src/index.js';

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

describe('tryReverse (§7.15, AD-024)', () => {
  it('accepts a valid in-surface rule edit', async () => {
    const out = await tryReverse(engine, JSON.stringify({ $: 'attr', name: 'email' }), '$');
    expect(out.status).toBe('accepted');
    if (out.status === 'accepted') expect(out.document).toEqual({ $: 'attr', name: 'email' });
  });

  it('accepts in-surface literals / arrays / objects', async () => {
    for (const doc of [[1, 2, 3], { a: 1, b: 'x' }, 42, 'hi'] as const) {
      const out = await tryReverse(engine, JSON.stringify(doc), '$');
      expect(out.status, JSON.stringify(doc)).toBe('accepted');
    }
  });

  it('rejects malformed JSON as json_template (FR-112)', async () => {
    const out = await tryReverse(engine, '{ not valid', '$');
    expect(out.status).toBe('rejected');
    if (out.status === 'rejected') expect(out.error.code).toBe('json_template');
  });

  it('rejects an out-of-surface edit as import_unsupported (§15.7, FR-112)', async () => {
    // ambiguous attr variant (name AND names) → the encoder emits transon_unsupported
    const out = await tryReverse(engine, JSON.stringify({ $: 'attr', name: 'a', names: ['b'] }), '$');
    expect(out.status).toBe('rejected');
    if (out.status === 'rejected') expect(out.error.code).toBe('import_unsupported');
  });

  it('rejects an unknown rule as import_unsupported', async () => {
    const out = await tryReverse(engine, JSON.stringify({ $: 'no_such_rule' }), '$');
    expect(out.status).toBe('rejected');
    if (out.status === 'rejected') expect(out.error.code).toBe('import_unsupported');
  });

  // Regression (round-trip-reviewer): the surface check must test `transon_unsupported` in
  // BLOCK-TYPE position only — an in-surface document whose DATA contains that string (literal
  // value, object key, or param) must still be accepted (FR-111), not false-rejected.
  it('accepts in-surface documents that contain the string "transon_unsupported" as data', async () => {
    const docs = [
      'transon_unsupported', // scalar literal
      { transon_unsupported: 1 }, // object key
      { $: 'attr', name: 'transon_unsupported' }, // rule param value
      [{ a: 'transon_unsupported' }, 'transon_unsupported'], // nested
    ];
    for (const doc of docs) {
      const out = await tryReverse(engine, JSON.stringify(doc), '$');
      expect(out.status, JSON.stringify(doc)).toBe('accepted');
      if (out.status === 'accepted') expect(out.document).toEqual(doc);
    }
  });
});
