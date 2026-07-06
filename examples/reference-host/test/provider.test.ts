// D3.6 — the Pyodide reference EngineProvider (AD-025). Port-conformance without loading real
// Pyodide: a fake Pyodide proves the status lifecycle (idle→loading→ready|failed, NFR-028/AC-023),
// the JSON-string boundary (§5.9), validate/transform/version proxying, the files_written→filesWritten
// mapping (§16.5), and the dynamic includeLoader callback (§16.6). The real Pyodide load is
// browser-only (verified manually / M5 Playwright); this asserts the provider's contract.
import { describe, it, expect, vi } from 'vitest';
import { createPyodideHost, type PyodideLike } from '../src/provider.js';

interface FakePy extends PyodideLike {
  loadCalls: number;
}

function fakePyodide(): FakePy {
  const fns: Record<string, (...a: unknown[]) => unknown> = {
    transon_validate(templateStr, marker) {
      expect(typeof templateStr).toBe('string'); // JSON-string boundary (§5.9)
      expect(typeof marker).toBe('string');
      const t = JSON.parse(templateStr as string) as { $?: string };
      return t.$ === 'bad'
        ? JSON.stringify({ status: 'ok', valid: false, error_type: 'DefinitionError', error_message: 'nope' })
        : JSON.stringify({ status: 'ok', valid: true });
    },
    transon_transform(templateStr, inputStr, marker, includesStr, jsLoader, maxIncludeDepth) {
      // Real Pyodide delivers a JS `null` argument as JsNull (NOT Python None), so the glue's
      // `int(max_include_depth)` throws. The provider must OMIT the argument instead — mirror
      // that strictness here so any null crossing the boundary fails this suite.
      if (maxIncludeDepth === null) {
        throw new TypeError("int() argument must be a real number, not 'JsNull'");
      }
      expect(typeof inputStr).toBe('string');
      const input = JSON.parse(inputStr as string) as unknown;
      // exercise the dynamic include callback if present; the glue passes a JS callback that returns
      // a JSON string (or null), which Python json.loads — mirror that here.
      let resolved: unknown = null;
      if (typeof jsLoader === 'function') {
        const s = (jsLoader as (n: string) => string | null)('Frag');
        resolved = s == null ? null : (JSON.parse(s) as unknown);
      }
      return JSON.stringify({
        status: 'ok',
        success: true,
        // echo maxIncludeDepth so tests can assert the §6.5 ceiling crosses the boundary (AD-035)
        output: { input, resolved, maxIncludeDepth: maxIncludeDepth ?? null },
        files_written: { 'f.txt': 'x' },
      });
    },
    transon_version() {
      return JSON.stringify({ engine: '0.1.6', metadata: '3.0' });
    },
  };
  return {
    loadCalls: 0,
    async loadPackage() {
      this.loadCalls++;
    },
    async runPythonAsync() {
      /* install + glue definition: no-op in the fake */
    },
    globals: { get: (name: string) => fns[name] },
  };
}

describe('Pyodide reference host (AD-025, §5.9)', () => {
  it('transitions idle → ready across init() (NFR-028, AC-023)', async () => {
    const host = createPyodideHost({ loadPyodide: async () => fakePyodide() });
    expect(host.status).toBe('idle');
    await host.init();
    expect(host.status).toBe('ready');
  });

  it('init() failure surfaces status `failed` (§17.9)', async () => {
    const host = createPyodideHost({
      loadPyodide: async () => {
        throw new Error('pyodide load failed');
      },
    });
    await expect(host.init()).rejects.toThrow(/pyodide/);
    expect(host.status).toBe('failed');
  });

  it('validate proxies the verdict across the JSON boundary', async () => {
    const host = createPyodideHost({ loadPyodide: async () => fakePyodide() });
    await host.init();
    expect(await host.validate({ $: 'attr', name: 'x' }, { marker: '$' })).toMatchObject({
      status: 'ok',
      valid: true,
    });
    expect(await host.validate({ $: 'bad' }, { marker: '$' })).toMatchObject({
      valid: false,
      error_type: 'DefinitionError',
    });
  });

  it('transform proxies output, maps files_written→filesWritten, and calls the include loader', async () => {
    const host = createPyodideHost({ loadPyodide: async () => fakePyodide() });
    await host.init();
    const includeLoader = vi.fn((name: string) => ({ resolvedFor: name }));
    const res = await host.transform({ $: 'this' }, { a: 1 }, { marker: '$', includeLoader });
    expect(res.success).toBe(true);
    expect(res.filesWritten).toEqual({ 'f.txt': 'x' }); // snake→camel mapping (§16.5)
    // the dynamic include callback was invoked across the boundary (§16.6)
    expect(includeLoader).toHaveBeenCalledWith('Frag');
    expect(res.output).toMatchObject({ input: { a: 1 }, resolved: { resolvedFor: 'Frag' } });
  });

  it('transform forwards the codec include ceiling across the boundary (§6.5, AD-035/RFC-004)', async () => {
    // Was silently dropped pre-RFC-004, leaving the browser host on the engine default (50) —
    // found by the in-browser AC-042 verification (G_encode rejected at "depth limit (50)").
    const host = createPyodideHost({ loadPyodide: async () => fakePyodide() });
    await host.init();
    const withCap = await host.transform({ $: 'this' }, 1, { marker: '$', maxIncludeDepth: 55 });
    expect(withCap.output).toMatchObject({ maxIncludeDepth: 55 });
    const withoutCap = await host.transform({ $: 'this' }, 1, { marker: '$' });
    expect(withoutCap.output).toMatchObject({ maxIncludeDepth: null });
  });

  it('version proxies engine + metadata', async () => {
    const host = createPyodideHost({ loadPyodide: async () => fakePyodide() });
    await host.init();
    expect(await host.version()).toEqual({ engine: '0.1.6', metadata: '3.0' });
  });
});
