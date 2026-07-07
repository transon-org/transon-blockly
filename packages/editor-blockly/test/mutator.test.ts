// FR-015 (editable scalar field) + AC-038 / §13.13 (on-canvas structural mutators). Headless
// mechanics: the field types/serializes JSON scalars with fidelity, and the array/object mutators
// add/remove inputs and reflect the change in extraState (which the codec reads). The AC-038
// "round-trips identically to JSON-authored" guarantee is proven against the real engine in the
// engine-node-adapter integration test (test/ui/mutator-roundtrip.test.ts).
import { describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import { registerTransonBlocks } from '../src/index.js';

interface ScalarField extends Blockly.Field {
  saveState(): unknown;
  loadState(s: unknown): void;
}
interface ArrayBlock extends Blockly.Block {
  addItem_(): void;
  removeItem_(): void;
  saveExtraState(): { items: number[] };
  loadExtraState(s: { items?: unknown[] }): void;
}
interface ObjectBlock extends Blockly.Block {
  addField_(): void;
  removeField_(): void;
  saveExtraState(): { keys: unknown[] };
  loadExtraState(s: { keys?: unknown[] }): void;
}

/** Connect a fresh scalar child into `input` and return it (value connection). */
function connectChild(ws: Blockly.Workspace, parent: Blockly.Block, input: string): Blockly.Block {
  const child = ws.newBlock('transon_literal');
  parent.getInput(input)!.connection!.connect(child.outputConnection!);
  return child;
}

function fresh<T extends Blockly.Block>(type: string): { ws: Blockly.Workspace; b: T } {
  registerTransonBlocks();
  const ws = new Blockly.Workspace();
  return { ws, b: ws.newBlock(type) as T };
}

describe('FR-015 — editable scalar field with type fidelity', () => {
  it('round-trips every JSON scalar type through save/load (no string↔number coercion)', () => {
    const { ws, b } = fresh('transon_literal');
    const field = b.getField('VALUE') as unknown as ScalarField;
    for (const v of [42, 'hi', true, false, null, 3.5, '0', '12', '']) {
      field.loadState(v);
      expect(field.saveState()).toEqual(v); // a loaded "0" stays the string "0", not number 0
    }
    ws.dispose();
  });

  it('parses editor text into a typed scalar on commit (JSON scalar → typed; bare → string)', () => {
    const { ws, b } = fresh('transon_literal');
    const field = b.getField('VALUE')!;
    const cases: Array<[string, unknown]> = [
      ['42', 42],
      ['3.5', 3.5],
      ['true', true],
      ['null', null],
      ['"7"', '7'], // quoted → string "7"
      ['hello', 'hello'], // bare → string
    ];
    for (const [text, expected] of cases) {
      field.setValue(text); // programmatic equivalent of an editor commit
      expect((field as unknown as ScalarField).saveState()).toEqual(expected);
    }
    ws.dispose();
  });
});

describe('AC-038 — array mutator (on-canvas add/remove)', () => {
  it('adds/removes ITEM inputs and reflects the count in extraState', () => {
    const { ws, b } = fresh<ArrayBlock>('transon_array');
    expect(b.getInput('ITEM0')).toBeNull();
    b.addItem_();
    b.addItem_();
    expect(b.getInput('ITEM0')).toBeTruthy();
    expect(b.getInput('ITEM1')).toBeTruthy();
    expect(b.saveExtraState()).toEqual({ items: [0, 1] });
    b.removeItem_();
    expect(b.getInput('ITEM1')).toBeNull();
    expect(b.saveExtraState()).toEqual({ items: [0] });
    b.removeItem_();
    b.removeItem_(); // underflow is a no-op
    expect(b.saveExtraState()).toEqual({ items: [] });
    ws.dispose();
  });

  // FR-133 regression: the stock minimap mirrors a +/- mutation by REPLAYING the 'mutation'
  // BlockChange onto its mirror block — which runs loadExtraState() → the rebuild. A destructive
  // remove-all + re-add rebuild detaches every child on the mirror (children appear detached on the
  // minimap only, since the on-canvas +/- path touches just the tail input). The rebuild must
  // RECONCILE the tail and preserve existing inputs and their connected children.
  it('loadExtraState preserves connected children (minimap mirror-replay path)', () => {
    const { ws, b } = fresh<ArrayBlock>('transon_array');
    b.addItem_();
    b.addItem_();
    const c0 = connectChild(ws, b, 'ITEM0');
    const c1 = connectChild(ws, b, 'ITEM1');
    // add a slot then remove it — the two mutation events the minimap replays via loadExtraState
    b.loadExtraState({ items: [0, 1, 2] });
    b.loadExtraState(b.saveExtraState()); // == { items: [0, 1] }
    expect(b.getInput('ITEM0')!.connection!.targetBlock()).toBe(c0);
    expect(b.getInput('ITEM1')!.connection!.targetBlock()).toBe(c1);
    ws.dispose();
  });
});

describe('AC-038 — object mutator (on-canvas add/remove with editable keys)', () => {
  it('adds/removes KEY+VALUE fields; saveExtraState reads the editable keys', () => {
    const { ws, b } = fresh<ObjectBlock>('transon_object_literal');
    b.addField_();
    b.setFieldValue('name', 'KEY0'); // the user types the key on canvas
    b.addField_();
    b.setFieldValue('age', 'KEY1');
    expect(b.getInput('VALUE0')).toBeTruthy();
    expect(b.getInput('VALUE1')).toBeTruthy();
    expect(b.saveExtraState()).toEqual({ keys: ['name', 'age'] });
    b.removeField_();
    expect(b.getInput('VALUE1')).toBeNull();
    expect(b.saveExtraState()).toEqual({ keys: ['name'] });
    ws.dispose();
  });

  // FR-133 regression (same minimap mirror-replay path as the array): loadExtraState must preserve
  // the connected values of the keys it keeps, only reconciling the tail.
  it('loadExtraState preserves connected values while refreshing keys (mirror-replay path)', () => {
    const { ws, b } = fresh<ObjectBlock>('transon_object_literal');
    b.addField_();
    b.setFieldValue('name', 'KEY0');
    b.addField_();
    b.setFieldValue('age', 'KEY1');
    const v0 = connectChild(ws, b, 'VALUE0');
    const v1 = connectChild(ws, b, 'VALUE1');
    b.loadExtraState({ keys: ['name', 'age', 'extra'] }); // add a field...
    b.loadExtraState({ keys: ['name', 'age'] }); // ...then remove it
    expect(b.getInput('VALUE0')!.connection!.targetBlock()).toBe(v0);
    expect(b.getInput('VALUE1')!.connection!.targetBlock()).toBe(v1);
    expect(b.getFieldValue('KEY0')).toBe('name');
    expect(b.getFieldValue('KEY1')).toBe('age');
    ws.dispose();
  });

  it('loadExtraState rebuilds editable KEY fields from extraState.keys (decoder contract)', () => {
    const { ws, b } = fresh<ObjectBlock>('transon_object_literal');
    b.loadExtraState({ keys: ['a', 'b'] });
    expect(b.getFieldValue('KEY0')).toBe('a');
    expect(b.getFieldValue('KEY1')).toBe('b');
    expect(b.saveExtraState()).toEqual({ keys: ['a', 'b'] }); // editable keys collected back
    ws.dispose();
  });
});

describe('AC-038 / §13.13 — +/- controls live on the TITLE row (density: no separate controls row)', () => {
  // The controls previously occupied their own dummy input row (TRANSON_CONTROLS), costing a full
  // row per array/object block. They now sit inline on the title row (the blockly-samples
  // plus-minus idiom), UI-only as before (FieldImage is non-serializable — never in save()).
  for (const type of ['transon_array', 'transon_object_literal'] as const) {
    it(`${type}: +/- fields sit on the first (title) input; no separate controls row`, () => {
      const { ws, b } = fresh(type);
      // no dedicated controls input row
      expect(b.inputList.filter((i) => i.name === 'TRANSON_CONTROLS')).toEqual([]);
      // the +/- fields exist, named, on the FIRST input (the implicit title dummy row)
      const plus = b.getField('TRANSON_PLUS');
      const minus = b.getField('TRANSON_MINUS');
      expect(plus).toBeTruthy();
      expect(minus).toBeTruthy();
      const titleFields = b.inputList[0]!.fieldRow;
      expect(titleFields).toContain(plus);
      expect(titleFields).toContain(minus);
      // the title label stays first on the row — "<Title> [+] [−]"
      expect(titleFields[0]!.getText()).toMatch(/Array|Object/);
      // UI-only: neither button is serializable (can never leak into workspace serialization)
      expect(plus!.isSerializable()).toBe(false);
      expect(minus!.isSerializable()).toBe(false);
      ws.dispose();
    });
  }

  it('re-running the mutator helper does not duplicate the buttons (idempotent guard)', () => {
    const { ws, b } = fresh<ArrayBlock>('transon_array');
    b.loadExtraState({ items: [0] }); // loadExtraState path re-enters the helper machinery
    const plusFields = b.inputList.flatMap((i) => i.fieldRow).filter((f) => f.name === 'TRANSON_PLUS');
    expect(plusFields.length).toBe(1);
    ws.dispose();
  });

  for (const type of ['transon_array', 'transon_object_literal'] as const) {
    it(`${type}: palette (flyout) blocks get NO +/- buttons — mutating a palette block is
        meaningless and the grown block overlaps its flyout neighbours`, () => {
      registerTransonBlocks();
      const ws = new Blockly.Workspace();
      ws.internalIsFlyout = true; // what a real Flyout marks its workspace as (block.isInFlyout)
      const b = ws.newBlock(type);
      expect(b.isInFlyout).toBe(true); // precondition — the block knows it lives in the palette
      expect(b.getField('TRANSON_PLUS')).toBeNull();
      expect(b.getField('TRANSON_MINUS')).toBeNull();
      // the canvas copy (same type, non-flyout workspace) still gets the controls
      const { ws: ws2, b: canvas } = fresh(type);
      expect(canvas.getField('TRANSON_PLUS')).toBeTruthy();
      ws.dispose();
      ws2.dispose();
    });
  }
});
