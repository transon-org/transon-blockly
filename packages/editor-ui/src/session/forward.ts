// Forward projection flow (ARCHITECTURE §6, one-way): live Blockly workspace → canonical Transon
// JSON. This is the DECODER direction (workspace→document, editor-core run.ts; see ARCH §6 naming
// note). It runs the generated decoder + the block-map through the host engine — so it is gated on
// an engine being `ready` (Q1/§10.4). The codec logic is NOT re-implemented here; this only
// orchestrates core's decode()/blockMap() and folds the result into the session.

import { decode, blockMap, CodecError } from '@transon/editor-core';
import type { EngineProvider, Json, JsonPathBlockMap } from '@transon/editor-core';
import type { EditorStore } from './store.js';
import type { GenerationStatus } from './types.js';
import { isEngineReady } from './engine-status.js';
import { codecErrorCode, type EditorError } from './errors.js';

export interface ForwardResult {
  template_json: Json | null;
  block_map: JsonPathBlockMap | null;
  generation_status: GenerationStatus;
  error: EditorError | null;
}

/** A Blockly workspace serialization with no top-level blocks (nothing authored yet). */
export function isEmptyWorkspace(workspace: Json | null): boolean {
  return topBlocks(workspace).length === 0;
}

/** The top-level blocks of a Blockly workspace-serialization envelope (`save()` output). */
function topBlocks(workspace: Json | null): Json[] {
  if (workspace == null) return [];
  const blocks = (workspace as { blocks?: { blocks?: Json[] } }).blocks?.blocks;
  return Array.isArray(blocks) ? blocks : [];
}

/**
 * Unwrap the single top block the codec decodes. The store's `workspace` is the Blockly envelope
 * (`{ blocks: { blocks: [...] } }`, the native `serialization.workspaces.save()` output, AD-032);
 * the decoder operates on the bare top block (the document root). A Transon template is one document
 * = one top block. Returns `undefined` for an empty workspace and (best-effort) the first top block
 * when several are present — a multi-top workspace is an authoring-in-progress state.
 */
export function topBlock(workspace: Json | null): Json | undefined {
  return topBlocks(workspace)[0];
}

/**
 * Project the workspace to canonical JSON + the block map. Pure with respect to the store: it only
 * reads the engine. Returns `unavailable` (not an error) when the engine cannot run the codec — the
 * caller surfaces that as a gated, explained state, never as a user error.
 */
export async function runForward(
  engine: EngineProvider | undefined,
  workspace: Json | null,
  marker: string,
): Promise<ForwardResult> {
  if (!isEngineReady(engine)) {
    return { template_json: null, block_map: null, generation_status: 'unavailable', error: null };
  }
  const block = topBlock(workspace);
  if (block === undefined) {
    return { template_json: null, block_map: null, generation_status: 'empty', error: null };
  }
  try {
    const document = await decode(engine!, block, marker);
    const map = await blockMap(engine!, document, marker);
    return { template_json: document, block_map: map, generation_status: 'complete', error: null };
  } catch (err) {
    if (err instanceof CodecError) {
      return {
        template_json: null,
        block_map: null,
        generation_status: 'incomplete', // could not produce a complete template (§17.5)
        error: {
          code: codecErrorCode(err, 'forward'),
          message: err.message,
          raw_engine_error: err.rawEngineError,
        },
      };
    }
    throw err;
  }
}

/**
 * Apply a forward result to the store. A successful (re)generation supersedes the previous
 * validate/execute verdicts: validation resets to `idle` (re-validation needed for the new
 * template) and a prior successful execution is marked `stale` (§17.8). The forward error (if any)
 * replaces any prior generation/import error but leaves engine-disabled gating to engine-status.
 */
export function applyForward(store: EditorStore, result: ForwardResult): void {
  const prev = store.getState();
  const downstreamReset =
    result.generation_status === 'complete'
      ? {
          validation_status:
            prev.validation_status === 'disabled' ? ('disabled' as const) : ('idle' as const),
          execution_status:
            prev.execution_status === 'success' ? ('stale' as const) : prev.execution_status,
        }
      : {};
  store.setState({
    template_json: result.template_json,
    block_map: result.block_map,
    generation_status: result.generation_status,
    errors: result.error ? [result.error] : [],
    ...downstreamReset,
  });
}

/** A trailing debounce used to coalesce rapid workspace-change events before re-projecting (§6). */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): ((...args: A) => void) & { cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: A): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, ms);
  };
  debounced.cancel = (): void => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  return debounced;
}
