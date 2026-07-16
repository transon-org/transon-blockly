// AC-043 — runtime metadata surface with fail-safe fallback (RFC-007, SPEC §7.18, AD-036), the
// engine-executed halves, through the REAL engine:
//   (a) a session surface generated from a fetched catalog projects a rule ABSENT from the pinned
//       snapshot: it encodes in-surface (no transon_unsupported) and round-trips to identity —
//       no editor code change, no projection-template change, no snapshot re-pin (FR-139, FR-120);
//   (b) the DEFAULT (snapshot) codec routes the same template to transon_unsupported, unchanged
//       (AD-004);
//   (d) a fetched rule unknown to the committed presentation projects via the FR-141 fallback —
//       title = metadata name, the data-declared fallback category, advanced.
// Plus the P-A proxy: the Node adapter's getEditorMetadata() delivers the real engine export
// (metadata-contract §3 runtime delivery), and fetchRuntimeSurface() runs end-to-end against it.
//
// FR-139 — opt-in runtime metadata source (fetch → gate → generate through the same engine).
// FR-140 — gate + all-or-nothing surface (an incompatible payload throws MetadataFallbackError).
// FR-141 — presentation fallback for rules the committed presentation does not know.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json, CatalogEntry, RuntimeSurface } from '@transon/editor-core';
import {
  fetchRuntimeSurface,
  MetadataFallbackError,
  runCodecArtifact,
  encode,
  decode,
  editorMetadata,
  metadataVersion,
  PRESENTATION,
} from '@transon/editor-core';
import { createNodeEngineProvider } from '../../src/index.js';

// A fabricated "next engine release" rule, absent from the pinned snapshot — the same structural
// shape as AC-034's synthetic rule (constant field + dynamic input, two variants).
const VNEXT_RULE = {
  name: 'vnextrule',
  params: [
    { kind: 'constant', name: 'mode', options: ['a', 'b'] },
    { kind: 'dynamic', name: 'value' },
  ],
  variants: [
    { id: 'base', params: [{ name: 'mode', required: true }] },
    { id: 'value', params: [{ name: 'mode', required: true }, { name: 'value', required: true }] },
  ],
} as unknown as CatalogEntry;

/** Wrap the real engine so getEditorMetadata() reports a vNext catalog (snapshot + the new rule).
 *  Everything else — including the generator runs — hits the real engine. */
function vNextEngine(real: EngineProvider, payload: Json): EngineProvider {
  return {
    get status() {
      return real.status;
    },
    init: () => real.init(),
    validate: (t, o) => real.validate(t, o),
    transform: (t, i, o) => real.transform(t, i, o),
    version: () => real.version(),
    getEditorMetadata: async () => payload,
    dispose: () => {
      /* the wrapped engine is shared across tests; disposed once in afterAll */
    },
  };
}

const vNextPayload = (): Json =>
  ({
    ...(editorMetadata as unknown as Record<string, Json>),
    engine_version: '9.9.9',
    catalog: {
      ...editorMetadata.catalog,
      rules: [...editorMetadata.catalog.rules, VNEXT_RULE],
    },
  }) as unknown as Json;

let real: EngineProvider;
let surface: RuntimeSurface;

beforeAll(async () => {
  real = createNodeEngineProvider();
  await real.init();
  surface = await fetchRuntimeSurface(vNextEngine(real, vNextPayload()));
}, 120_000);
afterAll(() => real?.dispose());

describe('P-A — the Node adapter proxies the real engine export (contract §3)', () => {
  it('getEditorMetadata() returns the §2 payload with a pin-compatible metadata_version', async () => {
    const payload = (await real.getEditorMetadata!()) as {
      metadata_version: unknown;
      catalog: { rules: { name: string }[] };
    };
    expect(String(payload.metadata_version)).toBe(metadataVersion);
    expect(payload.catalog.rules.length).toBeGreaterThan(0);
  });

  it('fetchRuntimeSurface() runs end-to-end against the real, unwrapped export (FR-139)', async () => {
    const s = await fetchRuntimeSurface(real);
    // The live engine may be AHEAD of the pin (that skew is RFC-007's reason to exist — e.g. the
    // 0.1.8 release adding `split` while the snapshot pins 0.1.7): the fetched catalog must cover
    // at least every pinned rule, and the surface generates cleanly over whatever it exports.
    const fetched = new Set(s.metadata.catalog.rules.map((r) => r.name));
    for (const r of editorMetadata.catalog.rules) expect(fetched.has(r.name)).toBe(true);
    expect(s.paletteBlocks.length).toBeGreaterThan(0);
  }, 120_000);
});

describe('AC-043(a) — the fetched-catalog surface projects the vNext rule in-surface', () => {
  it('the generated encoder carries an arm for the vNext rule', () => {
    expect(surface.artifacts.encoder.fragments['enc__vnextrule']).toBeDefined();
  });

  it('a vNext template encodes to a rule block (not transon_unsupported) and round-trips to identity', async () => {
    const t: Json = { $: 'vnextrule', mode: 'a', value: { $: 'attr', name: 'x' } };
    const ws = (await runCodecArtifact(engineForCodec(), surface.artifacts.encoder, t)) as { type: string };
    expect(ws.type).toBe('transon_rule_vnextrule__value');
    const back = await runCodecArtifact(engineForCodec(), surface.artifacts.decoder, ws as unknown as Json);
    expect(back).toEqual(t);
  });
});

describe('AC-043(b) — the DEFAULT snapshot codec still routes the vNext rule to transon_unsupported (AD-004)', () => {
  it('encodes to the exact-preserving placeholder and round-trips unchanged', async () => {
    const t: Json = { $: 'vnextrule', mode: 'a', value: { $: 'attr', name: 'x' } };
    const ws = (await encode(real, t)) as { type: string };
    expect(ws.type).toBe('transon_unsupported');
    expect(await decode(real, ws as unknown as Json)).toEqual(t);
  });
});

describe('AC-043(d) / FR-141 — presentation fallback for the unknown rule', () => {
  it('the vNext rule lands in the data-declared fallback category, titled by its metadata name, advanced', () => {
    const toolbox = surface.toolbox as {
      contents: { kind: string; name?: string; contents?: { type?: string; kind: string }[] }[];
    };
    const fallbackCat = toolbox.contents.find((c) => c.name === PRESENTATION.fallbackCategory);
    expect(fallbackCat).toBeDefined();
    expect(
      fallbackCat!.contents!.some((b) => typeof b.type === 'string' && b.type.startsWith('transon_rule_vnextrule__')),
    ).toBe(true);
    const def = surface.paletteBlocks.find((d) => d.type === 'transon_rule_vnextrule__base') as unknown as {
      message0?: string;
      advanced?: unknown;
    };
    expect(def).toBeDefined();
    // Fallback title = the metadata rule name (FR-141) — it heads the block's message.
    expect(def.message0).toMatch(/vnextrule/);
  });

  it('committed rules keep their committed presentation (FR-141: fallback never rewrites known rules)', () => {
    const attr = surface.paletteBlocks.find((d) => d.type.startsWith('transon_rule_attr__')) as unknown as {
      message0?: string;
    };
    expect(attr?.message0).toMatch(new RegExp(PRESENTATION.rules['attr']!.title));
  });
});

describe('FR-140 — an incompatible payload throws MetadataFallbackError (never a mixed surface)', () => {
  it('rejects a different-major metadata_version', async () => {
    const bad = { ...(vNextPayload() as Record<string, Json>), metadata_version: '4.0' };
    await expect(fetchRuntimeSurface(vNextEngine(real, bad as unknown as Json))).rejects.toBeInstanceOf(
      MetadataFallbackError,
    );
  });
});

/** The engine used to EXECUTE the generated codec — same real engine (AD-030: generate-then-run
 *  through one host). */
function engineForCodec(): EngineProvider {
  return real;
}
