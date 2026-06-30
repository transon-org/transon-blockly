// Public codec surface (M1): the generated encoder/decoder runner + the block vocabulary.
// The codec executes through a host EngineProvider (AD-008); it bundles no engine.

export { encode, decode, blockMap, runCodecArtifact, CodecError, CODEC_MARKER } from './run.js';
export {
  STRUCTURAL_BLOCK_TYPES,
  ruleBlockType,
  isRuleBlockType,
} from './vocabulary.js';
export type {
  StructuralBlockType,
  WorkspaceBlock,
  JsonPathBlockMap,
  JsonPathBlockMapEntry,
} from './vocabulary.js';

// The metadata→codec projection (AD-026). Exposed so the build/regen gate can regenerate the
// committed artifacts + generator sources via a host engine; not used by the runtime path.
export {
  generateCodec,
  serializeArtifact,
  stableStringify,
  GENERATOR_SOURCES,
  GENERATOR_FILES,
  CATALOG_RULES,
  M1_RULES,
} from './codegen.js';
export type { CodecArtifact } from './codegen.js';

// Editor-owned presentation projection-data (metadata-contract §2.9, FR-127/NFR-048) — the
// single committed source for title/category/advanced + category order + category→colour,
// consumed by the G_palette/G_toolbox projections.
export { PRESENTATION } from './presentation.js';
export type { Presentation, RulePresentation } from './presentation.js';
