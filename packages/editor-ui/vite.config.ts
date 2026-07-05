/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

// Vite 6 library mode (AD-021). Emits ESM + .d.ts. React, Blockly, and the sibling @transon
// packages are EXTERNAL (the consumer — @transon/editor-element — bundles a single React +
// Blockly; AD-019/AD-020). Blockly in particular MUST be a single instance (its registries are
// singletons), so editor-ui never bundles its own copy.
//
// FR-133: @blockly/zoom-to-fit and @blockly/workspace-minimap are ALSO external, for the same
// reason as `blockly` itself, plus one more: both ship a UMD `require('blockly/core')`. Bundling
// that UMD factory would force Rollup to synthesize a CJS-interop wrapper for the external
// `blockly/core` import, and that synthesized wrapper silently drops members under some
// module-loader transforms (observed: Vitest/esbuild's namespace shape for `blockly/core` exposes
// no genuinely-"own-enumerable" keys, so a `Object.keys()`-based wrapper copies nothing). Keeping
// the plugins external sidesteps that class of bug entirely — every real consumer (editor-ui's
// own tests, editor-element's ESM + IIFE builds) resolves the bare specifier itself, same as
// `blockly`.
export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    sourcemap: true,
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'blockly',
        /^blockly\//,
        '@blockly/zoom-to-fit',
        '@blockly/workspace-minimap',
        '@transon/editor-core',
        '@transon/editor-blockly',
      ],
    },
  },
  // M4 introduces the jsdom DOM test env (AD-021) for React components + the interactive Blockly
  // mount. The framework-agnostic store tests also run here (jsdom is a DOM superset of node).
  test: {
    name: 'editor-ui',
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
  },
});
