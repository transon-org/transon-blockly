import { describe, it, expect } from 'vitest';
import { REFERENCE_HOST_PACKAGE, PINNED_ENGINE_VERSION } from '../src/index.js';

// D0 scaffold smoke test. The Pyodide provider + port-conformance tests land in D3.6.
describe('reference-host scaffold', () => {
  it('exposes the package marker', () => {
    expect(REFERENCE_HOST_PACKAGE).toBe('@transon/reference-host');
  });

  it('pins the engine version to the metadata snapshot (AD-025)', () => {
    expect(PINNED_ENGINE_VERSION).toBe('0.1.3');
  });
});
