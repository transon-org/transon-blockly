// NFR-046 / AD-031 — the behavior runtime is a FIXED, finite set of interaction primitives that
// does not grow per rule. The deterministic `check_behavior_runtime_size.py` gate proves
// rule-agnosticism (no rule-name dispatch) + the bounded primitive count over the source; this
// test pins the runtime's registered surface and that it is honest about what it declares.
//
// The complementary "adding a rule changes NOTHING here" proof is the AC-037 synthetic-rule test
// (it asserts BEHAVIOR_PRIMITIVES is unchanged after a new rule folds into the projected surface).
import { describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import { BEHAVIOR_PRIMITIVES, registerTransonRuntime } from '../src/index.js';

describe('NFR-046 — finite, rule-agnostic behavior runtime (AD-031)', () => {
  it('declares exactly the fixed set of interaction primitives (1 field + 3 mutators)', () => {
    expect([...BEHAVIOR_PRIMITIVES]).toEqual([
      'field_transon_scalar',
      'transon_array_mutator',
      'transon_object_mutator',
      'transon_unsupported_mutator',
    ]);
  });

  it('registers exactly those primitives into Blockly (field + mutators)', () => {
    registerTransonRuntime();
    // The custom field is in the field registry…
    expect(Blockly.fieldRegistry.fromJson({ type: 'field_transon_scalar', value: null })).toBeTruthy();
    // …and each mutator extension is registered (re-registering throws "already registered").
    for (const mutator of ['transon_array_mutator', 'transon_object_mutator', 'transon_unsupported_mutator']) {
      expect(() => Blockly.Extensions.registerMutator(mutator, {}), `${mutator} already registered`).toThrow();
    }
  });

  it('the primitives are keyed by structural vocabulary, never by a rule name', () => {
    // None of the registered primitive names is a built-in rule name — they are the scalar field
    // and the structural-block mutators (array/object/unsupported), so a new rule adds none.
    const ruleNames = new Set(['this', 'attr', 'object', 'map', 'expr', 'call', 'set', 'get', 'switch', 'cond']);
    for (const p of BEHAVIOR_PRIMITIVES) expect(ruleNames.has(p)).toBe(false);
  });
});
