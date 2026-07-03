import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransonEditor } from '../src/components/TransonEditor.js';
import { createFakeEngine } from './fake-engine.js';

// D3.3 — the sample-input panel validates JSON syntax and surfaces `json_input` (§16.4, §12.8).
describe('sample input JSON validation (§16.4 json_input)', () => {
  it('surfaces json_input on malformed input and clears it on valid input', async () => {
    const engine = createFakeEngine({ status: 'ready' });
    const { container } = render(<TransonEditor host={{ engine }} mode="sandbox" />);
    await waitFor(() =>
      expect(screen.getByTestId('engine-status').getAttribute('data-status')).toBe('ready'),
    );

    fireEvent.change(screen.getByTestId('input-content'), { target: { value: '{ bad json' } });
    await waitFor(() =>
      expect(container.querySelector('[data-error-code="json_input"]')).toBeTruthy(),
    );

    fireEvent.change(screen.getByTestId('input-content'), { target: { value: '{"x": 1}' } });
    await waitFor(() =>
      expect(container.querySelector('[data-error-code="json_input"]')).toBeNull(),
    );
  });
});
