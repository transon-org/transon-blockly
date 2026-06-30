import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TransonEditor } from '../src/components/TransonEditor.js';
import { createFakeEngine } from './fake-engine.js';

// D2.2 — sandbox mode renders the canonical §12.1 panel set (AC-001, AC-031, FR-002).
describe('sandbox mode (AC-001, AC-031)', () => {
  it('shows canvas, generated-JSON, input, output, toolbar, and status', async () => {
    const engine = createFakeEngine({ status: 'ready' });
    render(<TransonEditor host={{ engine }} mode="sandbox" />);

    expect(screen.getByTestId('editor-shell').getAttribute('data-mode')).toBe('sandbox');
    expect(screen.getByTestId('transon-canvas')).toBeTruthy();
    expect(screen.getByTestId('json-panel')).toBeTruthy();
    expect(screen.getByTestId('input-panel')).toBeTruthy();
    expect(screen.getByTestId('output-panel')).toBeTruthy();
    expect(screen.getByTestId('toolbar')).toBeTruthy();
    expect(screen.getByTestId('status-bar')).toBeTruthy();

    // the controller settles to a ready engine (NFR-028/AC-023)
    await waitFor(() =>
      expect(screen.getByTestId('engine-status').getAttribute('data-status')).toBe('ready'),
    );
  });

  it('with no engine, the shell still renders and JSON generation is gated (§10.4)', async () => {
    render(<TransonEditor host={{}} mode="sandbox" />);
    expect(screen.getByTestId('transon-canvas')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId('engine-status').getAttribute('data-status')).toBe('absent'),
    );
    // generation is unavailable, surfaced (not a crash, not an error)
    expect(screen.getByTestId('json-gated')).toBeTruthy();
  });
});
