// The canonical editor error taxonomy (SPEC §16.4). Every surfaced failure — JSON parse, import
// surface, engine validate/transform, include resolution, runtime init, internal — maps to exactly
// one of these codes. FR-095 renders each code's category distinctly (never colour-only, NFR-045).

import type { CodecError } from '@transon/editor-core';

/** SPEC §16.4 canonical error codes. */
export type ErrorCode =
  | 'json_template' // invalid JSON in imported template text or a direct JSON edit (§7.15)
  | 'json_input' // invalid JSON in sample input
  | 'import_unsupported' // out-of-surface template (§15.7) / out-of-surface direct JSON edit
  | 'template_definition' // engine DefinitionError via validate()
  | 'runtime_transformation' // engine TransformationError via transform()
  | 'include_loader' // include template could not be resolved (§16.6)
  | 'engine_init' // host engine runtime failed to load or initialize
  | 'metadata_fallback' // runtime metadata path unusable — session fell back to the snapshot (§7.18, FR-140)
  | 'engine_floor' // host engine below the declared codec engine floor (§7.19, FR-142)
  | 'editor_internal'; // unexpected editor error

/** Human-facing category label per code (FR-095 distinct display). */
export const ERROR_CATEGORY: Record<ErrorCode, string> = {
  json_template: 'Invalid template JSON',
  json_input: 'Invalid sample input',
  import_unsupported: 'Unsupported template',
  template_definition: 'Template definition error',
  runtime_transformation: 'Runtime error',
  include_loader: 'Include not resolved',
  engine_init: 'Engine initialization error',
  metadata_fallback: 'Engine metadata unavailable (using built-in catalog)',
  engine_floor: 'Engine version below the editor’s supported floor',
  editor_internal: 'Editor error',
};

/** A normalized editor error carrying its taxonomy code and (when known) the block correlation. */
export interface EditorError {
  code: ErrorCode;
  message: string;
  /** Engine template path to the offending node, when known (§9.12). */
  template_path?: string;
  /** Correlated Blockly block id, when known (filled by the highlighter, D4). */
  block_id?: string;
  /** Original, unmapped engine text for diagnostics. */
  raw_engine_error?: string;
}

/**
 * Map the engine's exception class string + message (as carried on ValidationResult/
 * ExecutionResult/CodecError) to the §16.4 taxonomy. The engine raises `DefinitionError` for
 * static/definition problems and `TransformationError` at runtime; an unresolved `include` surfaces
 * as a `TransformationError` whose message says "include not resolvable", so we detect it by message
 * to map it to `include_loader` (§16.6). `phase` disambiguates an otherwise-ambiguous failure.
 */
export function engineErrorCode(
  errorType: string | undefined,
  message: string | undefined,
  phase: 'validate' | 'transform' | 'codec',
): ErrorCode {
  const t = (errorType ?? '').toLowerCase();
  const m = (message ?? '').toLowerCase();
  if (t.includes('include') || m.includes('include not resolvable') || m.includes('include_loader')) {
    return 'include_loader';
  }
  if (t.includes('definition')) return 'template_definition';
  if (t.includes('transformation')) return 'runtime_transformation';
  // Fall back by the call that produced it.
  if (phase === 'validate') return 'template_definition';
  if (phase === 'transform') return 'runtime_transformation';
  return 'editor_internal';
}

/**
 * Map a CodecError (a failure while running the encoder/decoder/blockMap through the host engine)
 * to the taxonomy. A surface failure during the reverse §7.15 path is `import_unsupported`; other
 * codec failures during the forward projection are `editor_internal` (the codec is generated and
 * should not fail on in-surface input — a failure there is an editor/codec defect, not user error).
 *
 * Depth/recursion limits during codec execution are runtime LIMITS, not out-of-surface (§15.7)
 * violations (§16.4, AD-035/RFC-004), so both are mapped to `runtime_transformation`, never
 * `import_unsupported` — otherwise a legitimately deep template would be mislabelled
 * "Unsupported template". Two limits can trip (metadata-contract §6.5):
 *   - the engine's `include` depth-limit guard (`CODEC_MAX_INCLUDE_DEPTH`) — a clean engine
 *     `TransformationError` whose message says "depth limit";
 *   - the host call stack, for a pathological rule-per-level document — a raw recursion overflow
 *     (Python `RecursionError`, "maximum recursion depth exceeded") caught at the
 *     `EngineProvider` boundary and carried on the CodecError's errorType/message.
 */
export function codecErrorCode(err: CodecError, phase: 'forward' | 'reverse'): ErrorCode {
  const t = (err.errorType ?? '').toLowerCase();
  const m = (err.message ?? '').toLowerCase();
  if (t.includes('include') || m.includes('include not resolvable')) return 'include_loader';
  if (m.includes('depth limit')) return 'runtime_transformation';
  if (t.includes('recursion') || m.includes('maximum recursion depth')) return 'runtime_transformation';
  return phase === 'reverse' ? 'import_unsupported' : 'editor_internal';
}
