// §16.4 error taxonomy / NFR-028 — a host engine whose transform()/validate() REJECTS (a host/glue
// defect, not an engine verdict: the port contract returns failures as results) must surface
// `editor_internal` in the session error list, never vanish. Regression: the Pyodide host's
// transon_transform threw on a JsNull include-depth argument (RFC-004 plumbing) and the rejection
// escaped through `void controller.run()` — Run appeared to silently do nothing, with
// execution_status stuck at `pending`.
import { describe, it, expect } from 'vitest';
import { createEditorStore } from '../src/session/store.js';
import { executeTemplate } from '../src/session/execute.js';
import { validateTemplate } from '../src/session/validate.js';
import { createFakeEngine } from './fake-engine.js';

const MARKER = '$';

describe('rejected engine calls surface editor_internal (§16.4)', () => {
  it('transform() rejection → execution_status error + editor_internal (no prior output)', async () => {
    const store = createEditorStore({ template_json: { $: 'this' } });
    const engine = createFakeEngine({
      onTransform: () => {
        throw new Error('glue exploded');
      },
    });
    const res = await executeTemplate(store, engine, MARKER);
    expect(res).toBeNull(); // no engine result to thread into onExecute
    const s = store.getState();
    expect(s.execution_status).toBe('error');
    expect(s.errors).toHaveLength(1);
    expect(s.errors[0]!.code).toBe('editor_internal');
    expect(s.errors[0]!.message).toContain('glue exploded');
  });

  it('transform() rejection preserves prior output as stale (§17.8)', async () => {
    const store = createEditorStore({
      template_json: { $: 'this' },
      execution_output_json: { previous: true },
      execution_status: 'success',
    });
    const engine = createFakeEngine({
      onTransform: () => {
        throw new Error('glue exploded');
      },
    });
    await executeTemplate(store, engine, MARKER);
    const s = store.getState();
    expect(s.execution_status).toBe('stale'); // prior output kept, marked stale
    expect(s.execution_output_json).toEqual({ previous: true });
    expect(s.errors[0]!.code).toBe('editor_internal');
  });

  it('validate() rejection → editor_internal error, status back to idle (no fabricated verdict, NFR-004)', async () => {
    const store = createEditorStore({ template_json: { $: 'this' } });
    const engine = createFakeEngine({
      onValidate: () => {
        throw new Error('glue exploded');
      },
    });
    const res = await validateTemplate(store, engine, MARKER);
    expect(res).toBeNull();
    const s = store.getState();
    // NOT 'invalid' — the editor never reports a validity verdict it didn't get from the engine.
    expect(s.validation_status).toBe('idle');
    expect(s.errors).toHaveLength(1);
    expect(s.errors[0]!.code).toBe('editor_internal');
  });
});
