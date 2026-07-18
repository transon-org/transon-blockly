// Engine runtime status mirroring + projection gating (NFR-028, AC-023, §10.4, §17.9).
//
// Q1 / SPEC §10.4 (corrected for the projection model, AD-026/030): generation, import-sync,
// validation, and execution all run through the host engine, so they are available ONLY when an
// engine exists AND is `ready`. With no engine (`absent`) or any non-ready state, those actions are
// disabled while block authoring + raw JSON text handling stay available. This module is the single
// place that decides "is the engine usable right now" and reflects it into the session.

import type { EngineProvider } from '@transon/editor-core';
import { CODEC_ENGINE_FLOOR, isBelowEngineFloor } from '@transon/editor-core';
import type { EditorStore } from './store.js';
import type { EngineRuntimeStatus } from './types.js';

/** Map a (possibly absent) host engine to the surfaced runtime status (`absent` ≠ `idle`). */
export function engineRuntimeStatus(engine: EngineProvider | undefined): EngineRuntimeStatus {
  return engine ? engine.status : 'absent';
}

/** The single gate: are engine-backed actions (projection/validate/execute) usable right now? */
export function isEngineReady(engine: EngineProvider | undefined): boolean {
  return !!engine && engine.status === 'ready';
}

/**
 * Query the host engine + metadata schema versions and fold them into the session for diagnostics
 * (FR-080, AC-023). No-op until the engine is ready; failures leave the versions null. The committed
 * metadata-schema version the editor was built against is a separate constant (`metadataVersion` in
 * editor-core); a mismatch with the host's is surfaced by the UI (NFR-040/AD-012).
 */
export async function loadEngineVersions(
  store: EditorStore,
  engine: EngineProvider | undefined,
): Promise<void> {
  if (!isEngineReady(engine)) return;
  try {
    const v = await engine!.version();
    store.setState({ engine_version: v.engine ?? null, metadata_version: v.metadata ?? null });
    // FR-142 (§7.19): codec engine-floor check, once the version is known. Persistent and
    // NON-blocking (mirrors metadata_fallback): the diagnostic explains at init what would
    // otherwise surface as an opaque engine error on the first codec run. An unknown or
    // unparsable version never triggers it (isBelowEngineFloor is total).
    if (isBelowEngineFloor(v.engine)) {
      store.setState({
        engine_floor: {
          code: 'engine_floor',
          message:
            `host engine ${v.engine} is below the editor's codec engine floor ` +
            `${CODEC_ENGINE_FLOOR} — the generated codec uses engine primitives (the total ` +
            '`in` operator and `length` function) this engine lacks; engine-backed actions ' +
            'will fail until the host upgrades its transon engine',
        },
      });
    }
  } catch {
    /* diagnostics only — leave the versions null on failure */
  }
}

/**
 * Reflect the current engine runtime status into the store and gate the engine-backed verdicts.
 * When the engine is not ready, validation/execution show `disabled`; when it becomes ready they
 * reset to `idle` so the next user action can run. Authoring/JSON-text actions are never gated here.
 * Call this after `init()`, on any host-signalled status change, and from the mount lifecycle (D2).
 */
export function applyEngineStatus(store: EditorStore, engine: EngineProvider | undefined): void {
  const status = engineRuntimeStatus(engine);
  const ready = status === 'ready';
  const prev = store.getState();
  store.setState({
    engine_runtime_status: status,
    validation_status: ready
      ? prev.validation_status === 'disabled'
        ? 'idle'
        : prev.validation_status
      : 'disabled',
    execution_status: ready
      ? prev.execution_status === 'disabled'
        ? 'idle'
        : prev.execution_status
      : 'disabled',
  });
}
