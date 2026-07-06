// FR-136 — hide individual toolbar actions: a hidden action is NOT rendered (distinct from
// read-only (FR-107), which DISABLES while leaving the action visible). Composes so an embed can
// present a reduced action set (the docs-site embed hides all six).
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TransonEditor } from '../src/components/TransonEditor.js';
import { createFakeEngine } from './fake-engine.js';

const ALL = ['btn-new', 'btn-import', 'btn-copy', 'btn-download', 'btn-validate', 'btn-run'];

function ready() {
  return createFakeEngine({ status: 'ready' });
}

describe('FR-136 hide toolbar actions', () => {
  it('renders all actions by default', async () => {
    render(<TransonEditor host={{ engine: ready() }} mode="sandbox" />);
    await waitFor(() => expect(screen.getByTestId('toolbar')).toBeTruthy());
    for (const id of ALL) expect(screen.queryByTestId(id)).not.toBeNull();
  });

  it('hidden actions are not rendered (not merely disabled)', async () => {
    render(
      <TransonEditor
        host={{ engine: ready() }}
        mode="sandbox"
        hideToolbarActions={['new', 'import', 'copy', 'download', 'validate', 'run']}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('toolbar')).toBeTruthy());
    for (const id of ALL) expect(screen.queryByTestId(id)).toBeNull();
  });

  it('hides only the named actions; the rest remain', async () => {
    render(
      <TransonEditor
        host={{ engine: ready() }}
        mode="sandbox"
        hideToolbarActions={['import', 'copy', 'download']}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('toolbar')).toBeTruthy());
    expect(screen.queryByTestId('btn-import')).toBeNull();
    expect(screen.queryByTestId('btn-copy')).toBeNull();
    expect(screen.queryByTestId('btn-download')).toBeNull();
    expect(screen.queryByTestId('btn-new')).not.toBeNull();
    expect(screen.queryByTestId('btn-validate')).not.toBeNull();
    expect(screen.queryByTestId('btn-run')).not.toBeNull();
  });

  it('is independent of readOnly (readOnly disables New but does not hide it)', async () => {
    render(<TransonEditor host={{ engine: ready() }} mode="sandbox" readOnly />);
    await waitFor(() => expect(screen.getByTestId('toolbar')).toBeTruthy());
    const nw = screen.getByTestId('btn-new') as HTMLButtonElement;
    expect(nw).not.toBeNull(); // still rendered
    expect(nw.disabled).toBe(true); // but disabled
  });
});
