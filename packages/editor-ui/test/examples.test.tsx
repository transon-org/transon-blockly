// D2 — Examples panel + expected-vs-actual (FR-009/075/076/079/099, AC-018/019). The picker loads a
// corpus example; the OutputPanel shows expected alongside actual with a text match/differ label
// (not colour-only, NFR-045). The real-engine load+run identity is proven in the node adapter
// (test/ui/example-run.test.ts); here we test the UI + the controller's example bookkeeping.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExamplesPanel, OutputPanel } from '../src/components/panels.js';
import { emptySession } from '../src/session/types.js';
import { createEditorController } from '../src/session/controller.js';
import { createFakeEngine } from './fake-engine.js';
import type { ExampleCase } from '../src/session/host.js';

const EXAMPLES: ExampleCase[] = [
  { name: 'AttrBasic', template: { $: 'attr', name: 'email' }, data: { email: 'a@b.c' }, result: 'a@b.c', rule: 'attr' },
  { name: 'ExprAdd', template: { $: 'expr', op: '+', value: 1 }, data: 2, result: 3, rule: 'expr' },
];

function container(): HTMLElement {
  const c = document.createElement('div');
  c.style.width = '800px';
  c.style.height = '600px';
  document.body.appendChild(c);
  return c;
}

describe('ExamplesPanel picker (FR-009, AC-018)', () => {
  it('renders an option per example and fires onSelect with the chosen example', () => {
    const onSelect = vi.fn();
    render(<ExamplesPanel examples={EXAMPLES} selected={null} onSelect={onSelect} onReset={() => {}} />);
    const select = screen.getByTestId('example-select') as HTMLSelectElement;
    expect(screen.getByRole('option', { name: 'AttrBasic' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'ExprAdd' })).toBeTruthy();
    fireEvent.change(select, { target: { value: 'ExprAdd' } });
    expect(onSelect).toHaveBeenCalledWith(EXAMPLES[1]);
  });

  it('renders nothing when the corpus is empty', () => {
    const { container: c } = render(
      <ExamplesPanel examples={[]} selected={null} onSelect={() => {}} onReset={() => {}} />,
    );
    expect(c.querySelector('[data-testid="examples-panel"]')).toBeNull();
  });
});

describe('OutputPanel expected-vs-actual (AC-019, FR-075/076, NFR-045)', () => {
  it('shows a text "matches" label when actual equals expected', () => {
    const state = emptySession({
      selected_example: 'ExprAdd',
      expected_output_json: 3,
      execution_output_json: 3,
      execution_status: 'success',
    });
    render(<OutputPanel state={state} />);
    const indicator = screen.getByTestId('match-indicator');
    expect(indicator.getAttribute('data-match')).toBe('match');
    expect(indicator.textContent).toMatch(/matches/i);
    expect(screen.getByTestId('expected-content').textContent).toContain('3');
  });

  it('shows a text "differs" label when actual differs from expected', () => {
    const state = emptySession({
      selected_example: 'ExprAdd',
      expected_output_json: 3,
      execution_output_json: 99,
      execution_status: 'success',
    });
    render(<OutputPanel state={state} />);
    const indicator = screen.getByTestId('match-indicator');
    expect(indicator.getAttribute('data-match')).toBe('differ');
    expect(indicator.textContent).toMatch(/differs/i);
  });

  it('shows no match indicator before a run, or when no example is loaded', () => {
    const beforeRun = emptySession({ selected_example: 'ExprAdd', expected_output_json: 3, execution_status: 'idle' });
    const { rerender } = render(<OutputPanel state={beforeRun} />);
    expect(screen.queryByTestId('match-indicator')).toBeNull();

    const noExample = emptySession({ execution_output_json: 5, execution_status: 'success' });
    rerender(<OutputPanel state={noExample} />);
    expect(screen.queryByTestId('match-indicator')).toBeNull();
    expect(screen.queryByTestId('expected-output')).toBeNull();
  });
});

describe('controller.loadExample bookkeeping (FR-099, AC-018)', () => {
  it('records the example name, sample input, and expected output', async () => {
    const c = container();
    // A gated engine: the template load is engine-gated (proven end-to-end in the adapter); here we
    // assert the controller's example bookkeeping, which runs regardless of the engine.
    const ctl = createEditorController(c, { host: { engine: createFakeEngine({ status: 'failed' }) }, debounceMs: 0 });
    try {
      await ctl.loadExample(EXAMPLES[0]!).catch(() => {});
      const s = ctl.store.getState();
      expect(s.selected_example).toBe('AttrBasic');
      expect(s.sample_input_json).toEqual({ email: 'a@b.c' });
      expect(s.expected_output_json).toBe('a@b.c');
    } finally {
      ctl.dispose();
      c.remove();
    }
  });

  it('New clears the loaded-example state', () => {
    const c = container();
    const ctl = createEditorController(c, { host: { engine: createFakeEngine({ status: 'failed' }) }, debounceMs: 0 });
    try {
      ctl.store.setState({ selected_example: 'AttrBasic', expected_output_json: 'a@b.c' });
      ctl.newWorkspace();
      expect(ctl.store.getState().selected_example).toBeNull();
      expect(ctl.store.getState().expected_output_json).toBeNull();
    } finally {
      ctl.dispose();
      c.remove();
    }
  });
});
