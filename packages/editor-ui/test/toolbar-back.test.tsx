// FR-137 — optional host-provided LEADING toolbar action (`onBack` + `backLabel`): when supplied,
// the editor renders it as the FIRST toolbar item and invokes the host callback on activation. The
// editor performs no navigation itself (AD-008) — the host owns routing.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransonEditor } from '../src/components/TransonEditor.js';
import { createFakeEngine } from './fake-engine.js';

function ready() {
  return createFakeEngine({ status: 'ready' });
}

describe('FR-137 leading toolbar action (onBack)', () => {
  it('is absent when no onBack is provided', async () => {
    render(<TransonEditor host={{ engine: ready() }} mode="sandbox" />);
    await waitFor(() => expect(screen.getByTestId('toolbar')).toBeTruthy());
    expect(screen.queryByTestId('btn-back')).toBeNull();
  });

  it('renders FIRST in the toolbar with the given label when onBack is provided', async () => {
    render(
      <TransonEditor host={{ engine: ready() }} mode="sandbox" onBack={() => {}} backLabel="Back to docs" />,
    );
    await waitFor(() => expect(screen.queryByTestId('btn-back')).not.toBeNull());
    const toolbar = screen.getByTestId('toolbar');
    const back = screen.getByTestId('btn-back');
    expect(toolbar.firstElementChild).toBe(back); // leading item
    expect(back.textContent).toContain('Back to docs');
  });

  it('invokes the host callback on click and does not navigate itself', async () => {
    const onBack = vi.fn();
    render(<TransonEditor host={{ engine: ready() }} mode="sandbox" onBack={onBack} />);
    await waitFor(() => expect(screen.queryByTestId('btn-back')).not.toBeNull());
    fireEvent.click(screen.getByTestId('btn-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('defaults the label to "Back" when backLabel is omitted', async () => {
    render(<TransonEditor host={{ engine: ready() }} mode="sandbox" onBack={() => {}} />);
    await waitFor(() => expect(screen.queryByTestId('btn-back')).not.toBeNull());
    expect(screen.getByTestId('btn-back').textContent).toContain('Back');
  });
});
