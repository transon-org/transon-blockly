// The M1 round-trip corpus (a subset of SPEC §15.8 covering the prototype `attr` rule and
// the structural skeleton). Each entry is an in-surface Transon template; `input` (when
// present) drives the execution-based semantic-identity check (AC-035, AD-011).
import type { Json } from '@transon/editor-core';

export interface CorpusEntry {
  name: string;
  template: Json;
  input?: Json;
}

export const M1_CORPUS: CorpusEntry[] = [
  // literals (type fidelity: number vs string, null, empty)
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
  // attr — both variants, optional default, nesting
  { name: 'attr-name', template: { $: 'attr', name: 'a' }, input: { a: 1 } },
  { name: 'attr-name-int', template: { $: 'attr', name: 0 }, input: [10, 20] },
  { name: 'attr-names', template: { $: 'attr', names: ['a', 'b'] }, input: { a: { b: 7 } } },
  { name: 'attr-default', template: { $: 'attr', name: 'missing', default: 'anon' }, input: {} },
  { name: 'attr-names-default-null', template: { $: 'attr', names: ['p'], default: null }, input: {} },
  { name: 'attr-nested', template: { $: 'attr', name: { $: 'attr', name: 'key' } }, input: { key: 'a', a: 99 } },
  // review #1 regression: a `default` value EQUAL to the old presence sentinel must NOT be dropped
  // (presence is key-based, not value-based). Output is the literal default since the key is absent.
  { name: 'attr-default-sentinel-value', template: { $: 'attr', name: 'missing', default: '__transon_absent__' }, input: {} },
  // out-of-surface → unsupported placeholder, exact preservation (AD-004, FR-031/034, §13.11)
  { name: 'unsupported-rule', template: { $: 'no_such_rule_xyz', x: 1 } },
  // review #2 regression: ambiguous (name+names) and foreign-param `attr` are out-of-surface
  // (engine DefinitionError at validate) → must NOT be silently rewritten; preserved exactly.
  { name: 'unsupported-attr-ambiguous', template: { $: 'attr', name: 'a', names: ['b'] } },
  { name: 'unsupported-attr-foreign-param', template: { $: 'attr', name: 'a', bogusparam: 1 } },
  // mixed deep structure
  { name: 'mixed', template: [{ $: 'attr', name: 'a' }, { k: [1, { $: 'attr', name: 'd', default: 0 }] }], input: { a: 5 } },
];
