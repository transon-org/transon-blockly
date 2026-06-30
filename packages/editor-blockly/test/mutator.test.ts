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

  it('loadExtraState rebuilds editable KEY fields from extraState.keys (decoder contract)', () => {
    const { ws, b } = fresh<ObjectBlock>('transon_object_literal');
    b.loadExtraState({ keys: ['a', 'b'] });
    expect(b.getFieldValue('KEY0')).toBe('a');
    expect(b.getFieldValue('KEY1')).toBe('b');
    expect(b.saveExtraState()).toEqual({ keys: ['a', 'b'] }); // editable keys collected back
    ws.dispose();
  });
});
