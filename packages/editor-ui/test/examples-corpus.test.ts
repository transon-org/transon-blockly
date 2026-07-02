// D2 — build the example corpus from the committed docs metadata (FR-079, AC-018). The editor loads
// examples from the engine's flat example corpus (docs.examples, metadata-contract §2.7 v2.1), each
// carrying template + sample input + expected result for actual-vs-expected display (AC-019).
import { describe, it, expect } from 'vitest';
import { editorMetadata } from '@transon/editor-core';
import { buildExampleCorpus } from '../src/session/examples.js';

describe('buildExampleCorpus (FR-079, AC-018)', () => {
  const corpus = buildExampleCorpus();

  it('maps the flat engine corpus 1:1 into ExampleCase[] (no dedupe needed, §2.7)', () => {
    // The engine serializes every case exactly once; the builder is a direct map.
    expect(corpus.length).toBe(editorMetadata.docs.examples.length);
    // Anti-truncation ratchet (121 at the pinned engine v0.1.6) — a shrunken corpus must trip.
    expect(corpus.length).toBeGreaterThanOrEqual(121);
    for (const e of corpus) {
      expect(typeof e.name).toBe('string');
      expect(e.template).toBeDefined();
    }
  });

  it('carries sample input + expected result for actual-vs-expected (AC-019)', () => {
    const withResult = corpus.filter((e) => e.result !== undefined);
    expect(withResult.length).toBeGreaterThan(0);
    const expr = corpus.find((e) => e.rule === 'expr');
    expect(expr).toBeTruthy();
    expect(expr!.template).toBeTypeOf('object');
  });

  it('attaches the owning rule from engine name references and engine corpus tags', () => {
    // Ownership comes from docs.rules[*].examples (engine-owned join), tags from the corpus.
    const owned = corpus.filter((e) => e.rule);
    expect(owned.length).toBeGreaterThan(0);
    const ruleNames = new Set(editorMetadata.docs.rules.map((r) => r.name));
    for (const e of owned) {
      expect(ruleNames.has(e.rule!)).toBe(true);
    }
    for (const e of corpus) {
      expect(Array.isArray(e.tags)).toBe(true);
      expect(e.tags!.length).toBeGreaterThan(0);
    }
  });

  it('includes the curated tiers (worked examples + recipes) in the corpus', () => {
    const names = new Set(corpus.map((e) => e.name));
    for (const name of [
      ...editorMetadata.docs.worked_examples,
      ...editorMetadata.docs.recipes,
    ]) {
      expect(names.has(name)).toBe(true);
    }
  });

  it('resolves tier membership from the engine reference lists, never tag conventions (§2.7)', () => {
    const tierOf = new Map(corpus.map((e) => [e.name, e.tier]));
    for (const name of editorMetadata.docs.worked_examples) {
      expect(tierOf.get(name)).toBe('worked-example');
    }
    for (const name of editorMetadata.docs.recipes) {
      expect(tierOf.get(name)).toBe('recipe');
    }
    const curated = new Set([
      ...editorMetadata.docs.worked_examples,
      ...editorMetadata.docs.recipes,
    ]);
    for (const e of corpus) {
      if (!curated.has(e.name)) expect(e.tier).toBeUndefined();
    }
  });

  it('example names are unique (usable as a selection key)', () => {
    const names = corpus.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
