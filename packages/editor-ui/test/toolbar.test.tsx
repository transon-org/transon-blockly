import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransonEditor } from '../src/components/TransonEditor.js';
import { createFakeEngine } from './fake-engine.js';

// D2.5 — toolbar actions (§12.3): New + Toggle View wired here; Validate/Run gated on engine-ready.
describe('toolbar (§12.3, FR-004)', () => {
  it('Validate/Run are disabled while the engine is not ready (§10.4)', async () => {
    render(<TransonEditor host={{}} mode="sandbox" />);
    await waitFor(() =>
      expect(screen.getByTestId('engine-status').getAttribute('data-status')).toBe('absent'),
    );
    expect((screen.getByTestId('btn-validate') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('btn-run') as HTMLButtonElement).disabled).toBe(true);
  });

  it('Validate/Run enable once the engine is ready (AC-012/013)', async () => {
    const engine = createFakeEngine({ status: 'ready' });
    render(<TransonEditor host={{ engine }} mode="sandbox" />);
    await waitFor(() =>
      expect((screen.getByTestId('btn-validate') as HTMLButtonElement).disabled).toBe(false),
    );
    expect((screen.getByTestId('btn-run') as HTMLButtonElement).disabled).toBe(false);
  });

  it('New is wired and keeps the (empty) workspace empty without crashing', async () => {
    const engine = createFakeEngine({ status: 'ready' });
    render(<TransonEditor host={{ engine }} mode="sandbox" />);
    await waitFor(() =>
      expect(screen.getByTestId('engine-status').getAttribute('data-status')).toBe('ready'),
    );
    fireEvent.click(screen.getByTestId('btn-new'));
    // generated JSON panel still present, nothing generated
    expect(screen.getByTestId('json-panel')).toBeTruthy();
  });
});
