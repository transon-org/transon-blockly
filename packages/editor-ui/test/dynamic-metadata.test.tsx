// FR-139 — opt-in runtime metadata source: an opted-in session fetches the engine metadata once on
//          the ready transition and swaps its projection surface (palette/toolbox/codec) to the
//          generated one; the default session never fetches.
// FR-140 — fail-safe fallback: any runtime-path failure leaves the session on the snapshot surface,
//          fully functional, with a PERSISTENT `metadata_fallback` diagnostic (§16.4) that later
//          projections do not wipe.
// AC-043(c) — the controller-level fallback half; the engine-executed halves (a/b/d) live in
//          test/engine-node-adapter/test/codec/dynamic-surface.test.ts.
//
// `fetchRuntimeSurface` runs the real generators through a real engine, so it is mocked here (the
// editor-ui suite is engine-free); its own gate logic is covered engine-free in
// packages/editor-core/test/dynamic.test.ts and against the real engine in the Node adapter suite.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Blockly from 'blockly/core';
import { MetadataFallbackError } from '@transon/editor-core';
import type { RuntimeSurface } from '@transon/editor-core';
import { createEditorController } from '../src/session/controller.js';
import { createFakeEngine } from './fake-engine.js';

vi.mock('@transon/editor-core', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@transon/editor-core')>();
  return { ...orig, fetchRuntimeSurface: vi.fn() };
});
const { fetchRuntimeSurface } = await import('@transon/editor-core');
const mockFetch = vi.mocked(fetchRuntimeSurface);

function container(): HTMLElement {
  const c = document.createElement('div');
  c.style.width = '800px';
  c.style.height = '600px';
  document.body.appendChild(c);
  return c;
}

/** A minimal generated surface: one synthetic rule block on top of an empty flyout toolbox, plus
 *  inert one-fragment codec artifacts (the fake engine echoes inputs, so they never really run). */
function syntheticSurface(): RuntimeSurface {
  return {
    metadata: {
      metadata_version: '3.0',
      engine_version: '9.9.9',
      catalog: { rules: [{ name: 'synthrule' }], operators: [], functions: [] },
      docs: { examples: [], rules: [], operators: [], functions: [], worked_examples: [], recipes: [] },
    },
    paletteBlocks: [
      {
        type: 'transon_rule_synthrule__base',
        message0: 'Synth %1',
        args0: [{ type: 'input_value', name: 'value' }],
        output: null,
        colour: 300,
      },
    ],
    toolbox: {
      kind: 'categoryToolbox',
      contents: [
        {
          kind: 'category',
          name: 'Custom',
          contents: [{ kind: 'block', type: 'transon_rule_synthrule__base' }],
        },
      ],
    },
    artifacts: {
      encoder: { entry: 'enc', fragments: { enc: null } },
      decoder: { entry: 'dec', fragments: { dec: null } },
      blockmap: { entry: 'mapenc', fragments: { mapenc: null } },
    },
  } as unknown as RuntimeSurface;
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('FR-139 — opt-in runtime metadata source', () => {
  it('an opted-in session fetches once on ready and swaps to the engine surface', async () => {
    mockFetch.mockResolvedValue(syntheticSurface());
    const engine = createFakeEngine();
    const c = container();
    const ctl = createEditorController(c, { host: { engine }, metadataSource: 'engine', debounceMs: 0 });
    try {
      await vi.waitFor(() => expect(ctl.store.getState().metadata_source).toBe('engine'));
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(ctl.store.getState().metadata_fallback).toBeNull();
      // The generated palette is registered into Blockly (FR-139: the fetched rule projects).
      expect(Blockly.Blocks['transon_rule_synthrule__base']).toBeDefined();
    } finally {
      ctl.dispose();
      c.remove();
    }
  });

  it('a default (snapshot) session never calls the runtime metadata path', async () => {
    const engine = createFakeEngine();
    const c = container();
    const ctl = createEditorController(c, { host: { engine }, debounceMs: 0 });
    try {
      await vi.waitFor(() => expect(ctl.store.getState().engine_runtime_status).toBe('ready'));
      expect(mockFetch).not.toHaveBeenCalled();
      expect(ctl.store.getState().metadata_source).toBe('snapshot');
    } finally {
      ctl.dispose();
      c.remove();
    }
  });
});

describe('FR-140 — fail-safe fallback to the snapshot surface (AC-043(c))', () => {
  it('a failing fetch leaves a functional snapshot session with a persistent metadata_fallback diagnostic', async () => {
    mockFetch.mockRejectedValue(
      new MetadataFallbackError('incompatible_version', 'engine metadata_version "4.0" is not compatible'),
    );
    const engine = createFakeEngine();
    const c = container();
    const onChange = vi.fn();
    const ctl = createEditorController(c, {
      host: { engine },
      metadataSource: 'engine',
      onChange,
      debounceMs: 0,
    });
    try {
      await vi.waitFor(() => {
        const s = ctl.store.getState();
        expect(s.metadata_fallback).not.toBeNull();
      });
      const s = ctl.store.getState();
      expect(s.metadata_source).toBe('snapshot');
      expect(s.metadata_fallback!.code).toBe('metadata_fallback');
      expect(s.metadata_fallback!.message).toMatch(/not compatible/);
      // The session stays functional on the snapshot surface (NFR-039): the forward projection
      // still runs and does NOT wipe the persistent diagnostic.
      await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
      expect(ctl.store.getState().metadata_fallback).not.toBeNull();
    } finally {
      ctl.dispose();
      c.remove();
    }
  });
});
