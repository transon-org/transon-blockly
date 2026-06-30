import { describe, it, expect } from 'vitest';
import { EDITOR_UI_PACKAGE } from '../src/index.js';

// D0 scaffold smoke test: the package builds, the jsdom env loads, and the entry resolves.
describe('editor-ui scaffold', () => {
  it('exposes the package marker', () => {
    expect(EDITOR_UI_PACKAGE).toBe('@transon/editor-ui');
  });

  it('runs in a jsdom DOM environment (AD-021)', () => {
    expect(typeof document).toBe('object');
    const el = document.createElement('div');
    expect(el.tagName).toBe('DIV');
  });
});
