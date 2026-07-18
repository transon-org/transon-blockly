// FR-132 — tiered, grouped, doc-labeled Examples picker. The corpus is ordered curated-first
// (worked examples, then recipes, each in the engine reference-list order, metadata-contract §2.7);
// the panel renders tier/rule optgroups and labels each entry by the first sentence of its engine
// doc, keeping the unique case name as the selection value. All derivation is mechanical over the
// engine-emitted corpus data (AD-012) — no hand-maintained editor-side list.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { editorMetadata } from '@transon/editor-core';
import type { EditorMetadata } from '@transon/editor-core';
import { buildExampleCorpus, buildExampleCorpusFromDocs } from '../src/session/examples.js';
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

  it('a corpus with no tier/rule membership at all renders flat — no fabricated "other" group', () => {
    // FR-132 (v2.8 degradation): e.g. a host `examples` override built without the engine
    // reference lists. The old behavior — one "Reference · other" optgroup over everything —
    // read as "uncategorised" in an embed; a group-less corpus must render group-less.
    const host: ExampleCase[] = [
      { name: 'HostCase', doc: 'Host example. Detail.', template: {} },
      { name: 'HostCase2', doc: 'Second host example.', template: {} },
    ];
    const { container } = render(
      <ExamplesPanel examples={host} selected={null} onSelect={vi.fn()} onReset={vi.fn()} />,
    );
    expect(container.querySelectorAll('optgroup').length).toBe(0);
    const options = Array.from(container.querySelectorAll('option[value]'))
      .filter((o) => (o as HTMLOptionElement).value !== '') as HTMLOptionElement[];
    expect(options.map((o) => o.value)).toEqual(['HostCase', 'HostCase2']);
    expect(options[0]!.textContent).toBe('Host example');
    for (const o of options) expect(o.title).toBe(o.value);
  });

  it('a partially categorised corpus keeps the "Reference · other" group for the rule-less tail', () => {
    const mixed: ExampleCase[] = [
      { name: 'Ruled', doc: 'Ruled case.', template: {}, rule: 'attr' },
      { name: 'RuleLess', doc: 'Rule-less case.', template: {} },
    ];
    const { container } = render(
      <ExamplesPanel examples={mixed} selected={null} onSelect={vi.fn()} onReset={vi.fn()} />,
    );
    const groups = Array.from(container.querySelectorAll('optgroup')).map((g) => g.label);
    expect(groups).toEqual(['Reference · attr', 'Reference · other']);
  });

  it('colliding labels within a group are disambiguated by the unique case name', () => {
    // FR-132 (v2.8 disambiguation): the engine guarantees unique NAMES, not unique doc first
    // sentences — the pinned corpus already renders identical labels inside three rule groups.
    const host: ExampleCase[] = [
      { name: 'suffix_str', doc: 'Adds suffix to input string. Via format.', template: {} },
      { name: 'suffix_expr', doc: 'Adds suffix to input string. Via expr.', template: {} },
      { name: 'unrelated', doc: 'Stands alone.', template: {} },
    ];
    const { container } = render(
      <ExamplesPanel examples={host} selected={null} onSelect={vi.fn()} onReset={vi.fn()} />,
    );
    const byValue = new Map(
      (Array.from(container.querySelectorAll('option[value]')) as HTMLOptionElement[])
        .filter((o) => o.value !== '')
        .map((o) => [o.value, o.textContent]),
    );
    expect(byValue.get('suffix_str')).toBe('Adds suffix to input string — suffix_str');
    expect(byValue.get('suffix_expr')).toBe('Adds suffix to input string — suffix_expr');
    expect(byValue.get('unrelated')).toBe('Stands alone'); // no collision → no suffix
  });

  it('disambiguation is scoped per group: the same label in two different groups stays bare', () => {
    const cases2: ExampleCase[] = [
      { name: 'a1', doc: 'Same sentence.', template: {}, rule: 'attr' },
      { name: 'm1', doc: 'Same sentence.', template: {}, rule: 'map' },
    ];
    const { container } = render(
      <ExamplesPanel examples={cases2} selected={null} onSelect={vi.fn()} onReset={vi.fn()} />,
    );
    const texts = (Array.from(container.querySelectorAll('option[value]')) as HTMLOptionElement[])
      .filter((o) => o.value !== '')
      .map((o) => o.textContent);
    expect(texts).toEqual(['Same sentence', 'Same sentence']);
  });
});

describe('buildExampleCorpusFromDocs (FR-132) — the embedder seam', () => {
  it('derives the same tier/rule joins as buildExampleCorpus from a bare docs payload', () => {
    // The shape an embedder holds (e.g. the engine get_all_docs() payload) — no catalog wrapper.
    const corpus = buildExampleCorpusFromDocs(fakeMetadata.docs);
    expect(corpus).toEqual(buildExampleCorpus(fakeMetadata));
    const byName = new Map(corpus.map((e) => [e.name, e]));
    expect(byName.get('Worked1')!.tier).toBe('worked-example');
    expect(byName.get('RefC')!.rule).toBe('attr');
  });
});
