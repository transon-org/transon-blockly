// FR-135 — autorun: re-execute the current template against the current sample input on every
// accepted template change and on every sample-input change (debounced per NFR-027), keeping the
// output live without an explicit Run. Respects the engine-ready + valid-input gates (§10.4, §16.4).
// Realizes the dormant NFR-027. `onExecute` is the observable: run() fires it with the
// ExecutionResult, while codec projections (runForward) never do — so it isolates the user-template
// execution from the forward projection's own engine.transform() calls.
import { describe, it, expect, vi } from 'vitest';
import { createEditorController } from '../src/session/controller.js';
import { createFakeEngine } from './fake-engine.js';

const TEMPLATE = { $: 'this' };
const OK = () => ({ status: 'ok' as const, success: true, output: { ok: true } });

function container(): HTMLElement {
  const c = document.createElement('div');
  c.style.width = '800px';
  c.style.height = '600px';
  document.body.appendChild(c);
  return c;
}

describe('FR-135 autorun', () => {
  it('re-executes on a template change, with no explicit Run', async () => {
    const onExecute = vi.fn();
    const onChange = vi.fn();
    const engine = createFakeEngine({ onTransform: OK });
    const c = container();
    const ctl = createEditorController(c, {
      host: { engine },
      autorun: true,
      onExecute,
      onChange,
      debounceMs: 0,
    });
    try {
      await vi.waitFor(() => expect(onChange).toHaveBeenCalled()); // initial empty projection settled
      ctl.store.setState({ template_json: TEMPLATE });
      await vi.waitFor(() =>
        expect(onExecute).toHaveBeenCalledWith(expect.objectContaining({ output: { ok: true } })),
      );
    } finally {
      ctl.dispose();
      c.remove();
    }
  });

  it('re-executes on a sample-input change (running against the new input)', async () => {
    const onExecute = vi.fn();
    const onChange = vi.fn();
    const engine = createFakeEngine({ onTransform: OK });
    const c = container();
    const ctl = createEditorController(c, {
      host: { engine },
      autorun: true,
      onExecute,
      onChange,
      debounceMs: 0,
    });
    try {
      await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
      ctl.store.setState({ template_json: TEMPLATE });
      await vi.waitFor(() => expect(onExecute).toHaveBeenCalled());
      onExecute.mockClear();
      ctl.setInputText('{"a":1}');
      await vi.waitFor(() => expect(onExecute).toHaveBeenCalled());
      expect(engine.transforms.at(-1)?.input).toEqual({ a: 1 });
    } finally {
      ctl.dispose();
      c.remove();
    }
  });

  it('does NOT auto-execute when autorun is off (Run still required)', async () => {
    const onExecute = vi.fn();
    const onChange = vi.fn();
    const c = container();
    const ctl = createEditorController(c, {
      host: { engine: createFakeEngine() },
      onExecute,
      onChange,
      debounceMs: 0,
    });
    try {
      await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
      ctl.store.setState({ template_json: TEMPLATE });
      ctl.setInputText('{"a":1}');
      await new Promise((r) => setTimeout(r, 20));
      expect(onExecute).not.toHaveBeenCalled();
    } finally {
      ctl.dispose();
      c.remove();
    }
  });

  it('does NOT auto-execute when the engine is not ready (§10.4 gate)', async () => {
    const onExecute = vi.fn();
    const engine = createFakeEngine({ status: 'loading' });
    const c = container();
    const ctl = createEditorController(c, {
      host: { engine },
      autorun: true,
      onExecute,
      debounceMs: 0,
    });
    try {
      ctl.store.setState({ template_json: TEMPLATE, sample_input_json: { a: 1 } });
      await new Promise((r) => setTimeout(r, 20));
      expect(onExecute).not.toHaveBeenCalled();
    } finally {
      ctl.dispose();
      c.remove();
    }
  });

  it('coalesces rapid changes into a single execution (NFR-027 debounce)', async () => {
    const onExecute = vi.fn();
    const onChange = vi.fn();
    const engine = createFakeEngine({ onTransform: OK });
    const c = container();
    const ctl = createEditorController(c, {
      host: { engine },
      autorun: true,
      onExecute,
      onChange,
      debounceMs: 10,
    });
    try {
      await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
      ctl.store.setState({ template_json: TEMPLATE });
      ctl.store.setState({ template_json: { $: 'parent' } });
      ctl.setInputText('{"a":1}');
      await vi.waitFor(() => expect(onExecute).toHaveBeenCalled());
      expect(onExecute).toHaveBeenCalledTimes(1);
    } finally {
      ctl.dispose();
      c.remove();
    }
  });
});
