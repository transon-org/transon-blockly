// @transon/editor-core — public M0 surface.
//
// M0 ships only the engine-free scaffolding: the EngineProvider port type (AD-008) and
// the typed metadata-snapshot loader (AD-012). No codec, no generators, no Blockly,
// no React (those are M1/M3/M4/M5).

export type {
  Json,
  EngineProvider,
  ValidationResult,
  ExecutionResult,
} from './engine/ports.js';

export {
  editorMetadata,
  metadataVersion,
} from './metadata/snapshot.js';
export type {
  EditorMetadata,
  EditorCatalog,
  EditorDocs,
  CatalogEntry,
} from './metadata/snapshot.js';
