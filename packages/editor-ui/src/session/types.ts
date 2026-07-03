// The EditorSession state shape (SPEC §9.3) plus the M4 data-flow fields the store needs to drive
// the one-way forward projection and the gated reverse sync (ARCHITECTURE §6). Pure data — no
// React, no Blockly, no engine. The codec/validate/execute all cross the host EngineProvider port.

import type { Json, JsonPathBlockMap } from '@transon/editor-core';
import type { EditorError } from './errors.js';

export type EditorMode = 'sandbox' | 'compact';

/** Verdict lifecycle of static validation (not the call's own ok/error). `disabled` = no engine. */
export type ValidationStatus = 'idle' | 'pending' | 'valid' | 'invalid' | 'disabled';

/** Verdict lifecycle of execution. `stale` marks a prior success kept after a later failure (§17.8). */
export type ExecutionStatus = 'idle' | 'pending' | 'success' | 'error' | 'stale' | 'disabled';

/** §7.15 reverse-sync state of the JSON panel relative to the workspace. */
export type JsonSyncStatus = 'in_sync' | 'out_of_sync' | 'editing';

/**
 * The host engine runtime lifecycle the editor surfaces (NFR-028, AC-023). Mirrors
 * `EngineProvider.status`, with `absent` for "no host engine supplied at all" (§10.4) — distinct
 * from `idle` (an engine exists but has not been initialized).
 */
export type EngineRuntimeStatus = 'absent' | 'idle' | 'loading' | 'ready' | 'failed';

/**
 * Whether a canonical template can currently be generated from the workspace (§17.5). `unavailable`
 * is the engine-gated case (Q1/§10.4: the projection runs the codec through the engine, so with no
 * `ready` engine there is no generation); `incomplete` is a workspace missing required inputs.
 */
export type GenerationStatus = 'empty' | 'complete' | 'incomplete' | 'unavailable';

export interface EditorSession {
  // ---- SPEC §9.3 canonical fields ----
  /** Blockly workspace serialization JSON (the projection source of the canonical template). */
  workspace: Json | null;
  /** The generated canonical Transon JSON (decode(workspace)). */
  template_json: Json | null;
  sample_input_json: Json | null;
  execution_output_json: Json | null;
  validation_status: ValidationStatus;
  execution_status: ExecutionStatus;
  errors: EditorError[];
  selected_example: string | null;
  marker: string;
  engine_version: string | null;
  metadata_version: string | null;
  editor_mode: EditorMode;

  // ---- M4 data-flow fields (ARCHITECTURE §6) ----
  /** Mirror of the host EngineProvider lifecycle (NFR-028, AC-023). */
  engine_runtime_status: EngineRuntimeStatus;
  /** §7.15 reverse-sync state of the editable JSON panel. */
  json_sync_status: JsonSyncStatus;
  /** Whether generation from the workspace is possible right now (§17.5, §10.4). */
  generation_status: GenerationStatus;
  /** template_path → block correlation map for error highlighting (§9.12, FR-091/122). */
  block_map: JsonPathBlockMap | null;
  /** Captured `file` writes from the last execution (§16.5, §12.11, AC-024). */
  files_written: Record<string, Json> | null;
  /** Expected output of the loaded example, for actual-vs-expected display (§12.9, AC-019). Null
   *  unless an example with a `result` is loaded. */
  expected_output_json: Json | null;
}

/** The default marker key (SPEC §11.2). */
export const DEFAULT_MARKER = '$';

/** A fresh session with everything idle/empty (used by New and by the store factory). */
export function emptySession(overrides: Partial<EditorSession> = {}): EditorSession {
  return {
    workspace: null,
    template_json: null,
    sample_input_json: null,
    execution_output_json: null,
    validation_status: 'idle',
    execution_status: 'idle',
    errors: [],
    selected_example: null,
    marker: DEFAULT_MARKER,
    engine_version: null,
    metadata_version: null,
    editor_mode: 'sandbox',
    engine_runtime_status: 'absent',
    json_sync_status: 'in_sync',
    generation_status: 'empty',
    block_map: null,
    files_written: null,
    expected_output_json: null,
    ...overrides,
  };
}
