import { describe, it, expect } from 'vitest';
import { createEditorStore } from '../src/session/store.js';
import { emptySession } from '../src/session/types.js';

// D1.1 — the EditorSession store carries the SPEC §9.3 fields + the M4 data-flow fields (FR-001).
describe('EditorSession store (FR-001, §9.3)', () => {
  const SPEC_9_3 = [
    'workspace',
    'template_json',
    'sample_input_json',
    'execution_output_json',
    'validation_status',
    'execution_status',
    'errors',
    'selected_example',
    'marker',
    'engine_version',
    'metadata_version',
    'editor_mode',
  ];
  const M4_FLOW = [
    'engine_runtime_status',
    'json_sync_status',
    'generation_status',
    'block_map',
    'files_written',
  ];
  // M5 D2: expected output of the loaded example, for actual-vs-expected display (§12.9, AC-019).
  const M5_FIELDS = ['expected_output_json'];
  // RFC-007 runtime metadata source (SPEC §7.18, FR-139/140).
  const RFC007_FIELDS = ['metadata_source', 'metadata_fallback'];

  it('initial state has exactly the §9.3 fields plus the M4 flow + M5 fields', () => {
    const store = createEditorStore();
    expect(Object.keys(store.getState()).sort()).toEqual([...SPEC_9_3, ...M4_FLOW, ...M5_FIELDS, ...RFC007_FIELDS].sort());
  });

  it('defaults are idle/empty with no engine and the default marker (§11.2, §10.4)', () => {
    const s = emptySession();
    expect(s.marker).toBe('$');
    expect(s.editor_mode).toBe('sandbox');
    expect(s.engine_runtime_status).toBe('absent');
    expect(s.validation_status).toBe('idle');
    expect(s.json_sync_status).toBe('in_sync');
    expect(s.generation_status).toBe('empty');
    expect(s.errors).toEqual([]);
  });

  it('setState shallow-merges and notifies subscribers; unsubscribe stops notifications', () => {
    const store = createEditorStore();
    const seen: string[] = [];
    const unsub = store.subscribe((s) => seen.push(s.editor_mode));
    store.setState({ editor_mode: 'compact' });
    expect(store.getState().editor_mode).toBe('compact');
    // unrelated fields preserved
    expect(store.getState().marker).toBe('$');
    unsub();
    store.setState({ editor_mode: 'sandbox' });
    expect(seen).toEqual(['compact']); // no notification after unsubscribe
  });
});
