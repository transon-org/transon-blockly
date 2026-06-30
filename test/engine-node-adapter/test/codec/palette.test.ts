// FR-084, FR-089, FR-016, FR-058, FR-118 — G_palette projects loadable Zelos block definitions
// for every rule variant from metadata + the committed presentation data (AD-026).
//
// FR-084/089: metadata-generated block definitions with labels, parameter inputs, required-input
// structure, and the field-vs-input disposition. FR-058: constant params with a resolved enum
// render as dropdowns. FR-016/FR-123: the literal-object block is distinct from the `object`
// rule block. The palette is a STATIC artifact produced by running G_palette over the metadata;
// FR-125 (it actually LOADS in headless Blockly) is gated separately in @transon/editor-blockly.
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json } from '@transon/editor-core';
import {
  generatePalette,
  PRESENTATION,
  editorMetadata,
  ruleBlockType,
  isRuleBlockType,
  STRUCTURAL_BLOCK_TYPES,
} from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';

interface ArgDef { type: string; name?: string; options?: Array<[string, string]> }
interface BlockDef {
  type: string;
  message0: string;
  args0?: ArgDef[];
  output: Json;
  colour: number | string;
  mutator?: string;
}

let engine: EngineProvider;
let blocks: BlockDef[];
let byType: Map<string, BlockDef>;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
  blocks = ((await generatePalette(engine)) as unknown as { blocks: BlockDef[] }).blocks;
  byType = new Map(blocks.map((b) => [b.type, b]));
});
afterAll(() => engine?.dispose());

const placeholderCount = (msg: string): number => (msg.match(/%\d+/g) ?? []).length;

describe('G_palette block definitions (FR-084, FR-089, FR-118)', () => {
  it('emits one definition per rule variant, plus the four structural blocks (FR-124 vocabulary)', () => {
    const ruleVariantTypes = editorMetadata.catalog.rules.flatMap((r) =>
      (r.variants as Array<{ id: string }>).map((v) => ruleBlockType(r.name, v.id)),
    );
    for (const t of ruleVariantTypes) expect(byType.has(t), `palette missing ${t}`).toBe(true);
    for (const t of STRUCTURAL_BLOCK_TYPES) expect(byType.has(t), `palette missing structural ${t}`).toBe(true);
    expect(blocks.length).toBe(ruleVariantTypes.length + STRUCTURAL_BLOCK_TYPES.length);
  });

  it('every rule-variant block has consistent message↔args and an advisory output (FR-125, §13.1)', () => {
    for (const b of blocks) {
      if (!isRuleBlockType(b.type)) continue;
      const args = b.args0 ?? [];
      // message0 placeholders are exactly %1..%N matching args0 (consistent message↔args, FR-125).
      expect(placeholderCount(b.message0), `${b.type} message↔args`).toBe(args.length);
      const nums = (b.message0.match(/%(\d+)/g) ?? []).map((p) => Number(p.slice(1)));
      expect(nums).toEqual(args.map((_, i) => i + 1));
      expect(b.output, `${b.type} output is advisory (null)`).toBeNull();
    }
  });

  it('label shows the friendly title and the rule name (OQ-008, §12.5)', () => {
    for (const rule of editorMetadata.catalog.rules) {
      const title = PRESENTATION.rules[rule.name]!.title;
      for (const v of rule.variants as Array<{ id: string }>) {
        const b = byType.get(ruleBlockType(rule.name, v.id))!;
        expect(b.message0.startsWith(`${title} (${rule.name})`), `${b.type} label`).toBe(true);
      }
    }
  });

  it('colour is the rule category colour (NFR-048)', () => {
    for (const rule of editorMetadata.catalog.rules) {
      const colour = PRESENTATION.categoryColour[PRESENTATION.rules[rule.name]!.category];
      for (const v of rule.variants as Array<{ id: string }>) {
        expect(byType.get(ruleBlockType(rule.name, v.id))!.colour).toEqual(colour);
      }
    }
  });

  it('dispatches the FR-118 widget: dynamic→input, constant+options→dropdown (FR-058)', () => {
    for (const rule of editorMetadata.catalog.rules) {
      const kindOf = new Map((rule.params as Array<{ name: string; kind?: string; options?: string[] }>).map((p) => [p.name, p]));
      for (const v of rule.variants as Array<{ id: string; params: Array<{ name: string }> }>) {
        const b = byType.get(ruleBlockType(rule.name, v.id))!;
        const args = new Map((b.args0 ?? []).map((a) => [a.name, a]));
        for (const vp of v.params) {
          const meta = kindOf.get(vp.name)!;
          const arg = args.get(vp.name)!;
          if (meta.kind === 'constant' && meta.options) {
            expect(arg.type, `${b.type}.${vp.name}`).toBe('field_dropdown');
            expect(arg.options).toEqual(meta.options.map((o) => [o, o]));
          } else if (meta.kind === 'constant') {
            expect(arg.type, `${b.type}.${vp.name}`).toBe('field_input');
          } else {
            expect(arg.type, `${b.type}.${vp.name}`).toBe('input_value');
          }
        }
      }
    }
  });

  it('the literal-object block is distinct from the object rule block (FR-016, FR-123)', () => {
    expect(byType.has('transon_object_literal')).toBe(true);
    expect(isRuleBlockType('transon_object_literal')).toBe(false);
    // The object rule still has its own projected blocks.
    expect(byType.has(ruleBlockType('object', 'fields'))).toBe(true);
    expect(byType.has(ruleBlockType('object', 'key+value'))).toBe(true);
  });

  it('the palette block-type set matches the encoder vocabulary exactly (D-B parity, FR-126)', () => {
    const ruleVariantTypes = new Set(
      editorMetadata.catalog.rules.flatMap((r) =>
        (r.variants as Array<{ id: string }>).map((v) => ruleBlockType(r.name, v.id)),
      ),
    );
    const paletteRuleTypes = new Set(blocks.map((b) => b.type).filter(isRuleBlockType));
    expect([...paletteRuleTypes].sort()).toEqual([...ruleVariantTypes].sort());
  });
});
