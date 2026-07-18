// FR-041, FR-042, AC-007, AC-008 — operators/functions sweep (D2: constant-param field disposition).
//
// Every expr operator token (28 including alternative aliases) and every call function name
// (4) must:
//   1. Round-trip: decode(encode(T)) === T  (FR-035/036, AC-011)
//   2. Place the operator/function value verbatim in the block's `fields` map, NOT in `inputs`
//      (FR-118, FR-124, FR-047 — constant param → field, not value input)
//   3. Be valid Transon (engine transformation does not error) [transon-authoring skill]
//
// Operator catalog: 14 canonical tokens × 2 (name + alternative) = 28 total.
// Function catalog: 4 (str, int, float, type).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json } from '@transon/editor-core';
import { encode, decode, editorMetadata } from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

// ── helpers ──────────────────────────────────────────────────────────────────

type AnyBlock = { type: string; fields?: Record<string, Json>; inputs?: Record<string, Json> };

/** Encode a template and return the top-level block typed as AnyBlock. */
async function encodeBlock(tmpl: Json): Promise<AnyBlock> {
  return (await encode(engine, tmpl)) as AnyBlock;
}

/**
 * Build a minimal valid expr template for a given operator.
 * - Unary operators (kind:'unary'): {$:'expr', op: token}  (base variant)
 * - Binary operators (kind:'binary'): {$:'expr', op: token, value: 1}  (value variant)
 */
function exprTemplate(op: string, kind: 'unary' | 'binary'): Json {
  if (kind === 'unary') return { $: 'expr', op };
  return { $: 'expr', op, value: 1 };
}

/** Build a minimal valid call template for a function name. */
function callTemplate(name: string): Json {
  return { $: 'call', name };
}

// ── FR-041 / AC-007: every expr operator token ───────────────────────────────

describe('FR-041 / AC-007: expr operators — constant op encoded in fields (FR-118/FR-124)', () => {
  // FR-041: "The editor shall support all built-in expr operators (§14.14)."
  // AC-007: "Operators available"
  const operators = editorMetadata.catalog.operators as Array<{
    name: string;
    alternative: string;
    kind: 'unary' | 'binary';
  }>;

  // Verify we have the expected count: 15 canonical operators (each has a canonical name +
  // alternative; `in` — engine 0.1.8 — spells both the same, so 15 operators = 29 tokens)
  it('metadata exposes the expected operator catalog (15 operators = 29 tokens)', () => {
    expect(operators.length).toBe(15);
  });

  for (const opMeta of operators) {
    for (const token of [opMeta.name, opMeta.alternative]) {
      it(`op=${JSON.stringify(token)} (${opMeta.kind}) → fields.op verbatim, round-trips`, async () => {
        // FR-041: support the operator
        const tmpl = exprTemplate(token, opMeta.kind);

        // FR-118 / FR-124: constant param 'op' must appear in block's fields, NOT inputs
        const blk = await encodeBlock(tmpl);
        expect(blk.fields, `fields should be present for op=${token}`).toBeDefined();
        expect(blk.fields!['op'], `fields.op should be ${token}`).toBe(token);
        expect(blk.inputs?.['op'], 'op must NOT be an input (it is a constant field)').toBeUndefined();

        // FR-035 / AC-011: round-trip
        const back = await decode(engine, blk as Json);
        expect(back, `round-trip for op=${token}`).toEqual(tmpl);

        // Engine validity (transon-authoring): template is valid and executable
        const input: Json = opMeta.kind === 'unary' ? false : 5;
        const result = await engine.transform(tmpl, input, { marker: '$' });
        expect(result.status, `engine should execute op=${token} without error`).toBe('ok');
      });
    }
  }
});

// ── FR-042 / AC-008: every call function name ────────────────────────────────

describe('FR-042 / AC-008: call functions — constant name encoded in fields (FR-118/FR-124)', () => {
  // FR-042: "The editor shall support all built-in call functions (§14.15)."
  // AC-008: "Functions available"
  const functions = editorMetadata.catalog.functions as Array<{ name: string }>;

  // Verify we have the expected 34 functions (4 pre-0.1.8 + the RFC 0007 builtin library)
  it('metadata exposes the expected function catalog (34 functions)', () => {
    expect(functions.length).toBe(34);
  });

  for (const fnMeta of functions) {
    it(`call.name=${JSON.stringify(fnMeta.name)} → fields.name verbatim, round-trips`, async () => {
      // FR-042: support the function
      const tmpl = callTemplate(fnMeta.name);

      // FR-118 / FR-124: constant param 'name' must appear in block's fields, NOT inputs
      const blk = await encodeBlock(tmpl);
      expect(blk.fields, `fields should be present for name=${fnMeta.name}`).toBeDefined();
      expect(blk.fields!['name'], `fields.name should be ${fnMeta.name}`).toBe(fnMeta.name);
      expect(blk.inputs?.['name'], 'name must NOT be an input').toBeUndefined();

      // FR-035 / AC-011: round-trip
      const back = await decode(engine, blk as Json);
      expect(back, `round-trip for name=${fnMeta.name}`).toEqual(tmpl);

      // Engine validity (transon-authoring): function is callable
      const result = await engine.transform(tmpl, 42, { marker: '$' });
      expect(result.status, `engine should execute call.name=${fnMeta.name}`).toBe('ok');
    });
  }
});

// ── mixed: a block may carry BOTH fields (constant) and inputs (dynamic) ─────

describe('FR-118 / FR-124 / FR-047: field-vs-input disposition (mixed constant+dynamic)', () => {
  // FR-047: "distinguish dynamic from constant parameters"
  // FR-124: "declared params placed as fields (constant) or value inputs (dynamic)"
  // FR-118: "derived from kind via cond/switch"

  it('expr/value: op in fields, value in inputs', async () => {
    // {$:expr, op:'+', value:5} → fields:{op:'+'}, inputs:{value:{block:...}}
    const tmpl: Json = { $: 'expr', op: '+', value: 5 };
    const blk = await encodeBlock(tmpl);
    expect(blk.type).toBe('transon_rule_expr__value');
    expect(blk.fields).toEqual({ op: '+' });
    expect(blk.inputs).toHaveProperty('value');
    expect(blk.inputs!['op']).toBeUndefined();  // op must NOT be in inputs
  });

  it('expr/values: op in fields, values in inputs', async () => {
    const tmpl: Json = { $: 'expr', op: '+', values: [1, 2] };
    const blk = await encodeBlock(tmpl);
    expect(blk.type).toBe('transon_rule_expr__values');
    expect(blk.fields).toEqual({ op: '+' });
    expect(blk.inputs).toHaveProperty('values');
    expect(blk.inputs!['op']).toBeUndefined();
  });

  it('expr/base (unary): op in fields only, no inputs', async () => {
    const tmpl: Json = { $: 'expr', op: '!' };
    const blk = await encodeBlock(tmpl);
    expect(blk.type).toBe('transon_rule_expr__base');
    expect(blk.fields).toEqual({ op: '!' });
    expect(blk.inputs?.['op']).toBeUndefined();
    expect(blk.inputs?.['value']).toBeUndefined();
  });

  it('call/base: name in fields only', async () => {
    const tmpl: Json = { $: 'call', name: 'str' };
    const blk = await encodeBlock(tmpl);
    expect(blk.type).toBe('transon_rule_call__base');
    expect(blk.fields).toEqual({ name: 'str' });
    expect(blk.inputs?.['name']).toBeUndefined();
  });

  it('call/value: name in fields, value in inputs', async () => {
    const tmpl: Json = { $: 'call', name: 'str', value: { $: 'expr', op: '+', value: 1 } };
    const blk = await encodeBlock(tmpl);
    expect(blk.type).toBe('transon_rule_call__value');
    expect(blk.fields).toEqual({ name: 'str' });
    expect(blk.inputs).toHaveProperty('value');
    expect(blk.inputs!['name']).toBeUndefined();
  });

  it('call/values: name in fields, values in inputs', async () => {
    const tmpl: Json = { $: 'call', name: 'int', values: [{ $: 'this' }, 16] };
    const blk = await encodeBlock(tmpl);
    expect(blk.type).toBe('transon_rule_call__values');
    expect(blk.fields).toEqual({ name: 'int' });
    expect(blk.inputs).toHaveProperty('values');
    expect(blk.inputs!['name']).toBeUndefined();
  });

  // Decode direction (FR-126: decoder reads fields for constant, inputs for dynamic)
  it('decode: constant field reconstructed from fields, dynamic from inputs', async () => {
    // Manually construct a block with fields.op and inputs.value
    const blk: Json = {
      type: 'transon_rule_expr__value',
      fields: { op: '+' },
      inputs: { value: { block: { type: 'transon_literal', fields: { VALUE: 5 } } } },
    };
    const back = await decode(engine, blk);
    expect(back).toEqual({ $: 'expr', op: '+', value: 5 });
  });

  it('decode: call/name field reconstructed verbatim', async () => {
    const blk: Json = {
      type: 'transon_rule_call__base',
      fields: { name: 'str' },
    };
    const back = await decode(engine, blk);
    expect(back).toEqual({ $: 'call', name: 'str' });
  });

  // Pure-dynamic rules (attr) must NOT gain a fields key (only expr/call have constant params)
  it('all-dynamic param rules (attr) have no fields key in encoded block', async () => {
    const blk = await encodeBlock({ $: 'attr', name: 'x' });
    // attr.name is dynamic — must NOT appear in fields
    expect((blk as AnyBlock).fields?.['name']).toBeUndefined();
  });
});
