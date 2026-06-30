// Validation flow (ARCHITECTURE §6.4): run the host engine's validate() on the generated template
// and fold the verdict into the session (FR-064..070, AC-012/016). Engine-gated (§10.4) — the
// engine is the authoritative validator (NFR-004); the editor never reports validity it didn't get.

import type { EngineProvider } from '@transon/editor-core';
import type { EditorStore } from './store.js';
import { isEngineReady } from './engine-status.js';
import { engineErrorCode, type EditorError } from './errors.js';

/**
 * Validate the current `template_json` through the host engine. No-op when the engine is not ready
 * (gated) or there is nothing to validate. Sets `validation_status` and the error list (the latest
 * validate/run operation owns the error panel).
 */
export async function validateTemplate(
  store: EditorStore,
  engine: EngineProvider | undefined,
  marker: string,
): Promise<void> {
  const template = store.getState().template_json;
  if (!isEngineReady(engine) || template == null) return;
  store.setState({ validation_status: 'pending' });
  const res = await engine!.validate(template, { marker });
  if (res.status === 'ok' && res.valid) {
    store.setState({ validation_status: 'valid', errors: [] });
    return;
  }
  const error: EditorError = {
    code: engineErrorCode(res.error_type, 'validate'),
    message: res.error_message ?? 'validation failed',
    template_path: res.template_path,
    block_id: res.block_id,
    raw_engine_error: res.raw_engine_error,
  };
  store.setState({ validation_status: 'invalid', errors: [error] });
}
