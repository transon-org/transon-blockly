/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// Vitest project for the Node->Python adapter. These tests spawn a real Python
// subprocess and talk to the `transon` engine (AD-011), so they need a generous timeout.
export default defineConfig({
  test: {
    name: 'engine-node-adapter',
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
