// AC-037 — presentation from DATA, not code. A new rule with complete metadata + a
// presentation-data entry appears in the palette + toolbox with its title/category/advanced/
// colour driven entirely by the data (presentation.json shape), with NO editor code change
// (strengthens AC-034 for the projected surface). The behavior runtime is untouched (NFR-046).
//
// This mirrors the M2 AC-034 proof (a synthetic rule folds into the codec via a generateCodec
// catalog override): here generatePalette/generateToolbox take the same catalog override plus a
// presentation override, projecting the synthetic rule through the COMMITTED generators.
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json, CatalogEntry } from '@transon/editor-core';
import {
  generatePalette,
  generateToolbox,
  PRESENTATION,
  CATALOG_RULES,
  editorMetadata,
  ruleBlockType,
} from '@transon/editor-core';
import { BEHAVIOR_PRIMITIVES } from '@transon/editor-blockly';
import { createNodeEngineProvider } from '../../src/index.js';

// A synthetic rule that exists ONLY in this test — never in the engine metadata or any TS.
const SYNTHETIC_RULE = {
  name: 'greet',
  params: [{ name: 'name', kind: 'dynamic' }],
  variants: [{ id: 'base', params: [{ name: 'name', required: true }] }],
} as unknown as CatalogEntry;

// Its presentation comes entirely from data (the presentation.json shape), not TypeScript.
const SYNTHETIC_PRESENTATION = {
  ...PRESENTATION,
  rules: { ...PRESENTATION.rules, greet: { title: 'Greet', category: 'Formatting', advanced: false } },
};
const SYNTHETIC_CATALOG = [...editorMetadata.catalog.rules, SYNTHETIC_RULE];
const SYNTHETIC_RULES = [...CATALOG_RULES, 'greet'];

interface BlockDef { type: string; message0: string; colour: Json }
interface ToolboxCategory { name: string; contents: Array<{ type: string }> }

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

describe('AC-037 — a new rule is projected from data with no editor code change', () => {
  it('the synthetic rule gets a palette block with data-driven title + colour', async () => {
    const palette = ((await generatePalette(engine, SYNTHETIC_RULES, SYNTHETIC_CATALOG, SYNTHETIC_PRESENTATION)) as
      unknown as { blocks: BlockDef[] }).blocks;
    const greet = palette.find((b) => b.type === ruleBlockType('greet', 'base'));
    expect(greet, 'greet block projected into the palette').toBeTruthy();
    // title + rule name from the presentation data (OQ-008); colour = its category's colour.
    expect(greet!.message0.startsWith('Greet (greet)')).toBe(true);
    expect(greet!.colour).toEqual(PRESENTATION.categoryColour['Formatting']);
  });

  it('the synthetic rule appears in its toolbox category (FR-044)', async () => {
    const toolbox = (await generateToolbox(engine, SYNTHETIC_RULES, SYNTHETIC_CATALOG, SYNTHETIC_PRESENTATION)) as
      unknown as { contents: ToolboxCategory[] };
    const formatting = toolbox.contents.find((c) => c.name === 'Formatting')!;
    expect(formatting.contents.map((b) => b.type)).toContain(ruleBlockType('greet', 'base'));
  });

  it('the behavior runtime is unchanged — no per-rule growth (NFR-046, AD-031)', () => {
    // Adding a rule touched only metadata + presentation data; the runtime's fixed primitive set
    // is identical, proving a new rule adds NO behavior code.
    expect([...BEHAVIOR_PRIMITIVES]).toEqual([
      'field_transon_scalar',
      'transon_array_mutator',
      'transon_object_mutator',
      'transon_unsupported_mutator',
    ]);
  });
});
