// D1 — configurable rule categories (FR-109): filterToolbox hides / reorders the committed §12.4
// categoryToolbox by category display name, over a copy (never mutating the artifact), and reports
// unknown names rather than silently dropping them.
import { describe, it, expect, vi } from 'vitest';
import { getTransonToolbox } from '@transon/editor-blockly';
import { filterToolbox } from '../src/blockly/toolbox.js';

interface CatToolbox {
  kind: string;
  contents: Array<{ kind: string; name?: string }>;
}
const names = (tb: unknown): string[] =>
  (tb as CatToolbox).contents.map((c) => c.name!).filter(Boolean);

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
