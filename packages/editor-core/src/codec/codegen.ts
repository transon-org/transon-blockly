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
import { DOC_MARKER_PLACEHOLDER } from './vocabulary.js';
// The committed @-staged generators (the projection-as-data). generateCodec runs THESE; the
// typed builders below are the editable authoring source, held byte-equal by the regen gate.
import gEncode from './generators/G_encode.json' with { type: 'json' };
import gDecode from './generators/G_decode.json' with { type: 'json' };

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

// The codec inspects the DOCUMENT marker via this placeholder (distinct from the codec template's
// own `$` marker); the runtime substitutes the configured marker (default `$`) before executing,
// so one committed codec serves any marker (FR-063).
const DOC_MARKER = DOC_MARKER_PLACEHOLDER;

// keys of `this` (used by the skeleton, which walks `this` directly rather than via `set node`).
const THIS_KEYS: Json = { $: 'map', item: { $: 'key' } };
const isEmptyNames = (list: Json): Json => eqv(joinNames(list), KEY_NIL);
const thisHasKey = (name: Json): Json =>
  nev(joinNames({ $: 'chain', funcs: [THIS_KEYS, { $: 'filter', cond: eqv(THIS_T, name) }] }), KEY_NIL);

// The skeleton-owned literal-marker escape (FR-123, §11.4): `this` is an EXACTLY-shaped
// `{<marker>: "object", fields: X}` — marker value `object`, a `fields` key, and no other key.
// It represents the literal object X (which may itself carry the marker), and takes precedence
// over the (M2) `object` rule arm.
const isEscape: Json = {
  $: 'expr', op: 'and', values: [
    eqv({ $: 'attr', name: DOC_MARKER }, 'object'),
    thisHasKey('fields'),
    isEmptyNames({ $: 'chain', funcs: [
      THIS_KEYS, { $: 'filter', cond: nev(THIS_T, DOC_MARKER) }, { $: 'filter', cond: nev(THIS_T, 'fields') },
    ] }),
  ],
};
// Emit `transon_object_literal` for the literal object that is the current `this` (its key/value
// pairs recurse). Reused for a marker-free object and for the escape's `fields` payload.
const encObjectLiteral: Json = { $: 'object', fields: {
  type: 'transon_object_literal',
  extraState: { $: 'object', fields: { keys: THIS_KEYS } },
  inputs: { $: 'map', key: { $: 'format', pattern: 'VALUE{}', value: { $: 'index' } },
            value: { $: 'object', fields: { block: { $: 'include', name: 'enc' } } } },
} };

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
    NODE_KEYS, { $: 'filter', cond: nev(THIS_T, DOC_MARKER) }, { $: 'filter', cond: isForeignKey },
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
    lit({ $: 'object', key: DOC_MARKER, value: RULE_NAME }),
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
      cases: [
        // marker absent → a normal literal object
        { when: eqv({ $: 'attr', name: DOC_MARKER, default: '__transon_no_marker__' }, '__transon_no_marker__'),
          then: encObjectLiteral },
        // literal-marker escape (FR-123): `{<marker>:object, fields:X}` → the literal object X,
        // taking precedence over rule dispatch
        { when: isEscape, then: { $: 'chain', funcs: [{ $: 'attr', name: 'fields' }, encObjectLiteral] } },
      ],
      // otherwise dispatch on the rule name; unknown rule → out of surface
      default: { $: 'switch', key: { $: 'attr', name: DOC_MARKER }, cases: dispatchCases,
                 default: { $: 'object', fields: { type: 'transon_unsupported', extraState: { $: 'object', fields: { raw: { $: 'this' } } } } } } } },
  default: { $: 'object', fields: { type: 'transon_literal', fields: { $: 'object', fields: { VALUE: { $: 'this' } } } } },
});

const FIXED_DEC_CASES: Record<string, Json> = {
  transon_literal: { $: 'chain', funcs: [{ $: 'attr', name: 'fields' }, { $: 'attr', name: 'VALUE' }] },
  transon_array: { $: 'chain', funcs: [{ $: 'attr', name: 'inputs' },
    { $: 'map', item: { $: 'chain', funcs: [{ $: 'attr', name: 'block' }, { $: 'include', name: 'dec' }] } }] },
  transon_object_literal: { $: 'chain', funcs: [
    { $: 'attr', name: 'extraState' }, { $: 'attr', name: 'keys' },
    { $: 'map', key: { $: 'this' },
      value: { $: 'chain', funcs: [{ $: 'get', name: 'blk' }, { $: 'attr', name: 'inputs' },
        { $: 'attr', name: { $: 'format', pattern: 'VALUE{}', value: { $: 'index' } } },
        { $: 'attr', name: 'block' }, { $: 'include', name: 'dec' }] } },
    // `this` is now the rebuilt literal object. If it carries the marker key, reproduce the
    // §11.4 escape `{<marker>:object, fields:<object>}`; otherwise emit it directly (FR-123).
    { $: 'cond',
      cases: [{ when: thisHasKey(DOC_MARKER),
                then: { $: 'join', sep: '', items: [
                  { $: 'object', key: DOC_MARKER, value: 'object' },
                  { $: 'object', key: 'fields', value: { $: 'this' } }] } }],
      default: { $: 'this' } }] },
  transon_unsupported: { $: 'chain', funcs: [{ $: 'attr', name: 'extraState' }, { $: 'attr', name: 'raw' }] },
};
const decSkeleton = (allCases: Json): Json => ({ $: 'chain', funcs: [
  { $: 'set', name: 'blk' },
  { $: 'switch', key: { $: 'attr', name: 'type' }, cases: allCases, default: { $: 'this' } },
] });

// ---- block-map encoder (FR-091/094/122, §9.12) ----
// A fixed, metadata-free template that walks the document and emits a NESTED tree of nodes, each
// carrying its raw path SEGMENT (the parent key/index), `rule_name` (rule nodes), and
// `parameter_name` (rule params). The runtime assembles the flat JsonPathBlockMap — the unique,
// escaped JSON path (`block_id`/`template_path`) and `nearest_parent_block_id` (FR-094) — from the
// tree (escaping `/` in keys, which the engine cannot). Emitted ALONGSIDE the workspace; separate
// from the main codec, which stays untouched.
const MSELF: Json = { $: 'get', name: 'self' };
const mField = (name: string): Json => ({ $: 'chain', funcs: [MSELF, { $: 'attr', name }] });
const M_N = mField('n');
const mCtx = (n: Json, seg: Json, pname?: Json): Json => ({
  $: 'object', fields: pname === undefined ? { n, seg } : { n, seg, pn: pname },
});
// a tree node: its segment + parameter_name (omitted via NO_CONTENT when absent), optional rule_name, children.
const mNode = (rule: Json | null, children: Json): Json => ({
  $: 'object', fields: { seg: mField('seg'), parameter_name: mField('pn'), ...(rule ? { rule_name: rule } : {}), children },
});
const mRecurse = (ctxObj: Json): Json => ({ $: 'chain', funcs: [ctxObj, { $: 'include', name: 'mapenc' }] });
const M_KEY: Json = { $: 'key' };
const M_INDEX: Json = { $: 'index' };
// recurse into a node's entries; for a rule, drop the marker entry and tag each child with its param name.
const mChildren = (seg: Json, pname: Json | undefined, dropMarker: boolean): Json => ({
  $: 'chain', funcs: [
    M_N,
    ...(dropMarker ? [{ $: 'filter', cond: nev(M_KEY, DOC_MARKER) }] : []),
    { $: 'map', item: mRecurse(mCtx(THIS_T, seg, pname)) },
  ],
});
const BLOCKMAP_ENCODER: Json = { $: 'chain', funcs: [
  { $: 'set', name: 'self' },
  { $: 'switch', key: { $: 'call', name: 'type', value: M_N },
    cases: {
      object: { $: 'cond',
        cases: [{ when: nev({ $: 'chain', funcs: [M_N, { $: 'attr', name: DOC_MARKER, default: '__transon_no_marker__' }] }, '__transon_no_marker__'),
                  then: mNode({ $: 'chain', funcs: [M_N, { $: 'attr', name: DOC_MARKER }] }, mChildren(M_KEY, M_KEY, true)) }],
        default: mNode(null, mChildren(M_KEY, undefined, false)) },
      array: mNode(null, mChildren(M_INDEX, undefined, false)),
    },
    default: mNode(null, []) } ] };

/** The prototype rule(s) projected in M1 (the de-risk slice). M2 extends this list. */
export const M1_RULES = ['attr'];

// The per-rule `@`-staged generators are committed as inspectable, tool-agnostic projection
// DATA under `src/codec/generators/` (AD-026: the surface is projection(metadata), and the
// projection itself is data, not hidden code). The typed builders above are the editable
// authoring source; `generateCodec` runs the committed JSON copies, and the regen gate keeps
// the two byte-equal (AD-030). The rule-agnostic skeleton stays in this driver — it has the
// driver-injected dispatch/case holes and does not vary per rule (AD-028).
export const GENERATOR_FILES = { encode: 'G_encode.json', decode: 'G_decode.json' } as const;
export const GENERATOR_SOURCES: Record<string, Json> = {
  [GENERATOR_FILES.encode]: G_RULE_ENCODE,
  [GENERATOR_FILES.decode]: G_RULE_DECODE_CASES,
};

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
): Promise<{ encoder: CodecArtifact; decoder: CodecArtifact; blockmap: CodecArtifact }> {
  const catalogRules = editorMetadata.catalog.rules;
  const encFragments: Record<string, Json> = {};
  const decCases: Record<string, Json> = { ...FIXED_DEC_CASES };
  const dispatch: Record<string, Json> = {};

  for (const name of rules) {
    const entry = catalogRules.find((r: CatalogEntry) => r.name === name);
    if (!entry) throw new Error(`codegen: rule '${name}' not in metadata catalog`);
    encFragments[`enc__${name}`] = await runGen(engine, gEncode as unknown as Json, entry as unknown as Json);
    const cases = (await runGen(engine, gDecode as unknown as Json, entry as unknown as Json)) as Record<string, Json>;
    Object.assign(decCases, cases);
    dispatch[name] = { $: 'include', name: `enc__${name}` };
  }

  const encoder: CodecArtifact = { entry: 'enc', fragments: { enc: encSkeleton(dispatch), ...encFragments } };
  const decoder: CodecArtifact = { entry: 'dec', fragments: { dec: decSkeleton(decCases) } };
  // The block-map encoder is rule-agnostic (no per-rule projection), so it is a fixed artifact.
  const blockmap: CodecArtifact = { entry: 'mapenc', fragments: { mapenc: BLOCKMAP_ENCODER } };
  return { encoder, decoder, blockmap };
}

/**
 * Deterministic, key-sorted JSON serialization (+ trailing newline) so the regen gates can
 * byte-compare committed data (artifacts and the generator sources) against a fresh build
 * (AD-030). The trailing newline matches POSIX text files.
 */
export function stableStringify(value: Json): string {
  const sortKeys = (_key: string, v: unknown): unknown => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const src = v as Record<string, unknown>;
      return Object.keys(src).sort().reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = src[k];
        return acc;
      }, {});
    }
    return v;
  };
  return JSON.stringify(value, sortKeys, 2) + '\n';
}

/** Serialize a committed codec artifact deterministically (AD-030). */
export function serializeArtifact(a: CodecArtifact): string {
  return stableStringify(a as unknown as Json);
}
