// The runtime metadata source (RFC-007, SPEC §7.18, AD-036): fetch the engine's editor-metadata
// through the optional `EngineProvider.getEditorMetadata()` port method, gate it (FR-140), and
// generate the session's projection surface from the FETCHED catalog by running the committed
// FR-114 generators through the same engine — the AD-030 two-pass model executed at session init
// instead of build time. The committed snapshot + artifacts stay the default and the fail-safe
// fallback; this module THROWS `MetadataFallbackError` on every failure path so the caller can
// fall back and surface the §16.4 `metadata_fallback` diagnostic.

import type { EngineProvider, Json } from '../engine/ports.js';
import { editorMetadata, metadataVersion, type CatalogEntry, type EditorMetadata } from './snapshot.js';
import { generateCodec, generatePalette, generateToolbox } from '../codec/codegen.js';
import { PRESENTATION, type Presentation } from '../codec/presentation.js';
import type { CodecArtifacts } from '../codec/run.js';
import type { BlockDefinition } from '../codec/surface.js';

/** A runtime-path failure (FR-140): the caller falls back to the bundled snapshot surface and
 *  surfaces `metadata_fallback` (SPEC §16.4). `reason` is a stable machine-readable tag. */
export class MetadataFallbackError extends Error {
  constructor(
    readonly reason:
      | 'method_absent'
      | 'fetch_failed'
      | 'malformed_payload'
      | 'incompatible_version'
      | 'generation_failed',
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'MetadataFallbackError';
  }
}

/**
 * The FR-140 same-major compatibility rule (metadata-contract §5): a fetched `metadata_version`
 * is compatible when its MAJOR component equals the major of the schema version this build was
 * generated against (`metadataVersion`, e.g. "3.0" accepts "3.x", rejects "2.x"/"4.x").
 * Tolerates the engine emitting a bare number (same normalization as the snapshot loader).
 */
export function isCompatibleMetadataVersion(
  fetched: unknown,
  pinned: string = metadataVersion,
): boolean {
  if (fetched == null) return false;
  const major = (v: string): string | undefined => {
    const m = /^(\d+)(\.|$)/.exec(v.trim());
    return m?.[1];
  };
  const fetchedMajor = major(String(fetched));
  const pinnedMajor = major(pinned);
  return fetchedMajor !== undefined && fetchedMajor === pinnedMajor;
}

/**
 * Structurally validate a fetched payload against the metadata-contract §2 shape the editor
 * consumes (FR-140): object with `catalog.{rules,operators,functions}` lists of named entries,
 * a `docs` payload, and a compatible `metadata_version`. Returns the typed view; throws
 * `MetadataFallbackError` otherwise. Deliberately shallow — the engine owns the export (AD-012,
 * contract §4): this asserts only what the generators and the gate consume.
 */
export function validateMetadataPayload(payload: Json): EditorMetadata {
  const isNamedList = (v: unknown): v is CatalogEntry[] =>
    Array.isArray(v) && v.every((e) => !!e && typeof e === 'object' && typeof (e as { name?: unknown }).name === 'string');
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new MetadataFallbackError('malformed_payload', 'engine metadata is not an object (contract §2)');
  }
  const raw = payload as {
    metadata_version?: unknown;
    engine_version?: unknown;
    catalog?: { rules?: unknown; operators?: unknown; functions?: unknown };
    docs?: unknown;
  };
  if (!isCompatibleMetadataVersion(raw.metadata_version)) {
    throw new MetadataFallbackError(
      'incompatible_version',
      `engine metadata_version ${JSON.stringify(raw.metadata_version ?? null)} is not compatible with the editor's pinned schema ${metadataVersion} (same-major rule, contract §5)`,
    );
  }
  const catalog = raw.catalog;
  if (
    !catalog ||
    typeof catalog !== 'object' ||
    !isNamedList(catalog.rules) ||
    !isNamedList(catalog.operators) ||
    !isNamedList(catalog.functions) ||
    catalog.rules.length === 0
  ) {
    throw new MetadataFallbackError('malformed_payload', 'engine metadata catalog is missing or malformed (contract §2)');
  }
  if (!raw.docs || typeof raw.docs !== 'object') {
    throw new MetadataFallbackError('malformed_payload', 'engine metadata docs payload is missing (contract §2.7)');
  }
  return {
    metadata_version: String(raw.metadata_version),
    engine_version: raw.engine_version == null ? null : String(raw.engine_version),
    catalog: { rules: catalog.rules, operators: catalog.operators, functions: catalog.functions },
    docs: raw.docs as EditorMetadata['docs'],
  };
}

/**
 * The FR-141 presentation fallback: the committed presentation, extended with a data-driven entry
 * (title = metadata `name`, the declared `fallbackCategory`, `advanced: true`) for every fetched
 * rule the committed `rules` map does not know. Committed rules stay untouched; no TS literal
 * enters the category domain (FR-127 — the category comes from `presentation.json`).
 */
export function presentationWithFallback(catalog: CatalogEntry[]): Presentation {
  const rules = { ...PRESENTATION.rules };
  for (const entry of catalog) {
    if (!rules[entry.name]) {
      rules[entry.name] = { title: entry.name, category: PRESENTATION.fallbackCategory, advanced: true };
    }
  }
  return { ...PRESENTATION, rules };
}

/** The session surface generated from a runtime-fetched catalog (FR-139): everything a session
 *  needs to swap sources atomically — never mixed with snapshot pieces (FR-140). */
export interface RuntimeSurface {
  metadata: EditorMetadata;
  paletteBlocks: BlockDefinition[];
  toolbox: Json;
  artifacts: CodecArtifacts;
}

/**
 * Fetch the engine's editor-metadata and generate the full session surface from it (FR-139):
 * gate (FR-140) → `generateCodec`/`generatePalette`/`generateToolbox` over the fetched catalog
 * with the FR-141 presentation fallback — all through the same host engine (AD-030). Throws
 * `MetadataFallbackError` on every failure path; the caller falls back to the snapshot surface.
 */
export async function fetchRuntimeSurface(engine: EngineProvider): Promise<RuntimeSurface> {
  if (typeof engine.getEditorMetadata !== 'function') {
    throw new MetadataFallbackError('method_absent', 'the host engine provider does not implement getEditorMetadata()');
  }
  let payload: Json;
  try {
    payload = await engine.getEditorMetadata();
  } catch (e) {
    throw new MetadataFallbackError('fetch_failed', `getEditorMetadata() failed: ${(e as Error).message}`, e);
  }
  const metadata = validateMetadataPayload(payload);
  const rules = metadata.catalog.rules.map((r) => r.name);
  const presentation = presentationWithFallback(metadata.catalog.rules);
  try {
    const [artifacts, palette, toolbox] = await Promise.all([
      generateCodec(engine, rules, metadata.catalog.rules),
      generatePalette(engine, rules, metadata.catalog.rules, presentation),
      generateToolbox(engine, rules, metadata.catalog.rules, presentation),
    ]);
    return {
      metadata,
      paletteBlocks: (palette as { blocks: BlockDefinition[] }).blocks,
      toolbox,
      artifacts,
    };
  } catch (e) {
    throw new MetadataFallbackError(
      'generation_failed',
      `projection generation over the fetched catalog failed: ${(e as Error).message}`,
      e,
    );
  }
}

/** The pinned snapshot metadata, re-exported for callers that surface which source a session ended
 *  on (FR-140 diagnostics; e.g. "engine 0.1.8 / metadata 3.0 (runtime)" vs "(snapshot)"). */
export { editorMetadata as snapshotMetadata };
