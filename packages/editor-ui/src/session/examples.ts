// Example corpus loader (FR-079, FR-009, AC-018/019). Reads the committed engine docs payload's
// flat example corpus — `docs.examples` (metadata-contract §2.7 v2.1, bundled at build time,
// OQ-003) — into the `ExampleCase[]` the Examples panel consumes. Each example carries the Transon
// template plus its sample input (`data`) and expected output (`result`) for actual-vs-expected
// display (§12.9, AC-019). Pure data over the metadata snapshot (AD-012); an embedder may override
// with `host.examples`.

import { editorMetadata } from '@transon/editor-core';
import type { EditorMetadata, Json } from '@transon/editor-core';
import type { ExampleCase } from './host.js';

/**
 * Build the built-in example corpus from the committed metadata docs. The engine corpus serializes
 * every case exactly once with a unique `name` (metadata-contract §2.7), so this is a direct map —
 * no content-hash dedupe. The owning rule is taken from the engine-emitted `docs.rules[*].examples`
 * name references, falling back to the rule's parameter-level `params[*].examples` references (the
 * engine-owned tag join; never re-derived from tag conventions), and `tags` are the engine's corpus
 * tags. Curated-tier membership (`tier`) is resolved from the `docs.worked_examples`/`docs.recipes`
 * reference lists — the same lists that drive the curated-first ordering (FR-132): worked examples
 * then recipes, each in list order, then the rest of the corpus in emitted order. Defaults to the
 * pinned snapshot; pass `metadata` to build from an alternate (e.g. host-provided) payload.
 */
export function buildExampleCorpus(metadata: EditorMetadata = editorMetadata): ExampleCase[] {
  const ruleByExample = new Map<string, string>();
  const claim = (names: unknown, rule: string) => {
    if (!Array.isArray(names)) return;
    for (const name of names) {
      if (typeof name === 'string' && !ruleByExample.has(name)) ruleByExample.set(name, rule);
    }
  };
  for (const entry of metadata.docs.rules) claim(entry.examples, entry.name);
  for (const entry of metadata.docs.rules) {
    for (const param of (entry.params as Array<Record<string, unknown>> | undefined) ?? []) {
      claim(param.examples, entry.name);
    }
  }

  const tierByExample = new Map<string, 'worked-example' | 'recipe'>();
  for (const name of metadata.docs.worked_examples ?? []) tierByExample.set(name, 'worked-example');
  for (const name of metadata.docs.recipes ?? []) {
    if (!tierByExample.has(name)) tierByExample.set(name, 'recipe');
  }

  const corpus = metadata.docs.examples ?? [];
  const byName = new Map(corpus.map((example) => [example.name, example]));
  const curated = [...(metadata.docs.worked_examples ?? []), ...(metadata.docs.recipes ?? [])]
    .map((name) => byName.get(name))
    .filter((example) => example !== undefined);
  const curatedNames = new Set(curated.map((example) => example.name));
  const ordered = [...curated, ...corpus.filter((example) => !curatedNames.has(example.name))];

  return ordered.map((example) => ({
    name: example.name,
    doc: example.doc ?? undefined,
    template: example.template as Json,
    data: example.data,
    result: example.result,
    rule: ruleByExample.get(example.name),
    tier: tierByExample.get(example.name),
    tags: example.tags,
  }));
}
