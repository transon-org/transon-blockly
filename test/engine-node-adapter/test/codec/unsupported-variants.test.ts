// Import-failure / ambiguity-rejection coverage — FR-055, §15.6, AC-029/AC-030.
//
// §15.6 requires that every import match EXACTLY one declared variant; zero, multiple,
// or partial matches must be reported as import_unsupported (§16.4). The codec routes
// all such nodes to a `transon_unsupported` block (§13.11, AD-004). This file asserts:
//   (a) the encoded block's type is `transon_unsupported`, and
//   (b) decode(encode(T)) === T — exact preservation with no silent rewrite (FR-055, AD-004).
//
// Covered cases:
//   1. value+values ambiguity on expr (AC-029)
//   2. value+values ambiguity on call (AC-029)
//   3. item+items ambiguity on map (AC-029)
//   4. item + key+value collision on map (AC-029)
//   5. key+value + fields collision on object (AC-029)
//   6. zero-param rule with foreign key: {$:'this', extra:1}
//   7. unknown rule: {$:'no_such_rule', x:1}
//   8. foreign param on a single-variant rule: {$:'set', name:'n', bogus:1}
//
// AC-029 — block variants for mutually exclusive parameters.
// AC-030 — variant import matching (ambiguity rejection).
// FR-055 — no silent rewrite; out-of-surface → transon_unsupported.
// §15.6 — variant matching: exactly one variant must match.
// §16.4 — import_unsupported error category.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json } from '@transon/editor-core';
import { encode, decode } from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

/** All out-of-surface templates that should route to transon_unsupported (FR-055, §15.6). */
const UNSUPPORTED_CASES: { name: string; template: Json; reason: string }[] = [
  // AC-029: value+values is ambiguous for expr — two exclusive param groups present simultaneously
  {
    name: 'expr-value-and-values-ambiguous',
    template: { $: 'expr', op: '+', value: 1, values: [2] },
    reason: 'expr: value+values is an ambiguous multi-variant collision (AC-029)',
  },
  // AC-029: value+values is ambiguous for call — two exclusive param groups present simultaneously
  {
    name: 'call-value-and-values-ambiguous',
    template: { $: 'call', name: 'str', value: 1, values: [2] },
    reason: 'call: value+values is an ambiguous multi-variant collision (AC-029)',
  },
  // AC-029: item+items is ambiguous for map — two exclusive param groups present simultaneously
  {
    name: 'map-item-and-items-ambiguous',
    template: { $: 'map', item: { $: 'this' }, items: [{ $: 'this' }] },
    reason: 'map: item+items is an ambiguous multi-variant collision (AC-029)',
  },
  // AC-029: item present along with key+value on map — zero-or-two-variant match
  {
    name: 'map-item-and-key-value-ambiguous',
    template: { $: 'map', item: { $: 'this' }, key: { $: 'key' }, value: { $: 'value' } },
    reason: 'map: item + key+value is an ambiguous multi-variant collision (AC-029)',
  },
  // AC-029: key+value and fields both present on object — two exclusive param groups
  {
    name: 'object-key-value-and-fields-ambiguous',
    template: { $: 'object', key: 'k', value: 'v', fields: { x: 1 } },
    reason: 'object: key+value + fields is an ambiguous multi-variant collision (AC-029)',
  },
  // §15.6: zero-param rule with a foreign key is out of surface (unknown parameter)
  {
    name: 'this-with-foreign-param',
    template: { $: 'this', extra: 1 },
    reason: 'this: zero-param rule does not accept any param; extra is foreign (§15.6)',
  },
  // §15.6: completely unknown rule — no metadata, no variant
  {
    name: 'unknown-rule',
    template: { $: 'no_such_rule', x: 1 },
    reason: 'no_such_rule: unknown rule with no metadata (§15.6)',
  },
  // §15.6: foreign param on a single-variant rule — bogus is not declared for set
  {
    name: 'set-with-foreign-param',
    template: { $: 'set', name: 'n', bogus: 1 },
    reason: 'set: bogus is not a declared param; single-variant rule with foreign key (§15.6)',
  },
  // §15.7 / FR-123: the object/fields payload MUST be a mapping (the engine rejects a non-dict
  // `fields`). A non-dict `fields` is neither the escape nor a valid rule node → out of surface,
  // routed to transon_unsupported with exact preservation rather than a raw codec error.
  { name: 'object-fields-int', template: { $: 'object', fields: 5 }, reason: 'object/fields payload is a scalar, not a mapping (§15.7)' },
  { name: 'object-fields-list', template: { $: 'object', fields: [1, 2] }, reason: 'object/fields payload is a list, not a mapping (§15.7)' },
  { name: 'object-fields-string', template: { $: 'object', fields: 'str' }, reason: 'object/fields payload is a string, not a mapping (§15.7)' },
  { name: 'object-fields-null', template: { $: 'object', fields: null }, reason: 'object/fields payload is null, not a mapping (§15.7)' },
  { name: 'object-fields-bool', template: { $: 'object', fields: true }, reason: 'object/fields payload is a bool, not a mapping (§15.7)' },
];

describe(
  'ambiguity / import-failure → transon_unsupported (type check) (FR-055, §15.6, AC-029/030)',
  () => {
    for (const { name, template, reason } of UNSUPPORTED_CASES) {
      it(`${name}: encoded block type is transon_unsupported — ${reason}`, async () => {
        const ws = await encode(engine, template);
        expect(
          (ws as { type: string }).type,
          `Expected transon_unsupported for: ${reason}`,
        ).toBe('transon_unsupported');
      });
    }
  },
);

describe(
  'ambiguity / import-failure → exact preservation: decode(encode(T)) === T (AD-004, FR-055)',
  () => {
    for (const { name, template, reason } of UNSUPPORTED_CASES) {
      it(`${name}: decode(encode(T)) deep-equals T — ${reason}`, async () => {
        const back = await decode(engine, await encode(engine, template));
        expect(back).toEqual(template);
      });
    }
  },
);
