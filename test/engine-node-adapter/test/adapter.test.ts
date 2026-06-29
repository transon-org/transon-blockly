// Node->Python engine adapter: version() + validate() round-trip (SPEC §9.9).
//   AD-008 — the editor reaches the engine only through the EngineProvider port.
//   AD-011 — execution-based verification via a real Node->Python `transon` adapter.
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

describe('Node->Python EngineProvider (AD-008, AD-011)', () => {
  it('reaches ready status after init()', () => {
    expect(engine.status).toBe('ready');
  });

  it('version() returns the engine version and metadata "2.0"', async () => {
    const v = await engine.version();
    expect(typeof v.engine).toBe('string');
    expect(v.engine.length).toBeGreaterThan(0);
    expect(v.engine).not.toBe('unknown');
    expect(v.metadata).toBe('2.0');
  });

  it('validate() on a tiny valid template returns a well-formed §9.9 result', async () => {
    // `{ "$": "this" }` is the identity rule — a minimal valid template.
    const template: Json = { $: 'this' };
    const res = await engine.validate(template, { marker: '$' });
    expect(res.status).toBe('ok');
    expect(res.valid).toBe(true);
    // On success the failure fields are absent.
    expect(res.error_type).toBeUndefined();
    expect(res.raw_engine_error).toBeUndefined();
  });

  it('validate() on a bogus rule reports a §9.9 failure with raw_engine_error', async () => {
    const template: Json = { $: 'no_such_rule_xyz' };
    const res = await engine.validate(template, { marker: '$' });
    expect(res.status).toBe('ok');
    expect(res.valid).toBe(false);
    expect(typeof res.error_type).toBe('string');
    expect(typeof res.raw_engine_error).toBe('string');
    expect(res.raw_engine_error!.length).toBeGreaterThan(0);
  });
});
