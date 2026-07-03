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
import { PRESENTATION, type Presentation } from './presentation.js';
// The committed @-staged generators (the projection-as-data). generateCodec runs THESE; the
// typed builders below are the editable authoring source, held byte-equal by the regen gate.
import gEncode from './generators/G_encode.json' with { type: 'json' };
import gDecode from './generators/G_decode.json' with { type: 'json' };
import gToolbox from './generators/G_toolbox.json' with { type: 'json' };
import gPalette from './generators/G_palette.json' with { type: 'json' };

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

// True when the node's `fields` payload itself contains the marker key. This is what makes the
// §11.4 escape (a literal object that must *contain* the marker key) distinguishable from the
// `object`/`fields` RULE: a marker-bearing payload (e.g. `{<marker>:"v"}`) cannot be written as a
// plain literal, so it is the escape; a marker-FREE payload is the rule.
const fieldsHasMarkerKey: Json = nev(
  joinNames({ $: 'chain', funcs: [
    { $: 'attr', name: 'fields', default: {} },
    { $: 'map', item: { $: 'key' } },
    { $: 'filter', cond: eqv(THIS_T, DOC_MARKER) },
  ] }),
  KEY_NIL,
);

// The skeleton-owned literal-marker escape (FR-123, §11.4): `this` is an EXACTLY-shaped
// `{<marker>: "object", fields: X}` — marker value `object`, a `fields` key, no other key, AND the
// `fields` payload X *contains the marker key*. It represents the literal object X (§11.4: "a
// literal object that must contain the marker key") and takes precedence over the `object` rule arm.
// A marker-FREE `{<marker>:object, fields:X}` is NOT the escape — it is the `object`/`fields` RULE
// (which omits NO_CONTENT values), so it falls through to the rule arm and round-trips as the rule
// (`transon_rule_object__fields`), not as a bare literal that would drop the wrapper.
const isEscape: Json = {
  $: 'expr', op: 'and', values: [
    eqv({ $: 'attr', name: DOC_MARKER }, 'object'),
    thisHasKey('fields'),
    isEmptyNames({ $: 'chain', funcs: [
      THIS_KEYS, { $: 'filter', cond: nev(THIS_T, DOC_MARKER) }, { $: 'filter', cond: nev(THIS_T, 'fields') },
    ] }),
    fieldsHasMarkerKey,
  ],
};

// The skeleton-level out-of-surface placeholder ($-form): preserves the raw node verbatim (AD-004,
// §13.11). Shared by the object-branch malformed guard and the rule-dispatch default below.
const SKELETON_UNSUPPORTED: Json = {
  $: 'object', fields: { type: 'transon_unsupported', extraState: { $: 'object', fields: { raw: { $: 'this' } } } },
};

// A `{<marker>:object, fields:X}` whose `fields` payload X is NOT a dict is malformed — the engine
// requires `fields` to be a mapping. It is neither the escape nor a valid `object`/`fields` rule
// node, so it is out of surface → transon_unsupported with exact preservation (§15.7, FR-123).
// `call type` returns `'object'` for a dict (the same predicate the skeleton switches on). Checked
// BEFORE the escape so the non-dict never reaches the dict-walking escape/rule paths (which would
// otherwise raise a codec error instead of emitting the placeholder).
// NOTE: `expr and` evaluates every operand (no short-circuit), and `call type` raises on a
// NoContent value — so the `fields` lookup carries a `{}` default. For a node WITHOUT a `fields`
// key the type is then `object` (≠-test false) and the `thisHasKey('fields')` operand already
// makes the whole `and` false; a present non-dict `fields` keeps its real (non-dict) type.
const isMalformedObjectFields: Json = {
  $: 'expr', op: 'and', values: [
    eqv({ $: 'attr', name: DOC_MARKER }, 'object'),
    thisHasKey('fields'),
    nev({ $: 'call', name: 'type', value: { $: 'attr', name: 'fields', default: {} } }, 'object'),
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

// FR-118 / FR-047: disposition helpers — resolve at @-time from enriched variant params.
// After driver enrichment (see generateCodec), each variant param carries a `kind` field
// (copied from the rule-level param by name). These @-time filters partition the params:
const AT_CONSTANT_PARAMS: Json = { '@': 'chain', funcs: [
  at('params'),
  { '@': 'filter', cond: { '@': 'expr', op: '==', values: [at('kind'), 'constant'] } },
] };
const AT_DYNAMIC_PARAMS: Json = { '@': 'chain', funcs: [
  at('params'),
  { '@': 'filter', cond: { '@': 'expr', op: '!=', values: [at('kind'), 'constant'] } },
] };
// @-time sentinel for "no constant params" (separate from $-runtime KEY_NIL):
const AT_KEY_NIL = 'transon::absent-key@gen';
// True at @-time when there is at least one constant param in the variant:
const atHasConstantParams: Json = { '@': 'expr', op: '!=', values: [
  { '@': 'join', sep: ',', default: AT_KEY_NIL, items: { '@': 'chain', funcs: [
    AT_CONSTANT_PARAMS, { '@': 'map', item: at('name') },
  ] } },
  AT_KEY_NIL,
] };

// per-param constant field ($): reads the raw scalar verbatim from the node (FR-024).
// Emitted only when the param key is present on the node (FR-025, key-based not value-based).
// The value is NOT recursed through `include enc` — it is a literal scalar choice.
const encField = (paramHole: Json): Json =>
  lit({
    $: 'cond',
    cases: [{
      when: keyPresent(paramHole),
      then: { $: 'attr', name: paramHole },   // verbatim scalar, no sub-encoding
    }],
  });

// per-param dynamic value input ($); emitted only when the param key is present (FR-025).
const encRecurse = (paramHole: Json): Json =>
  lit({
    $: 'cond',
    cases: [{
      when: keyPresent(paramHole),
      then: { $: 'object', fields: { block: { $: 'chain', funcs: [{ $: 'attr', name: paramHole }, { $: 'include', name: 'enc' }] } } },
    }],
  });

// WHEN: the node is an EXACT match for this variant — every required param is a key AND no
// non-marker key is foreign to the variant's declared params.
//
// R1 FIX (empty-operand): The six zero-param rules (`this`, `parent`, `item`, `key`, `index`,
// `value`) have an empty required-param list and an empty variant-param list. The ORIGINAL
// `allRequiredPresent` (expr and over [keyPresent(p) for required p]) and `isForeignKey`
// (expr and over [nev(this, p.name) for p in variant.params]) both used `expr and` over a
// $-runtime list that may be empty → DefinitionError (engine requires ≥1 operand for `and`).
//
// FIX: reframe both onto the join-of-empty membership pattern already used by `keyPresent`/
// `noForeignKey`. `{$:join, items:[], default:KEY_NIL}` → `KEY_NIL`, so `join == KEY_NIL` is
// vacuously true on empty lists.
//
// allRequiredPresent:
//   NEW: "no required param is absent from node keys"
//   Build the @-time literal array of required param names, embed it in the $-codec, then at
//   $-runtime filter it keeping only names absent from node keys, join, compare to KEY_NIL.
//   Empty required list → $:filter over [] → [] → join default → KEY_NIL == KEY_NIL → true ✓
//
//   Inner filter condition: save the current param name as _rp, then check if _rp is absent
//   from node keys using a keyPresent-style $-filter on NODE_KEYS.
//
const allRequiredPresent: Json = eqv(
  joinNames({ $: 'chain', funcs: [
    // @-time: produce literal array of required param names ([] for zero-param rules)
    { '@': 'chain', funcs: [
      at('params'), { '@': 'filter', cond: at('required') }, { '@': 'map', item: at('name') }
    ] },
    // $-time: filter keeping those ABSENT from node keys
    { $: 'filter', cond: { $: 'chain', funcs: [
      { $: 'set', name: '_rp' },   // save current param name (this = param name in outer $:filter)
      // is _rp not a node key?
      eqv(
        joinNames({ $: 'chain', funcs: [NODE_KEYS, { $: 'filter', cond: eqv(THIS_T, { $: 'get', name: '_rp' }) }] }),
        KEY_NIL,
      ),
    ] } },
  ] }),
  KEY_NIL,
);

// isForeignKey: THIS is a node key; foreign === no declared param name equals THIS key.
//   NEW: "no declared param has this name"
//   Build the @-time literal array of variant param names, embed in the $-codec, then at
//   $-runtime save the node key as _fk, filter the param names by == _fk, join, compare
//   to KEY_NIL.
//   Empty params list → $:filter over [] → [] → join default → KEY_NIL == KEY_NIL → true
//   (correct: with no declared params every key is foreign) ✓
//
const isForeignKey: Json = eqv( // THIS is a node key; foreign === no declared param has this name
  joinNames({ $: 'chain', funcs: [
    { $: 'set', name: '_fk' },    // save node key (this = node key in outer $:filter over NODE_KEYS)
    // @-time: produce literal array of variant param names ([] for zero-param rules)
    { '@': 'chain', funcs: [at('params'), { '@': 'map', item: at('name') }] },
    // $-time: filter keeping param names that match the saved node key
    { $: 'filter', cond: eqv({ $: 'this' }, { $: 'get', name: '_fk' }) },
  ] }),
  KEY_NIL,
);
const noForeignKey: Json = eqv(
  joinNames({ $: 'chain', funcs: [
    NODE_KEYS, { $: 'filter', cond: nev(THIS_T, DOC_MARKER) }, { $: 'filter', cond: isForeignKey },
  ] }),
  KEY_NIL,
);
const ENC_WHEN: Json = lit({ $: 'expr', op: 'and', values: [allRequiredPresent, noForeignKey] });

// FR-118 / FR-124 / FR-047: emit the block as a $:join of 2 or 3 $-objects so the
// `fields` (constant params) key is conditionally included.
//
//   item 0 — always: { type: "transon_rule_<rule>__<variant>" }
//   item 1 — @-time: if the variant has ANY constant params:
//              { fields: { <paramName>: <cond-verbatim-scalar>, ... } }
//   item 2 — always: { inputs: { <paramName>: <cond-encRecurse>, ... } }
//              (may be {} for zero-dynamic-param variants; harmless)
//
// The @-time conditional uses @:cond to produce either [fields_item] or [] (empty),
// then @:join concatenates the three arrays before they become the $:join items list.
//
// Convention (FR-118): constant param name → used verbatim as the block field key.
//   e.g. `expr.op` → fields.op, `call.name` → fields.name.
const TYPE_ITEM: Json = lit({ $: 'object', fields: { type: blockType(at('id')) } });
const FIELDS_ITEM: Json = lit({
  $: 'object', fields: {
    fields: lit({ $: 'object', fields: { '@': 'chain', funcs: [
      AT_CONSTANT_PARAMS, { '@': 'map', key: at('name'), value: encField(at('name')) },
    ] } }),
  },
});
const INPUTS_ITEM: Json = lit({
  $: 'object', fields: {
    inputs: lit({ $: 'object', fields: { '@': 'chain', funcs: [
      AT_DYNAMIC_PARAMS, { '@': 'map', key: at('name'), value: encRecurse(at('name')) },
    ] } }),
  },
});
const ENC_THEN: Json = lit({
  $: 'join', sep: '', items: {
    '@': 'join', sep: '', items: [
      [TYPE_ITEM],
      { '@': 'cond', cases: [{ when: atHasConstantParams, then: [FIELDS_ITEM] }], default: [] },
      [INPUTS_ITEM],
    ],
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

// FR-118 / FR-126: constant params read from blk.fields[<name>] (verbatim scalar);
// dynamic params read from blk.inputs[<name>].block (recursed via include dec).
// Presence is key-based (never value-based — review #1).

const decField = (paramHole: Json): Json => {
  // present === the block's `fields` object has a key === paramHole
  const fieldKeys: Json = { $: 'chain', funcs: [{ $: 'get', name: 'blk' }, { $: 'attr', name: 'fields' }, { $: 'map', item: { $: 'key' } }] };
  const fieldPresent: Json = nev(joinNames({ $: 'chain', funcs: [fieldKeys, { $: 'filter', cond: eqv(THIS_T, paramHole) }] }), KEY_NIL);
  return lit({
    $: 'cond',
    cases: [{
      when: fieldPresent,
      then: { $: 'chain', funcs: [
        { $: 'get', name: 'blk' }, { $: 'attr', name: 'fields' },
        { $: 'attr', name: paramHole },   // verbatim scalar, no sub-decoding
      ] },
    }],
  });
};

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

// DEC_RECON: reconstruct the Transon node from block type + fields (constant) + inputs (dynamic).
// Uses $:join of 3 $-objects; an empty constant or dynamic map contributes {} which is identity.
const DEC_RECON: Json = lit({
  $: 'join', items: [
    lit({ $: 'object', key: DOC_MARKER, value: RULE_NAME }),
    // constant params ← blk.fields
    lit({ $: 'object', fields: { '@': 'chain', funcs: [
      AT_CONSTANT_PARAMS, { '@': 'map', key: at('name'), value: decField(at('name')) },
    ] } }),
    // dynamic params ← blk.inputs
    lit({ $: 'object', fields: { '@': 'chain', funcs: [
      AT_DYNAMIC_PARAMS, { '@': 'map', key: at('name'), value: decInput(at('name')) },
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
    // extraState.items = the item indices [0..n-1]; the Blockly `transon_array_mutator` reads its
    // length to rebuild the ITEM{n} inputs at load time (Blockly errors on an input the block
    // doesn't declare). UI-only structural state (§11.5), symmetric with object_literal's
    // extraState.keys; the decoder ignores it (it walks `inputs`), so round-trip is unchanged.
    array: { $: 'object', fields: { type: 'transon_array',
      extraState: { $: 'object', fields: { items: { $: 'map', item: { $: 'index' } } } },
      inputs: { $: 'map', key: { $: 'format', pattern: 'ITEM{}', value: { $: 'index' } },
                value: { $: 'object', fields: { block: { $: 'include', name: 'enc' } } } } } },
    object: { $: 'cond',
      cases: [
        // marker absent → a normal literal object
        { when: eqv({ $: 'attr', name: DOC_MARKER, default: '__transon_no_marker__' }, '__transon_no_marker__'),
          then: encObjectLiteral },
        // malformed object/fields (non-dict `fields` payload) → out of surface (§15.7, FR-123).
        // Must precede the escape so the non-dict payload never reaches a dict-walking path.
        { when: isMalformedObjectFields, then: SKELETON_UNSUPPORTED },
        // literal-marker escape (FR-123): `{<marker>:object, fields:X}` (X carries the marker key)
        // → the literal object X, taking precedence over rule dispatch
        { when: isEscape, then: { $: 'chain', funcs: [{ $: 'attr', name: 'fields' }, encObjectLiteral] } },
      ],
      // otherwise dispatch on the rule name; unknown rule → out of surface
      default: { $: 'switch', key: { $: 'attr', name: DOC_MARKER }, cases: dispatchCases,
                 default: SKELETON_UNSUPPORTED } } },
  default: { $: 'object', fields: { type: 'transon_literal', fields: { $: 'object', fields: { VALUE: { $: 'this' } } } } },
});

const FIXED_DEC_CASES: Record<string, Json> = {
  transon_literal: { $: 'chain', funcs: [{ $: 'attr', name: 'fields' }, { $: 'attr', name: 'VALUE' }] },
  // `default: {}` makes decode tolerant of a missing `inputs` key: Blockly's workspace save()
  // DROPS an empty `inputs:{}`, so a Blockly-resaved empty array has no `inputs` — without the
  // default, `map` over the engine's NoContent throws. Behavior-preserving: when `inputs` is
  // present (always, for direct encoder output) the default is ignored; map over `{}` → [] (the
  // empty array). This hardens the reverse Blockly-save→decode path (FR-126 decoder-consume).
  transon_array: { $: 'chain', funcs: [{ $: 'attr', name: 'inputs', default: {} },
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

// ---- G_toolbox: project the Blockly toolbox/category structure (FR-044, FR-114, §12.4, AD-026) ----
//
// Unlike the codec generators (which emit a `$`-runtime codec), `G_toolbox` produces a STATIC
// artifact (the toolbox JSON the editor loads — it does not execute over user data). So it runs
// single-stage under the meta marker `@`: every `@`-dict evaluates and the output is literal
// Blockly `categoryToolbox` JSON.
//
// Input (`this`), assembled by `generateToolbox` from the committed presentation data + catalog
// (no category-name literals in TS — categories/order/colour come from presentation.json):
//   { categories: [ { name, colour, blocks: [{rule, variant}], structuralBlockTypes: [string] } ] }
// The template derives the `transon_rule_<rule>__<variant>` block-type name in-projection (the
// same naming the encoder emits, FR-124), so the block-type vocabulary has one authored source.
const tbAt = (name: string): Json => ({ '@': 'attr', name });
// one palette block entry for a rule variant; `this` = { rule, variant }.
const TB_RULE_BLOCK: Json = {
  kind: 'block',
  type: { '@': 'join', sep: '', items: ['transon_rule_', tbAt('rule'), '__', tbAt('variant')] },
};
// one palette block entry for a structural block; `this` = the block-type string.
const TB_STRUCTURAL_BLOCK: Json = { kind: 'block', type: { '@': 'this' } };
// a category node; `this` = a category. `contents` concatenates the rule-variant blocks and the
// structural blocks (both flat lists) via `@:join sep:''`.
const TB_CATEGORY: Json = {
  kind: 'category',
  name: tbAt('name'),
  colour: tbAt('colour'),
  contents: { '@': 'join', sep: '', items: [
    { '@': 'chain', funcs: [tbAt('blocks'), { '@': 'map', item: TB_RULE_BLOCK }] },
    { '@': 'chain', funcs: [tbAt('structuralBlockTypes'), { '@': 'map', item: TB_STRUCTURAL_BLOCK }] },
  ] },
};
const G_TOOLBOX: Json = {
  kind: 'categoryToolbox',
  contents: { '@': 'chain', funcs: [tbAt('categories'), { '@': 'map', item: TB_CATEGORY }] },
};

// ---- G_palette: project the Zelos block definitions per rule variant (FR-084/089/114, AD-026) ----
//
// Like G_toolbox, the palette is a STATIC artifact (block definitions the editor registers into
// Blockly, not executed over user data), so G_palette runs single-stage under the meta marker `@`.
// generatePalette enriches each rule entry with the variant params' `kind`/`options` (FR-118), a
// curated `menu` for constant+options params (FR-130, from presentation.json — no TS literals,
// FR-127), and the rule's presentation title + category colour, then this projection emits, per
// variant, a Blockly (Zelos) block definition. The FR-118 widget decision is made here in the
// projection via `@:cond` (never baked into metadata):
//   - dynamic param    → `input_value` (a value input)                          (§13.5)
//   - constant+options → `field_transon_dropdown` (curated or identity menu,
//                         full metadata domain accepted verbatim)      (§13.6, FR-058, FR-130)
//   - constant         → `field_input` (verbatim scalar field)                  (§13.6)
// Label = "<title> (<rule>)" (OQ-008, §12.5); colour = the rule's category colour (NFR-048).
//
// `this` of the projection is the enriched entry { name, title, colour, variants:[{id, params}] };
// each constant+options param already carries `menu` (curated `[[label,value],...]` pairs or the
// identity menu), computed in `enrichForPalette` (TS, not this projection).
const pGet = (name: string): Json => ({ '@': 'chain', funcs: [{ '@': 'get', name: 'pentry' }, { '@': 'attr', name }] });
const P_NAME = pGet('name');
const P_TITLE = pGet('title');
const P_COLOUR = pGet('colour');
const pAt = (name: string): Json => ({ '@': 'attr', name });
// "%<index+1>" — the Blockly message placeholder for the param at this position.
const P_PCT_INDEX: Json = { '@': 'format', pattern: '%{}', value: { '@': 'expr', op: 'add', values: [{ '@': 'index' }, 1] } };
// per-param message segment: " <paramName> %<n>"
const P_PARAM_SEG: Json = { '@': 'join', sep: '', items: [' ', pAt('name'), ' ', P_PCT_INDEX] };
// "<title> (<rule>)" label + the " <param> %n" segments (one per param) — shared by both layouts.
const P_LABEL: Json = { '@': 'join', sep: '', items: [P_TITLE, ' (', P_NAME, ')'] };
const P_PARAM_SEGS: Json = { '@': 'join', sep: '', items: { '@': 'chain', funcs: [pAt('params'), { '@': 'map', item: P_PARAM_SEG }] } };
// @-time predicates on a param: constant? has a resolved enum domain (`options`)?
const P_IS_CONSTANT: Json = { '@': 'expr', op: '==', values: [pAt('kind'), 'constant'] };
const P_HAS_OPTIONS: Json = { '@': 'expr', op: '!=', values: [
  { '@': 'join', sep: ',', default: '@noopt', items: { '@': 'attr', name: 'options', default: [] } }, '@noopt',
] };
// one args0 entry per param — the FR-118 widget decision (lazy @:cond, only one branch taken).
// FR-130: constant+options always uses the custom field — `menu` (from enrichForPalette) is the
// curated pairs when presentation declares them, else the identity menu; `accept` is the FULL
// metadata options domain, so every metadata-valid token stays accepted regardless of curation.
const P_ARG: Json = { '@': 'cond', cases: [
  { when: { '@': 'expr', op: 'and', values: [P_IS_CONSTANT, P_HAS_OPTIONS] },
    then: { type: 'field_transon_dropdown', name: pAt('name'), options: pAt('menu'), accept: pAt('options') } },
  { when: P_IS_CONSTANT,
    then: { type: 'field_input', name: pAt('name') } },
], default: { type: 'input_value', name: pAt('name') } };
// one widget per param (FR-118), in param order — shared as args0 (compact) or args1 (title-own-row).
const P_ARGS: Json = { '@': 'chain', funcs: [pAt('params'), { '@': 'map', item: P_ARG }] };
const P_TYPE: Json = { '@': 'join', sep: '', items: ['transon_rule_', P_NAME, '__', pAt('id')] };
// One block definition per variant. External inputs (FR-129, §13.10, AD-033): every value parameter
// connects from the SIDE via a puzzle socket (thrasos); the block body holds only fields + mutator
// controls, never inline-embedded values. When the variant has ≥2 value inputs (`multiInput`, a flag
// the driver computes — Transon has no length function) the title takes its own first row (a leading
// dummy input) and the named inputs start on the second row; otherwise the title and inputs share the
// flow. Display-only; round-trip-neutral (§21.12) — codec unchanged.
const P_VARIANT_DEF: Json = { '@': 'cond',
  cases: [{
    when: pAt('multiInput'),
    then: {
      type: P_TYPE,
      message0: { '@': 'join', sep: '', items: [P_LABEL, ' %1'] },
      args0: [{ type: 'input_dummy' }],
      message1: P_PARAM_SEGS,
      args1: P_ARGS,
      output: null,
      colour: P_COLOUR,
      inputsInline: false,
    },
  }],
  default: {
    type: P_TYPE,
    message0: { '@': 'join', sep: '', items: [P_LABEL, P_PARAM_SEGS] },
    args0: P_ARGS,
    output: null,
    colour: P_COLOUR,
    inputsInline: false,
  },
};
const G_PALETTE: Json = { '@': 'chain', funcs: [
  { '@': 'set', name: 'pentry' },
  { '@': 'chain', funcs: [{ '@': 'get', name: 'pentry' }, pAt('variants'), { '@': 'map', item: P_VARIANT_DEF }] },
] };

/**
 * Full catalog of rules derived from engine metadata (FR-040, AC-006, AC-034).
 * Derived from `editorMetadata.catalog.rules` at module load time so a future engine
 * update with a new rule folds in automatically (no code change needed — AC-034).
 *
 * Field-vs-input disposition (FR-118, FR-124, FR-047): constant params (`expr.op`,
 * `call.name`) encode as block `fields`; dynamic params encode as `inputs`.
 * Implemented in D2 via entry enrichment in `generateCodec` and @-time param filtering
 * in `ENC_THEN` / `DEC_RECON`.
 */
export const CATALOG_RULES: string[] = editorMetadata.catalog.rules.map((r: CatalogEntry) => r.name);

/** @deprecated Use CATALOG_RULES. Kept for existing imports (M1 alias). */
export const M1_RULES = CATALOG_RULES;

// The per-rule `@`-staged generators are committed as inspectable, tool-agnostic projection
// DATA under `src/codec/generators/` (AD-026: the surface is projection(metadata), and the
// projection itself is data, not hidden code). The typed builders above are the editable
// authoring source; `generateCodec` runs the committed JSON copies, and the regen gate keeps
// the two byte-equal (AD-030). The rule-agnostic skeleton stays in this driver — it has the
// driver-injected dispatch/case holes and does not vary per rule (AD-028).
export const GENERATOR_FILES = {
  encode: 'G_encode.json',
  decode: 'G_decode.json',
  toolbox: 'G_toolbox.json',
  palette: 'G_palette.json',
} as const;
export const GENERATOR_SOURCES: Record<string, Json> = {
  [GENERATOR_FILES.encode]: G_RULE_ENCODE,
  [GENERATOR_FILES.decode]: G_RULE_DECODE_CASES,
  [GENERATOR_FILES.toolbox]: G_TOOLBOX,
  [GENERATOR_FILES.palette]: G_PALETTE,
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

// ---- entry enrichment: copy `kind` from rule-level params onto variant-level params (FR-118) ----
//
// The metadata `entry.variants[*].params` carry only `{name, required}`, while
// `entry.params` (rule-level) carry `{kind, name, ...}`. The generators need `kind` on
// the variant params so they can branch at @-time (constant→field, dynamic→input).
//
// This is a generic metadata-normalization join (name-based), applied uniformly to every rule.
// No rule is special-cased, so a future rule with a constant param (AC-034) folds in
// automatically with no code change.

type RuleParam = { name: string; kind?: string; options?: string[]; [k: string]: unknown };
type VariantParam = { name: string; required: boolean; [k: string]: unknown };
type VariantEntry = { id: string; params: VariantParam[]; [k: string]: unknown };
type CatalogRuleEntry = { name: string; params: RuleParam[]; variants: VariantEntry[]; [k: string]: unknown };

function enrichEntry(entry: unknown): unknown {
  const e = entry as CatalogRuleEntry;
  const kindMap = new Map<string, string>(
    e.params.map((p) => [p.name, p.kind ?? 'dynamic']),
  );
  return {
    ...e,
    variants: e.variants.map((v) => ({
      ...v,
      params: v.params.map((p) => ({ ...p, kind: kindMap.get(p.name) ?? 'dynamic' })),
    })),
  };
}

/**
 * Generate the encoder + decoder artifacts by running the `@`-staged generators over the
 * pinned metadata (AD-030). Pure: returns the artifacts, writes nothing.
 */
export async function generateCodec(
  engine: EngineProvider,
  rules: string[] = CATALOG_RULES,
  // Optional catalog override (default: the pinned metadata catalog). This exists so the AC-034
  // proof can project a SYNTHETIC rule through the *committed* generators + skeleton with zero
  // projection-template change — demonstrating that a new rule folds in by metadata alone. The
  // committed artifacts are always generated from `editorMetadata.catalog.rules` (the default).
  catalog: CatalogEntry[] = editorMetadata.catalog.rules,
): Promise<{ encoder: CodecArtifact; decoder: CodecArtifact; blockmap: CodecArtifact }> {
  const catalogRules = catalog;
  const encFragments: Record<string, Json> = {};
  const decCases: Record<string, Json> = { ...FIXED_DEC_CASES };
  const dispatch: Record<string, Json> = {};

  for (const name of rules) {
    const entry = catalogRules.find((r: CatalogEntry) => r.name === name);
    if (!entry) throw new Error(`codegen: rule '${name}' not in metadata catalog`);
    // Enrich: copy `kind` from rule-level params onto variant-level params (FR-118, AD-029).
    // The generators branch at @-time on `kind` to decide field vs input disposition.
    const enriched = enrichEntry(entry) as Json;
    encFragments[`enc__${name}`] = await runGen(engine, gEncode as unknown as Json, enriched);
    const cases = (await runGen(engine, gDecode as unknown as Json, enriched)) as Record<string, Json>;
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
 * Generate the Blockly toolbox artifact by running the committed `G_toolbox` projection over the
 * pinned metadata + presentation data (FR-044, FR-114, AD-026, AD-030). The output is a static
 * `categoryToolbox` JSON the editor loads (it does not execute at runtime). Pure: returns the
 * toolbox JSON, writes nothing.
 *
 * The `catalog`/`presentation` overrides exist so the AC-037 synthetic-rule proof can project a
 * new rule into the toolbox with zero projection-template change (presentation from data, not
 * code). The committed artifact is always generated from the defaults.
 */
export async function generateToolbox(
  engine: EngineProvider,
  rules: string[] = CATALOG_RULES,
  catalog: CatalogEntry[] = editorMetadata.catalog.rules,
  presentation: Presentation = PRESENTATION,
): Promise<Json> {
  // Group each rule's variants under its presentation category. The category comes from the
  // committed presentation data (never a TS literal — FR-127), so a new rule with a presentation
  // entry folds into its category with no code change (AC-037).
  const blocksByCategory: Record<string, Array<{ rule: string; variant: string }>> = {};
  for (const name of rules) {
    const entry = catalog.find((r) => r.name === name) as CatalogRuleEntry | undefined;
    if (!entry) throw new Error(`toolbox: rule '${name}' not in metadata catalog`);
    const cat = presentation.rules[name]?.category;
    if (!cat) throw new Error(`toolbox: rule '${name}' has no presentation category`);
    (blocksByCategory[cat] ??= []).push(...entry.variants.map((v) => ({ rule: name, variant: v.id })));
  }
  const categories = presentation.categoryOrder.map((name) => ({
    name,
    colour: presentation.categoryColour[name] ?? 0,
    blocks: blocksByCategory[name] ?? [],
    structuralBlockTypes: presentation.structuralBlocks[name] ?? [],
  }));
  return runGen(engine, gToolbox as unknown as Json, { categories } as unknown as Json);
}

// FR-130: curated `[[label, value], ...]` pairs for a constant+options param, from
// presentation.dropdownMenus[rule][param] when declared, else the identity menu (one pair per
// option, `[opt, opt]` — behaves exactly like a plain field_dropdown). VALIDATES the curation
// against the param's metadata options domain — every entry's value/aliases must be a real
// option, and no token may be claimed by two entries — so a malformed presentation.json fails
// loudly at generation time rather than silently dropping/duplicating a token (fail-loud, mirrors
// the `palette: rule '<x>' has no presentation entry` style).
function menuFor(ruleName: string, paramName: string, options: string[], presentation: Presentation): Array<[string, string]> {
  const curated = presentation.dropdownMenus[ruleName]?.[paramName];
  if (!curated) return options.map((o): [string, string] => [o, o]);
  const domain = new Set(options);
  const seen = new Set<string>();
  for (const entry of curated) {
    for (const token of [entry.value, ...(entry.aliases ?? [])]) {
      if (!domain.has(token)) {
        throw new Error(
          `palette: dropdownMenus.${ruleName}.${paramName} entry '${entry.value}' claims token ` +
          `'${token}' not in the metadata options domain (FR-130)`,
        );
      }
      if (seen.has(token)) {
        throw new Error(
          `palette: dropdownMenus.${ruleName}.${paramName} token '${token}' appears in two entries (FR-130)`,
        );
      }
      seen.add(token);
    }
  }
  return curated.map((entry): [string, string] => [entry.label, entry.value]);
}

// ---- enrich a rule entry for the palette projection (FR-118, FR-058, FR-130) ----
// Join the variant params' `kind` + resolved enum `options` from the rule-level params (the
// metadata carries `kind`/`options` only at rule level, like `enrichEntry` for the codec), attach
// the curated/identity dropdown `menu` (FR-130), and attach the rule's presentation title +
// category colour (from presentation.json — not TS). A new rule with complete metadata + a
// presentation entry folds in with no code change (AC-037).
function enrichForPalette(entry: unknown, presentation: Presentation): Json {
  const e = entry as CatalogRuleEntry;
  const kindMap = new Map(e.params.map((p) => [p.name, p.kind ?? 'dynamic']));
  const optMap = new Map(e.params.map((p) => [p.name, p.options]));
  const pres = presentation.rules[e.name];
  if (!pres) throw new Error(`palette: rule '${e.name}' has no presentation entry (FR-127)`);
  return {
    name: e.name,
    title: pres.title,
    colour: presentation.categoryColour[pres.category] ?? 0,
    variants: e.variants.map((v) => {
      const params = v.params.map((p) => {
        const options = optMap.get(p.name);
        const menu = options ? menuFor(e.name, p.name, options, presentation) : undefined;
        return {
          name: p.name,
          required: p.required,
          kind: kindMap.get(p.name) ?? 'dynamic',
          ...(options ? { options, menu } : {}),
        };
      });
      // ≥2 value inputs ⇒ the title takes its own first row (FR-129, §13.10). Computed here in plain
      // TS (Transon has no length function) so the G_palette projection just branches on the flag.
      const multiInput = params.filter((p) => p.kind !== 'constant').length >= 2;
      return { id: v.id, params, multiInput };
    }),
  } as unknown as Json;
}

// The fixed, rule-agnostic structural block definitions (transon_literal/array/object_literal/
// unsupported) — the non-rule vocabulary the encoder emits (FR-124). Their *shape* is fixed
// (rule-agnostic, like FIXED_DEC_CASES), but their colour + label come from presentation data
// (FR-127). The dynamic-arity blocks reference behavior-runtime mutators by name; the scalar
// literal references the custom JSON-scalar field; both are registered in @transon/editor-blockly
// (AD-031). transon_unsupported is edit-blocked and preserves its raw payload (§13.11, AD-004).
function structuralColour(presentation: Presentation, blockType: string): number | string {
  const cat = Object.entries(presentation.structuralBlocks).find(([, types]) => types.includes(blockType))?.[0];
  return cat ? (presentation.categoryColour[cat] ?? 0) : presentation.unsupportedColour;
}
function structuralDefs(presentation: Presentation): Json[] {
  const t = presentation.structuralTitles;
  return [
    { type: 'transon_literal', message0: '%1', args0: [{ type: 'field_transon_scalar', name: 'VALUE' }],
      output: null, colour: structuralColour(presentation, 'transon_literal'), inputsInline: true, tooltip: t.transon_literal },
    { type: 'transon_array', message0: t.transon_array, output: null,
      colour: structuralColour(presentation, 'transon_array'), mutator: 'transon_array_mutator', tooltip: t.transon_array },
    { type: 'transon_object_literal', message0: t.transon_object_literal, output: null,
      colour: structuralColour(presentation, 'transon_object_literal'), mutator: 'transon_object_mutator', tooltip: t.transon_object_literal },
    { type: 'transon_unsupported', message0: t.transon_unsupported, output: null,
      colour: presentation.unsupportedColour, mutator: 'transon_unsupported_mutator', tooltip: t.transon_unsupported },
  ] as unknown as Json[];
}

/**
 * Generate the Blockly palette artifact: the loadable Zelos block definitions for every rule
 * variant (projected by `G_palette`) plus the fixed structural definitions (FR-084, FR-089,
 * FR-114, FR-125, AD-026, AD-030). The output is `{ blocks: BlockDefinition[] }` the editor
 * registers into Blockly. Pure: returns the definitions, writes nothing.
 *
 * The `catalog`/`presentation` overrides drive the AC-037 synthetic-rule proof (a new rule
 * becomes a projected block with no editor code change).
 */
export async function generatePalette(
  engine: EngineProvider,
  rules: string[] = CATALOG_RULES,
  catalog: CatalogEntry[] = editorMetadata.catalog.rules,
  presentation: Presentation = PRESENTATION,
): Promise<Json> {
  const blocks: Json[] = [];
  for (const name of rules) {
    const entry = catalog.find((r) => r.name === name);
    if (!entry) throw new Error(`palette: rule '${name}' not in metadata catalog`);
    const defs = (await runGen(engine, gPalette as unknown as Json, enrichForPalette(entry, presentation))) as Json[];
    blocks.push(...defs);
  }
  blocks.push(...structuralDefs(presentation));
  return { blocks } as unknown as Json;
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
