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

// FR-130 — curated dropdown menus for constant parameters. Every declared curation is validated
// against the parameter's metadata `options` domain (never a hand-written token list): pairwise
// disjoint, jointly covers the full domain, and the curated menu is strictly shorter (the UAT
// point — one entry per symbol/word-alias pair collapses two tokens into one menu item).
describe('dropdown-menu curation (FR-130, metadata-contract §2.9)', () => {
  const optionsOf = (rule: string, param: string): string[] => {
    const r = editorMetadata.catalog.rules.find((e) => e.name === rule);
    const p = (r?.params as Array<{ name: string; options?: string[] }> | undefined)?.find(
      (x) => x.name === param,
    );
    return p?.options ?? [];
  };

  it('declares a curated menu for expr.op', () => {
    expect(PRESENTATION.dropdownMenus.expr?.op).toBeTruthy();
  });

  it('every declared rule/param exists in the metadata and is a constant param with options', () => {
    for (const [rule, params] of Object.entries(PRESENTATION.dropdownMenus)) {
      const entry = editorMetadata.catalog.rules.find((r) => r.name === rule);
      expect(entry, `dropdownMenus rule '${rule}' not in metadata`).toBeTruthy();
      for (const paramName of Object.keys(params)) {
        const options = optionsOf(rule, paramName);
        expect(options.length, `${rule}.${paramName} has no metadata options domain`).toBeGreaterThan(0);
      }
    }
  });

  it('every curated value/alias belongs to the options domain, and no token appears twice', () => {
    for (const [rule, params] of Object.entries(PRESENTATION.dropdownMenus)) {
      for (const [paramName, menu] of Object.entries(params)) {
        const domain = new Set(optionsOf(rule, paramName));
        const seen = new Set<string>();
        for (const entry of menu) {
          expect(entry.value, `${rule}.${paramName} entry value non-empty`).toBeTruthy();
          expect(entry.label, `${rule}.${paramName} entry '${entry.value}' label non-empty`).toBeTruthy();
          const tokens = [entry.value, ...(entry.aliases ?? [])];
          for (const t of tokens) {
            expect(domain.has(t), `${rule}.${paramName} token '${t}' not in metadata options`).toBe(true);
            expect(seen.has(t), `${rule}.${paramName} token '${t}' appears in two entries`).toBe(false);
            seen.add(t);
          }
        }
      }
    }
  });

  it('the curated menu jointly covers the full metadata options domain', () => {
    for (const [rule, params] of Object.entries(PRESENTATION.dropdownMenus)) {
      for (const [paramName, menu] of Object.entries(params)) {
        const domain = optionsOf(rule, paramName);
        const covered = new Set(menu.flatMap((e) => [e.value, ...(e.aliases ?? [])]));
        const missing = domain.filter((t) => !covered.has(t));
        expect(missing, `${rule}.${paramName} uncovered metadata tokens`).toEqual([]);
      }
    }
  });

  it('the curated menu is strictly shorter than the full domain (the UAT collapse point)', () => {
    for (const [rule, params] of Object.entries(PRESENTATION.dropdownMenus)) {
      for (const [paramName, menu] of Object.entries(params)) {
        const domain = optionsOf(rule, paramName);
        expect(menu.length, `${rule}.${paramName} menu should curate (be shorter than domain)`).toBeLessThan(
          domain.length,
        );
      }
    }
  });

  it('expr.op curates the 29-token domain into 15 symbol-first entries', () => {
    const domain = optionsOf('expr', 'op');
    expect(domain.length).toBe(29);
    const menu = PRESENTATION.dropdownMenus.expr!.op!;
    expect(menu.length).toBe(15);
    // canonical spelling = symbol (matches the metadata's symbol-first pair order). `in`
    // (engine 0.1.8) is the one operator whose symbol IS the word — same token for both
    // spellings, so it carries no alias (menuFor rejects a token claimed twice).
    for (const entry of menu) {
      if (entry.value === 'in') continue;
      expect(/^[^a-zA-Z]/.test(entry.value), `${entry.value} should be a symbol token`).toBe(true);
    }
    expect(menu.some((e) => e.value === 'in')).toBe(true);
  });
});

// §12.5 (OQ-018) / metadata-contract §2.9 — optional short display labels for long parameter
// names, keyed by rule then param. Display-only: substitutes the metadata name on a multi-input
// socket row; the codec field/input key is untouched (proven at the codec layer in
// test/engine-node-adapter/test/codec/palette.test.ts — this file only proves the presentation
// DATA is well-formed against the metadata catalog).
describe('short param display labels (§12.5, OQ-018, metadata-contract §2.9)', () => {
  it('declares a short label for attr.default', () => {
    expect(PRESENTATION.paramLabels.attr?.default).toBe('fallback');
  });

  it('every declared rule/param exists in the metadata catalog', () => {
    for (const [rule, labels] of Object.entries(PRESENTATION.paramLabels)) {
      const entry = editorMetadata.catalog.rules.find((r) => r.name === rule);
      expect(entry, `paramLabels rule '${rule}' not in metadata`).toBeTruthy();
      const paramNames = new Set((entry?.params as Array<{ name: string }> | undefined)?.map((p) => p.name));
      for (const paramName of Object.keys(labels)) {
        expect(paramNames.has(paramName), `paramLabels.${rule}.${paramName} not a real parameter`).toBe(true);
      }
    }
  });

  it('every declared label is a non-empty string', () => {
    for (const [rule, labels] of Object.entries(PRESENTATION.paramLabels)) {
      for (const [paramName, label] of Object.entries(labels)) {
        expect(typeof label, `paramLabels.${rule}.${paramName}`).toBe('string');
        expect(label.length, `paramLabels.${rule}.${paramName} non-empty`).toBeGreaterThan(0);
      }
    }
  });

  it('a rule/param absent from paramLabels has no declared entry (falls back to the metadata name at the codec layer)', () => {
    expect(PRESENTATION.paramLabels.attr?.name).toBeUndefined();
  });
});
