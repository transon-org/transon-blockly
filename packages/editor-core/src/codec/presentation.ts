// Typed loader for the editor-owned presentation projection-data (metadata-contract §2.9,
// SPEC FR-127/NFR-048).
//
// This is the SINGLE committed source for per-rule title/category/advanced + the toolbox
// category order + the category→colour map. It is *data* (JSON), not TypeScript and not inline
// template literals — the FR-127 source-scan (`harness/scripts/check_presentation.py`) fails if
// any of these enumerations appear as a TS literal under `packages/*/src`. The engine export
// stays Blockly-agnostic and emits none of it (§2.8); the projections join it by rule name
// (the same metadata-normalization pattern as `enrichEntry` joins `kind`).

import presentation from './presentation.json' with { type: 'json' };

/** Per-rule editor-owned presentation (§2.9). `category` ∈ `categoryOrder`. */
export interface RulePresentation {
  title: string;
  category: string;
  advanced: boolean;
}

/**
 * A curated dropdown-menu entry for a constant parameter (SPEC FR-130): the **canonical token**
 * it inserts (`value`), a display **label**, and the metadata **alias tokens** it also covers.
 * Curation is display-only — every value/alias must belong to the parameter's metadata `options`
 * domain and every metadata token round-trips verbatim (AD-004, §21.12).
 */
export interface DropdownMenuEntry {
  value: string;
  label: string;
  aliases?: string[];
}

/** The committed presentation-data shape consumed by `G_palette`/`G_toolbox` (§2.9). */
export interface Presentation {
  /** Toolbox category order (SPEC §12.4 set, editor-owned order). */
  categoryOrder: string[];
  /** Category → Zelos colour (hue 0–360 or hex). Single source for palette + toolbox (NFR-048). */
  categoryColour: Record<string, number | string>;
  /**
   * Structural (non-rule) block types per toolbox category (§12.4): the scalar literal block in
   * "Literals", the array/object-literal blocks in "Objects / Arrays". Editor-owned placement —
   * keeps the category names out of TypeScript (FR-127). `transon_unsupported` is intentionally
   * absent: it is an import-only placeholder (§13.11), never a palette entry.
   */
  structuralBlocks: Record<string, string[]>;
  /** Friendly titles for the structural block types (editor-owned, not rules). */
  structuralTitles: Record<string, string>;
  /** Colour for the import-only `transon_unsupported` placeholder (§13.11) — not a category. */
  unsupportedColour: number | string;
  /** Per-rule title/category/advanced, keyed by rule name. Completeness-gated (FR-127). */
  rules: Record<string, RulePresentation>;
  /**
   * Curated dropdown menus for constant parameters (FR-130), keyed by rule name then param name.
   * A rule/param absent here keeps the full metadata `options` domain as its menu (FR-058).
   */
  dropdownMenus: Record<string, Record<string, DropdownMenuEntry[]>>;
}

const raw = presentation as unknown as Presentation & { $doc?: string };

/** The pinned editor-owned presentation data (§2.9), as a typed `Presentation`. */
export const PRESENTATION: Presentation = {
  categoryOrder: raw.categoryOrder,
  categoryColour: raw.categoryColour,
  structuralBlocks: raw.structuralBlocks,
  structuralTitles: raw.structuralTitles,
  unsupportedColour: raw.unsupportedColour,
  rules: raw.rules,
  dropdownMenus: raw.dropdownMenus ?? {},
};
