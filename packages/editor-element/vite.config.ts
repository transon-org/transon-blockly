/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Vite 6 library mode (AD-021). D0 ships the ESM entry only (externalizing React/Blockly/siblings,
// tree-shakeable, AD-020). D6 adds the self-contained IIFE entry that bundles React + the UI and
// auto-registers <transon-editor> for <script> usage — and a no-engine-in-bundle assertion (AD-008).
export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*.ts'],
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
        '@transon/editor-core',
        '@transon/editor-blockly',
        '@transon/editor-ui',
      ],
    },
  },
  test: {
    name: 'editor-element',
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
});
