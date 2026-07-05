import { describe, it, expect } from 'vitest';
import { mountBlockly } from '../src/blockly/mount.js';

// FR-133 (SPEC §7.17, AC-041(a), NFR-029) — canvas navigation for large templates: on-canvas zoom
// controls, wheel/pinch zoom, one-action zoom-to-fit, a minimap overview (OQ-020), and pan/scroll
// (drag + scrollbars + wheel). Zoom and scroll position are UI-only state (§11.5) — this suite
// never touches the codec; it only asserts the mounted workspace carries the navigation wiring and
// tears it down cleanly.

function makeContainer(): HTMLElement {
  const c = document.createElement('div');
  c.style.width = '800px';
  c.style.height = '600px';
  document.body.appendChild(c);
  return c;
}

describe('Canvas navigation (FR-133)', () => {
  it('mounts with zoom config: controls, wheel, pinch, start/min/max scale', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      const options = mount.workspace.options;
      expect(options.zoomOptions?.controls).toBe(true);
      expect(options.zoomOptions?.wheel).toBe(true);
      expect(options.zoomOptions?.pinch).toBe(true);
      expect(options.zoomOptions?.startScale).toBe(0.9);
      expect(options.zoomOptions?.minScale).toBe(0.2);
      expect(options.zoomOptions?.maxScale).toBe(3);
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('mounts with move config: scrollbars, drag, wheel (pan/scroll)', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      const options = mount.workspace.options;
      expect(options.moveOptions?.scrollbars).toBeTruthy();
      expect(options.moveOptions?.drag).toBe(true);
      expect(options.moveOptions?.wheel).toBe(true);
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('zoom-to-fit is wired: workspace.zoomToFit() normalizes scale without throwing', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      mount.loadDocument({ type: 'transon_literal', fields: { VALUE: 1 } });
      mount.workspace.setScale(2.5); // perturb away from the fitted scale first
      expect(() => mount.workspace.zoomToFit()).not.toThrow();
      // zoomToFit recalculates scale to frame the content — it should no longer sit at the
      // arbitrary perturbed value (it may legitimately clamp back to 1 for a single tiny block).
      expect(mount.workspace.scale).not.toBe(2.5);
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('minimap is instantiated on mount (DOM side-effect present)', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      // PositionedMinimap.init() renders a `.blockly-minimap` element into the injection div.
      expect(c.querySelector('.blockly-minimap')).toBeTruthy();
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('minimap mirrors a programmatic loadDocument (events are suppressed, so the mirror must be resynced)', () => {
    // The plugin mirrors the primary workspace by REPLAYING change events onto its own mini
    // workspace. loadDocument()/clear() run with Blockly events disabled (no forward-flow feedback
    // loop), so without an explicit resync the minimap stays empty and every later event replay
    // ("collapse", move, delete) throws "The associated block is undefined" (seen live in the
    // reference host). FR-133/AC-041(a): the minimap must reflect a programmatically loaded doc.
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      mount.loadDocument({
        type: 'transon_rule_attr__name',
        inputs: { name: { block: { type: 'transon_literal', fields: { VALUE: 'x' } } } },
      });
      const mm = c.parentElement?.querySelector('.blockly-minimap') ?? c.querySelector('.blockly-minimap');
      expect(mm).toBeTruthy();
      expect(mm!.querySelectorAll('g.blocklyBlock').length).toBeGreaterThan(0);
      // and a post-load event replay on the now-synced mirror must not throw (the live failure mode)
      const top = mount.workspace.getTopBlocks(false)[0]!;
      expect(() => top.setCollapsed(true)).not.toThrow();
      // clear() must resync the mirror down to empty as well
      mount.clear();
      expect(mm!.querySelectorAll('g.blocklyBlock').length).toBe(0);
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('dispose() tears down the zoom-to-fit control and the minimap without throwing', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    expect(() => mount.dispose()).not.toThrow();
    // the minimap DOM node is removed once disposed alongside the rest of the workspace chrome
    expect(c.querySelector('.blockly-minimap')).toBeNull();
    c.remove();
  });
});
