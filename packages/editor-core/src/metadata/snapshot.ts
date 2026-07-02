// Typed loader for the pinned, engine-owned editor-metadata snapshot (AD-012, NFR-047).
//
// Import mechanism & justification: the snapshot lives at repo-root `docs/metadata-snapshot.json`
// (outside this package, shared by the docs/ gates). We import it as a JSON module with a relative
// path. Vite library mode inlines `resolveJsonModule` imports into the build output, and Vitest
// resolves the same path, so one source of truth feeds both build and tests with no copy step and
// no fs/Node-only path. The structural `catalog` is kept separate from the `docs` examples payload
// per NFR-047, so consumers (M1 generators) read the lean catalog without pulling examples.

import snapshot from '../../../../docs/metadata-snapshot.json' with { type: 'json' };

import type { Json } from '../engine/ports.js';

/** A single entry in one of the catalog lists (rules / operators / functions). */
export type CatalogEntry = { name: string } & Record<string, Json>;

/** The structural catalog (no examples/docs) — NFR-047. */
export interface EditorCatalog {
  rules: CatalogEntry[];
  operators: CatalogEntry[];
  functions: CatalogEntry[];
}

/**
 * One serialized corpus case in the flat `docs.examples` corpus
 * (metadata-contract §2.7, v2.1 / engine metadata 3.0). Names are unique —
 * they are the join key every `examples` reference list resolves against.
 */
export interface ExampleEntry {
  name: string;
  doc: string | null;
  template: Json;
  data: Json;
  result: Json;
  /** Engine facts (what the case demonstrates) — grouping/filter hints, not the join. */
  tags: string[];
}

/**
 * The examples/docs payload, split from the structural catalog (NFR-047).
 * Normalized (metadata-contract §2.7): `examples` is the flat corpus (every case
 * exactly once); entry-level `examples` fields and the curated tiers are ordered
 * `name` references into it.
 */
export interface EditorDocs {
  examples: ExampleEntry[];
  rules: CatalogEntry[];
  operators: CatalogEntry[];
  functions: CatalogEntry[];
  worked_examples: string[];
  recipes: string[];
}

/**
 * The typed editor-metadata view consumed by the editor (AD-012). `metadata_version`
 * drives the schema-mismatch check; `engine_version` is informational (may be `null`
 * when the snapshot was exported from a non-installed engine checkout).
 */
export interface EditorMetadata {
  metadata_version: string;
  engine_version: string | null;
  catalog: EditorCatalog;
  docs: EditorDocs;
}

const raw = snapshot as unknown as {
  metadata_version: number | string;
  engine_version: string | null;
  catalog: EditorCatalog;
  docs: EditorDocs;
};

/**
 * The pinned editor metadata, as a typed `EditorMetadata`.
 *
 * `metadata_version` is normalized to a string token (e.g. "3.0") for the schema-version gate
 * (AD-012, metadata-contract §5). The engine/snapshot already emit the version as a string, so
 * `String(...)` is idempotent here; it also guards an engine that ever emits the bare number.
 */
export const editorMetadata: EditorMetadata = {
  metadata_version: String(raw.metadata_version),
  engine_version: raw.engine_version,
  catalog: raw.catalog,
  docs: raw.docs,
};

/** The pinned metadata-schema version this build was generated against (AD-012). */
export const metadataVersion: string = editorMetadata.metadata_version;
