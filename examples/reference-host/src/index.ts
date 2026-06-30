// @transon/reference-host — the reference EngineProvider (AD-025), implemented over in-browser
// Python `transon` via Pyodide. It runs both user templates (validate/execute) and the projection
// codecs (encode/decode/blockMap) across the host boundary using the same `transform` port
// (AD-030, ARCHITECTURE §5.9). Engine installed from PyPI at load time, never bundled (AD-008).
//
// D0 ships only the package + marker; the Pyodide-backed provider + the demo app land in D3.6.

export const REFERENCE_HOST_PACKAGE = '@transon/reference-host';

/** The engine version this reference host pins, matching docs/metadata-snapshot.md (AD-025). */
export const PINNED_ENGINE_VERSION = '0.1.3';
