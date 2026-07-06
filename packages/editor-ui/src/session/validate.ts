// Validation flow (ARCHITECTURE §6.4): run the host engine's validate() on the generated template
// and fold the verdict into the session (FR-064..070, AC-012/016). Engine-gated (§10.4) — the
// engine is the authoritative validator (NFR-004); the editor never reports validity it didn't get.

import type { EngineProvider, ValidationResult } from '@transon/editor-core';
import type { EditorStore } from './store.js';
import { isEngineReady } from './engine-status.js';
import { engineErrorCode, type EditorError } from './errors.js';
import { createLatestGuard } from './latest.js';

// Per-store latest-call guard: only the newest started validation may commit its verdict (§17.8
// stale-result safety) — an older overlapping call resolving late must not overwrite fresher state.
const beginValidation = createLatestGuard<EditorStore>();

/**
 * Validate the current `template_json` through the host engine. No-op when the engine is not ready
 * (gated) or there is nothing to validate. Sets `validation_status` and the error list (the latest
 * validate/run operation owns the error panel). Returns the raw engine `ValidationResult` so the
 * caller can thread it into the `onValidate` embedding callback (ARCHITECTURE §5.3, FR-105), or
 * `null` when gated / nothing to validate.
 */
export async function validateTemplate(
  store: EditorStore,
  engine: EngineProvider | undefined,
  marker: string,
): Promise<ValidationResult | null> {
  const template = store.getState().template_json;
  const activeEngine = engine;
  if (!activeEngine || !isEngineReady(activeEngine) || template == null) return null;
  const isCurrent = beginValidation(store);
  store.setState({ validation_status: 'pending' });
  let res: ValidationResult;
  try {
    res = await activeEngine.validate(template, { marker });
  } catch (e) {
    // A rejection is a host/glue defect, not an engine verdict (§16.4). Back to `idle`, NOT
    // `invalid` — the editor never reports a validity verdict it didn't get (NFR-004).
    if (!isCurrent() || !isEngineReady(activeEngine)) return null;
    store.setState({
      validation_status: 'idle',
      errors: [{ code: 'editor_internal', message: `engine validate failed: ${String(e)}` }],
    });
    return null;
  }
  // Drop the verdict when a newer validation started while this one was in flight (§17.8 — the
  // latest call owns validation_status/errors) or the engine left `ready` (disposed/failed
  // mid-flight, NFR-004: the engine must still be authoritative); onValidate must not fire either.
  if (!isCurrent() || !isEngineReady(activeEngine)) return null;
  if (res.status === 'ok' && res.valid) {
    store.setState({ validation_status: 'valid', errors: [] });
    return res;
  }
  const error: EditorError = {
    code: engineErrorCode(res.error_type, res.error_message, 'validate'),
    message: res.error_message ?? 'validation failed',
    template_path: res.template_path,
    block_id: res.block_id,
    raw_engine_error: res.raw_engine_error,
  };
  store.setState({ validation_status: 'invalid', errors: [error] });
  return res;
}
