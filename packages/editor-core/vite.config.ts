/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Vite 6 library mode (AD-021). Emits ESM + .d.ts. The metadata snapshot JSON imported
// by src/metadata/snapshot.ts is inlined into the bundle by Vite's resolveJsonModule.
export default defineConfig({
  plugins: [
    dts({
      // Only ship declarations for the package's own source, not the imported JSON.
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
    // Editor-core is engine-free and dependency-light (AD-008); nothing external to mark.
    rollupOptions: {},
  },
  test: {
    name: 'editor-core',
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
