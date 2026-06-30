import { describe, it, expect } from 'vitest';
import { createTransonEditor } from '../src/create.js';
import { fakeEngine } from './fake.js';

// D6 — createTransonEditor() vanilla factory (FR-010/011, AC-022, AD-019).
function target(): HTMLElement {
  const t = document.createElement('div');
  t.style.width = '800px';
  t.style.height = '600px';
  document.body.appendChild(t);
  return t;
}

describe('createTransonEditor (AD-019, AC-022)', () => {
  it('mounts a sandbox editor into the target and returns a usable handle', () => {
    const t = target();
    const handle = createTransonEditor(t, { host: { engine: fakeEngine() }, mode: 'sandbox' });
    try {
      expect(t.querySelector('[data-testid="editor-shell"]')).toBeTruthy();
      expect(t.querySelector('[data-testid="transon-canvas"]')).toBeTruthy();
      expect(handle.getTemplate()).toBeNull(); // empty workspace initially
    } finally {
      handle.destroy();
      t.remove();
    }
  });

  it('mounts compact mode when requested', () => {
    const t = target();
    const handle = createTransonEditor(t, { host: { engine: fakeEngine() }, mode: 'compact' });
    try {
      expect(t.querySelector('[data-mode="compact"]')).toBeTruthy();
    } finally {
      handle.destroy();
      t.remove();
    }
  });

  it('destroy() unmounts the editor', () => {
    const t = target();
    const handle = createTransonEditor(t, { host: { engine: fakeEngine() } });
    handle.destroy();
    expect(t.querySelector('[data-testid="editor-shell"]')).toBeNull();
    t.remove();
  });
});
