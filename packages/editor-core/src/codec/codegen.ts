// Codec generation — the metadata→codec projection (AD-026, AD-027, AD-030, FR-114/115/116/119/120).
//
// The codec is a *projection of metadata*, not hand-written: per-rule encode/decode arms are
// produced by running `@`-staged generator templates (the `G_*`) through the host engine,
// which emit `$`-codecs (the two-pass generate-then-run model, AD-027). The rule-agnostic
// skeleton owns the invariants (AD-028); only the per-rule arms are projected, so a new rule
// is added by metadata alone — no skeleton/code change (AC-034, NFR-046).
//
// This is the projection compiler (AD-026), NOT a codec↔workspace mapping layer (FR-126,
// AD-032): it constructs generator templates and runs them via an injected EngineProvider
// (the M0 Node→Python adapter at build time); it never reads a workspace block's
// `type`/`inputs`/`fields` to translate it. It is pure (no fs/IO) — the artifacts it returns
// are serialized + committed by the regen gate, and executed at runtime by `run.ts` through a
// host engine (engine-free, AD-008).

import type { EngineProvider, Json } from '../engine/ports.js';
import { editorMetadata, type CatalogEntry } from '../metadata/snapshot.js';

/** The marker the `@`-staged generators run under (AD-027). */
const META_MARKER = '@';

// ---- generator construction helpers (mirror the proven projection; @ = evaluate-now) ----
const at = (name: Json): Json => ({ '@': 'attr', name });
const lit = (fields: Json): Json => ({ '@': 'object', fields }); // emit a $-object literal
// the rule name, read at generation time from the `entry` variable set at the top of a generator
const RULE_NAME: Json = { '@': 'chain', funcs: [{ '@': 'get', name: 'entry' }, { '@': 'attr', name: 'name' }] };
const blockType = (variantIdHole: Json): Json => ({
  '@': 'join',
  items: ['transon_rule_', RULE_NAME, '__', variantIdHole],
  sep: '',
});

// Value-independent presence + variant matching ($-runtime). Presence must NOT be decided by
// comparing a param's VALUE to a sentinel — a param whose value equals the sentinel would be
// misread as absent (review #1). Instead, decide from the node's KEY set: required/allowed param
// names are generation-time-known, so membership unrolls to == / != against literal names, and
// only the node's keys are walked at runtime. This also rejects ambiguous / foreign-param nodes
// as out-of-surface (review #2): they match no variant exactly → the cond default → unsupported.
const KEY_NIL = 'transon::absent-key'; // join-of-empty marker; a real param/key name never equals it
const THIS_T: Json = { $: 'this' };
const NODE_KEYS: Json = { $: 'chain', funcs: [{ $: 'get', name: 'node' }, { $: 'map', item: { $: 'key' } }] };
const eqv = (a: Json, b: Json): Json => ({ $: 'expr', op: '==', values: [a, b] });
const nev = (a: Json, b: Json): Json => ({ $: 'expr', op: '!=', values: [a, b] });
const joinNames = (list: Json): Json => ({ $: 'join', items: list, sep: ',', default: KEY_NIL });
// the node has a key === paramHole (paramHole is a generation-time literal name spliced via @)
const keyPresent = (paramHole: Json): Json =>
  nev(joinNames({ $: 'chain', funcs: [NODE_KEYS, { $: 'filter', cond: eqv(THIS_T, paramHole) }] }), KEY_NIL);

// ---- G_rule_encode: project a rule's encode arm from its metadata ----
// per-param value input ($); emitted only when the param key is present on the node (FR-025).
const encRecurse = (paramHole: Json): Json =>
  lit({
    $: 'cond',
    cases: [{
      when: keyPresent(paramHole),
      then: { $: 'object', fields: { block: { $: 'chain', funcs: [{ $: 'attr', name: paramHole }, { $: 'include', name: 'enc' }] } } },
    }],
  });

// WHEN: the node is an EXACT match for this variant — every required param is a key AND no
// non-marker key is foreign to the variant's declared params. (Lists are non-empty for every
// catalog variant, so `expr and` is always given ≥1 operand.)
const allRequiredPresent: Json = {
  $: 'expr', op: 'and',
  values: { '@': 'chain', funcs: [
    at('params'), { '@': 'filter', cond: at('required') },
    { '@': 'map', item: keyPresent(at('name')) },
  ] },
};
const isForeignKey: Json = { // THIS is a node key; foreign === differs from every declared param name
  $: 'expr', op: 'and',
  values: { '@': 'chain', funcs: [at('params'), { '@': 'map', item: nev(THIS_T, at('name')) }] },
};
const noForeignKey: Json = eqv(
  joinNames({ $: 'chain', funcs: [
    NODE_KEYS, { $: 'filter', cond: nev(THIS_T, '$') }, { $: 'filter', cond: isForeignKey },
  ] }),
  KEY_NIL,
);
const ENC_WHEN: Json = lit({ $: 'expr', op: 'and', values: [allRequiredPresent, noForeignKey] });
const ENC_THEN: Json = lit({
  $: 'object', fields: {
    type: blockType(at('id')),
    inputs: lit({ $: 'object', fields: { '@': 'chain', funcs: [
      at('params'), { '@': 'map', key: at('name'), value: encRecurse(at('name')) },
    ] } }),
  },
});
const ENC_UNSUPPORTED: Json = lit({ $: 'object', fields: { type: 'transon_unsupported', extraState: { $: 'object', fields: { raw: { $: 'this' } } } } });
const G_RULE_ENCODE: Json = { '@': 'chain', funcs: [
  { '@': 'set', name: 'entry' },
  // the emitted arm captures the node (`set node`) so the matcher can read its key set, then
  // dispatches to the first exactly-matching variant, else `transon_unsupported`.
  lit({ $: 'chain', funcs: [
    { $: 'set', name: 'node' },
    lit({
      $: 'cond',
      cases: { '@': 'chain', funcs: [at('variants'), { '@': 'map', item: lit({ when: ENC_WHEN, then: ENC_THEN }) }] },
      default: ENC_UNSUPPORTED,
    }),
  ] }),
] };

// ---- G_rule_decode_cases: project { <blockType>: <reconstruction> } per variant ----
const decInput = (paramHole: Json): Json => {
  // present === the block's `inputs` object has a key === paramHole (key-based, not value-based:
  // the codec never confuses a value with a key, mirroring the encoder — review #1).
  const inputKeys: Json = { $: 'chain', funcs: [{ $: 'get', name: 'blk' }, { $: 'attr', name: 'inputs' }, { $: 'map', item: { $: 'key' } }] };
  const inputPresent: Json = nev(joinNames({ $: 'chain', funcs: [inputKeys, { $: 'filter', cond: eqv(THIS_T, paramHole) }] }), KEY_NIL);
  return lit({
    $: 'cond',
    cases: [{
      when: inputPresent,
      then: { $: 'chain', funcs: [
        { $: 'get', name: 'blk' }, { $: 'attr', name: 'inputs' },
        { $: 'attr', name: paramHole }, { $: 'attr', name: 'block' }, { $: 'include', name: 'dec' },
      ] },
    }],
  });
};
const DEC_RECON: Json = lit({
  $: 'join', items: [
    lit({ $: 'object', key: '$', value: RULE_NAME }),
    lit({ $: 'object', fields: { '@': 'chain', funcs: [
      at('params'), { '@': 'map', key: at('name'), value: decInput(at('name')) },
    ] } }),
  ],
});
const G_RULE_DECODE_CASES: Json = { '@': 'chain', funcs: [
  { '@': 'set', name: 'entry' },
  { '@': 'chain', funcs: [at('variants'), { '@': 'map', key: blockType(at('id')), value: DEC_RECON }] },
] };

// ---- fixed, rule-agnostic skeleton (AD-028); dispatch/cases merged at build time ----
const encSkeleton = (dispatchCases: Json): Json => ({
  $: 'switch', key: { $: 'call', name: 'type', value: { $: 'this' } },
  cases: {
    array: { $: 'object', fields: { type: 'transon_array',
      inputs: { $: 'map', key: { $: 'format', pattern: 'ITEM{}', value: { $: 'index' } },
                value: { $: 'object', fields: { block: { $: 'include', name: 'enc' } } } } } },
    object: { $: 'cond',
      cases: [{ when: { $: 'expr', op: 'eq', values: [{ $: 'attr', name: '$', default: '__transon_no_marker__' }, '__transon_no_marker__'] },
                then: { $: 'object', fields: { type: 'transon_object_literal',
                  extraState: { $: 'object', fields: { keys: { $: 'map', item: { $: 'key' } } } },
                  inputs: { $: 'map', key: { $: 'format', pattern: 'VALUE{}', value: { $: 'index' } },
                            value: { $: 'object', fields: { block: { $: 'include', name: 'enc' } } } } } } }],
      default: { $: 'switch', key: { $: 'attr', name: '$' }, cases: dispatchCases,
                 default: { $: 'object', fields: { type: 'transon_unsupported', extraState: { $: 'object', fields: { raw: { $: 'this' } } } } } } } },
  default: { $: 'object', fields: { type: 'transon_literal', fields: { $: 'object', fields: { VALUE: { $: 'this' } } } } },
});

const FIXED_DEC_CASES: Record<string, Json> = {
  transon_literal: { $: 'chain', funcs: [{ $: 'attr', name: 'fields' }, { $: 'attr', name: 'VALUE' }] },
  transon_array: { $: 'chain', funcs: [{ $: 'attr', name: 'inputs' },
    { $: 'map', item: { $: 'chain', funcs: [{ $: 'attr', name: 'block' }, { $: 'include', name: 'dec' }] } }] },
  transon_object_literal: { $: 'chain', funcs: [{ $: 'attr', name: 'extraState' }, { $: 'attr', name: 'keys' },
    { $: 'map', key: { $: 'this' },
      value: { $: 'chain', funcs: [{ $: 'get', name: 'blk' }, { $: 'attr', name: 'inputs' },
        { $: 'attr', name: { $: 'format', pattern: 'VALUE{}', value: { $: 'index' } } },
        { $: 'attr', name: 'block' }, { $: 'include', name: 'dec' }] } }] },
  transon_unsupported: { $: 'chain', funcs: [{ $: 'attr', name: 'extraState' }, { $: 'attr', name: 'raw' }] },
};
const decSkeleton = (allCases: Json): Json => ({ $: 'chain', funcs: [
  { $: 'set', name: 'blk' },
  { $: 'switch', key: { $: 'attr', name: 'type' }, cases: allCases, default: { $: 'this' } },
] });

/** The prototype rule(s) projected in M1 (the de-risk slice). M2 extends this list. */
export const M1_RULES = ['attr'];

/** The committed codec bundle shape: a self-`include`-able fragment map plus an entry name. */
export interface CodecArtifact {
  entry: string;
  fragments: Record<string, Json>;
}

async function runGen(engine: EngineProvider, generator: Json, ruleEntry: Json): Promise<Json> {
  const res = await engine.transform(generator, ruleEntry, { marker: META_MARKER });
  if (res.status !== 'ok' || !res.success) {
    throw new Error(`codegen failed: ${res.error_message ?? 'unknown'} (${res.raw_engine_error ?? ''})`);
  }
  return res.output as Json;
}

/**
 * Generate the encoder + decoder artifacts by running the `@`-staged generators over the
 * pinned metadata (AD-030). Pure: returns the artifacts, writes nothing.
 */
export async function generateCodec(
  engine: EngineProvider,
  rules: string[] = M1_RULES,
): Promise<{ encoder: CodecArtifact; decoder: CodecArtifact }> {
  const catalogRules = editorMetadata.catalog.rules;
  const encFragments: Record<string, Json> = {};
  const decCases: Record<string, Json> = { ...FIXED_DEC_CASES };
  const dispatch: Record<string, Json> = {};

  for (const name of rules) {
    const entry = catalogRules.find((r: CatalogEntry) => r.name === name);
    if (!entry) throw new Error(`codegen: rule '${name}' not in metadata catalog`);
    encFragments[`enc__${name}`] = await runGen(engine, G_RULE_ENCODE, entry as unknown as Json);
    const cases = (await runGen(engine, G_RULE_DECODE_CASES, entry as unknown as Json)) as Record<string, Json>;
    Object.assign(decCases, cases);
    dispatch[name] = { $: 'include', name: `enc__${name}` };
  }

  const encoder: CodecArtifact = { entry: 'enc', fragments: { enc: encSkeleton(dispatch), ...encFragments } };
  const decoder: CodecArtifact = { entry: 'dec', fragments: { dec: decSkeleton(decCases) } };
  return { encoder, decoder };
}

/**
 * Deterministic, key-sorted serialization so the regen gate can byte-compare the committed
 * artifacts against a fresh generation (AD-030). The trailing newline matches POSIX text files.
 */
export function serializeArtifact(a: CodecArtifact): string {
  const sortKeys = (_key: string, value: unknown): unknown => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const src = value as Record<string, unknown>;
      return Object.keys(src).sort().reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = src[k];
        return acc;
      }, {});
    }
    return value;
  };
  return JSON.stringify(a, sortKeys, 2) + '\n';
}
