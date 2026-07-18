// The typed metadata-snapshot loader exposes the pinned, engine-owned export.
//   AD-012  — engine-owned, versioned editor-metadata export, consumed by the editor.
//   NFR-047 — split structural catalog / examples-docs payload.
import { describe, it, expect } from 'vitest';
import { editorMetadata, metadataVersion } from '../src/index.js';

describe('metadata snapshot loader (AD-012, NFR-047)', () => {
  it('exposes metadata_version "3.0" as a stable string token', () => {
    // AD-012: the schema version gate compares a string token; the engine emits 3.0
    // (normalized example corpus, metadata-contract §2.7 v2.1).
    expect(metadataVersion).toBe('3.0');
    expect(editorMetadata.metadata_version).toBe('3.0');
  });

  it('exposes the full structural rule catalog (23 rules)', () => {
    expect(editorMetadata.catalog.rules.length).toBe(23);
    // Every rule entry is named (the catalog/docs join key, metadata-contract §2).
    for (const rule of editorMetadata.catalog.rules) {
      expect(typeof rule.name).toBe('string');
    }
  });

  it('splits the structural catalog from the examples/docs payload (NFR-047)', () => {
    // Both halves present; docs additionally carries the flat corpus + curated tiers (§2.7).
    expect(editorMetadata.catalog).toBeDefined();
    expect(editorMetadata.docs).toBeDefined();
    expect(Object.keys(editorMetadata.catalog).sort()).toEqual([
      'functions',
      'operators',
      'rules',
    ]);
    expect(Object.keys(editorMetadata.docs).sort()).toEqual([
      'examples',
      'functions',
      'operators',
      'recipes',
      'rules',
      'worked_examples',
    ]);
    // The split must be by-name-joinable: catalog and docs cover the same rule set.
    const catalogNames = editorMetadata.catalog.rules.map((r) => r.name).sort();
    const docsNames = editorMetadata.docs.rules.map((r) => r.name).sort();
    expect(catalogNames).toEqual(docsNames);
  });

  it('normalizes examples: flat corpus + resolvable name references (§2.7 v2.1)', () => {
    const corpus = editorMetadata.docs.examples;
    expect(corpus.length).toBeGreaterThan(0);
    // Every case appears exactly once — names are the unique join key.
    const names = new Set(corpus.map((e) => e.name));
    expect(names.size).toBe(corpus.length);
    // Every reference list resolves into the corpus (entry-level + curated tiers).
    const referenceLists: unknown[][] = [
      editorMetadata.docs.worked_examples,
      editorMetadata.docs.recipes,
    ];
    for (const family of ['rules', 'operators', 'functions'] as const) {
      for (const entry of editorMetadata.docs[family]) {
        referenceLists.push((entry.examples as unknown[]) ?? []);
      }
    }
    for (const list of referenceLists) {
      for (const name of list) {
        expect(typeof name).toBe('string');
        expect(names.has(name as string)).toBe(true);
      }
    }
  });
});
