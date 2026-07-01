// FR-129 / §13.10 / AD-033 — projected rule blocks are value/output blocks with EXTERNAL inputs:
// every value parameter connects from the SIDE via a puzzle socket (thrasos renderer), and the block
// body holds only fields + mutator controls, never inline-embedded values. This is a block-definition
// display default in the G_palette projection (palette.json): pure UI, round-trip-neutral (§21.12) —
// the codec artifacts are unchanged. Engine-free committed-artifact test, so it also guards the regen.
import { describe, it, expect } from 'vitest';
import { PALETTE_BLOCKS, isRuleBlockType, ruleBlockType } from '../src/index.js';

describe('projected rule blocks use external puzzle inputs (FR-129, §13.10, AD-033)', () => {
  it('every rule-variant block sets inputsInline: false', () => {
    const ruleBlocks = PALETTE_BLOCKS.filter((b) => isRuleBlockType(b.type));
    expect(ruleBlocks.length).toBeGreaterThan(0);
    const inline = ruleBlocks.filter((b) => b.inputsInline !== false).map((b) => b.type);
    expect(inline, `rule blocks not external (inputsInline!=false): ${inline.join(', ')}`).toEqual([]);
  });

  it('a variant with ≥2 value inputs puts the title on its own first row (§13.10)', () => {
    // join(items/sep/default) — the committed artifact should carry a leading dummy row + message1.
    const join = PALETTE_BLOCKS.find((b) => b.type === ruleBlockType('join', 'base'))!;
    const args0 = (join.args0 as Array<{ type?: string }> | undefined) ?? [];
    expect(args0.map((a) => a.type)).toEqual(['input_dummy']);
    expect(join.message1, 'multi-input block has a second message row').toBeTruthy();
  });
});
