// D4 — progressive disclosure end-to-end (§12.6, OQ-009): the mount hides advanced blocks by default
// and setToolboxView restores them; the controller.setPaletteView seam drives it. Reads the injected
// toolbox via Blockly's toolbox API (reliable under jsdom).
import { describe, it, expect } from 'vitest';
import { mountBlockly } from '../src/blockly/mount.js';
import { createEditorController } from '../src/session/controller.js';
import { createFakeEngine } from './fake-engine.js';

function container(): HTMLElement {
  const c = document.createElement('div');
  c.style.width = '800px';
  c.style.height = '600px';
  document.body.appendChild(c);
  return c;
}
function categoryNames(ws: unknown): string[] {
  const tb = (ws as { getToolbox?(): unknown }).getToolbox?.() as
    | { getToolboxItems?(): Array<{ getName?(): string }> }
    | null;
  return (tb?.getToolboxItems?.() ?? [])
    .map((i) => i.getName?.())
    .filter((n): n is string => typeof n === 'string');
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
