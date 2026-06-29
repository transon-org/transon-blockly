// The typed metadata-snapshot loader exposes the pinned, engine-owned export.
//   AD-012  — engine-owned, versioned editor-metadata export, consumed by the editor.
//   NFR-047 — split structural catalog / examples-docs payload.
import { describe, it, expect } from 'vitest';
import { editorMetadata, metadataVersion } from '../src/index.js';

describe('metadata snapshot loader (AD-012, NFR-047)', () => {
  it('exposes metadata_version "2.0" as a stable string token', () => {
    // AD-012: the schema version gate compares a string token; the engine emits 2.0.
    expect(metadataVersion).toBe('2.0');
    expect(editorMetadata.metadata_version).toBe('2.0');
  });

  it('exposes the full structural rule catalog (22 rules)', () => {
    expect(editorMetadata.catalog.rules.length).toBe(22);
    // Every rule entry is named (the catalog/docs join key, metadata-contract §2).
    for (const rule of editorMetadata.catalog.rules) {
      expect(typeof rule.name).toBe('string');
    }
  });

  it('splits the structural catalog from the examples/docs payload (NFR-047)', () => {
    // Both halves present and keyed identically (rules/operators/functions).
    expect(editorMetadata.catalog).toBeDefined();
    expect(editorMetadata.docs).toBeDefined();
    expect(Object.keys(editorMetadata.catalog).sort()).toEqual([
      'functions',
      'operators',
      'rules',
    ]);
    expect(Object.keys(editorMetadata.docs).sort()).toEqual([
      'functions',
      'operators',
      'rules',
    ]);
    // The split must be by-name-joinable: catalog and docs cover the same rule set.
    const catalogNames = editorMetadata.catalog.rules.map((r) => r.name).sort();
    const docsNames = editorMetadata.docs.rules.map((r) => r.name).sort();
    expect(catalogNames).toEqual(docsNames);
  });
});
