// The reference EngineProvider (AD-025): in-browser Python `transon` via Pyodide. Implements the
// editor-core EngineProvider port (AD-008) — status lifecycle (idle→loading→ready|failed), validate/
// transform/version — by proxying to the Python glue across a JSON-string boundary (§5.9). It runs
// both user templates AND the generated codecs through the same `transform` (AD-030). Engine
// installed from PyPI at load time, never bundled (AD-008). Pinned to the metadata-snapshot engine.

import type { EngineProvider, ExecutionResult, Json, ValidationResult } from '@transon/editor-core';
import { GLUE_PY } from './glue.js';

/** The engine version this reference host pins, matching docs/metadata-snapshot.md (AD-025).
 *  ≥ 0.1.7 is REQUIRED by the codec depth ceiling (R-32 recursion budget, AD-035/RFC-004). */
export const PINNED_ENGINE_VERSION = '0.1.7';

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

/**
 * PEP 440-ish version allowlist. `engineVersion` is interpolated into Python source executed in
 * Pyodide, so anything outside a plain version literal must be rejected up front.
 */
const ENGINE_VERSION_RE = /^\d+(\.\d+)*([a-z]+\d*)?$/;

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
  if (!ENGINE_VERSION_RE.test(engineVersion)) {
    throw new Error(
      `createPyodideHost: invalid engineVersion ${JSON.stringify(engineVersion)} — expected a plain version like "0.1.6"`,
    );
  }
  const indexURL = opts.pyodideIndexUrl ?? PYODIDE_CDN;
  let py: PyodideLike | undefined;
  // Closure-backed state (not `this`-based) so methods work regardless of call binding.
  let status: EngineProvider['status'] = 'idle';
  let initPromise: Promise<void> | undefined;
  // Bumped by dispose(): an init() started before the dispose must not resurrect the host.
  let generation = 0;

  const requirePy = (method: string): PyodideLike => {
    if (!py) {
      throw new Error(`createPyodideHost: ${method}() requires init() to have resolved (status: ${status})`);
    }
    return py;
  };

  const provider: EngineProvider = {
    get status() {
      return status;
    },
    async init(): Promise<void> {
      if (status === 'ready') return;
      // Concurrent init() calls share the in-flight promise instead of re-loading Pyodide.
      if (initPromise) return initPromise;
      status = 'loading';
      const startedGeneration = generation;
      const stale = (): boolean => generation !== startedGeneration; // disposed mid-flight
      initPromise = (async () => {
        try {
          const loaded = await (opts.loadPyodide ? opts.loadPyodide() : defaultLoadPyodide(indexURL));
          if (stale()) return;
          await loaded.loadPackage('micropip');
          await loaded.runPythonAsync(`import micropip\nawait micropip.install("transon==${engineVersion}")`);
          await loaded.runPythonAsync(GLUE_PY);
          if (stale()) return;
          py = loaded;
          status = 'ready';
        } catch (e) {
          if (!stale()) {
            status = 'failed';
            initPromise = undefined; // allow a retry after failure
          }
          throw e;
        }
      })();
      return initPromise;
    },
    async validate(template: Json, o: { marker: string }): Promise<ValidationResult> {
      const fn = requirePy('validate').globals.get('transon_validate') as PyCallable;
      const out = fn(JSON.stringify(template), o.marker) as string;
      return JSON.parse(out) as ValidationResult;
    },
    async transform(template, input, o): Promise<ExecutionResult> {
      const fn = requirePy('transform').globals.get('transon_transform') as PyCallable;
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
        // Codec include ceiling (CODEC_MAX_INCLUDE_DEPTH, §6.5/AD-035) — was silently dropped
        // before RFC-004, leaving the browser host on the engine default (50).
        o.maxIncludeDepth ?? null,
      ) as string;
      const parsed = JSON.parse(out) as ExecutionResult & { files_written?: Record<string, Json> };
      // The Python glue emits snake_case `files_written`; the port uses camelCase `filesWritten`.
      const { files_written, ...rest } = parsed;
      return { ...rest, filesWritten: files_written } as ExecutionResult;
    },
    async version(): Promise<{ engine: string; metadata: string }> {
      const fn = requirePy('version').globals.get('transon_version') as PyCallable;
      return JSON.parse(fn() as string) as { engine: string; metadata: string };
    },
    dispose(): void {
      generation += 1; // invalidate any in-flight init() so it cannot resurrect the host
      py = undefined;
      initPromise = undefined;
      status = 'idle';
    },
  };
  return provider;
}
