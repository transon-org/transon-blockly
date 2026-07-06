import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { REFERENCE_HOST_PACKAGE, PINNED_ENGINE_VERSION } from '../src/index.js';

// D0 scaffold smoke test. The Pyodide provider + port-conformance tests land in D3.6.
describe('reference-host scaffold', () => {
  it('exposes the package marker', () => {
    expect(REFERENCE_HOST_PACKAGE).toBe('@transon/reference-host');
  });

  it('pins the engine version to the metadata snapshot (AD-025)', () => {
    // Assert against the committed snapshot itself (the AD-025 contract), not a copied literal —
    // a snapshot re-pin must move this constant in the same change (e.g. 0.1.6 → 0.1.7, RFC-004).
    const HERE = dirname(fileURLToPath(import.meta.url));
    const snapshot = JSON.parse(
      readFileSync(join(HERE, '..', '..', '..', 'docs', 'metadata-snapshot.json'), 'utf8'),
    ) as { engine_version: string | null };
    expect(PINNED_ENGINE_VERSION).toBe(snapshot.engine_version);
  });
});
