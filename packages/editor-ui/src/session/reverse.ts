// Strict bidirectional JSON sync — the reverse path (§7.15, AD-024, FR-111..113). A direct edit of
// the generated Transon JSON syncs back to the workspace ONLY when it is (a) valid JSON and (b)
// within the supported surface (§15.7); otherwise it is reported and the workspace is left unchanged
// (FR-112/113). This module decides accept/reject by RUNNING THE GENERATED CODEC (encode/decode)
// through the host engine — it never re-implements the codec or the surface check (AD-032).

import { encode, decode, CodecError, stableStringify, STRUCTURAL_BLOCK_TYPES } from '@transon/editor-core';
import type { CodecArtifacts, EngineProvider, Json } from '@transon/editor-core';
import { codecErrorCode, type EditorError } from './errors.js';

export type ReverseOutcome =
  | { status: 'accepted'; block: Json; document: Json }
  | { status: 'rejected'; error: EditorError };

/** The out-of-surface placeholder block type (§13.11), sourced from the vocabulary (single source). */
const UNSUPPORTED = STRUCTURAL_BLOCK_TYPES.find((t) => t.includes('unsupported')) ?? 'transon_unsupported';

/**
 * Does the encoded workspace contain a `transon_unsupported` placeholder (out-of-surface, §15.7)?
 * We must check the placeholder in BLOCK-TYPE position only — a naive substring scan false-positives
 * when the document *data* happens to contain the string `transon_unsupported` (as a literal value,
 * object key, or param), wrongly rejecting a valid in-surface edit (FR-111). So walk structurally
 * and test each node's `type`. This reads only `.type` (not `.inputs`/`.fields`/`.extraState`) and
 * recurses via `Object.values`, so it is not a codec↔workspace mapping (FR-126/AD-032).
 */
function containsUnsupported(node: Json): boolean {
  if (Array.isArray(node)) return node.some(containsUnsupported);
  if (node !== null && typeof node === 'object') {
    if ((node as { type?: unknown }).type === UNSUPPORTED) return true;
    return Object.values(node).some(containsUnsupported);
  }
  return false;
}

/**
 * Decide whether an edited JSON string may sync back to the workspace (§7.15). Steps:
 *   1. parse — invalid JSON → `json_template` (§16.4).
 *   2. encode through the engine → the candidate workspace block.
 *   3. surface check — any `transon_unsupported` in the output means out-of-surface → `import_unsupported`.
 *   4. round-trip gate (AD-024) — re-`decode` must reproduce the edited document; a mismatch (meaning
 *      would change) → `import_unsupported`.
 * Only an in-surface, round-trip-faithful edit is `accepted`; the caller then loads the block.
 */
export async function tryReverse(
  engine: EngineProvider,
  text: string,
  marker: string,
  artifacts?: CodecArtifacts,
): Promise<ReverseOutcome> {
  let document: Json;
  try {
    document = JSON.parse(text) as Json;
  } catch (e) {
    return { status: 'rejected', error: { code: 'json_template', message: `Invalid JSON: ${(e as Error).message}` } };
  }

  let block: Json;
  try {
    block = await encode(engine, document, marker, artifacts);
  } catch (e) {
    const error: EditorError =
      e instanceof CodecError
        ? { code: codecErrorCode(e, 'reverse'), message: e.message, raw_engine_error: e.rawEngineError }
        : { code: 'editor_internal', message: (e as Error).message };
    return { status: 'rejected', error };
  }

  if (containsUnsupported(block)) {
    return {
      status: 'rejected',
      error: { code: 'import_unsupported', message: 'Template is outside the supported surface (§15.7).' },
    };
  }

  let roundTripped: Json;
  try {
    roundTripped = await decode(engine, block, marker, artifacts);
  } catch (e) {
    return {
      status: 'rejected',
      error: { code: 'import_unsupported', message: (e as Error).message },
    };
  }
  if (stableStringify(roundTripped) !== stableStringify(document)) {
    return {
      status: 'rejected',
      error: { code: 'import_unsupported', message: 'Edit could not be represented without changing meaning (§7.15).' },
    };
  }

  return { status: 'accepted', block, document };
}
