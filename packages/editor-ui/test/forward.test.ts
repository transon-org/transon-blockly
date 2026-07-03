import { describe, it, expect, vi } from 'vitest';
import type { Json } from '@transon/editor-core';
import { createEditorStore } from '../src/session/store.js';
import { runForward, applyForward, isEmptyWorkspace, debounce } from '../src/session/forward.js';
import { createFakeEngine } from './fake-engine.js';

// D1.2 — forward projection wiring (FR-019 generation, FR-091/122 block_map, §10.4 gating, §17.5).
// Codec *correctness* (real decode/blockMap output) is proven against the real engine in the
// engine-node-adapter integration test; here we test the store-side flow and gating with a fake.
describe('forward projection flow (FR-019/091/122, §10.4)', () => {
  const WS = { blocks: { blocks: [{ type: 'transon_literal' }] } };

  it('detects an empty workspace', () => {
    expect(isEmptyWorkspace(null)).toBe(true);
    expect(isEmptyWorkspace({ blocks: { blocks: [] } })).toBe(true);
    expect(isEmptyWorkspace(WS)).toBe(false);
  });

  it('is gated when no engine is available (§10.4): unavailable, no engine call', async () => {
    const r = await runForward(undefined, WS, '$');
    expect(r).toEqual({
      template_json: null,
      block_map: null,
      generation_status: 'unavailable',
      error: null,
    });
  });

  it('is gated while the engine is not ready (§10.4)', async () => {
    const engine = createFakeEngine({ status: 'loading' });
    const r = await runForward(engine, WS, '$');
    expect(r.generation_status).toBe('unavailable');
    expect(engine.calls.transform).toBe(0); // never ran the codec
  });

  it('with a ready engine, an empty workspace generates nothing (§17.5)', async () => {
    const engine = createFakeEngine({ status: 'ready' });
    const r = await runForward(engine, { blocks: { blocks: [] } }, '$');
    expect(r.generation_status).toBe('empty');
    expect(engine.calls.transform).toBe(0);
  });

  it('with a ready engine and a workspace, runs the codec (decode + blockMap)', async () => {
    // Script the two codec executions: blockMap wraps its input as {n: document}; decode passes the
    // raw workspace. Return a fixed document for decode and a minimal MapNode root for blockMap.
    const engine = createFakeEngine({
      status: 'ready',
      onTransform: (_t, input) => {
        const isBlockMap =
          !!input && typeof input === 'object' && !Array.isArray(input) && 'n' in (input as object);
        const output: Json = isBlockMap ? { children: [] } : { $: 'this' };
        return { status: 'ok', success: true, output };
      },
    });
    const r = await runForward(engine, WS, '$');
    expect(engine.calls.transform).toBe(2); // decode + blockMap
    expect(r.generation_status).toBe('complete');
    expect(r.template_json).toEqual({ $: 'this' });
    expect(r.block_map).toEqual([{ template_path: '$', block_id: '$' }]);
    expect(r.error).toBeNull();
  });

  it('applyForward: a complete generation resets validation→idle and marks prior success stale', () => {
    const store = createEditorStore();
    store.setState({ validation_status: 'valid', execution_status: 'success' });
    applyForward(store, {
      template_json: { $: 'this' },
      block_map: [{ template_path: '$', block_id: '$' }],
      generation_status: 'complete',
      error: null,
    });
    const s = store.getState();
    expect(s.template_json).toEqual({ $: 'this' });
    expect(s.block_map).toHaveLength(1);
    expect(s.generation_status).toBe('complete');
    expect(s.validation_status).toBe('idle'); // re-validation needed for the new template
    expect(s.execution_status).toBe('stale'); // §17.8
    expect(s.errors).toEqual([]);
  });

  it('debounce coalesces rapid calls into one trailing invocation', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 50);
    d();
    d();
    d();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
