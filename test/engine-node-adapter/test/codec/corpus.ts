// The M1/M2 round-trip corpus (§15.8 covering the full 22-rule catalog and the structural
// skeleton). Each entry is an in-surface Transon template; `input` (when present) drives the
// execution-based semantic-identity check (AC-035, AD-011).
//
// FR-040: all 22 built-in rules have at least one corpus entry.
// FR-045/046: required params present; optional params exercised both with and without.
// FR-052/053/054: every variant of every multi-variant rule has an entry.
// FR-055: no silent rewrite (out-of-surface entries encode to transon_unsupported).
// FR-124: workspace-shape invariant over all entries.
// AC-006: all rules reachable via the codec.
// AC-035: round-trip by construction (structural + execution identity).
import type { Json } from '@transon/editor-core';

export interface CorpusEntry {
  name: string;
  template: Json;
  input?: Json;
}

export const M1_CORPUS: CorpusEntry[] = [
  // ---- literals (type fidelity: number vs string, null, empty) ----
  { name: 'string', template: 'hello' },
  { name: 'int', template: 42 },
  { name: 'float', template: 3.14 },
  { name: 'bool-true', template: true },
  { name: 'bool-false', template: false },
  { name: 'null', template: null },
  { name: 'string-zero', template: '0' },
  { name: 'empty-string', template: '' },
  // literal arrays + objects (ordering, nesting, empties)
  { name: 'array', template: [1, 2, 3] },
  { name: 'array-empty', template: [] },
  { name: 'object', template: { a: 1, b: [2, { c: 3 }] } },
  { name: 'object-empty', template: {} },

  // ---- attr — both variants, optional default, nesting (FR-045/046/052/053/054) ----
  { name: 'attr-name', template: { $: 'attr', name: 'a' }, input: { a: 1 } },
  { name: 'attr-name-int', template: { $: 'attr', name: 0 }, input: [10, 20] },
  { name: 'attr-names', template: { $: 'attr', names: ['a', 'b'] }, input: { a: { b: 7 } } },
  { name: 'attr-default', template: { $: 'attr', name: 'missing', default: 'anon' }, input: {} },
  { name: 'attr-names-default-null', template: { $: 'attr', names: ['p'], default: null }, input: {} },
  { name: 'attr-nested', template: { $: 'attr', name: { $: 'attr', name: 'key' } }, input: { key: 'a', a: 99 } },
  // review #1 regression: a `default` value EQUAL to the old presence sentinel must NOT be dropped
  { name: 'attr-default-sentinel-value', template: { $: 'attr', name: 'missing', default: '__transon_absent__' }, input: {} },

  // ---- literal-marker escape (§11.4, FR-059/123) ----
  { name: 'escape-marker-key-object', template: { $: 'object', fields: { $: 'v' } } },
  { name: 'escape-marker-key-mixed', template: { $: 'object', fields: { $: 'x', y: [1, 2] } } },

  // ---- out-of-surface → unsupported placeholder, exact preservation (FR-055, §13.11) ----
  { name: 'unsupported-rule', template: { $: 'no_such_rule_xyz', x: 1 } },
  // review #2 regression: ambiguous (name+names) and foreign-param `attr` are out-of-surface
  { name: 'unsupported-attr-ambiguous', template: { $: 'attr', name: 'a', names: ['b'] } },
  { name: 'unsupported-attr-foreign-param', template: { $: 'attr', name: 'a', bogusparam: 1 } },

  // ---- mixed deep structure ----
  { name: 'mixed', template: [{ $: 'attr', name: 'a' }, { k: [1, { $: 'attr', name: 'd', default: 0 }] }], input: { a: 5 } },

  // ================================================================
  // M2 D1 — full 22-rule catalog (FR-040, AC-006)
  // ================================================================

  // ---- this (zero-param, base variant) ----
  // FR-040: `this` rule — returns current context value pass-through
  { name: 'this', template: { $: 'this' }, input: 42 },

  // ---- parent (zero-param, base variant) ----
  // FR-040: `parent` — used inside a chain where parent context is established
  { name: 'parent', template: { $: 'chain', funcs: ['hello', { $: 'parent' }] }, input: null },

  // ---- item (zero-param, base variant) ----
  // FR-040: `item` — used inside map over a list
  { name: 'item', template: { $: 'map', item: { $: 'item' } }, input: [1, 2, 3] },

  // ---- key (zero-param, base variant) ----
  // FR-040: `key` — used inside map over a dict
  { name: 'key', template: { $: 'map', item: { $: 'key' } }, input: { a: 1, b: 2 } },

  // ---- index (zero-param, base variant) ----
  // FR-040: `index` — used inside map over a list
  { name: 'index', template: { $: 'map', item: { $: 'index' } }, input: [10, 20, 30] },

  // ---- value (zero-param, base variant) ----
  // FR-040: `value` — used inside map over a dict
  { name: 'value', template: { $: 'map', item: { $: 'value' } }, input: { a: 1, b: 2 } },

  // ---- set (required: name) ----
  // FR-040: `set` stores `this` under a name and returns it unchanged
  {
    name: 'set',
    template: { $: 'chain', funcs: [{ $: 'set', name: 'x' }, { $: 'get', name: 'x' }] },
    input: 99,
  },

  // ---- get (required: name; optional: default) ----
  // FR-045/046: required-only and with optional default
  { name: 'get-name', template: { $: 'chain', funcs: [{ $: 'set', name: 'v' }, { $: 'get', name: 'v' }] }, input: 5 },
  { name: 'get-default', template: { $: 'get', name: 'missing', default: 0 }, input: {} },

  // ---- object (key+value variant) ----
  // FR-040/052: `object` key+value variant — dynamic-key dict
  // NOTE: object/fields is caught by the skeleton's literal-marker escape → transon_object_literal
  // (FR-123). Only key+value is a real rule block; fields is covered by escape tests.
  { name: 'object-key-value', template: { $: 'object', key: 'k', value: 'v' }, input: null },
  // with dynamic key and value
  {
    name: 'object-key-value-dynamic',
    template: { $: 'object', key: { $: 'attr', name: 'k' }, value: { $: 'attr', name: 'v' } },
    input: { k: 'myKey', v: 'myVal' },
  },

  // ---- map (three variants: item, items, key+value) ----
  // FR-052/053/054: every map variant
  // map/item — single item template (list → list)
  {
    name: 'map-item',
    template: { $: 'map', item: { $: 'expr', op: '+', value: 1 } },
    input: [1, 2, 3],
  },
  // map/items — multi-output per element (list → flat list)
  {
    name: 'map-items',
    template: { $: 'map', items: [{ $: 'this' }, { $: 'this' }] },
    input: [1, 2],
  },
  // map/key+value — dict → dict
  {
    name: 'map-key-value',
    template: { $: 'map', key: { $: 'key' }, value: { $: 'value' } },
    input: { a: 1, b: 2 },
  },

  // ---- filter (required: cond) ----
  // FR-040: `filter` — keep items matching cond
  { name: 'filter', template: { $: 'filter', cond: { $: 'this' } }, input: [1, 0, 2, null, 3] },

  // ---- zip (required: items) ----
  // FR-040: `zip` — zip multiple lists/templates
  {
    name: 'zip',
    template: { $: 'zip', items: [{ $: 'this' }, { $: 'this' }] },
    input: [1, 2, 3],
  },

  // ---- file (required: name, content) ----
  // FR-040: `file` — structural only (file writes are captured, not executed in tests)
  // Both required params present. Execution result is null (file capture returns null).
  { name: 'file', template: { $: 'file', name: 'out.txt', content: 'hello' }, input: null },

  // ---- join (required: items; optional: sep, default) ----
  // FR-045/046: required-only and with optional params
  { name: 'join-items', template: { $: 'join', items: [{ a: 1 }, { $: 'this' }] }, input: { b: 2 } },
  { name: 'join-sep', template: { $: 'join', items: ['a', 'b', 'c'], sep: '-' }, input: null },
  { name: 'join-default', template: { $: 'join', items: [], sep: ',', default: 'empty' }, input: null },

  // ---- chain (required: funcs) ----
  // FR-040: `chain` — pipeline
  {
    name: 'chain',
    template: { $: 'chain', funcs: [{ $: 'attr', name: 'x' }, { $: 'expr', op: '+', value: 1 }] },
    input: { x: 5 },
  },

  // ---- expr (three variants: base, value, values) ----
  // FR-052/053/054: every expr variant; op stays as a value input (D2 will move to field)
  // expr/base — unary (op only, no operand)
  { name: 'expr-base', template: { $: 'expr', op: '!' }, input: false },
  // expr/value — binary monad (op + single value)
  { name: 'expr-value', template: { $: 'expr', op: '+', value: 10 }, input: 5 },
  // expr/values — explicit operands list
  {
    name: 'expr-values',
    template: { $: 'expr', op: '+', values: [{ $: 'this' }, 1] },
    input: 4,
  },

  // ---- call (three variants: base, value, values) ----
  // FR-052/053/054: every call variant; name stays as a value input (D2)
  // call/base — function with no argument
  { name: 'call-base', template: { $: 'call', name: 'str' }, input: 42 },
  // call/value — function with single argument
  { name: 'call-value', template: { $: 'call', name: 'str', value: { $: 'expr', op: '+', value: 1 } }, input: 5 },
  // call/values — function with multiple arguments
  { name: 'call-values', template: { $: 'call', name: 'int', values: [{ $: 'this' }, 16] }, input: 'FF' },

  // ---- format (required: pattern; optional: value, default) ----
  // FR-045/046: required-only and with optional params
  { name: 'format-pattern', template: { $: 'format', pattern: 'hello world' }, input: null },
  {
    name: 'format-value',
    template: { $: 'format', pattern: '{name}!', value: { $: 'this' } },
    input: { name: 'Alice' },
  },
  {
    name: 'format-default',
    template: { $: 'format', pattern: '{x}', value: { $: 'this' }, default: 'n/a' },
    input: {},
  },

  // ---- include (required: name; optional: default) ----
  // FR-045/046: structural only (include resolves at runtime via host loader)
  // Execution: both T and decode(encode(T)) will fail identically (no loader) → AC-035 passes.
  { name: 'include-name', template: { $: 'include', name: 'my_template' } },
  { name: 'include-default', template: { $: 'include', name: 'missing', default: 'fallback' } },

  // ---- switch (required: key, cases; optional: default) ----
  // FR-045/046: cases is a literal mapping (merged at codegen time per skeleton design)
  {
    name: 'switch-base',
    template: {
      $: 'switch',
      key: { $: 'this' },
      cases: { a: 1, b: 2 },
    },
    input: 'a',
  },
  {
    name: 'switch-default',
    template: {
      $: 'switch',
      key: { $: 'this' },
      cases: { x: 10 },
      default: 99,
    },
    input: 'z',
  },

  // ---- cond (required: cases; optional: default) ----
  // FR-045/046: cases is a list of {when, then}
  {
    name: 'cond-base',
    template: {
      $: 'cond',
      cases: [{ when: { $: 'this' }, then: 'truthy' }],
    },
    input: 1,
  },
  {
    name: 'cond-default',
    template: {
      $: 'cond',
      cases: [{ when: false, then: 'never' }],
      default: 'fallback',
    },
    input: null,
  },
];
