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

interface ArgDef { type: string; name?: string; options?: Array<[string, string]>; accept?: string[] }
interface BlockDef {
  type: string;
  message0: string;
  args0?: ArgDef[];
  output: Json;
  colour: number | string;
  mutator?: string;
  inputsInline?: boolean;
  message1?: string;
  args1?: ArgDef[];
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
    // placeholders %1..%N in each message exactly match that message's args (per-message numbering).
    const consistent = (msg: string | undefined, args: ArgDef[] | undefined, label: string): void => {
      const a = args ?? [];
      const nums = ((msg ?? '').match(/%(\d+)/g) ?? []).map((p) => Number(p.slice(1)));
      expect(placeholderCount(msg ?? ''), `${label} message↔args`).toBe(a.length);
      expect(nums).toEqual(a.map((_, i) => i + 1));
    };
    for (const b of blocks) {
      if (!isRuleBlockType(b.type)) continue;
      consistent(b.message0, b.args0, `${b.type} msg0`);
      if (b.message1 !== undefined) consistent(b.message1, b.args1, `${b.type} msg1`);
      expect(b.output, `${b.type} output is advisory (null)`).toBeNull();
    }
  });

  it('canvas face (message0) shows the title only — no (<rule>) suffix (§12.5, OQ-018, AC-041(c))', () => {
    for (const rule of editorMetadata.catalog.rules) {
      const title = PRESENTATION.rules[rule.name]!.title;
      for (const v of rule.variants as Array<{ id: string }>) {
        const b = byType.get(ruleBlockType(rule.name, v.id))!;
        expect(b.message0.startsWith(title), `${b.type} canvas label starts with title`).toBe(true);
        expect(b.message0.includes(`(${rule.name})`), `${b.type} canvas label must NOT carry (<rule>)`).toBe(false);
      }
    }
  });

  it('the projected def carries the flyout dual label "<title> (<rule>)" as display-only data (§12.5, OQ-018)', () => {
    for (const rule of editorMetadata.catalog.rules) {
      const title = PRESENTATION.rules[rule.name]!.title;
      for (const v of rule.variants as Array<{ id: string }>) {
        const b = byType.get(ruleBlockType(rule.name, v.id))! as BlockDef & { flyoutLabel?: string };
        expect(b.flyoutLabel, `${b.type} flyoutLabel`).toBe(`${title} (${rule.name})`);
      }
    }
  });

  it('no two rule-variant blocks render the same visual face (§12.5, revised 2026-07-18)', () => {
    // The regression gate for the value/values (call, expr) and item/items (map) collisions:
    // strip the non-rendered arg keys (`name` is the codec key, `accept` the validation domain)
    // and require every remaining face — messages + rendered widget shapes — to be unique.
    const visual = (args: ArgDef[] | undefined): unknown =>
      (args ?? []).map(({ name: _name, accept: _accept, ...rendered }) => rendered);
    const faces = new Map<string, string>();
    for (const b of blocks) {
      if (!isRuleBlockType(b.type)) continue;
      const face = JSON.stringify([b.message0, visual(b.args0), b.message1, visual(b.args1)]);
      const prior = faces.get(face);
      expect(prior, `${b.type} renders the same face as ${prior}`).toBeUndefined();
      faces.set(face, b.type);
    }
  });

  it('sibling variants that differ only by the lone dynamic param keep its label on the socket (§12.5, revised 2026-07-18)', () => {
    // call/expr value-vs-values and map item-vs-items would otherwise be indistinguishable.
    expect(byType.get(ruleBlockType('call', 'value'))!.message0).toBe('Call function name %1 value %2');
    expect(byType.get(ruleBlockType('call', 'values'))!.message0).toBe('Call function name %1 values %2');
    expect(byType.get(ruleBlockType('expr', 'value'))!.message0).toBe('Expression op %1 value %2');
    expect(byType.get(ruleBlockType('expr', 'values'))!.message0).toBe('Expression op %1 values %2');
    expect(byType.get(ruleBlockType('map', 'item'))!.message0).toBe('Map item %1');
    expect(byType.get(ruleBlockType('map', 'items'))!.message0).toBe('Map items %1');
  });

  it('genuinely unambiguous single-socket variants stay bare (§12.5, OQ-018)', () => {
    // The OQ-018 density win is kept wherever no sibling variant collides: the lone socket
    // carries only its placeholder, no param-name prose.
    expect(byType.get(ruleBlockType('filter', 'base'))!.message0).toBe('Filter %1');
    expect(byType.get(ruleBlockType('set', 'base'))!.message0).toBe('Set variable %1');
    // object__fields is single-socket and unique (the sibling key+value variant is multi-input).
    expect(byType.get(ruleBlockType('object', 'fields'))!.message0).toBe('Build object %1');
  });

  it('multi-input variants keep every per-input label (§12.5, OQ-018, FR-078)', () => {
    for (const rule of editorMetadata.catalog.rules) {
      const kindOf = new Map((rule.params as Array<{ name: string; kind?: string }>).map((p) => [p.name, p.kind ?? 'dynamic']));
      for (const v of rule.variants as Array<{ id: string; params: Array<{ name: string }> }>) {
        const dynamicCount = v.params.filter((p) => kindOf.get(p.name) !== 'constant').length;
        if (dynamicCount < 2) continue;
        const b = byType.get(ruleBlockType(rule.name, v.id))!;
        // every dynamic param's display text (declared short label, else metadata name) renders
        // as its COMPLETE " <label> %<n>" segment at the param's position in the inputs row
        // (message1 — the title-own-row layout, §13.10). Matching the whole segment (label AND
        // its positional placeholder) rules out substring false-passes like 'value' in 'values'.
        expect(b.message1, `${b.type} has an inputs row`).toBeTruthy();
        for (const [i, p] of v.params.entries()) {
          if (kindOf.get(p.name) === 'constant') continue;
          const label = PRESENTATION.paramLabels[rule.name]?.[p.name] ?? p.name;
          const segment = ` ${label} %${i + 1}`;
          expect(b.message1!.includes(segment), `${b.type} multi-input keeps segment '${segment}' for param '${p.name}'`).toBe(true);
        }
      }
    }
  });

  it('declared short param labels substitute the metadata name on multi-input sockets (§12.5, OQ-018, metadata-contract §2.9)', () => {
    // attr.default has a declared short label ("fallback") and attr__name/attr__names are
    // multi-input variants (name/names + default, both dynamic) — the declared label must render,
    // the codec input `name` must stay the metadata name.
    const label = PRESENTATION.paramLabels.attr?.default;
    expect(label).toBe('fallback');
    for (const variantId of ['name', 'names']) {
      const b = byType.get(ruleBlockType('attr', variantId))!;
      const args = [...(b.args0 ?? []), ...(b.args1 ?? [])];
      const defaultArg = args.find((a) => a.name === 'default')!;
      expect(defaultArg, `${b.type} default input keeps the metadata name as its codec key`).toBeTruthy();
      expect(defaultArg.name).toBe('default');
      const msgText = [b.message0, b.message1].filter((m): m is string => typeof m === 'string').join(' ');
      expect(msgText.includes('fallback'), `${b.type} shows the declared short label`).toBe(true);
      expect(new RegExp(`(^|\\s)default(\\s|$)`).test(msgText), `${b.type} must not show the raw metadata name`).toBe(false);
    }
  });

  it('projects rule blocks with external puzzle inputs (FR-129, §13.10, AD-033)', () => {
    for (const b of blocks) {
      if (!isRuleBlockType(b.type)) continue;
      expect(b.inputsInline, `${b.type} should be external`).toBe(false);
    }
  });

  it('multi-input blocks put the title on its own first row (FR-129, §13.10)', () => {
    const countValueInputs = (b: BlockDef): number =>
      [...(b.args0 ?? []), ...(b.args1 ?? [])].filter((a) => a.type === 'input_value').length;
    for (const b of blocks) {
      if (!isRuleBlockType(b.type)) continue;
      if (countValueInputs(b) >= 2) {
        // title alone on row 1 (a leading dummy input), named inputs on message1's rows.
        expect((b.args0 ?? []).map((a) => a.type), `${b.type} row-1 dummy`).toEqual(['input_dummy']);
        expect(b.message1, `${b.type} has a 2nd row`).toBeTruthy();
        expect(countValueInputs({ type: b.type, message0: '', output: null, colour: 0, args1: b.args1 }))
          .toBeGreaterThanOrEqual(2);
      } else {
        // ≤1 input: single row, no 2nd message.
        expect(b.message1, `${b.type} single row`).toBeUndefined();
      }
    }
    // sanity: join(items/sep/default) is the archetype; map(item) stays single-row.
    expect(byType.get(ruleBlockType('join', 'base'))!.message1).toBeTruthy();
    expect(byType.get(ruleBlockType('map', 'item'))!.message1).toBeUndefined();
  });

  it('colour is the rule category colour (NFR-048)', () => {
    for (const rule of editorMetadata.catalog.rules) {
      const colour = PRESENTATION.categoryColour[PRESENTATION.rules[rule.name]!.category];
      for (const v of rule.variants as Array<{ id: string }>) {
        expect(byType.get(ruleBlockType(rule.name, v.id))!.colour).toEqual(colour);
      }
    }
  });

  it('dispatches the FR-118 widget: dynamic→input, constant+options→field_transon_dropdown (FR-058, FR-130)', () => {
    for (const rule of editorMetadata.catalog.rules) {
      const kindOf = new Map((rule.params as Array<{ name: string; kind?: string; options?: string[] }>).map((p) => [p.name, p]));
      for (const v of rule.variants as Array<{ id: string; params: Array<{ name: string }> }>) {
        const b = byType.get(ruleBlockType(rule.name, v.id))!;
        // widgets live in args0 (single-row) or args1 (title-on-own-row, §13.10) — merge both.
        const args = new Map([...(b.args0 ?? []), ...(b.args1 ?? [])].map((a) => [a.name, a]));
        for (const vp of v.params) {
          const meta = kindOf.get(vp.name)!;
          const arg = args.get(vp.name)! as ArgDef & { accept?: string[] };
          if (meta.kind === 'constant' && meta.options) {
            expect(arg.type, `${b.type}.${vp.name}`).toBe('field_transon_dropdown');
            expect(arg.accept, `${b.type}.${vp.name} accept`).toEqual(meta.options);
            const curated = PRESENTATION.dropdownMenus[rule.name]?.[vp.name];
            if (curated) {
              expect(arg.options, `${b.type}.${vp.name} curated menu`).toEqual(
                curated.map((e) => [e.label, e.value]),
              );
              expect((arg.options ?? []).length, `${b.type}.${vp.name} curated < full domain`)
                .toBeLessThan(meta.options.length);
            } else {
              expect(arg.options, `${b.type}.${vp.name} identity menu`).toEqual(meta.options.map((o) => [o, o]));
            }
          } else if (meta.kind === 'constant') {
            expect(arg.type, `${b.type}.${vp.name}`).toBe('field_input');
          } else {
            expect(arg.type, `${b.type}.${vp.name}`).toBe('input_value');
          }
        }
      }
    }
  });

  it('FR-130: expr.op gets the curated menu; call.name (uncurated) gets the identity menu', () => {
    const exprBase = byType.get(ruleBlockType('expr', 'base'))!;
    const opArg = [...(exprBase.args0 ?? []), ...(exprBase.args1 ?? [])].find((a) => a.name === 'op') as
      | (ArgDef & { accept?: string[] })
      | undefined;
    expect(opArg?.type).toBe('field_transon_dropdown');
    const exprMeta = editorMetadata.catalog.rules.find((r) => r.name === 'expr')!;
    const opMeta = (exprMeta.params as Array<{ name: string; options?: string[] }>).find((p) => p.name === 'op')!;
    expect(opArg?.accept).toEqual(opMeta.options);
    const curated = PRESENTATION.dropdownMenus.expr!.op!;
    expect(opArg?.options).toEqual(curated.map((e) => [e.label, e.value]));
    expect((opArg?.options ?? []).length).toBeLessThan((opMeta.options ?? []).length);

    const callBase = byType.get(ruleBlockType('call', 'base'))!;
    const nameArg = [...(callBase.args0 ?? []), ...(callBase.args1 ?? [])].find((a) => a.name === 'name') as
      | (ArgDef & { accept?: string[] })
      | undefined;
    expect(nameArg?.type).toBe('field_transon_dropdown');
    const callMeta = editorMetadata.catalog.rules.find((r) => r.name === 'call')!;
    const nameMeta = (callMeta.params as Array<{ name: string; options?: string[] }>).find((p) => p.name === 'name')!;
    expect(nameArg?.accept).toEqual(nameMeta.options);
    expect(nameArg?.options).toEqual((nameMeta.options ?? []).map((o) => [o, o]));
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
