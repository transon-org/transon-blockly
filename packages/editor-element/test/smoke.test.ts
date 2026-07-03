import { describe, it, expect } from 'vitest';
import { EDITOR_ELEMENT_PACKAGE } from '../src/index.js';

// D0 scaffold smoke test: the public package builds and resolves under jsdom.
describe('editor-element scaffold', () => {
  it('exposes the package marker', () => {
    expect(EDITOR_ELEMENT_PACKAGE).toBe('@transon/editor-element');
  });

  it('has the DOM custom-elements registry available (AD-019)', () => {
    expect(typeof customElements).toBe('object');
  });
});
