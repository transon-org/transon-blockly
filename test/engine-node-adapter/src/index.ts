// Node->Python `transon` EngineProvider adapter (AD-011, AD-025) — test-only.
//
// Spawns one long-lived Python `runner.py` process and speaks newline-delimited JSON
// over its stdin/stdout. Production embedders supply their own EngineProvider (AD-008);
// this exists so CI can run validation/execution and the codec round-trip against the
// real engine without an in-browser runtime.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createInterface, type Interface } from 'node:readline';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  EngineProvider,
  ExecutionResult,
  Json,
  ValidationResult,
} from '@transon/editor-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNNER = join(HERE, 'runner.py');

export interface NodeEngineProviderOptions {
  /** Override the Python interpreter. Defaults to the resolution order below. */
  python?: string;
  /** Override the transon checkout for PYTHONPATH (mirrors $TRANSON_REPO). */
  transonRepo?: string;
}

interface Resolved {
  python: string;
  env: NodeJS.ProcessEnv;
}

/**
 * Resolve the Python interpreter + environment. Resolution order:
 *   1. explicit `opts.python` / `$TRANSON_PYTHON`
 *   2. the engine checkout's own venv (`<transonRepo>/.venv/bin/python`) if present
 *   3. a bare `python3` on PATH
 * In every case PYTHONPATH is pointed at the transon checkout ($TRANSON_REPO ->
 * sibling ../transon) so the engine imports even from a bare interpreter.
 */
function resolvePython(opts: NodeEngineProviderOptions): Resolved {
  const env: NodeJS.ProcessEnv = { ...process.env };

  // Editor repo root is three levels up from test/engine-node-adapter/src.
  const repoRoot = resolve(HERE, '..', '..', '..');
  const transonRepo =
    opts.transonRepo ??
    env.TRANSON_REPO ??
    resolve(dirname(repoRoot), 'transon');

  // Ensure the engine is importable even when a bare `python3` is used.
  if (existsSync(join(transonRepo, 'transon', '__init__.py'))) {
    env.PYTHONPATH = env.PYTHONPATH
      ? `${transonRepo}:${env.PYTHONPATH}`
      : transonRepo;
  }

  const explicit = opts.python ?? env.TRANSON_PYTHON;
  if (explicit) return { python: explicit, env };
  // Prefer the engine checkout's own venv if it has one; else a bare `python3`
  // (the PYTHONPATH set above makes the sibling checkout importable either way).
  const venvPython = join(transonRepo, '.venv', 'bin', 'python');
  if (existsSync(venvPython)) return { python: venvPython, env };
  return { python: 'python3', env };
}

interface PendingRequest {
  resolve(value: Record<string, unknown>): void;
  reject(err: Error): void;
}

class NodeEngineProvider implements EngineProvider {
  status: EngineProvider['status'] = 'idle';

  #proc: ChildProcessWithoutNullStreams | null = null;
  #rl: Interface | null = null;
  #queue: PendingRequest[] = [];
  #stderr = '';

  constructor(private readonly opts: NodeEngineProviderOptions = {}) {}

  async init(): Promise<void> {
    if (this.status === 'ready') return;
    this.status = 'loading';
    try {
      const { python, env } = resolvePython(this.opts);
      const proc = spawn(python, [RUNNER], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      }) as ChildProcessWithoutNullStreams;
      this.#proc = proc;
      proc.stderr.setEncoding('utf8');
      proc.stderr.on('data', (chunk: string) => {
        this.#stderr += chunk;
      });
      proc.on('error', (err) => this.#failAll(err));
      proc.on('exit', (code) => {
        if (this.#queue.length) {
          this.#failAll(
            new Error(
              `runner exited (code ${code ?? 'null'})${
                this.#stderr ? `: ${this.#stderr}` : ''
              }`,
            ),
          );
        }
      });

      this.#rl = createInterface({ input: proc.stdout });
      this.#rl.on('line', (line) => this.#onLine(line));

      // Handshake: a version() round-trip proves the engine imported.
      await this.version();
      this.status = 'ready';
    } catch (err) {
      this.status = 'failed';
      throw err;
    }
  }

  async validate(
    template: Json,
    o: { marker: string },
  ): Promise<ValidationResult> {
    const res = await this.#request({
      op: 'validate',
      template,
      marker: o.marker,
    });
    return res as unknown as ValidationResult;
  }

  async transform(
    template: Json,
    input: Json,
    o: {
      marker: string;
      includeLoader?(name: string): Json | undefined;
    },
  ): Promise<ExecutionResult> {
    // `includeLoader` maps onto the engine `template_loader` delegate (AD-010). The
    // newline-JSON bridge is stateless per request and cannot call back across the
    // boundary mid-transform, so includes are passed eagerly as a name->fragment map.
    // M0 templates use no includes (an empty map is correct); M1 enumerates the names
    // the codec references and pre-resolves them through `includeLoader`.
    const includes: Record<string, Json> = collectIncludes(o.includeLoader);
    const res = (await this.#request({
      op: 'transform',
      template,
      input,
      marker: o.marker,
      includes,
    })) as Record<string, unknown>;

    // Map engine-native snake_case files_written -> camelCase filesWritten (§5.2).
    const { files_written, ...rest } = res as {
      files_written?: Record<string, Json>;
    } & Record<string, unknown>;
    return {
      ...(rest as object),
      filesWritten: files_written ?? {},
    } as unknown as ExecutionResult;
  }

  async version(): Promise<{ engine: string; metadata: string }> {
    const res = await this.#request({ op: 'version' });
    return res as unknown as { engine: string; metadata: string };
  }

  dispose(): void {
    this.#failAll(new Error('provider disposed'));
    this.#rl?.close();
    this.#rl = null;
    const proc = this.#proc;
    this.#proc = null;
    if (proc) {
      proc.stdin.end();
      proc.kill();
    }
    this.status = 'idle';
  }

  #onLine(line: string): void {
    const pending = this.#queue.shift();
    if (!pending) return;
    try {
      pending.resolve(JSON.parse(line) as Record<string, unknown>);
    } catch (err) {
      pending.reject(err as Error);
    }
  }

  #failAll(err: Error): void {
    const queue = this.#queue;
    this.#queue = [];
    for (const pending of queue) pending.reject(err);
  }

  #request(req: Record<string, unknown>): Promise<Record<string, unknown>> {
    const proc = this.#proc;
    if (!proc) return Promise.reject(new Error('provider not initialized'));
    return new Promise((resolveReq, rejectReq) => {
      this.#queue.push({ resolve: resolveReq, reject: rejectReq });
      proc.stdin.write(JSON.stringify(req) + '\n');
    });
  }
}

/**
 * Eagerly materialize include fragments for the stateless bridge. M0 codecs reference
 * no includes, so this returns an empty map; the `includeLoader` is retained on the
 * boundary for M1, where the set of referenced fragment names is known at codegen time.
 */
function collectIncludes(
  _includeLoader?: (name: string) => Json | undefined,
): Record<string, Json> {
  return {};
}

/** Create a Node->Python `transon` EngineProvider for tests (AD-011). */
export function createNodeEngineProvider(
  opts: NodeEngineProviderOptions = {},
): EngineProvider {
  return new NodeEngineProvider(opts);
}
