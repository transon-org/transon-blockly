// FR-044, FR-043, §12.4 — G_toolbox projects the Blockly toolbox/category structure from
// metadata + the committed presentation data (AD-026), grouping rules by their §12.4 category.
//
// FR-044: the editor visually groups rules by category (§12.4). FR-043: rule/category names
// derive from engine metadata + the editor-owned presentation source, not a hand-maintained
// taxonomy. The toolbox is a STATIC artifact (loaded, not executed), produced by running the
// committed G_toolbox projection over the pinned metadata.
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json } from '@transon/editor-core';
import {
  generateToolbox,
  PRESENTATION,
  editorMetadata,
  ruleBlockType,
  isRuleBlockType,
  STRUCTURAL_BLOCK_TYPES,
} from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';

interface ToolboxBlock { kind: string; type: string }
interface ToolboxCategory { kind: string; name: string; colour: Json; contents: ToolboxBlock[] }
interface Toolbox { kind: string; contents: ToolboxCategory[] }

let engine: EngineProvider;
let toolbox: Toolbox;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
  toolbox = (await generateToolbox(engine)) as unknown as Toolbox;
});
afterAll(() => engine?.dispose());

describe('G_toolbox category projection (FR-044, FR-043, §12.4)', () => {
  it('is a Blockly categoryToolbox', () => {
    expect(toolbox.kind).toBe('categoryToolbox');
  });

  it('emits every §12.4 category in presentation order, with its colour (FR-044, NFR-048)', () => {
    expect(toolbox.contents.map((c) => c.name)).toEqual(PRESENTATION.categoryOrder);
    for (const cat of toolbox.contents) {
      expect(cat.kind).toBe('category');
      expect(cat.colour).toEqual(PRESENTATION.categoryColour[cat.name]);
    }
  });

  it('groups each rule under its presentation category, one block per variant (FR-044, FR-043)', () => {
    const byName = new Map(toolbox.contents.map((c) => [c.name, c]));
    for (const rule of editorMetadata.catalog.rules) {
      const cat = PRESENTATION.rules[rule.name]?.category;
      expect(cat, `rule '${rule.name}' has a category`).toBeTruthy();
      const blockTypes = new Set((byName.get(cat!)?.contents ?? []).map((b) => b.type));
      for (const variant of rule.variants as Array<{ id: string }>) {
        expect(
          blockTypes.has(ruleBlockType(rule.name, variant.id)),
          `${rule.name}__${variant.id} should appear in category '${cat}'`,
        ).toBe(true);
      }
    }
  });

  it('places the structural blocks declared in presentation.structuralBlocks (§13.7/13.9)', () => {
    const byName = new Map(toolbox.contents.map((c) => [c.name, c]));
    for (const [cat, types] of Object.entries(PRESENTATION.structuralBlocks)) {
      const blockTypes = new Set((byName.get(cat)?.contents ?? []).map((b) => b.type));
      for (const t of types) {
        expect(blockTypes.has(t), `structural block '${t}' should appear in '${cat}'`).toBe(true);
      }
    }
  });

  it('every block entry is a valid rule or structural block type (FR-124 vocabulary)', () => {
    const structural = new Set<string>(STRUCTURAL_BLOCK_TYPES);
    for (const cat of toolbox.contents) {
      for (const block of cat.contents) {
        expect(block.kind).toBe('block');
        const ok = isRuleBlockType(block.type) || structural.has(block.type);
        expect(ok, `block type '${block.type}' is not a known vocabulary type`).toBe(true);
      }
    }
  });

  it('never lists transon_unsupported (import-only placeholder, §13.11)', () => {
    const all = toolbox.contents.flatMap((c) => c.contents.map((b) => b.type));
    expect(all).not.toContain('transon_unsupported');
  });
});
