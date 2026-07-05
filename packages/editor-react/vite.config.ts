/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

// Vite 6 library mode (AD-021, AD-019). The AD-019 delta from @transon/editor-element (which BUNDLES
// React into a self-contained IIFE): here React is a PEER — react/react-dom/jsx-runtime are EXTERNAL,
// so the host React app supplies its single React instance (a second React copy breaks hooks).
//
// The private internals (@transon/editor-ui, @transon/editor-blockly, @transon/editor-core) are NOT
// published, so they are BUNDLED IN — editor-react is the publishable React distribution of them.
// Blockly stays external (a real npm dependency) so a single Blockly instance is shared (its
// registries are singletons). Ships no engine (AD-008) — nothing here imports one.
//
// FR-133: @blockly/zoom-to-fit and @blockly/workspace-minimap stay external too, same reasoning as
// `blockly` (real npm deps, not editor internals) — see editor-ui/vite.config.ts for why bundling
// their UMD dist is best avoided.
export default defineConfig({
  plugins: [react(), dts({ include: ['src/**/*.ts', 'src/**/*.tsx'], rollupTypes: true })],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    sourcemap: true,
    rollupOptions: {
      // React is the PEER (external); Blockly (+ its two navigation plugins, FR-133) are external
      // runtime dependencies. Everything else (@transon/*) is bundled into this package.
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'blockly',
        /^blockly\//,
        '@blockly/zoom-to-fit',
        '@blockly/workspace-minimap',
      ],
    },
  },
  test: {
    name: 'editor-react',
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
  },
});
