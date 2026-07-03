import { describe, it, expect } from 'vitest';
import { createEditorStore } from '../src/session/store.js';
import { applyEngineStatus } from '../src/session/engine-status.js';
import { runForward, applyForward } from '../src/session/forward.js';

// D1.3 — engine-optional gating (§10.4, corrected for the projection model AD-026/030).
// Without a host engine: authoring works; generation/validation/execution are gated, never errors.
describe('engine-optional behavior (§10.4)', () => {
  it('authoring (workspace edits) works with no engine', () => {
    const store = createEditorStore();
    applyEngineStatus(store, undefined);
    expect(store.getState().engine_runtime_status).toBe('absent');
    // the user can still build a workspace
    store.setState({ workspace: { blocks: { blocks: [{ type: 'transon_array' }] } } });
    expect(store.getState().workspace).not.toBeNull();
  });

  it('generation is unavailable (not an error) with no engine', async () => {
    const store = createEditorStore();
    const result = await runForward(undefined, { blocks: { blocks: [{ type: 'transon_literal' }] } }, '$');
    expect(result.generation_status).toBe('unavailable');
    expect(result.error).toBeNull();
    applyForward(store, result);
    expect(store.getState().template_json).toBeNull();
    expect(store.getState().errors).toEqual([]); // gated, not a user error
  });

  it('validation/execution are disabled (not idle) with no engine', () => {
    const store = createEditorStore();
    applyEngineStatus(store, undefined);
    expect(store.getState().validation_status).toBe('disabled');
    expect(store.getState().execution_status).toBe('disabled');
  });
});
