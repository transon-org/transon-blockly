// Aggregates each package's vitest project so `pnpm test` / `vitest` at the root
// runs the whole workspace (AD-021 monorepo tooling).
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/editor-core',
  'packages/editor-blockly',
  'packages/editor-ui',
  'packages/editor-element',
  'packages/editor-react',
  'test/engine-node-adapter',
]);
