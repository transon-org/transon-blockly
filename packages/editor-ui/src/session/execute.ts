// Execution flow (ARCHITECTURE §6.4): validate the sample input JSON, then run the host engine's
// transform() and fold output + captured `file` writes into the session (FR-071..076, AC-013/014/
// 015/024/025). Engine-gated (§10.4). On failure, prior successful output is preserved but marked
// stale (§17.8). The include resolver crosses the same port (AD-010, §16.6).

import type { EngineProvider, ExecutionResult, Json } from '@transon/editor-core';
import type { EditorStore } from './store.js';
import { isEngineReady } from './engine-status.js';
import { engineErrorCode, type EditorError } from './errors.js';
import { createLatestGuard } from './latest.js';

// Per-store latest-call guard: only the newest started execution may commit its result (§17.8
// stale-result safety) — an older overlapping run resolving late must not overwrite fresher state.
const beginExecution = createLatestGuard<EditorStore>();

export interface ExecuteOptions {
  /** Host include resolver (AD-010, §16.6); unresolved names surface `include_loader`. Used by an
   *  in-process host (e.g. the Pyodide reference host) that can call back mid-transform. */
  includeLoader?(name: string): Json | undefined;
  /** Pre-resolved `name → fragment` includes (§16.6). Used by a stateless host (the Node bridge)
   *  that cannot call back mid-transform. */
  includes?: Record<string, Json>;
}

/**
 * Execute the current `template_json` against `sample_input_json`. No-op when gated or when there is
 * no template. Surfaces `runtime_transformation` / `include_loader` on failure (keeping prior output
 * marked stale, §17.8), and the produced output + captured file writes on success (§16.5, AC-024).
 * Returns the raw engine `ExecutionResult` so the caller can thread it into the `onExecute` embedding
 * callback (ARCHITECTURE §5.3, FR-106), or `null` when gated / nothing to execute.
 */
export async function executeTemplate(
  store: EditorStore,
  engine: EngineProvider | undefined,
  marker: string,
  opts: ExecuteOptions = {},
): Promise<ExecutionResult | null> {
  const { template_json, sample_input_json } = store.getState();
  const activeEngine = engine;
  if (!activeEngine || !isEngineReady(activeEngine) || template_json == null) return null;
  const isCurrent = beginExecution(store);
  store.setState({ execution_status: 'pending' });
  const res = await activeEngine.transform(template_json, sample_input_json ?? null, {
    marker,
    includeLoader: opts.includeLoader,
    includes: opts.includes,
  });
  // Drop the result when a newer execution started while this one was in flight (§17.8 — the latest
  // run owns execution_status/output) or the engine left `ready` (disposed/failed mid-flight,
  // NFR-004: never publish over a no-longer-authoritative engine); onExecute must not fire either.
  if (!isCurrent() || !isEngineReady(activeEngine)) return null;
  if (res.status === 'ok' && res.success) {
    store.setState({
      execution_status: 'success',
      execution_output_json: res.output ?? null,
      files_written: res.filesWritten ?? null,
      errors: [],
    });
    return res;
  }
  const error: EditorError = {
    code: engineErrorCode(res.error_type, res.error_message, 'transform'),
    message: res.error_message ?? 'execution failed',
    template_path: res.template_path,
    block_id: res.block_id,
    raw_engine_error: res.raw_engine_error,
  };
  const prev = store.getState();
  store.setState({
    // keep the last successful output but mark it stale (§17.8)
    execution_status: prev.execution_output_json != null ? 'stale' : 'error',
    errors: [error],
  });
  return res;
}
