// FR-138 — initial palette view: the editor opens in a seeded progressive-disclosure state
// (advanced blocks shown + search term) instead of the default, so an embed can present all blocks
// with the palette search/advanced chrome omitted (§12.6). "Variables" (set/get) is advanced-only,
// so its presence in the flat flyout is the clean signal. The mount honors an initial `view`; the
// controller forwards `paletteView` into it, and TransonEditor seeds its toolbar state from the prop.
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { mountBlockly } from '../src/blockly/mount.js';
import { TransonEditor } from '../src/components/TransonEditor.js';
import { createFakeEngine } from './fake-engine.js';
import { categoryNames } from './helpers/palette.js';

function container(): HTMLElement {
  const c = document.createElement('div');
  c.style.width = '800px';
  c.style.height = '600px';
  document.body.appendChild(c);
  return c;
}

describe('FR-138 initial palette view', () => {
  it('hides advanced categories by default (no initial view)', () => {
    const c = container();
    const mount = mountBlockly(c, {});
    try {
      expect(categoryNames(mount.workspace)).not.toContain('Variables');
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('opens with advanced categories shown when the initial view seeds showAdvanced', () => {
    const c = container();
    const mount = mountBlockly(c, { view: { showAdvanced: true } });
    try {
      expect(categoryNames(mount.workspace)).toContain('Variables');
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('seeds the Advanced-blocks toggle in TransonEditor from paletteView (end-to-end prop)', async () => {
    render(
      <TransonEditor
        host={{ engine: createFakeEngine({ status: 'ready' }) }}
        mode="sandbox"
        paletteView={{ showAdvanced: true, search: '' }}
      />,
    );
    await waitFor(() => expect(screen.queryByTestId('toggle-advanced')).not.toBeNull());
    expect((screen.getByTestId('toggle-advanced') as HTMLInputElement).checked).toBe(true);
  });

  it('omits the palette search + advanced toggle when hidePaletteControls is set (§12.6 chrome omitted)', async () => {
    render(
      <TransonEditor
        host={{ engine: createFakeEngine({ status: 'ready' }) }}
        mode="sandbox"
        paletteView={{ showAdvanced: true, search: '' }}
        hidePaletteControls
      />,
    );
    await waitFor(() => expect(screen.getByTestId('toolbar')).toBeTruthy());
    expect(screen.queryByTestId('toggle-advanced')).toBeNull();
    expect(screen.queryByTestId('palette-search')).toBeNull();
  });
});
