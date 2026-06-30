/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Vite 6 library mode (AD-021). Emits ESM + .d.ts. Blockly and @transon/editor-core are
// external (provided by the consumer / sibling package, not bundled — AD-019/AD-020); the
// behavior runtime here is the only first-party code.
export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*.ts', 'src/**/*.json'],
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
      external: ['blockly', /^blockly\//, '@transon/editor-core'],
    },
  },
  // FR-125/FR-126 headless gates run in pure Node: Blockly 13 registers block definitions and
  // loads workspace-serialization JSON without a DOM, so no jsdom/happy-dom (those are M4).
  test: {
    name: 'editor-blockly',
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
