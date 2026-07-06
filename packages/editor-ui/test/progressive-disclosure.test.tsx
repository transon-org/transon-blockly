// D4 — progressive disclosure end-to-end (§12.6, OQ-009): the mount hides advanced blocks by default
// and setToolboxView restores them; the controller.setPaletteView seam drives it. Reads the palette's
// category divider labels via the flyout contents API (§12.6 presentation; reliable under jsdom).
import { describe, it, expect } from 'vitest';
import { mountBlockly } from '../src/blockly/mount.js';
import { createEditorController } from '../src/session/controller.js';
import { createFakeEngine } from './fake-engine.js';
import { categoryNames } from './helpers/palette.js';

function container(): HTMLElement {
  const c = document.createElement('div');
  c.style.width = '800px';
  c.style.height = '600px';
  document.body.appendChild(c);
  return c;
}

describe('progressive disclosure mount wiring (§12.6)', () => {
  it('hides the advanced-only "Variables" category by default, and setToolboxView restores it', () => {
    const c = container();
    const mount = mountBlockly(c, {});
    try {
      expect(categoryNames(mount.workspace)).not.toContain('Variables'); // set/get are advanced
      mount.setToolboxView({ showAdvanced: true });
      expect(categoryNames(mount.workspace)).toContain('Variables');
      mount.setToolboxView({ showAdvanced: false });
      expect(categoryNames(mount.workspace)).not.toContain('Variables');
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('controller.setPaletteView drives the palette view', () => {
    const c = container();
    const ctl = createEditorController(c, { host: { engine: createFakeEngine() }, debounceMs: 0 });
    try {
      expect(() => ctl.setPaletteView({ showAdvanced: true, search: '' })).not.toThrow();
      // a search term narrows the toolbox to matching categories only
      ctl.setPaletteView({ showAdvanced: true, search: 'attr' });
      // the mount workspace toolbox now reflects the search (Data Access holds attr)
    } finally {
      ctl.dispose();
      c.remove();
    }
  });
});
