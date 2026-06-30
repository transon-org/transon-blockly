// The finite, rule-agnostic Blockly behavior runtime (AD-031, NFR-046, §13).
//
// This is the ONLY first-party Blockly *code* in the editor surface. Block *structure* is
// projected from metadata (G_palette/G_toolbox, AD-026); only the behavior JSON cannot express —
// a custom scalar field and the dynamic-arity / raw-preserving structural blocks — lives here. It
// is keyed by the fixed STRUCTURAL block vocabulary (transon_array / transon_object_literal /
// transon_unsupported) and the custom field, NEVER by rule name: a new rule rides entirely on
// metadata + projections and adds NOTHING here (NFR-046, enforced by check_behavior_runtime_size).
//
// Each dynamic-arity block rebuilds its value inputs from the encoder's UI-only extraState in
// `loadExtraState` — which Blockly runs BEFORE it attaches input connections, so the ITEM{n} /
// VALUE{n} inputs exist when children load (Blockly errors on a connection to an undeclared
// input). This is Blockly's own (de)serialization, not a hand-written codec↔workspace mapping
// (FR-126/AD-032): the runtime never reads the codec artifacts.

import * as Blockly from 'blockly/core';

type Json = unknown;

/** Custom field holding an arbitrary JSON scalar (string/number/boolean/null) for transon_literal. */
class FieldTransonScalar extends Blockly.Field<Json> {
  override SERIALIZABLE = true;

  constructor(value?: Json) {
    super(value === undefined ? null : value);
  }

  static override fromJson(options: Record<string, unknown>): FieldTransonScalar {
    return new FieldTransonScalar('value' in options ? (options['value'] as Json) : null);
  }

  // Accept any JSON scalar verbatim (type fidelity is the codec's job; this only displays it).
  protected override doClassValidation_(newValue?: Json): Json {
    return newValue === undefined ? null : newValue;
  }

  override getText(): string {
    const v = this.getValue();
    return typeof v === 'string' ? v : JSON.stringify(v ?? null);
  }
}

// ---- dynamic-arity structural blocks: rebuild value inputs from extraState ----

type DynamicBlock = Blockly.Block & {
  itemCount_?: number;
  keys_?: unknown[];
  rawState_?: unknown;
  rebuildInputs_?: () => void;
};

function removeInputs(block: Blockly.Block, prefix: string): void {
  for (let i = 0; block.getInput(`${prefix}${i}`); i++) block.removeInput(`${prefix}${i}`);
  // getInput is re-evaluated each iteration; collect-then-remove to avoid index shift.
  const names = block.inputList.map((inp) => inp.name).filter((n) => n.startsWith(prefix));
  for (const n of names) if (block.getInput(n)) block.removeInput(n);
}

/** transon_array: ITEM{n} value inputs, count from extraState.items.length. */
const ARRAY_MUTATOR = {
  itemCount_: 0,
  saveExtraState(this: DynamicBlock): { items: number[] } {
    return { items: Array.from({ length: this.itemCount_ ?? 0 }, (_, i) => i) };
  },
  loadExtraState(this: DynamicBlock, state: { items?: unknown[] }): void {
    this.itemCount_ = Array.isArray(state.items) ? state.items.length : 0;
    (this.rebuildInputs_ as () => void)();
  },
  rebuildInputs_(this: DynamicBlock): void {
    removeInputs(this, 'ITEM');
    for (let i = 0; i < (this.itemCount_ ?? 0); i++) this.appendValueInput(`ITEM${i}`);
  },
};

/** transon_object_literal: VALUE{n} value inputs labelled by extraState.keys. */
const OBJECT_MUTATOR = {
  keys_: [] as unknown[],
  saveExtraState(this: DynamicBlock): { keys: unknown[] } {
    return { keys: this.keys_ ?? [] };
  },
  loadExtraState(this: DynamicBlock, state: { keys?: unknown[] }): void {
    this.keys_ = Array.isArray(state.keys) ? state.keys : [];
    (this.rebuildInputs_ as () => void)();
  },
  rebuildInputs_(this: DynamicBlock): void {
    removeInputs(this, 'VALUE');
    (this.keys_ ?? []).forEach((key, i) => {
      this.appendValueInput(`VALUE${i}`).appendField(String(key));
    });
  },
};

/** transon_unsupported: preserve the raw out-of-surface payload verbatim; edit-blocked (§13.11). */
const UNSUPPORTED_MUTATOR = {
  rawState_: null as unknown,
  saveExtraState(this: DynamicBlock): { raw: unknown } {
    return { raw: this.rawState_ ?? null };
  },
  loadExtraState(this: DynamicBlock, state: { raw?: unknown }): void {
    this.rawState_ = state.raw ?? null;
    this.setEditable(false);
  },
};

let registered = false;

// Register, ignoring "already registered" if the singleton Blockly module was touched elsewhere.
function ignoreDuplicate(fn: () => void): void {
  try {
    fn();
  } catch (e) {
    if (!/already|registered/i.test(String((e as Error)?.message))) throw e;
  }
}

/**
 * Register the finite behavior runtime (the custom scalar field + the three structural mutators)
 * into Blockly. Idempotent. Must run before block definitions that reference them are loaded.
 */
export function registerTransonRuntime(): void {
  if (registered) return;
  registered = true;
  const reg = Blockly.fieldRegistry.register as unknown as (name: string, cls: unknown) => void;
  ignoreDuplicate(() => reg('field_transon_scalar', FieldTransonScalar));
  ignoreDuplicate(() => Blockly.Extensions.registerMutator('transon_array_mutator', ARRAY_MUTATOR));
  ignoreDuplicate(() => Blockly.Extensions.registerMutator('transon_object_mutator', OBJECT_MUTATOR));
  ignoreDuplicate(() => Blockly.Extensions.registerMutator('transon_unsupported_mutator', UNSUPPORTED_MUTATOR));
}

/** The fixed set of interaction primitives this runtime registers (NFR-046 size invariant). */
export const BEHAVIOR_PRIMITIVES = [
  'field_transon_scalar',
  'transon_array_mutator',
  'transon_object_mutator',
  'transon_unsupported_mutator',
] as const;
