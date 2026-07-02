// Shared collector for the §15.8 "examples from engine metadata" sweeps.
//
// Since engine metadata 3.0 (metadata-contract §2.7 v2.1) the docs payload is normalized:
// `docs.examples` is the flat corpus (every tagged engine case serialized exactly once) and the
// entry-level `examples` fields plus the curated tiers are ordered `name` references into it.
// The sweeps therefore iterate the corpus directly — each distinct template exactly once (121 at
// engine v0.1.5, up from 89 distinct among the 147 pre-3.0 inlined copies: the curated
// worked-example/recipe templates are now covered too). The owning rule/operator/function label
// is resolved from the engine-emitted reference lists (the engine-owned join) for stable,
// readable test names.
import type { CatalogEntry, Json } from '@transon/editor-core';
import { editorMetadata } from '@transon/editor-core';

/**
 * Corpus-size ratchet for the §15.8 sweeps: the flat corpus holds 121 cases at the pinned engine
 * v0.1.6. A sweep asserting `>= CORPUS_FLOOR` trips if a snapshot regeneration or engine change
 * silently truncates the corpus (the sweeps iterate whatever is present, so without a floor they
 * would pass near-vacuously). Bump deliberately when a re-pin grows the corpus.
 */
export const CORPUS_FLOOR = 121;

export interface DocsExample {
  /** Owning rule/operator/function (first engine reference), or the curated tier, or `corpus`. */
  source: string;
  name: string;
  template: Json;
  data: Json;
}

/** Every flat-corpus case exactly once, labeled by its first engine-emitted owner. */
export function collectDocsExamples(): DocsExample[] {
  const sourceByName = new Map<string, string>();
  const claim = (names: unknown, source: string) => {
    if (!Array.isArray(names)) return;
    for (const name of names) {
      if (typeof name === 'string' && !sourceByName.has(name)) sourceByName.set(name, source);
    }
  };
  for (const family of ['rules', 'operators', 'functions'] as const) {
    for (const entry of editorMetadata.docs[family]) {
      claim((entry as CatalogEntry).examples, entry.name);
    }
  }
  claim(editorMetadata.docs.worked_examples, 'worked-example');
  claim(editorMetadata.docs.recipes, 'recipe');

  return editorMetadata.docs.examples.map((example) => ({
    source: sourceByName.get(example.name) ?? 'corpus',
    name: example.name,
    template: example.template,
    data: example.data,
  }));
}
