// D1 — configurable rule categories (FR-109): filterToolbox hides / reorders the committed §12.4
// categoryToolbox by category display name, over a copy (never mutating the artifact), and reports
// unknown names rather than silently dropping them.
import { describe, it, expect, vi } from 'vitest';
import { getTransonToolbox } from '@transon/editor-blockly';
import { filterToolbox, progressiveToolbox, flattenToolbox } from '../src/blockly/toolbox.js';

interface CatToolbox {
  kind: string;
  contents: Array<{ kind: string; name?: string; contents?: Array<{ kind: string; type?: string }> }>;
}
const names = (tb: unknown): string[] =>
  (tb as CatToolbox).contents.map((c) => c.name!).filter(Boolean);
const blockTypes = (tb: unknown): string[] =>
  (tb as CatToolbox).contents.flatMap((c) =>
    (c.contents ?? []).filter((b) => b.kind === 'block').map((b) => b.type!),
  );

describe('filterToolbox (FR-109)', () => {
  it('returns the toolbox unchanged when no config is given', () => {
    const tb = getTransonToolbox();
    expect(filterToolbox(tb, undefined)).toBe(tb);
    expect(filterToolbox(tb, {})).toBe(tb);
  });

  it('hides the named categories (and does not mutate the source)', () => {
    const tb = getTransonToolbox();
    const before = names(tb);
    expect(before).toContain('Variables');
    expect(before).toContain('Includes');

    const filtered = filterToolbox(tb, { hidden: ['Variables', 'Includes'] });
    const after = names(filtered);
    expect(after).not.toContain('Variables');
    expect(after).not.toContain('Includes');
    expect(after.length).toBe(before.length - 2);
    // source artifact untouched
    expect(names(getTransonToolbox())).toEqual(before);
  });

  it('reorders the listed categories to the front, keeping the rest in original order', () => {
    const tb = getTransonToolbox();
    const original = names(tb);
    const filtered = names(filterToolbox(tb, { order: ['Literals', 'Custom'] }));
    expect(filtered[0]).toBe('Literals');
    expect(filtered[1]).toBe('Custom');
    // the unlisted categories keep their original relative order after the listed ones
    const rest = filtered.slice(2);
    const restOriginalOrder = original.filter((n) => n !== 'Literals' && n !== 'Custom');
    expect(rest).toEqual(restOriginalOrder);
  });

  it('reports unknown category names to onUnknown (not silently dropped)', () => {
    const onUnknown = vi.fn();
    filterToolbox(getTransonToolbox(), { hidden: ['Nope'], order: ['AlsoNope', 'Custom'] }, onUnknown);
    expect(onUnknown).toHaveBeenCalledTimes(1);
    expect(onUnknown).toHaveBeenCalledWith(expect.arrayContaining(['Nope', 'AlsoNope']));
    expect(onUnknown.mock.calls[0]![0]).not.toContain('Custom'); // known → not reported
  });
});

// §12.6 progressive disclosure — advanced blocks hidden by default (data-driven from PRESENTATION).
const ADVANCED_TYPES = [
  'transon_rule_parent__base',
  'transon_rule_set__base',
  'transon_rule_get__base',
  'transon_rule_include__base',
];

describe('progressiveToolbox (§12.6)', () => {
  it('hides advanced blocks by default and drops fully-advanced categories', () => {
    const tb = progressiveToolbox(getTransonToolbox(), {});
    const types = blockTypes(tb);
    for (const t of ADVANCED_TYPES) expect(types).not.toContain(t);
    // non-advanced blocks stay
    expect(types).toContain('transon_rule_attr__name');
    // 'Variables' holds only set/get (both advanced) → emptied → dropped
    expect(names(tb)).not.toContain('Variables');
    // 'Input / Context' keeps its non-advanced blocks though `parent` is hidden
    expect(names(tb)).toContain('Input / Context');
    expect(types).toContain('transon_rule_this__base');
  });

  it('shows advanced blocks when showAdvanced is true (nothing hidden)', () => {
    const tb = progressiveToolbox(getTransonToolbox(), { showAdvanced: true });
    const types = blockTypes(tb);
    for (const t of ADVANCED_TYPES) expect(types).toContain(t);
    expect(names(tb)).toContain('Variables');
    expect(tb).toBe(getTransonToolbox()); // no work → returns the original
  });

  it('filters blocks by a search term (and drops emptied categories)', () => {
    const tb = progressiveToolbox(getTransonToolbox(), { showAdvanced: true, search: 'attr' });
    const types = blockTypes(tb);
    expect(types.every((t) => t.includes('attr'))).toBe(true);
    expect(types).toContain('transon_rule_attr__name');
    expect(types).not.toContain('transon_rule_this__base');
  });
});

describe('flattenToolbox (§12.6 palette presentation)', () => {
  it('converts the categoryToolbox into a flyoutToolbox with divider labels in §12.4 order', () => {
    const tb = getTransonToolbox();
    const flat = flattenToolbox(tb) as {
      kind: string;
      contents: Array<{ kind: string; text?: string; type?: string }>;
    };
    expect(flat.kind).toBe('flyoutToolbox');

    // Every §12.4 category becomes a divider label, in the committed order.
    const labels = flat.contents.filter((c) => c.kind === 'label').map((c) => c.text);
    expect(labels).toEqual(names(tb));

    // Every block of every category survives, in category order.
    const flatBlocks = flat.contents.filter((c) => c.kind === 'block').map((c) => c.type);
    expect(flatBlocks).toEqual(blockTypes(tb));

    // No category items remain — the flyout definition must be flat.
    expect(flat.contents.some((c) => c.kind === 'category')).toBe(false);

    // Pure view: the committed artifact is untouched (AD-030/FR-127).
    expect((getTransonToolbox() as CatToolbox).contents.some((c) => c.kind === 'category')).toBe(
      true,
    );
  });

  it('composes after the §12.6 filters: emptied categories contribute no orphan label', () => {
    // 'attr' search keeps only attribute blocks → exactly one divider label survives.
    const flat = flattenToolbox(
      progressiveToolbox(getTransonToolbox(), { showAdvanced: true, search: 'attr' }),
    ) as { contents: Array<{ kind: string; text?: string }> };
    const labels = flat.contents.filter((c) => c.kind === 'label');
    expect(labels.length).toBe(1);
  });
});
