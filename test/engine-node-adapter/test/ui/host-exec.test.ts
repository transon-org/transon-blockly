// D3.1/D3.2/D3.4/D3.5 (real engine) — the editor-ui validation/execution flows run the host engine
// across the §10.4 boundary and fold the result into the session. These flows are DOM-free (no
// Blockly mount), so they run directly against the real Node→Python engine here.
// Covers AC-012/013/014/015/016/024/025, §16.4 taxonomy, §17.8 stale output.
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { EngineProvider } from '@transon/editor-core';
import { createEditorStore, validateTemplate, executeTemplate } from '@transon/editor-ui';
import { createNodeEngineProvider } from '../../src/index.js';

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

describe('validation flow (AC-012, AC-016, §16.4 template_definition)', () => {
  it('a valid template validates (status valid, no errors)', async () => {
    const store = createEditorStore({ template_json: { $: 'attr', name: 'x' } });
    await validateTemplate(store, engine, '$');
    expect(store.getState().validation_status).toBe('valid');
    expect(store.getState().errors).toEqual([]);
  });

  it('an invalid template surfaces a template_definition error', async () => {
    const store = createEditorStore({ template_json: { $: 'no_such_rule_xyz' } });
    await validateTemplate(store, engine, '$');
    expect(store.getState().validation_status).toBe('invalid');
    expect(store.getState().errors[0]?.code).toBe('template_definition');
  });
});

describe('execution flow (AC-013, AC-014, AC-015, §17.8)', () => {
  it('executes a template against input and surfaces the output', async () => {
    const store = createEditorStore({
      template_json: { $: 'attr', name: 'x' },
      sample_input_json: { x: 42 },
    });
    await executeTemplate(store, engine, '$');
    expect(store.getState().execution_status).toBe('success');
    expect(store.getState().execution_output_json).toBe(42);
  });

  it('a runtime failure surfaces runtime_transformation', async () => {
    const store = createEditorStore({
      template_json: { $: 'call', name: 'float' },
      sample_input_json: 'not-a-number',
    });
    await executeTemplate(store, engine, '$');
    expect(store.getState().execution_status).toBe('error');
    expect(store.getState().errors[0]?.code).toBe('runtime_transformation');
  });

  it('keeps prior successful output but marks it stale on a later failure (§17.8)', async () => {
    const store = createEditorStore({
      template_json: { $: 'attr', name: 'x' },
      sample_input_json: { x: 7 },
    });
    await executeTemplate(store, engine, '$');
    expect(store.getState().execution_status).toBe('success');
    // now fail without clearing the prior output
    store.setState({ template_json: { $: 'call', name: 'float' }, sample_input_json: 'abc' });
    await executeTemplate(store, engine, '$');
    expect(store.getState().execution_status).toBe('stale');
    expect(store.getState().execution_output_json).toBe(7); // prior output preserved
  });
});

describe('captured file writes (AC-024, §16.5, §12.11)', () => {
  it('captures `file` writes into files_written (no filesystem write)', async () => {
    const store = createEditorStore({
      template_json: { $: 'file', name: 'out.json', content: { $: 'this' } },
      sample_input_json: { a: 1 },
    });
    await executeTemplate(store, engine, '$');
    expect(store.getState().execution_status).toBe('success');
    expect(store.getState().files_written).toMatchObject({ 'out.json': { a: 1 } });
  });
});

describe('include loader (AC-025, §16.6, §17.10)', () => {
  it('resolves an include through the pre-resolved includes map', async () => {
    const store = createEditorStore({
      template_json: { $: 'include', name: 'Frag' },
      sample_input_json: { x: 7 },
    });
    await executeTemplate(store, engine, '$', { includes: { Frag: { $: 'attr', name: 'x' } } });
    expect(store.getState().execution_status).toBe('success');
    expect(store.getState().execution_output_json).toBe(7);
  });

  it('surfaces include_loader when an include cannot be resolved', async () => {
    const store = createEditorStore({
      template_json: { $: 'include', name: 'Missing' },
      sample_input_json: {},
    });
    // a loader exists but does not have 'Missing' → "include not resolvable: Missing"
    await executeTemplate(store, engine, '$', { includes: { Other: { $: 'this' } } });
    expect(store.getState().execution_status).not.toBe('success');
    expect(store.getState().errors[0]?.code).toBe('include_loader');
  });
});
