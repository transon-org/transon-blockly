// FR-142 / AC-044(d) (SPEC §7.19, §16.4 `engine_floor`) — session-init codec engine-floor check:
// once the host engine's version is known, a version below the declared CODEC_ENGINE_FLOOR
// surfaces a PERSISTENT, non-blocking `engine_floor` diagnostic; at/above the floor — and when
// the version is unknown — no diagnostic. Mirrors the metadata_fallback pattern.
import { describe, expect, it } from 'vitest';
import { createEditorStore } from '../src/session/store.js';
import { loadEngineVersions } from '../src/session/engine-status.js';
import { createFakeEngine } from './fake-engine.js';

describe('engine-floor diagnostic (FR-142, AC-044(d))', () => {
  it('a host below the floor surfaces the persistent engine_floor diagnostic', async () => {
    const store = createEditorStore();
    await loadEngineVersions(store, createFakeEngine({ status: 'ready', engineVersion: '0.1.7' }));
    const diag = store.getState().engine_floor;
    expect(diag).not.toBeNull();
    expect(diag!.code).toBe('engine_floor');
    // names both versions so the failure is explained at init (§7.19)
    expect(diag!.message).toContain('0.1.7');
    expect(diag!.message).toContain('0.1.8');
  });

  it('a host at/above the floor surfaces nothing', async () => {
    const store = createEditorStore();
    await loadEngineVersions(store, createFakeEngine({ status: 'ready', engineVersion: '0.2.0' }));
    expect(store.getState().engine_floor).toBeNull();
  });

  it('an unknown engine version surfaces nothing (FR-142: no diagnostic on unknown)', async () => {
    const store = createEditorStore();
    // fake-engine default reports the unparsable 'fake-0.0.0'
    await loadEngineVersions(store, createFakeEngine({ status: 'ready' }));
    expect(store.getState().engine_floor).toBeNull();
  });

  it('a later load from a compliant (or unknown) engine clears a stale diagnostic', async () => {
    const store = createEditorStore();
    await loadEngineVersions(store, createFakeEngine({ status: 'ready', engineVersion: '0.1.7' }));
    expect(store.getState().engine_floor).not.toBeNull();
    // same store, upgraded engine → the condition no longer holds → diagnostic clears
    await loadEngineVersions(store, createFakeEngine({ status: 'ready', engineVersion: '0.2.0' }));
    expect(store.getState().engine_floor).toBeNull();
    // and an unknown version never claims below-floor either
    await loadEngineVersions(store, createFakeEngine({ status: 'ready', engineVersion: '0.1.7' }));
    expect(store.getState().engine_floor).not.toBeNull();
    await loadEngineVersions(store, createFakeEngine({ status: 'ready' }));
    expect(store.getState().engine_floor).toBeNull();
  });

  it('non-blocking: the diagnostic does not gate validation/execution state', async () => {
    const store = createEditorStore();
    const before = {
      validation: store.getState().validation_status,
      execution: store.getState().execution_status,
    };
    await loadEngineVersions(store, createFakeEngine({ status: 'ready', engineVersion: '0.1.0' }));
    expect(store.getState().engine_floor).not.toBeNull();
    expect(store.getState().validation_status).toBe(before.validation);
    expect(store.getState().execution_status).toBe(before.execution);
  });
});
