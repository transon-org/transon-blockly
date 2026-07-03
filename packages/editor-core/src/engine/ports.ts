// EngineProvider port — the single runtime boundary between the engine-free editor
// and a host-supplied engine (AD-008, ARCHITECTURE §5.2, SPEC §10.4).
//
// The editor *defines* this port and *consumes* a host-provided implementation; it
// never bundles or initializes an engine (AD-008). Validation, execution, `include`
// resolution, and `file`-write capture all cross this one boundary.

/**
 * A JSON value. Transon templates, inputs, and outputs are all JSON (SPEC §11.1).
 */
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

/**
 * Static validation outcome — SPEC §9.9.
 *
 * Mirrors the engine's `Transformer.validate()` surface. `valid` is the boolean
 * verdict; the remaining fields locate and describe a failure and are absent/empty on
 * success. `error_type` maps the engine exception class
 * (`DefinitionError` / `TransformationError`); `raw_engine_error` carries the original
 * engine message verbatim for diagnostics (the editor must never report validity the
 * host did not confirm — NFR-004, SPEC §10.4).
 */
export interface ValidationResult {
  /** Lifecycle of the validation call itself (not the verdict). */
  status: 'ok' | 'error';
  /** The engine's verdict: did the template validate? */
  valid: boolean;
  /** Engine exception class, when validation failed. */
  error_type?: string;
  /** Human-readable failure message, when validation failed. */
  error_message?: string;
  /** Engine template path to the offending node, when known (SPEC §9.12). */
  template_path?: string;
  /** Editor block id correlated to `template_path`, when known. */
  block_id?: string;
  /** Original, unmapped engine error text, for diagnostics. */
  raw_engine_error?: string;
}

/**
 * Execution outcome — SPEC §9.10. Extends the §9.9 shape with the produced `output`,
 * a `success` flag, and captured `file` writes.
 *
 * NAMING (ARCHITECTURE §5.2): the TS port uses **camelCase `filesWritten`**, while the
 * Python runner emits the engine-native snake_case key `files_written` (SPEC §9.10).
 * The Node adapter is responsible for the snake→camel mapping at the boundary; engine
 * `write_file` side effects are *captured*, never written to disk (AD-009).
 */
export interface ExecutionResult {
  /** Lifecycle of the execution call itself (not the verdict). */
  status: 'ok' | 'error';
  /** Did execution complete without an engine error? */
  success: boolean;
  /** The transformed result, when execution succeeded. */
  output?: Json;
  /** Captured `file` writes (AD-009), keyed by file name. Snake-cased `files_written`
   *  in the engine/runner; mapped to this camelCase field by the adapter. */
  filesWritten?: Record<string, Json>;
  /** Engine exception class, when execution failed. */
  error_type?: string;
  /** Human-readable failure message, when execution failed. */
  error_message?: string;
  /** Engine template path to the offending node, when known (SPEC §9.12). */
  template_path?: string;
  /** Editor block id correlated to `template_path`, when known. */
  block_id?: string;
  /** Original, unmapped engine error text, for diagnostics. */
  raw_engine_error?: string;
}

/**
 * The runtime engine port (ARCHITECTURE §5.2). Implemented by the HOST, not the editor.
 *
 * A projection/codec template is run through the same `transform` method, parameterized
 * by `marker` — the two-pass generate-then-run model (AD-030, AD-027): the editor never
 * asks the host to `eval` a value as a template; it hands over a finished template plus
 * input data.
 */
export interface EngineProvider {
  /** Lifecycle of the provider. `idle` → `loading` → `ready` | `failed`. */
  readonly status: 'idle' | 'loading' | 'ready' | 'failed';

  /** Bring the engine to `ready` (spawn / load / handshake). Idempotent. */
  init(): Promise<void>;

  /** Statically validate `template` under `marker` (SPEC §9.9). */
  validate(template: Json, o: { marker: string }): Promise<ValidationResult>;

  /**
   * Execute `template` against `input` under `marker` (SPEC §9.10).
   *
   * `include` resolution (AD-010) crosses this boundary two ways, both mapping onto the
   * engine's `template_loader` delegate:
   *   - `includeLoader(name)` — host-driven dynamic resolution (e.g. an embedder's include
   *     library, M4). The stateless bridge cannot call back mid-transform, so a provider
   *     may pre-resolve a known name set through it.
   *   - `includes` — a pre-resolved `name → fragment` map, passed eagerly. The generated
   *     codec (M1) self-`include`s to recurse and factors its per-rule body into a named
   *     fragment; both names are known at codegen time, so the codec runner hands the whole
   *     bundle over directly here rather than through the callback.
   */
  transform(
    template: Json,
    input: Json,
    o: {
      marker: string;
      includeLoader?(name: string): Json | undefined;
      includes?: Record<string, Json>;
      /**
       * Cap the engine `include` recursion depth for this run. The generated codec recurses
       * by self-`include`, which is host-stack-bound below the engine default (50); the codec
       * sets a lower ceiling so deep nesting fails cleanly with an engine depth error instead
       * of a raw host stack overflow (metadata-contract §6.5, §16.4).
       */
      maxIncludeDepth?: number;
    },
  ): Promise<ExecutionResult>;

  /** Engine + metadata versions for the mismatch check (AD-012). */
  version(): Promise<{ engine: string; metadata: string }>;

  /** Release host resources (e.g. reap the subprocess). */
  dispose(): void;
}
