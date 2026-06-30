// Reference playground entry (AD-025): mount the sandbox editor wired to the in-browser Python
// `transon` engine via Pyodide. Demonstrates the full stack — the public @transon/editor-element
// surface driving the codec + validate/execute through a host EngineProvider (AD-008/AD-030). The
// engine loads eagerly on mount (Q2); the editor surfaces its idle→loading→ready/failed status.

import { createTransonEditor } from '@transon/editor-element';
import { createPyodideHost } from './provider.js';

const target = document.getElementById('app');
if (target) {
  createTransonEditor(target, {
    mode: 'sandbox',
    host: { engine: createPyodideHost() },
  });
}
