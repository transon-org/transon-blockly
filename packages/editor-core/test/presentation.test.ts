// FR-127 / NFR-048 — the editor-owned presentation projection-data is complete and consistent.
//
// The committed presentation.json (metadata-contract §2.9) is the SINGLE source for per-rule
// title/category/advanced + the toolbox category order + the category→colour map, consumed by
// the G_palette/G_toolbox projections. FR-127 requires a completeness check: every metadata
// rule must have a presentation entry (loud failure), and every rule's category must be a
// declared, coloured category. The source-scan half of FR-127 (no category/colour/presentation
// TS literals under packages/*/src) is the deterministic gate `check_presentation.py`.
import { describe, expect, it } from 'vitest';
import { editorMetadata, PRESENTATION } from '../src/index.js';

// The canonical category set (SPEC §12.4). This list is the SPEC contract the data must cover;
// it is a test-only assertion fixture, not a projection input (the projections read only
// PRESENTATION), so it does not violate the FR-127 "no category literals in src" scan.
const SPEC_12_4_CATEGORIES = [
  'Input / Context',
  'Variables',
  'Data Access',
  'Objects / Arrays',
  'Iteration',
  'Composition',
  'Computation',
  'Control Flow',
  'Formatting',
  'Side Effects',
  'Includes',
  'Literals',
  'Custom',
];

describe('presentation projection-data (FR-127, NFR-048, §2.9)', () => {
  it('every metadata rule has a presentation entry (FR-127 completeness)', () => {
    const ruleNames = editorMetadata.catalog.rules.map((r) => r.name);
    const missing = ruleNames.filter((name) => !(name in PRESENTATION.rules));
    expect(missing, `rules missing a presentation entry: ${missing.join(', ')}`).toEqual([]);
  });

  it('every presentation entry has a non-empty title and a declared category', () => {
    for (const [name, p] of Object.entries(PRESENTATION.rules)) {
      expect(p.title, `rule '${name}' title`).toBeTruthy();
      expect(typeof p.advanced, `rule '${name}' advanced`).toBe('boolean');
      expect(
        PRESENTATION.categoryOrder,
        `rule '${name}' category '${p.category}' not in categoryOrder`,
      ).toContain(p.category);
    }
  });

  it('categoryOrder is exactly the SPEC §12.4 category set (NFR-048 single source)', () => {
    expect([...PRESENTATION.categoryOrder].sort()).toEqual([...SPEC_12_4_CATEGORIES].sort());
  });

  it('every ordered category has a colour, and colours declare no extra categories (NFR-048)', () => {
    const ordered = [...PRESENTATION.categoryOrder].sort();
    const coloured = Object.keys(PRESENTATION.categoryColour).sort();
    expect(coloured).toEqual(ordered);
    for (const [cat, colour] of Object.entries(PRESENTATION.categoryColour)) {
      // Zelos accepts a hue number (0–360) or a hex string.
      const ok = typeof colour === 'string' || (typeof colour === 'number' && colour >= 0 && colour <= 360);
      expect(ok, `category '${cat}' colour ${String(colour)} is not a hue (0–360) or hex`).toBe(true);
    }
  });

  it('structuralBlocks categories are declared, and never list transon_unsupported (§13.11)', () => {
    for (const [cat, types] of Object.entries(PRESENTATION.structuralBlocks)) {
      expect(PRESENTATION.categoryOrder, `structuralBlocks category '${cat}'`).toContain(cat);
      expect(types, `structuralBlocks['${cat}']`).not.toContain('transon_unsupported');
    }
  });

  it('the §12.6 advanced set is flagged advanced', () => {
    // SPEC §12.6: set, get, parent, zip, file, include are advanced (progressive disclosure).
    for (const name of ['set', 'get', 'parent', 'zip', 'file', 'include']) {
      expect(PRESENTATION.rules[name]?.advanced, `rule '${name}' should be advanced (§12.6)`).toBe(true);
    }
  });
});
