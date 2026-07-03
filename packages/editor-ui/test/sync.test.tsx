// D5 — strict bidirectional JSON sync, controller wiring (§7.15, AD-024, AC-033; FR-038 — a
// rejected edit is clearly reported, never silently degraded). The real
// accept/reject DECISION (encode→surface→round-trip) is proven against the engine in the adapter
// (test/ui/reverse.test.ts); here we test the controller's RESPONSE over a real Blockly mount: an
// accepted edit loads into the workspace + marks in_sync; a rejected edit leaves the workspace
// UNCHANGED + marks out_of_sync with the error. tryReverse is mocked so no engine is needed.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tryReverse } from '../src/session/reverse.js';
import { createEditorController } from '../src/session/controller.js';
import { isEmptyWorkspace } from '../src/session/forward.js';
import { createFakeEngine } from './fake-engine.js';

vi.mock('../src/session/reverse.js', () => ({ tryReverse: vi.fn() }));
const mockReverse = vi.mocked(tryReverse);

const LITERAL_BLOCK = { type: 'transon_literal', fields: { VALUE: 1 } };

function container(): HTMLElement {
  const c = document.createElement('div');
  c.style.width = '800px';
  c.style.height = '600px';
  document.body.appendChild(c);
  return c;
}

async function tick(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => mockReverse.mockReset());

describe('§7.15 reverse sync — controller response (AC-033)', () => {
  it('an accepted edit loads into the workspace and marks in_sync (FR-111)', async () => {
    mockReverse.mockResolvedValue({ status: 'accepted', block: LITERAL_BLOCK, document: 1 });
    const c = container();
    const ctl = createEditorController(c, { host: { engine: createFakeEngine() }, debounceMs: 0 });
    try {
      ctl.setTemplateText('1');
      await vi.waitFor(() => expect(ctl.store.getState().json_sync_status).toBe('in_sync'));
      // the workspace now holds the loaded block (not empty)
      expect(isEmptyWorkspace(ctl.store.getState().workspace)).toBe(false);
      expect(mockReverse).toHaveBeenCalledWith(expect.anything(), '1', '$');
    } finally {
      ctl.dispose();
      c.remove();
    }
  });

  it('a rejected edit leaves the workspace UNCHANGED and marks out_of_sync (FR-112/113)', async () => {
    // first accept a block so the workspace is non-empty
    mockReverse.mockResolvedValue({ status: 'accepted', block: LITERAL_BLOCK, document: 1 });
    const c = container();
    const ctl = createEditorController(c, { host: { engine: createFakeEngine() }, debounceMs: 0 });
    try {
      ctl.setTemplateText('1');
      await vi.waitFor(() => expect(isEmptyWorkspace(ctl.store.getState().workspace)).toBe(false));
      const before = JSON.stringify(ctl.store.getState().workspace);

      // now a rejected edit
      mockReverse.mockResolvedValue({
        status: 'rejected',
        error: { code: 'json_template', message: 'bad json' },
      });
      ctl.setTemplateText('{ broken');
      await vi.waitFor(() => expect(ctl.store.getState().json_sync_status).toBe('out_of_sync'));
      expect(ctl.store.getState().errors[0]?.code).toBe('json_template');
      // workspace is byte-for-byte unchanged (FR-113)
      expect(JSON.stringify(ctl.store.getState().workspace)).toBe(before);
    } finally {
      ctl.dispose();
      c.remove();
    }
  });

  it('an out-of-surface rejection surfaces import_unsupported, workspace untouched (§15.7)', async () => {
    mockReverse.mockResolvedValue({
      status: 'rejected',
      error: { code: 'import_unsupported', message: 'out of surface' },
    });
    const c = container();
    const ctl = createEditorController(c, { host: { engine: createFakeEngine() }, debounceMs: 0 });
    try {
      await vi.waitFor(() => expect(ctl.store.getState().generation_status).toBe('empty'));
      ctl.setTemplateText('{"$":"attr","name":"a","names":["b"]}');
      await vi.waitFor(() => expect(ctl.store.getState().json_sync_status).toBe('out_of_sync'));
      expect(ctl.store.getState().errors[0]?.code).toBe('import_unsupported');
      expect(isEmptyWorkspace(ctl.store.getState().workspace)).toBe(true); // never loaded
    } finally {
      ctl.dispose();
      c.remove();
    }
  });

  it('marks editing immediately on a keystroke, before the debounced sync resolves (FR-113)', async () => {
    mockReverse.mockResolvedValue({ status: 'accepted', block: LITERAL_BLOCK, document: 1 });
    const c = container();
    const ctl = createEditorController(c, { host: { engine: createFakeEngine() }, debounceMs: 50 });
    try {
      await vi.waitFor(() => expect(ctl.store.getState().generation_status).toBe('empty'));
      ctl.setTemplateText('1');
      expect(ctl.store.getState().json_sync_status).toBe('editing'); // synchronous
      await tick();
    } finally {
      ctl.dispose();
      c.remove();
    }
  });
});
