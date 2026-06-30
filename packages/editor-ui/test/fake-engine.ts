// A controllable fake EngineProvider for editor-ui's headless store/UI tests. It lets a test set
// the runtime `status`, script validate/transform results, and capture calls — WITHOUT spawning the
// real Python engine (that lives in the engine-node-adapter integration tests). It also supports
// scripting decode/blockMap *codec* runs: the codec calls `engine.transform(codecTemplate, input)`,
// so a fake keyed on the input lets store-wiring tests assert flow without codec semantics.

import type { EngineProvider, ExecutionResult, Json, ValidationResult } from '@transon/editor-core';

export interface FakeEngineOptions {
  status?: EngineProvider['status'];
  /** Result for validate(); defaults to a passing verdict. */
  onValidate?(template: Json, marker: string): ValidationResult;
  /** Result for transform(); defaults to echoing the input as output. */
  onTransform?(template: Json, input: Json, marker: string): ExecutionResult;
  engineVersion?: string;
  metadataVersion?: string;
}

export interface FakeEngine extends EngineProvider {
  status: EngineProvider['status'];
  calls: { validate: number; transform: number; init: number; dispose: number };
  /** Records of transform(template, input) for assertion. */
  transforms: Array<{ template: Json; input: Json; marker: string }>;
}

export function createFakeEngine(opts: FakeEngineOptions = {}): FakeEngine {
  const engine: FakeEngine = {
    status: opts.status ?? 'ready',
    calls: { validate: 0, transform: 0, init: 0, dispose: 0 },
    transforms: [],
    async init() {
      this.calls.init++;
      if (this.status === 'idle') this.status = 'ready';
    },
    async validate(template, o) {
      this.calls.validate++;
      return (
        opts.onValidate?.(template, o.marker) ?? { status: 'ok', valid: true }
      );
    },
    async transform(template, input, o) {
      this.calls.transform++;
      this.transforms.push({ template, input, marker: o.marker });
      if (opts.onTransform) return opts.onTransform(template, input, o.marker);
      // Default: a blockMap call wraps its input as { n: document } — return a minimal MapNode root
      // so the forward flow's blockMap() doesn't crash; any other call echoes its input as output.
      const isBlockMap =
        !!input && typeof input === 'object' && !Array.isArray(input) && 'n' in (input as object);
      return { status: 'ok', success: true, output: isBlockMap ? { children: [] } : input };
    },
    async version() {
      return { engine: opts.engineVersion ?? 'fake-0.0.0', metadata: opts.metadataVersion ?? '2.0' };
    },
    dispose() {
      this.calls.dispose++;
    },
  };
  return engine;
}
