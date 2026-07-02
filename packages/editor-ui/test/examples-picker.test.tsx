// FR-132 — tiered, grouped, doc-labeled Examples picker. The corpus is ordered curated-first
// (worked examples, then recipes, each in the engine reference-list order, metadata-contract §2.7);
// the panel renders tier/rule optgroups and labels each entry by the first sentence of its engine
// doc, keeping the unique case name as the selection value. All derivation is mechanical over the
// engine-emitted corpus data (AD-012) — no hand-maintained editor-side list.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { editorMetadata } from '@transon/editor-core';
import type { EditorMetadata } from '@transon/editor-core';
import { buildExampleCorpus } from '../src/session/examples.js';
import { ExamplesPanel } from '../src/components/panels.js';
import type { ExampleCase } from '../src/session/host.js';

// Adversarial fixture for the §2.7 join rule: tier membership must come from the
// worked_examples/recipes NAME-REFERENCE lists, never from tag conventions — so `Worked1`
// carries no tier tag at all, and `Orphan` carries a misleading 'worked-example' tag while
// being referenced by neither list. Rule ownership likewise: `RefC` is referenced only at
// the parameter level (docs.rules[*].params[*].examples) and must still group under `attr`.
const fakeMetadata = {
  docs: {
    examples: [
      { name: 'RefB', doc: 'Second reference case.\nMore prose.', template: 1, data: null, result: 1, tags: ['attr'] },
      { name: 'Worked1', doc: '**Reshape records.**\n\nLong tail.', template: 1, data: null, result: 1, tags: [] },
      { name: 'RefA', doc: 'Filters a list, keeping odd items. Extra sentence.', template: 1, data: null, result: 1, tags: ['map'] },
      { name: 'Recipe1', doc: 'Swap keys and values.', template: 1, data: null, result: 1, tags: ['recipe'] },
      { name: 'RefC', doc: 'Param-level case.', template: 1, data: null, result: 1, tags: ['attr:name'] },
      { name: 'Orphan', doc: null, template: 1, data: null, result: 1, tags: ['worked-example'] },
    ],
    rules: [
      { name: 'map', examples: ['RefA'] },
      { name: 'attr', examples: ['RefB'], params: [{ name: 'name', examples: ['RefC'] }] },
    ],
    operators: [],
    functions: [],
    worked_examples: ['Worked1'],
    recipes: ['Recipe1'],
  },
} as unknown as EditorMetadata;

describe('buildExampleCorpus tier ordering (FR-132)', () => {
  it('orders curated tiers first, in engine reference-list order, then the reference corpus', () => {
    const corpus = buildExampleCorpus(fakeMetadata);
    expect(corpus.map((e) => e.name)).toEqual(['Worked1', 'Recipe1', 'RefB', 'RefA', 'RefC', 'Orphan']);
  });

  it('tier membership joins on the reference lists, never on tag conventions (§2.7)', () => {
    const byName = new Map(buildExampleCorpus(fakeMetadata).map((e) => [e.name, e]));
    expect(byName.get('Worked1')!.tier).toBe('worked-example'); // referenced, no tag needed
    expect(byName.get('Recipe1')!.tier).toBe('recipe');
    expect(byName.get('Orphan')!.tier).toBeUndefined(); // misleading tag must not promote it
  });

  it('rule ownership falls back to parameter-level engine references', () => {
    const byName = new Map(buildExampleCorpus(fakeMetadata).map((e) => [e.name, e]));
    expect(byName.get('RefC')!.rule).toBe('attr');
  });

  it('orders the real pinned corpus by the engine worked_examples + recipes lists', () => {
    const corpus = buildExampleCorpus();
    const worked = editorMetadata.docs.worked_examples;
    const recipes = editorMetadata.docs.recipes;
    expect(corpus.slice(0, worked.length).map((e) => e.name)).toEqual(worked);
    expect(corpus.slice(worked.length, worked.length + recipes.length).map((e) => e.name)).toEqual(recipes);
    expect(corpus.length).toBe(editorMetadata.docs.examples.length);
  });
});

describe('ExamplesPanel tiered rendering (FR-132)', () => {
  const cases: ExampleCase[] = buildExampleCorpus(fakeMetadata);

  it('renders curated tiers and per-rule reference optgroups, in order', () => {
    const { container } = render(
      <ExamplesPanel examples={cases} selected={null} onSelect={vi.fn()} onReset={vi.fn()} />,
    );
    const groups = Array.from(container.querySelectorAll('optgroup')).map((g) => g.label);
    expect(groups).toEqual(['Worked examples', 'Recipes', 'Reference · attr', 'Reference · map', 'Reference · other']);
    // RefC groups under attr via its param-level reference; the mistagged Orphan stays in other.
    const byGroup = new Map(
      Array.from(container.querySelectorAll('optgroup')).map((g) => [
        g.label,
        Array.from(g.querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value),
      ]),
    );
    expect(byGroup.get('Reference · attr')).toEqual(['RefB', 'RefC']);
    expect(byGroup.get('Reference · other')).toEqual(['Orphan']);
  });

  it('labels options by the first doc sentence, keeps the case name as value + tooltip', () => {
    const { container } = render(
      <ExamplesPanel examples={cases} selected={null} onSelect={vi.fn()} onReset={vi.fn()} />,
    );
    const options = Array.from(container.querySelectorAll('option[value]'))
      .filter((o) => (o as HTMLOptionElement).value !== '') as HTMLOptionElement[];
    const byValue = new Map(options.map((o) => [o.value, o]));
    expect(byValue.get('Worked1')!.textContent).toBe('Reshape records');
    expect(byValue.get('RefA')!.textContent).toBe('Filters a list, keeping odd items');
    // No doc → the case name is the label.
    expect(byValue.get('Orphan')!.textContent).toBe('Orphan');
    for (const o of options) expect(o.title).toBe(o.value);
  });

  it('selection semantics are unchanged: value is the unique case name (AC-018)', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ExamplesPanel examples={cases} selected={null} onSelect={onSelect} onReset={vi.fn()} />,
    );
    const select = container.querySelector('select')!;
    select.value = 'Recipe1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'Recipe1' }));
  });

  it('host-supplied corpora without tags/rules fall into the reference tier mechanically', () => {
    const host: ExampleCase[] = [
      { name: 'HostCase', doc: 'Host example. Detail.', template: {} },
    ];
    const { container } = render(
      <ExamplesPanel examples={host} selected={null} onSelect={vi.fn()} onReset={vi.fn()} />,
    );
    const groups = Array.from(container.querySelectorAll('optgroup')).map((g) => g.label);
    expect(groups).toEqual(['Reference · other']);
    const option = container.querySelector('option[value="HostCase"]') as HTMLOptionElement;
    expect(option.textContent).toBe('Host example');
  });
});
