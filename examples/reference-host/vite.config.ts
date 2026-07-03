import { defineConfig } from 'vite';

// Honor a harness-assigned port (e.g. Claude Code preview sets PORT); default to Vite's own.
export default defineConfig({
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : {},
});
