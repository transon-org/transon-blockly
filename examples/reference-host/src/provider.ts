// The reference EngineProvider (AD-025): in-browser Python `transon` via Pyodide. Implements the
// editor-core EngineProvider port (AD-008) — status lifecycle (idle→loading→ready|failed), validate/
// transform/version — by proxying to the Python glue across a JSON-string boundary (§5.9). It runs
// both user templates AND the generated codecs through the same `transform` (AD-030). Engine
// installed from PyPI at load time, never bundled (AD-008). Pinned to the metadata-snapshot engine.

import type { EngineProvider, ExecutionResult, Json, ValidationResult } from '@transon/editor-core';
import { GLUE_PY } from './glue.js';

/** The engine version this reference host pins, matching docs/metadata-snapshot.md (AD-025). */
export const PINNED_ENGINE_VERSION = '0.1.3';

/** A pinned Pyodide build (the editor ships no engine; this loads it at runtime, AD-008). */
export const PYODIDE_VERSION = 'v0.28.3';
export const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;

/** The minimal Pyodide surface the provider uses (the real Pyodide satisfies this). */
export interface PyodideLike {
  loadPackage(names: string | string[]): Promise<unknown>;
  runPythonAsync(code: string): Promise<unknown>;
  globals: { get(name: string): unknown };
}

export interface PyodideHostOptions {
  /** Inject a Pyodide instance (tests pass a fake; default loads the pinned CDN build in-browser). */
  loadPyodide?(): Promise<PyodideLike>;
  /** transon version installed from PyPI (default: the committed snapshot's engine, AD-025). */
  engineVersion?: string;
  /** Override the Pyodide CDN index URL. */
  pyodideIndexUrl?: string;
}

type PyCallable = (...args: unknown[]) => unknown;

async function defaultLoadPyodide(indexURL: string): Promise<PyodideLike> {
  // Browser-only: dynamically import the Pyodide ESM from the pinned CDN (never bundled, AD-008).
  const mod = (await import(/* @vite-ignore */ `${indexURL}pyodide.mjs`)) as {
    loadPyodide(o: { indexURL: string }): Promise<PyodideLike>;
  };
  return mod.loadPyodide({ indexURL });
}

/**
 * Create the reference Pyodide-backed EngineProvider. `init()` loads Pyodide, installs `transon`
 * from PyPI, and defines the Python glue; `validate`/`transform`/`version` proxy to it over JSON
 * strings. Production embedders may instead supply any EngineProvider (AD-008).
 */
export function createPyodideHost(opts: PyodideHostOptions = {}): EngineProvider {
  const engineVersion = opts.engineVersion ?? PINNED_ENGINE_VERSION;
  const indexURL = opts.pyodideIndexUrl ?? PYODIDE_CDN;
  let py: PyodideLike | undefined;

  const provider: EngineProvider = {
    status: 'idle',
    async init(): Promise<void> {
      if (this.status === 'ready') return;
      (this as { status: EngineProvider['status'] }).status = 'loading';
      try {
        py = await (opts.loadPyodide ? opts.loadPyodide() : defaultLoadPyodide(indexURL));
        await py.loadPackage('micropip');
        await py.runPythonAsync(`import micropip\nawait micropip.install("transon==${engineVersion}")`);
        await py.runPythonAsync(GLUE_PY);
        (this as { status: EngineProvider['status'] }).status = 'ready';
      } catch (e) {
        (this as { status: EngineProvider['status'] }).status = 'failed';
        throw e;
      }
    },
    async validate(template: Json, o: { marker: string }): Promise<ValidationResult> {
      const fn = py!.globals.get('transon_validate') as PyCallable;
      const out = fn(JSON.stringify(template), o.marker) as string;
      return JSON.parse(out) as ValidationResult;
    },
    async transform(template, input, o): Promise<ExecutionResult> {
      const fn = py!.globals.get('transon_transform') as PyCallable;
      const jsLoader = o.includeLoader
        ? (name: string): string | null => {
            const t = o.includeLoader!(name);
            return t === undefined ? null : JSON.stringify(t);
          }
        : null;
      const out = fn(
        JSON.stringify(template),
        JSON.stringify(input ?? null),
        o.marker,
        JSON.stringify(o.includes ?? {}),
        jsLoader,
      ) as string;
      const parsed = JSON.parse(out) as ExecutionResult & { files_written?: Record<string, Json> };
      // The Python glue emits snake_case `files_written`; the port uses camelCase `filesWritten`.
      const { files_written, ...rest } = parsed;
      return { ...rest, filesWritten: files_written } as ExecutionResult;
    },
    async version(): Promise<{ engine: string; metadata: string }> {
      const fn = py!.globals.get('transon_version') as PyCallable;
      return JSON.parse(fn() as string) as { engine: string; metadata: string };
    },
    dispose(): void {
      py = undefined;
    },
  };
  return provider;
}
