// D4 — engine + metadata schema versions in diagnostics (FR-080, AC-023). Once the engine is ready,
// the controller queries version() and the StatusBar surfaces both; a metadata-version mismatch
// against the version the editor was built with is flagged (NFR-040, AD-012).
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TransonEditor } from '../src/components/TransonEditor.js';
import { StatusBar } from '../src/components/panels.js';
import { emptySession } from '../src/session/types.js';
import { createEditorController } from '../src/session/controller.js';
import { createFakeEngine } from './fake-engine.js';

function container(): HTMLElement {
  const c = document.createElement('div');
  c.style.width = '800px';
  c.style.height = '600px';
  document.body.appendChild(c);
  return c;
}

describe('diagnostics versions (FR-080)', () => {
  it('loads engine + metadata versions from the host once ready', async () => {
    const c = container();
    const ctl = createEditorController(c, {
      host: { engine: createFakeEngine({ engineVersion: '9.9.9', metadataVersion: '2.0' }) },
      debounceMs: 0,
    });
    try {
      await waitFor(() => expect(ctl.store.getState().engine_version).toBe('9.9.9'));
      expect(ctl.store.getState().metadata_version).toBe('2.0');
    } finally {
      ctl.dispose();
      c.remove();
    }
  });

  it('surfaces the versions in the StatusBar and flags a metadata-schema mismatch (NFR-040)', () => {
    // matching metadata version → no mismatch flag
    render(<StatusBar state={emptySession({ engine_version: '1.2.3', metadata_version: '2.0' })} />);
    expect(screen.getByTestId('engine-version').textContent).toContain('1.2.3');
    const meta = screen.getByTestId('metadata-version');
    expect(meta.textContent).toContain('2.0');
    expect(meta.getAttribute('data-mismatch')).toBeNull();
  });

  it('flags a mismatched metadata version', () => {
    render(<StatusBar state={emptySession({ metadata_version: '999.0' })} />);
    const meta = screen.getByTestId('metadata-version');
    expect(meta.getAttribute('data-mismatch')).toBe('');
    expect(meta.textContent).toMatch(/built for/);
  });
});

describe('diagnostics in the shell (AC-023)', () => {
  it('shows the engine + metadata versions once the editor engine is ready', async () => {
    render(<TransonEditor host={{ engine: createFakeEngine({ engineVersion: '7.0.0' }) }} />);
    await waitFor(() => expect(screen.getByTestId('engine-version').textContent).toContain('7.0.0'));
    expect(screen.getByTestId('metadata-version')).toBeTruthy();
  });
});
