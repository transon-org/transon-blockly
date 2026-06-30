// Execution flow (ARCHITECTURE §6.4): validate the sample input JSON, then run the host engine's
// transform() and fold output + captured `file` writes into the session (FR-071..076, AC-013/014/
// 015/024/025). Engine-gated (§10.4). On failure, prior successful output is preserved but marked
// stale (§17.8). The include resolver crosses the same port (AD-010, §16.6).

import type { EngineProvider, Json } from '@transon/editor-core';
import type { EditorStore } from './store.js';
import { isEngineReady } from './engine-status.js';
import { engineErrorCode, type EditorError } from './errors.js';

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
 */
export async function executeTemplate(
  store: EditorStore,
  engine: EngineProvider | undefined,
  marker: string,
  opts: ExecuteOptions = {},
): Promise<void> {
  const { template_json, sample_input_json } = store.getState();
  if (!isEngineReady(engine) || template_json == null) return;
  store.setState({ execution_status: 'pending' });
  const res = await engine!.transform(template_json, sample_input_json ?? null, {
    marker,
    includeLoader: opts.includeLoader,
    includes: opts.includes,
  });
  if (res.status === 'ok' && res.success) {
    store.setState({
      execution_status: 'success',
      execution_output_json: res.output ?? null,
      files_written: res.filesWritten ?? null,
      errors: [],
    });
    return;
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
}
