// Public codec surface (M1): the generated encoder/decoder runner + the block vocabulary.
// The codec executes through a host EngineProvider (AD-008); it bundles no engine.

export { encode, decode, CodecError, CODEC_MARKER } from './run.js';
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
// committed artifacts via a host engine; not used by the runtime encode/decode path.
export { generateCodec, serializeArtifact, M1_RULES } from './codegen.js';
export type { CodecArtifact } from './codegen.js';
