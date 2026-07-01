// D3 — import / export UX (§7.13, FR-007/008/096..101, AC-021). Copy + Download of the generated
// canonical JSON, Import via the strict §7.15 gate, the FR-101 unsaved-changes guard, and the FR-100
// no-backend constraint. Copy/Download/Import use only clipboard/Blob/File — never the network.
//
// The controller is created FIRST (so Blockly.inject sees the real navigator/URL), then the specific
// clipboard/URL methods are patched via defineProperty (preserving the constructors Blockly needs).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEditorController } from '../src/session/controller.js';
import { tryReverse } from '../src/session/reverse.js';
import { isEmptyWorkspace } from '../src/session/forward.js';
import { createFakeEngine } from './fake-engine.js';

vi.mock('../src/session/reverse.js', () => ({ tryReverse: vi.fn() }));
const mockReverse = vi.mocked(tryReverse);
const LITERAL = { type: 'transon_literal', fields: { VALUE: 1 } };

function container(): HTMLElement {
  const c = document.createElement('div');
  c.style.width = '800px';
  c.style.height = '600px';
  document.body.appendChild(c);
  return c;
}
function patch(obj: object, key: string, value: unknown): void {
  Object.defineProperty(obj, key, { value, configurable: true, writable: true });
}

beforeEach(() => mockReverse.mockReset());

describe('copy (FR-097/008)', () => {
  it('writes the generated template JSON to the clipboard', async () => {
    const c = container();
    const ctl = createEditorController(c, { host: { engine: createFakeEngine() }, debounceMs: 0 });
    const writeText = vi.fn().mockResolvedValue(undefined);
    patch(navigator, 'clipboard', { writeText });
    try {
      ctl.store.setState({ template_json: { $: 'attr', name: 'email' } });
      expect(await ctl.copyTemplate()).toBe(true);
      expect(writeText).toHaveBeenCalledWith(JSON.stringify({ $: 'attr', name: 'email' }, null, 2));
    } finally {
      ctl.dispose();
      c.remove();
    }
  });

  it('is a no-op (returns false) when there is nothing to copy', async () => {
    const c = container();
    const ctl = createEditorController(c, { host: { engine: createFakeEngine() }, debounceMs: 0 });
    try {
      expect(await ctl.copyTemplate()).toBe(false);
    } finally {
      ctl.dispose();
      c.remove();
    }
  });
});

describe('download (FR-098/008, §11.6 canonical-only)', () => {
  it('creates an object URL + anchor download of the canonical JSON', () => {
    const c = container();
    const ctl = createEditorController(c, { host: { engine: createFakeEngine() }, debounceMs: 0 });
    const createObjectURL = vi.fn().mockReturnValue('blob:fake');
    const revokeObjectURL = vi.fn();
    patch(URL, 'createObjectURL', createObjectURL);
    patch(URL, 'revokeObjectURL', revokeObjectURL);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      ctl.store.setState({ template_json: { $: 'attr', name: 'x' } });
      expect(ctl.downloadTemplate()).toBe(true);
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    } finally {
      clickSpy.mockRestore();
      ctl.dispose();
      c.remove();
    }
  });

  it('returns false with nothing to download', () => {
    const c = container();
    const ctl = createEditorController(c, { host: { engine: createFakeEngine() }, debounceMs: 0 });
    try {
      expect(ctl.downloadTemplate()).toBe(false);
    } finally {
      ctl.dispose();
      c.remove();
    }
  });
});

describe('import via the §7.15 gate (FR-096/007)', () => {
  it('an accepted in-surface import loads into the workspace', async () => {
    mockReverse.mockResolvedValue({ status: 'accepted', block: LITERAL, document: 1 });
    const c = container();
    const ctl = createEditorController(c, { host: { engine: createFakeEngine() }, debounceMs: 0 });
    try {
      await ctl.importText('1');
      await vi.waitFor(() => expect(isEmptyWorkspace(ctl.store.getState().workspace)).toBe(false));
    } finally {
      ctl.dispose();
      c.remove();
    }
  });

  it('a rejected out-of-surface import is reported and leaves the workspace unchanged', async () => {
    mockReverse.mockResolvedValue({
      status: 'rejected',
      error: { code: 'import_unsupported', message: 'outside the supported surface' },
    });
    const c = container();
    const ctl = createEditorController(c, { host: { engine: createFakeEngine() }, debounceMs: 0 });
    try {
      await ctl.importText('{"$":"nope"}');
      expect(isEmptyWorkspace(ctl.store.getState().workspace)).toBe(true);
      expect(ctl.store.getState().errors[0]?.code).toBe('import_unsupported');
    } finally {
      ctl.dispose();
      c.remove();
    }
  });
});

describe('unsaved-changes guard (FR-101)', () => {
  it('New on a non-empty workspace prompts; declining preserves the workspace', async () => {
    mockReverse.mockResolvedValue({ status: 'accepted', block: LITERAL, document: 1 });
    const confirmReplace = vi.fn().mockReturnValue(false); // user declines
    const c = container();
    const ctl = createEditorController(c, { host: { engine: createFakeEngine() }, confirmReplace, debounceMs: 0 });
    try {
      await ctl.importText('1'); // empty workspace → not guarded; loads
      await vi.waitFor(() => expect(isEmptyWorkspace(ctl.store.getState().workspace)).toBe(false));
      const before = JSON.stringify(ctl.store.getState().workspace);

      ctl.newWorkspace(); // guarded — declined
      expect(confirmReplace).toHaveBeenCalled();
      expect(JSON.stringify(ctl.store.getState().workspace)).toBe(before); // unchanged
    } finally {
      ctl.dispose();
      c.remove();
    }
  });

  it('New on an empty workspace does not prompt', () => {
    const confirmReplace = vi.fn().mockReturnValue(false);
    const c = container();
    const ctl = createEditorController(c, { host: { engine: createFakeEngine() }, confirmReplace, debounceMs: 0 });
    try {
      ctl.newWorkspace();
      expect(confirmReplace).not.toHaveBeenCalled(); // nothing to lose
    } finally {
      ctl.dispose();
      c.remove();
    }
  });
});

describe('no backend (FR-100, AC-021)', () => {
  it('copy + download use no network (fetch is never called)', async () => {
    const c = container();
    const ctl = createEditorController(c, { host: { engine: createFakeEngine() }, debounceMs: 0 });
    const fetchSpy = vi.fn();
    patch(globalThis, 'fetch', fetchSpy);
    patch(navigator, 'clipboard', { writeText: vi.fn().mockResolvedValue(undefined) });
    patch(URL, 'createObjectURL', () => 'blob:x');
    patch(URL, 'revokeObjectURL', () => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      ctl.store.setState({ template_json: { $: 'attr', name: 'x' } });
      await ctl.copyTemplate();
      ctl.downloadTemplate();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      clickSpy.mockRestore();
      ctl.dispose();
      c.remove();
    }
  });
});
