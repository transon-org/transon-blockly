// D0 — embedding callbacks carry the engine result payloads (ARCHITECTURE §5.3): onValidate(r:
// ValidationResult), onExecute(r: ExecutionResult), onChange(template). FR-011 ("observe validation
// results and execution results"), FR-105 (expose validation status), FR-106 (expose execution
// status and output). The M4 controller fired these arg-less; this locks the payloads.
import { describe, it, expect, vi } from 'vitest';
import { createEditorController } from '../src/session/controller.js';
import { createEditorStore } from '../src/session/store.js';
import { validateTemplate } from '../src/session/validate.js';
import { executeTemplate } from '../src/session/execute.js';
import { createFakeEngine } from './fake-engine.js';

const TEMPLATE = { $: 'attr', name: 'x' };

function container(): HTMLElement {
  const c = document.createElement('div');
  c.style.width = '800px';
  c.style.height = '600px';
  document.body.appendChild(c);
  return c;
}

describe('flow functions return the raw engine result (D0)', () => {
  it('validateTemplate returns the ValidationResult (FR-105)', async () => {
    const store = createEditorStore({ marker: '$' });
    store.setState({ template_json: TEMPLATE });
    const engine = createFakeEngine({
      onValidate: () => ({ status: 'ok', valid: false, error_message: 'bad shape' }),
    });
    const r = await validateTemplate(store, engine, '$');
    expect(r).toEqual({ status: 'ok', valid: false, error_message: 'bad shape' });
  });

  it('validateTemplate returns null when gated / nothing to validate (FR-105)', async () => {
    const store = createEditorStore({ marker: '$' });
    // no template_json set → nothing to validate
    const r = await validateTemplate(store, createFakeEngine(), '$');
    expect(r).toBeNull();
  });

  it('executeTemplate returns the ExecutionResult incl. output + files (FR-106)', async () => {
    const store = createEditorStore({ marker: '$' });
    store.setState({ template_json: TEMPLATE, sample_input_json: { a: 1 } });
    const engine = createFakeEngine({
      onTransform: () => ({
        status: 'ok',
        success: true,
        output: { b: 2 },
        filesWritten: { 'out.txt': 'hi' },
      }),
    });
    const r = await executeTemplate(store, engine, '$');
    expect(r).toEqual({
      status: 'ok',
      success: true,
      output: { b: 2 },
      filesWritten: { 'out.txt': 'hi' },
    });
  });
});

describe('controller threads results into the embedding callbacks (FR-011/105/106)', () => {
  it('onValidate receives the ValidationResult', async () => {
    const onValidate = vi.fn();
    const engine = createFakeEngine({
      onValidate: () => ({ status: 'ok', valid: false, error_type: 'DefinitionError', error_message: 'nope' }),
    });
    const c = container();
    const ctl = createEditorController(c, { host: { engine }, onValidate, debounceMs: 0 });
    try {
      ctl.store.setState({ template_json: TEMPLATE });
      await ctl.validate();
      expect(onValidate).toHaveBeenCalledTimes(1);
      expect(onValidate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ok', valid: false, error_message: 'nope' }),
      );
    } finally {
      ctl.dispose();
      c.remove();
    }
  });

  it('onExecute receives the ExecutionResult', async () => {
    const onExecute = vi.fn();
    const engine = createFakeEngine({
      onTransform: () => ({ status: 'ok', success: true, output: { ok: true } }),
    });
    const c = container();
    const ctl = createEditorController(c, { host: { engine }, onExecute, debounceMs: 0 });
    try {
      ctl.store.setState({ template_json: TEMPLATE });
      await ctl.run();
      expect(onExecute).toHaveBeenCalledTimes(1);
      expect(onExecute).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ok', success: true, output: { ok: true } }),
      );
    } finally {
      ctl.dispose();
      c.remove();
    }
  });

  it('onChange receives the generated template (null when empty) (FR-104)', async () => {
    const onChange = vi.fn();
    const c = container();
    const ctl = createEditorController(c, { host: { engine: createFakeEngine() }, onChange, debounceMs: 0 });
    try {
      // initial projection of the empty workspace fires onChange(null)
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
    } finally {
      ctl.dispose();
      c.remove();
    }
  });
});
