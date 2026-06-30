// @transon/editor-core — public surface.
//
// M0 shipped the engine-free scaffolding: the EngineProvider port type (AD-008) and the
// typed metadata-snapshot loader (AD-012). M1 adds the projection codec — the generated
// encoder/decoder that round-trips a Transon document through Blockly workspace JSON,
// executed via a host engine (AD-026/030/032). No Blockly, no React (M3/M4/M5).

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

export {
  encode,
  decode,
  CodecError,
  CODEC_MARKER,
  STRUCTURAL_BLOCK_TYPES,
  ruleBlockType,
  isRuleBlockType,
  generateCodec,
  serializeArtifact,
  stableStringify,
  GENERATOR_SOURCES,
  GENERATOR_FILES,
  M1_RULES,
} from './codec/index.js';
export type {
  StructuralBlockType,
  WorkspaceBlock,
  JsonPathBlockMap,
  JsonPathBlockMapEntry,
  CodecArtifact,
} from './codec/index.js';
