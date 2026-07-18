// NFR-052 — network-hermetic canvas mount: injecting a workspace must trigger NO external
// network request. Without `sounds: false`, Blockly's WorkspaceAudio preloads its four UI sounds
// from the DEFAULT media path — https://static.blockly.com/media/ — on every inject. An
// embeddable component (NFR-043) must not silently call a third-party CDN from the host page,
// and the DOM suites must not depend on that CDN being reachable: its timeout failed CI as
// 8 unhandled fetch rejections (agentic-checks/tests on main, 2026-07-18).
import { describe, it, expect, vi } from 'vitest';
import { mountBlockly } from '../src/blockly/mount.js';

describe('network-hermetic mount (NFR-052)', () => {
  it('mounting fetches nothing and disables workspace sounds', () => {
    // A rejecting spy: any fetch during mount is both counted and loud.
    const spy = vi.fn(() => Promise.reject(new Error('NFR-052: mount must not fetch')));
    const origFetch = globalThis.fetch;
    globalThis.fetch = spy as unknown as typeof fetch;
    const container = document.createElement('div');
    document.body.appendChild(container);
    try {
      const mount = mountBlockly(container);
      try {
        expect((mount.workspace.options as { hasSounds?: boolean }).hasSounds).toBe(false);
      } finally {
        mount.dispose();
      }
      expect(spy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = origFetch;
      container.remove();
    }
  });
});
