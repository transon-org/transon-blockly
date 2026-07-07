import { defineConfig } from 'vitest/config';

// Shared Vitest settings for the workspace (coverage merges across projects).
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'text-summary', 'lcov', 'html'],
      include: [
        'packages/**/src/**/*.{ts,tsx}',
        'test/engine-node-adapter/src/**/*.ts',
      ],
      exclude: [
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/test/**',
        '**/dist/**',
        'packages/editor-element/src/iife.ts',
      ],
    },
  },
});
