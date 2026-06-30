import { describe, it, expect, vi } from 'vitest';
import * as Blockly from 'blockly/core';
import { toWorkspaceState } from '@transon/editor-blockly';
import { mountBlockly, TRANSON_ROOT_CLASS } from '../src/blockly/mount.js';

// D2.1 — the interactive Zelos mount (FR-001, AD-017 Zelos, AD-018 light DOM). Verifies the rendered
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
  it('injects a Zelos workspace into a light-DOM container (no shadow root)', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      expect(c.classList.contains(TRANSON_ROOT_CLASS)).toBe(true); // scoped prefix (AD-018)
      expect(c.shadowRoot).toBeNull(); // light DOM, never shadow (AD-018)
      expect(c.querySelector('svg')).toBeTruthy(); // rendered SVG canvas
      expect(mount.workspace.getRenderer().getClassName()).toMatch(/zelos/i); // AD-017
      expect(mount.workspace.getToolbox()).toBeTruthy(); // §12.4 categories present
    } finally {
      mount.dispose();
      c.remove();
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
