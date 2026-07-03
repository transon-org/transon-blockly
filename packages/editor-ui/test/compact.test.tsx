import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransonEditor } from '../src/components/TransonEditor.js';
import { createFakeEngine } from './fake-engine.js';

// D2.3 — compact mode shows canvas + palette (the Blockly toolbox) without requiring input/output
// panels, with a Visual|JSON|Split view switch (AC-032, FR-003/004).
describe('compact mode (AC-032, FR-003/004)', () => {
  it('shows canvas + toolbar + view switch, without input/output panels', async () => {
    const engine = createFakeEngine({ status: 'ready' });
    render(<TransonEditor host={{ engine }} mode="compact" />);

    expect(screen.getByTestId('editor-shell').getAttribute('data-mode')).toBe('compact');
    expect(screen.getByTestId('transon-canvas')).toBeTruthy();
    expect(screen.getByTestId('toolbar')).toBeTruthy();
    expect(screen.getByTestId('view-switch')).toBeTruthy();
    // compact does not require the sandbox input/output panels
    expect(screen.queryByTestId('input-panel')).toBeNull();
    expect(screen.queryByTestId('output-panel')).toBeNull();
    await waitFor(() =>
      expect(screen.getByTestId('engine-status').getAttribute('data-status')).toBe('ready'),
    );
  });

  it('toggling the view to JSON shows the JSON panel; the canvas stays mounted (FR-004)', async () => {
    const engine = createFakeEngine({ status: 'ready' });
    render(<TransonEditor host={{ engine }} mode="compact" />);
    await waitFor(() =>
      expect(screen.getByTestId('engine-status').getAttribute('data-status')).toBe('ready'),
    );
    // visual view: no JSON panel yet
    expect(screen.queryByTestId('json-panel')).toBeNull();
    fireEvent.change(screen.getByTestId('view-switch'), { target: { value: 'json' } });
    expect(screen.getByTestId('json-panel')).toBeTruthy();
    // the canvas DOM node persists (controller's workspace not orphaned)
    expect(screen.getByTestId('transon-canvas')).toBeTruthy();
  });
});
