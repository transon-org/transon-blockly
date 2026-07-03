// D1 — component embedding config surface (§7.14). Initial template/input (FR-102/103), exposing the
// generated template (FR-104), read-only mode (FR-107), and chrome-only CSS-var theming (FR-108/128).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TransonEditor } from '../src/components/TransonEditor.js';
import { createEditorController } from '../src/session/controller.js';
import { mountBlockly } from '../src/blockly/mount.js';
import { createFakeEngine } from './fake-engine.js';

function container(): HTMLElement {
  const c = document.createElement('div');
  c.style.width = '800px';
  c.style.height = '600px';
  document.body.appendChild(c);
  return c;
}

describe('initial config (FR-102/103)', () => {
  it('honours the initial sample input on mount (FR-103)', async () => {
    render(<TransonEditor host={{ engine: createFakeEngine() }} input={{ hello: 'world' }} />);
    await waitFor(() => {
      const input = screen.getByTestId('input-content') as HTMLTextAreaElement;
      expect(input.value).toContain('hello');
    });
  });
});

describe('read-only mode (FR-107)', () => {
  it('renders the shell read-only: New disabled, JSON panel not editable', async () => {
    render(<TransonEditor host={{ engine: createFakeEngine() }} readOnly mode="sandbox" />);
    await waitFor(() =>
      expect(screen.getByTestId('editor-shell').getAttribute('data-readonly')).toBe(''),
    );
    expect((screen.getByTestId('btn-new') as HTMLButtonElement).disabled).toBe(true);
    // the generated-JSON textarea is read-only (view, not edit)
    const ta = (await screen.findByTestId('json-content')) as HTMLTextAreaElement;
    expect(ta.readOnly).toBe(true);
  });

  it('the controller does not sync reverse edits in read-only mode (FR-107)', async () => {
    const c = container();
    const ctl = createEditorController(c, { host: { engine: createFakeEngine() }, readOnly: true, debounceMs: 0 });
    try {
      const before = ctl.store.getState().json_sync_status;
      ctl.setTemplateText('{"$":"attr","name":"x"}');
      await new Promise((r) => setTimeout(r, 5));
      // setTemplateText is a no-op: no transition to editing/out_of_sync
      expect(ctl.store.getState().json_sync_status).toBe(before);
    } finally {
      ctl.dispose();
      c.remove();
    }
  });
});

describe('theming hooks (FR-108/FR-128)', () => {
  it('applies --transon-* CSS custom properties to the shell root, ignoring other keys', async () => {
    render(
      <TransonEditor
        host={{
          engine: createFakeEngine(),
          theme: { '--transon-bg': '#101010', '--transon-accent': 'tomato', color: 'red' },
        }}
      />,
    );
    const shell = await screen.findByTestId('editor-shell');
    expect(shell.style.getPropertyValue('--transon-bg')).toBe('#101010');
    expect(shell.style.getPropertyValue('--transon-accent')).toBe('tomato');
    // a non-`--transon-*` key is ignored (chrome-only contract; no arbitrary style injection)
    expect(shell.style.getPropertyValue('color')).toBe('');
  });

  it('applies no inline custom properties when no theme is given', async () => {
    render(<TransonEditor host={{ engine: createFakeEngine() }} />);
    const shell = await screen.findByTestId('editor-shell');
    expect(shell.style.getPropertyValue('--transon-bg')).toBe('');
  });
});

describe('configurable categories reach the mount (FR-109)', () => {
  /** Read the injected toolbox's category names via Blockly's toolbox API. */
  function categoryNames(ws: unknown): string[] {
    const tb = (ws as { getToolbox?(): unknown }).getToolbox?.() as
      | { getToolboxItems?(): Array<{ getName?(): string }> }
      | null;
    const items = tb?.getToolboxItems?.() ?? [];
    return items.map((i) => i.getName?.()).filter((n): n is string => typeof n === 'string');
  }

  it('injects the configured category set, hiding configured categories', () => {
    // 'Data Access' is a non-advanced category (attr), present in the default view.
    const c = container();
    const full = mountBlockly(c, {});
    try {
      expect(categoryNames(full.workspace)).toContain('Data Access');
    } finally {
      full.dispose();
    }
    const c2 = container();
    const filtered = mountBlockly(c2, { categories: { hidden: ['Data Access'] } });
    try {
      const cats = categoryNames(filtered.workspace);
      expect(cats).not.toContain('Data Access');
      expect(cats.length).toBeGreaterThan(0);
    } finally {
      filtered.dispose();
      c.remove();
      c2.remove();
    }
  });
});

describe('onChange exposes the generated template (FR-104)', () => {
  it('fires with null for an empty workspace', async () => {
    const onChange = vi.fn();
    const c = container();
    const ctl = createEditorController(c, { host: { engine: createFakeEngine() }, onChange, debounceMs: 0 });
    try {
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
    } finally {
      ctl.dispose();
      c.remove();
    }
  });
});
