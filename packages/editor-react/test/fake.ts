// A minimal ready EngineProvider for editor-react's jsdom tests (no real engine). Its transform
// returns a minimal block-map node for blockMap calls so the forward projection doesn't crash.
import type { EngineProvider, Json } from '@transon/editor-core';

export function fakeEngine(): EngineProvider {
  return {
    status: 'ready',
    async init() {},
    async validate() {
      return { status: 'ok', valid: true };
    },
    async transform(_t, input) {
      const isBlockMap =
        !!input && typeof input === 'object' && !Array.isArray(input) && 'n' in (input as object);
      return { status: 'ok', success: true, output: (isBlockMap ? { children: [] } : input) as Json };
    },
    async version() {
      return { engine: 'fake', metadata: '3.0' };
    },
    dispose() {},
  };
}
