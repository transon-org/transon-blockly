// Reference playground entry (AD-025): mount the sandbox editor wired to the in-browser Python
// `transon` engine via Pyodide. Demonstrates the full stack — the public @transon/editor-element
// surface driving the codec + validate/execute through a host EngineProvider (AD-008/AD-030). The
// engine loads eagerly on mount (Q2); the editor surfaces its idle→loading→ready/failed status.

import { createTransonEditor } from '@transon/editor-element';
import { createPyodideHost } from './provider.js';

// Demo-only URL knobs (RFC-007/AC-043 live verification): `?engine=<version>` overrides the PyPI
// install away from the pin (the editor's snapshot pin is untouched), and `?metadata=engine` opts
// the session into the runtime metadata source (FR-139) — together they reproduce the
// newer-engine-vs-pinned-snapshot skew and show the dynamic surface resolving it.
const params = new URLSearchParams(location.search);
const engineVersion = params.get('engine') ?? undefined;
const metadataSource = params.get('metadata') === 'engine' ? ('engine' as const) : undefined;

const target = document.getElementById('app');
if (target) {
  createTransonEditor(target, {
    mode: 'sandbox',
    metadataSource,
    host: { engine: createPyodideHost(engineVersion ? { engineVersion } : {}) },
  });
}
