// AC-034 / FR-120 — projection coverage: a NEW rule folds into the generated codec from metadata
// alone, with NO projection-template or skeleton change (AD-026).
//
// Proof: project a SYNTHETIC rule (not in the pinned catalog) through the *committed* generators
// (`G_encode.json`/`G_decode.json`) and the fixed skeleton via `generateCodec` — passing only an
// in-memory catalog override. The synthetic rule has the two shapes M2 added (a `kind:"constant"`
// field param and `kind:"dynamic"` input params) across two variants. If it encodes, decodes, and
// round-trips with zero edits to any `.ts`/`.json` projection file, then "add a rule = add metadata"
// holds (AC-034). The committed artifacts are unaffected — the default catalog excludes it.
//
// AC-028 — metadata-driven generic block.
// AC-034 — projection coverage: new rule across all surfaces, no editor/projection change.
// FR-120 — a new rule appears across all surfaces from metadata.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json, CatalogEntry } from '@transon/editor-core';
import { generateCodec, runCodecArtifact, CATALOG_RULES, editorMetadata } from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';

// A fabricated rule with complete metadata: one constant (field) param + one dynamic (input) param,
// two variants. Mirrors the structural shape of real catalog entries (e.g. expr/call).
const SYNTH_RULE = {
  name: 'synthrule',
  params: [
    { kind: 'constant', name: 'mode', options: ['a', 'b', 'c'] },
    { kind: 'dynamic', name: 'value' },
  ],
  variants: [
    { id: 'base', params: [{ name: 'mode', required: true }] },
    { id: 'value', params: [{ name: 'mode', required: true }, { name: 'value', required: true }] },
  ],
} as unknown as CatalogEntry;

type Artifact = { entry: string; fragments: Record<string, Json> };

let engine: EngineProvider;
let encoder: Artifact;
let decoder: Artifact;

beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
  // Inject the synthetic rule via the catalog override ONLY — no projection file is touched.
  const catalog = [...editorMetadata.catalog.rules, SYNTH_RULE];
  const built = await generateCodec(engine, [...CATALOG_RULES, 'synthrule'], catalog);
  encoder = built.encoder;
  decoder = built.decoder;
});
afterAll(() => engine?.dispose());

const rt = async (t: Json): Promise<Json> => {
  const ws = await runCodecArtifact(engine, encoder, t);
  return runCodecArtifact(engine, decoder, ws);
};

describe('AC-034 — synthetic rule folds into the codec from metadata alone (no projection change)', () => {
  it('the committed generators produce an encode arm for the synthetic rule', () => {
    expect(encoder.fragments['enc__synthrule']).toBeDefined();
  });

  it('the DEFAULT codec excludes the synthetic rule (committed artifacts unaffected)', async () => {
    const def = await generateCodec(engine); // default catalog — no override
    expect(def.encoder.fragments['enc__synthrule']).toBeUndefined();
  });

  it('base variant (constant field only) round-trips', async () => {
    const t: Json = { $: 'synthrule', mode: 'a' };
    expect(await rt(t)).toEqual(t);
  });

  it('value variant (constant field + dynamic input) round-trips', async () => {
    const t: Json = { $: 'synthrule', mode: 'b', value: { $: 'attr', name: 'x' } };
    expect(await rt(t)).toEqual(t);
  });

  it('the constant param projects to a block FIELD, the dynamic param to an INPUT (FR-118/124)', async () => {
    const ws = (await runCodecArtifact(engine, encoder, {
      $: 'synthrule', mode: 'c', value: 7,
    })) as { type: string; fields?: Record<string, Json>; inputs?: Record<string, Json> };
    expect(ws.type).toBe('transon_rule_synthrule__value');
    expect(ws.fields?.mode).toBe('c'); // constant → field, verbatim
    expect(ws.inputs?.value).toBeDefined(); // dynamic → input
  });

  it('an ambiguous synthetic node (no exact variant) → transon_unsupported, exact preservation', async () => {
    // `value` present makes only the `value` variant eligible; add a foreign key → matches none.
    const t: Json = { $: 'synthrule', mode: 'a', value: 1, bogus: 2 };
    const ws = (await runCodecArtifact(engine, encoder, t)) as { type: string };
    expect(ws.type).toBe('transon_unsupported');
    expect(await rt(t)).toEqual(t);
  });
});
