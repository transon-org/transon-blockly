// D6 — accessibility baseline (AC-039, NFR-045, §19.5), the deterministic jsdom layer. Screen-reader
// labels on every major panel/region, keyboard-reachable controls, error + expected-vs-actual state
// conveyed as TEXT (not colour alone), and an axe-core scan of the sandbox chrome with no critical/
// serious ARIA violations. Contrast + visible-focus are verified in a real browser (see the styles +
// the browser layer); axe cannot compute contrast under jsdom (no layout), so it is disabled here.
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { TransonEditor } from '../src/components/TransonEditor.js';
import { OutputPanel } from '../src/components/panels.js';
import { emptySession } from '../src/session/types.js';
import { createFakeEngine } from './fake-engine.js';

describe('screen-reader labels on major panels (NFR-045)', () => {
  it('every major region/panel carries an accessible name', async () => {
    render(<TransonEditor host={{ engine: createFakeEngine() }} mode="sandbox" />);
    await waitFor(() => expect(screen.getByTestId('engine-status').getAttribute('data-status')).toBe('ready'));

    expect(screen.getByTestId('transon-canvas').getAttribute('aria-label')).toBeTruthy();
    expect(screen.getByLabelText('Examples')).toBeTruthy();
    expect(screen.getByLabelText('Output and errors')).toBeTruthy();
    // the JSON + input panels label both the region and the control (accessible name on each)
    expect(screen.getAllByLabelText('Generated template JSON').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText('Sample input JSON').length).toBeGreaterThanOrEqual(1);
    // toolbar + status are landmarks with names
    expect(screen.getByRole('toolbar', { name: 'Editor actions' })).toBeTruthy();
    const status = screen.getByTestId('status-bar');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });
});

describe('keyboard reachability (NFR-045)', () => {
  it('toolbar controls are native focusable elements (not divs)', async () => {
    render(<TransonEditor host={{ engine: createFakeEngine() }} mode="sandbox" />);
    await waitFor(() => screen.getByTestId('btn-validate'));
    for (const id of ['btn-new', 'btn-validate', 'btn-run', 'btn-copy', 'btn-download', 'palette-search', 'toggle-advanced']) {
      const el = screen.getByTestId(id);
      expect(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(el.tagName);
    }
  });
});

describe('state not conveyed by colour alone (NFR-045, FR-095)', () => {
  it('the expected-vs-actual match state has a text label', () => {
    const match = emptySession({ selected_example: 'x', expected_output_json: 1, execution_output_json: 1, execution_status: 'success' });
    const { rerender } = render(<OutputPanel state={match} />);
    expect(screen.getByTestId('match-indicator').textContent).toMatch(/matches/i);

    const differ = emptySession({ selected_example: 'x', expected_output_json: 1, execution_output_json: 2, execution_status: 'success' });
    rerender(<OutputPanel state={differ} />);
    expect(screen.getByTestId('match-indicator').textContent).toMatch(/differs/i);
  });

  it('errors carry a text category label (§16.4)', () => {
    const withError = emptySession({ errors: [{ code: 'runtime_transformation', message: 'boom' }] });
    render(<OutputPanel state={withError} />);
    const item = screen.getByTestId('error-list').querySelector('.transon-error-category');
    expect(item?.textContent?.trim().length).toBeGreaterThan(0);
  });
});

describe('axe-core: no critical/serious ARIA violations on the sandbox chrome (AC-039)', () => {
  it('scans the shell (excluding the Blockly canvas + contrast, unavailable under jsdom)', async () => {
    render(<TransonEditor host={{ engine: createFakeEngine() }} mode="sandbox" />);
    await waitFor(() => screen.getByTestId('toolbar'));

    // axe context = { include, exclude } (selectors); contrast is disabled (jsdom has no layout) and
    // the Blockly canvas is third-party DOM. Cast the call: axe's runtime context/options are looser
    // than the bundled overloads. Contrast + the canvas are verified in a real browser (D6 manual).
    const run = axe.run as unknown as (
      context: unknown,
      options: unknown,
    ) => Promise<{ violations: Array<{ id: string; impact?: string; nodes: unknown[] }> }>;
    const results = await run(
      { include: [['[data-testid="editor-shell"]']], exclude: [['[data-testid="transon-canvas"]']] },
      { rules: { 'color-contrast': { enabled: false } } },
    );
    const serious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })))).toEqual([]);
  });
});
