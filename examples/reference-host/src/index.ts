// @transon/reference-host — the reference EngineProvider (AD-025), implemented over in-browser
// Python `transon` via Pyodide. It runs both user templates (validate/execute) and the projection
// codecs (encode/decode/blockMap) across the host boundary using the same `transform` port
// (AD-030, ARCHITECTURE §5.9). Engine installed from PyPI at load time, never bundled (AD-008).
//
// D0 ships only the package + marker; the Pyodide-backed provider + the demo app land in D3.6.

export const REFERENCE_HOST_PACKAGE = '@transon/reference-host';

export {
  createPyodideHost,
  PINNED_ENGINE_VERSION,
  PYODIDE_VERSION,
  PYODIDE_CDN,
} from './provider.js';
export type { PyodideLike, PyodideHostOptions } from './provider.js';
export { GLUE_PY } from './glue.js';
