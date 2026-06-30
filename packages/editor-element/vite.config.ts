/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Vite 6 library mode (AD-021, AD-020). Two outputs from one config, switched by BUILD_TARGET:
//  - ESM (default): the primary, tree-shakeable entry. React/Blockly/siblings are EXTERNAL.
//  - IIFE (BUILD_TARGET=iife): a self-contained global that auto-registers <transon-editor>, with
//    React + the internal UI + Blockly BUNDLED IN. Ships NO engine (AD-008) — nothing here imports
//    one, so none is bundled (asserted by test/no-engine.test.ts).
// The package `build` script runs both: `vite build && BUILD_TARGET=iife vite build`.
const iife = process.env.BUILD_TARGET === 'iife';

export default defineConfig(
  iife
    ? {
        build: {
          emptyOutDir: false, // keep the ESM output produced by the first pass
          lib: {
            entry: resolve(__dirname, 'src/iife.ts'),
            name: 'TransonEditor',
            formats: ['iife'],
            fileName: () => 'iife.js',
          },
          sourcemap: true,
          // no externals — bundle React + @transon/editor-ui + Blockly into the self-contained global
        },
      }
    : {
        plugins: [dts({ include: ['src/**/*.ts'], rollupTypes: true })],
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
              '@transon/editor-core',
              '@transon/editor-blockly',
              '@transon/editor-ui',
            ],
          },
        },
        test: {
          name: 'editor-element',
          environment: 'jsdom',
          setupFiles: ['./test/setup.ts'],
          include: ['test/**/*.test.ts'],
        },
      },
);
