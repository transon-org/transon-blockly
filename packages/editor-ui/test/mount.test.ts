import { describe, it, expect, vi } from 'vitest';
import * as Blockly from 'blockly/core';
import { toWorkspaceState } from '@transon/editor-blockly';
import { mountBlockly, TRANSON_ROOT_CLASS } from '../src/blockly/mount.js';

// D2.1 — the interactive mount (FR-001, AD-017/AD-033 thrasos renderer, AD-018 light DOM). Verifies the rendered
// workspace injects into a light-DOM container, the change listener fires only on real edits, and
// the workspace↔document bridge (serialize / loadDocument / clear) works. Codec correctness is
// proven against the real engine elsewhere; here we pre-bake a codec block with the headless engine.

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function makeContainer(): HTMLElement {
  const c = document.createElement('div');
  c.style.width = '800px';
  c.style.height = '600px';
  document.body.appendChild(c);
  return c;
}

describe('Blockly mount (FR-001, AD-017, AD-018)', () => {
  it('injects a thrasos workspace into a light-DOM container (no shadow root)', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      expect(c.classList.contains(TRANSON_ROOT_CLASS)).toBe(true); // scoped prefix (AD-018)
      expect(c.shadowRoot).toBeNull(); // light DOM, never shadow (AD-018)
      expect(c.querySelector('svg')).toBeTruthy(); // rendered SVG canvas
      expect(mount.workspace.getRenderer().getClassName()).toMatch(/thrasos/i); // AD-017/AD-033
      // §12.6 palette presentation: a flat always-visible flyout list, no category column.
      expect(mount.workspace.getToolbox()).toBeNull();
      expect(mount.workspace.getFlyout()).toBeTruthy();
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('presents the palette as a flat list with §12.4 category divider labels (§12.6)', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      const flyout = mount.workspace.getFlyout()!;
      const kinds = flyout.getContents().map((i) => i.getType());
      expect(kinds.filter((k) => k === 'block').length).toBeGreaterThan(0); // palette blocks
      expect(kinds.filter((k) => k === 'label').length).toBeGreaterThan(1); // §12.4 dividers
      expect(kinds[0]).toBe('label'); // the list opens with a category divider
      // Always-visible: the flyout does not auto-close.
      expect(flyout.autoClose).toBe(false);
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('left-anchors divider label text — no per-label centering drift (§12.6)', () => {
    // Blockly centers label text at measuredWidth/2 with text-anchor:middle, but measures with
    // the renderer font constants — the divider CSS (uppercase, letter-spacing, smaller size)
    // renders a different width, so each label drifted by its own offset ("random left margin").
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      const texts = c.querySelectorAll('.blocklyFlyout .transonFlyoutDivider text');
      expect(texts.length).toBeGreaterThan(1);
      for (const t of texts) {
        expect(t.getAttribute('text-anchor')).toBe('start');
        expect(t.getAttribute('x')).toBe('0');
      }
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('keeps palette blocks at fixed scale while the canvas zooms (§12.6 / §11.5)', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      const flyout = mount.workspace.getFlyout()!;
      const before = flyout.getFlyoutScale();
      mount.workspace.setScale(2.5); // canvas zoom is UI-only viewport state
      expect(flyout.getFlyoutScale()).toBe(before); // palette must not follow
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('re-measures the workspace when the mount container resizes (§12.1 splitter / NFR-025)', () => {
    // Blockly only re-measures on WINDOW resize; a container-level resize (side-panel splitter
    // drag, host layout change) must be forwarded explicitly, or the SVG keeps its stale size.
    const observed: Element[] = [];
    let fire: (() => void) | undefined;
    class FakeResizeObserver {
      constructor(cb: () => void) {
        fire = cb;
      }
      observe(el: Element): void {
        observed.push(el);
      }
      disconnect(): void {
        observed.length = 0;
      }
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    try {
      const c = makeContainer();
      const mount = mountBlockly(c);
      try {
        expect(observed).toContain(c); // the mount watches its own container
        const svg = c.querySelector('svg.blocklySvg')!;
        // jsdom has no layout: offsetWidth is 0 at inject time. svgResize measures the svg's
        // parent (Blockly's injection div, 100%-sized inside our container) — give it the new
        // measured size (as a splitter drag would) and fire the observer.
        const injectionDiv = svg.parentElement!;
        Object.defineProperty(injectionDiv, 'offsetWidth', { value: 640, configurable: true });
        Object.defineProperty(injectionDiv, 'offsetHeight', { value: 480, configurable: true });
        fire?.(); // container resized → svgResize re-measures from the container
        expect(svg.getAttribute('width')).toBe('640px');
        expect(svg.getAttribute('height')).toBe('480px');
      } finally {
        mount.dispose();
      }
      expect(observed).toHaveLength(0); // dispose() disconnects the observer
      c.remove();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('serialize() returns the Blockly envelope; clear() empties it', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      // an empty Blockly workspace serializes to {} (save() omits empty sections)
      expect(typeof mount.serialize()).toBe('object');
      mount.loadDocument({ type: 'transon_literal', fields: { VALUE: 1 } });
      const loaded = mount.serialize() as { blocks?: { blocks?: unknown[] } };
      expect(loaded.blocks?.blocks ?? []).toHaveLength(1);
      mount.clear();
      const after = mount.serialize() as { blocks?: { blocks?: unknown[] } };
      expect(after.blocks?.blocks ?? []).toHaveLength(0);
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('loadDocument() projects a codec block into the canvas WITHOUT firing onWorkspaceChange', async () => {
    // A hand-crafted codec block (a scalar literal) — loadDocument only calls Blockly's loader, so
    // no engine is needed; codec correctness lives in the adapter integration tests.
    const block = { type: 'transon_literal', fields: { VALUE: 42 } };

    const c = makeContainer();
    const changes: unknown[] = [];
    const mount = mountBlockly(c, { onWorkspaceChange: (w) => changes.push(w) });
    try {
      mount.loadDocument(block);
      await tick();
      // programmatic load is suppressed — no feedback into the forward flow
      expect(changes).toHaveLength(0);
      const ws = mount.serialize() as { blocks?: { blocks?: unknown[] } };
      expect(ws.blocks?.blocks ?? []).toHaveLength(1);
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('onWorkspaceChange fires on a genuine (non-UI) workspace mutation', async () => {
    const c = makeContainer();
    const changes: unknown[] = [];
    const mount = mountBlockly(c, { onWorkspaceChange: (w) => changes.push(w) });
    try {
      // A non-suppressed Blockly load (an external mutation, not our programmatic loadDocument) fires
      // real BLOCK_CREATE/FINISHED_LOADING events the listener must surface. Events are batched
      // asynchronously, so poll.
      Blockly.serialization.workspaces.load(
        toWorkspaceState({ type: 'transon_literal', fields: { VALUE: 7 } }),
        mount.workspace,
      );
      await vi.waitFor(() => expect(changes.length).toBeGreaterThan(0));
    } finally {
      mount.dispose();
      c.remove();
    }
  });
});
