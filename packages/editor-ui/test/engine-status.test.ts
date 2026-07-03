import { describe, it, expect } from 'vitest';
import { createEditorStore } from '../src/session/store.js';
import {
  engineRuntimeStatus,
  isEngineReady,
  applyEngineStatus,
} from '../src/session/engine-status.js';
import { createFakeEngine } from './fake-engine.js';

// D1.4 — surface the host engine runtime status (NFR-028, AC-023) and gate engine-backed verdicts.
describe('engine runtime status + gating (NFR-028, AC-023, §10.4, §17.9)', () => {
  it('maps an absent engine to `absent` (distinct from idle)', () => {
    expect(engineRuntimeStatus(undefined)).toBe('absent');
    expect(isEngineReady(undefined)).toBe(false);
  });

  it('mirrors the provider status and reports readiness only when `ready`', () => {
    expect(engineRuntimeStatus(createFakeEngine({ status: 'loading' }))).toBe('loading');
    expect(isEngineReady(createFakeEngine({ status: 'loading' }))).toBe(false);
    expect(isEngineReady(createFakeEngine({ status: 'ready' }))).toBe(true);
  });

  it('disables validation/execution while not ready (NFR-028, §17.9)', () => {
    const store = createEditorStore();
    applyEngineStatus(store, createFakeEngine({ status: 'loading' }));
    expect(store.getState().engine_runtime_status).toBe('loading');
    expect(store.getState().validation_status).toBe('disabled');
    expect(store.getState().execution_status).toBe('disabled');
  });

  it('re-enables (idle) validation/execution when the engine reaches ready (AC-023)', () => {
    const store = createEditorStore();
    const engine = createFakeEngine({ status: 'loading' });
    applyEngineStatus(store, engine);
    expect(store.getState().validation_status).toBe('disabled');
    engine.status = 'ready';
    applyEngineStatus(store, engine);
    expect(store.getState().engine_runtime_status).toBe('ready');
    expect(store.getState().validation_status).toBe('idle');
    expect(store.getState().execution_status).toBe('idle');
  });

  it('on failed init, keeps authoring (workspace) but disables validate/run (§17.9)', () => {
    const store = createEditorStore();
    store.setState({ workspace: { blocks: { blocks: [{ type: 'transon_literal' }] } } });
    applyEngineStatus(store, createFakeEngine({ status: 'failed' }));
    expect(store.getState().engine_runtime_status).toBe('failed');
    expect(store.getState().validation_status).toBe('disabled');
    // authoring untouched — the workspace the user built remains
    expect(store.getState().workspace).not.toBeNull();
  });
});
