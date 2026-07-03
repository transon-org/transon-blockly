import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// D6 — the public surface ships NO engine (AD-008, AD-020). The package declares no engine
// dependency, no source imports one, and the self-contained IIFE bundle contains none.
const PKG_DIR = resolve(__dirname, '..');
const ENGINE_MARKERS = /pyodide|reference-host|engine-node-adapter|createPyodideHost|createNodeEngineProvider|micropip|loadPyodide/i;

describe('no engine bundled (AD-008, AD-020, AC-022)', () => {
  it('declares no engine dependency', () => {
    const pkg = JSON.parse(readFileSync(resolve(PKG_DIR, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    for (const name of Object.keys(pkg.dependencies ?? {})) {
      expect(name, `${name} must not be an engine`).not.toMatch(ENGINE_MARKERS);
    }
  });

  it('no source module imports an engine', () => {
    for (const f of ['index.ts', 'create.ts', 'element.ts', 'iife.ts']) {
      const src = readFileSync(resolve(PKG_DIR, 'src', f), 'utf8');
      expect(src, `${f} must not import an engine`).not.toMatch(ENGINE_MARKERS);
    }
  });

  it('the built IIFE bundle contains no engine (AD-020)', () => {
    const iife = resolve(PKG_DIR, 'dist', 'iife.js');
    if (!existsSync(iife)) {
      // Fail loud rather than silently skipping: this is the assertion that actually proves the
      // shipped bundle contains no engine code (AD-008/AD-020).
      throw new Error('dist/iife.js not found — run `build` before `test` to verify no engine is bundled');
    }
    const bundle = readFileSync(iife, 'utf8');
    expect(bundle).not.toMatch(ENGINE_MARKERS);
  });
});
