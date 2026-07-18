// @vitest-environment jsdom
//
// NFR-049 / AC-041(d) / §19.4 — the density harness, run against the REAL engine (encode() runs the
// committed encoder artifact through a host EngineProvider, AD-008/AD-032 — editor-ui has no engine
// of its own, so this corpus-wide sweep lives here, mirroring test/ui/example-run.test.ts's exact
// idiom: buildExampleCorpus() + encode() through createNodeEngineProvider()). This file overrides
// the package's default `node` Vitest environment to `jsdom` per-file (the project vite.config.ts
// stays `node` for every other test — jsdom is only pulled in here, where a rendered workspace is
// actually mounted) using the same DOM/canvas polyfills as packages/editor-ui/test/setup.ts (Blockly
// computes block geometry from its own renderer constants + a canvas measureText polyfill under
// jsdom, NOT from getBBox/CSS layout — verified against packages/editor-ui/test/density.test.ts,
// the fast engine-free companion covering the same 28px bound with hand-built fixtures).
//
// For every corpus example (the full flat docs.examples corpus, §2.7, ~121 entries at the pinned
// engine): mount once (perf — a full Blockly.inject per example is too slow for ~121 examples),
// load the example's template (encode -> workspace block), record blocks-visible
// (getAllBlocks(false).length) and the workspace bounding box (getBlocksBoundingBox()) at 100% zoom
// in a fixed 1440x900 viewport, then clear before the next example.
//
// The recorded numbers are compared against the COMMITTED baseline (density-baseline.json, kept in
// packages/editor-ui/test — the package the plan names for the harness) and must not regress
// (bounding box grows / blocks-visible shrinks) beyond a small per-example tolerance. Regenerate the
// baseline with `UPDATE_DENSITY=1` (never on a normal run — mirrors the UPDATE_ARTIFACTS idiom in
// test/codec/regen.test.ts, AD-030). This file ALSO asserts the NFR-049 28px single-value-input
// bound as a hard invariant (not just a ratchet), against a representative corpus example.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json } from '@transon/editor-core';
import { encode } from '@transon/editor-core';
import { mountBlockly, buildExampleCorpus, type TransonMount } from '@transon/editor-ui';
import { createNodeEngineProvider } from '../../src/index.js';
import { NO_PALETTE } from './corpus-mount.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = join(
  HERE,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'editor-ui',
  'test',
  'density-baseline.json',
);

// ---- jsdom polyfills (identical idiom to packages/editor-ui/test/setup.ts) ----
function polyfill(proto: object | undefined, name: string, impl: () => unknown): void {
  if (proto && typeof (proto as Record<string, unknown>)[name] !== 'function') {
    Object.defineProperty(proto, name, { value: impl, configurable: true, writable: true });
  }
}
const svgProto = typeof SVGElement !== 'undefined' ? SVGElement.prototype : undefined;
polyfill(svgProto, 'getBBox', () => ({ x: 0, y: 0, width: 0, height: 0 }));
polyfill(svgProto, 'getComputedTextLength', () => 0);
polyfill(svgProto, 'getScreenCTM', () => null);
const elemProto = typeof Element !== 'undefined' ? Element.prototype : undefined;
polyfill(elemProto, 'getBoundingClientRect', () => ({
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: 0,
  height: 0,
  toJSON: () => ({}),
}));
if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: () => ({
      measureText: (text: string) => ({ width: String(text).length * 8 }),
      fillText: () => {},
      font: '',
      save: () => {},
      restore: () => {},
      scale: () => {},
      clearRect: () => {},
      fillRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
    }),
  });
}
if (typeof globalThis.matchMedia !== 'function') {
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }),
  });
}

/** One recorded density measurement for a single corpus example (§19.4). */
interface DensityRecord {
  /** Number of blocks in the loaded workspace (getAllBlocks(false).length). */
  blocksVisible: number;
  /** Workspace bounding box (getBlocksBoundingBox()) at 100% zoom, px. */
  width: number;
  height: number;
}

type DensityBaseline = Record<string, DensityRecord>;

/** Tolerance for the no-regression ratchet: a rounding/font-metrics wobble under a few px must not
 *  trip the gate, but a real regression (bigger boxes / fewer visible blocks) must. */
const TOLERANCE_PX = 2;

function measure(mount: TransonMount, block: Json): DensityRecord {
  mount.workspace.clear();
  mount.loadDocument(block);
  mount.workspace.setScale(1); // "at 100% zoom" (NFR-049)
  mount.workspace.resize();
  const blocksVisible = mount.workspace.getAllBlocks(false).length;
  const bbox = mount.workspace.getBlocksBoundingBox();
  return {
    blocksVisible,
    width: bbox.right - bbox.left,
    height: bbox.bottom - bbox.top,
  };
}

function makeContainer(): HTMLElement {
  const c = document.createElement('div');
  // §19.4 fixed density-harness viewport.
  c.style.width = '1440px';
  c.style.height = '900px';
  document.body.appendChild(c);
  return c;
}

let engine: EngineProvider;
const corpus = buildExampleCorpus();

beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

describe('NFR-049 density harness over the docs example corpus (§19.4, AC-041(d))', () => {
  it('the corpus is non-empty (anti-truncation floor shared with examples-corpus.test.ts)', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(121);
  });

  it('a representative single-value-input rule block (set) renders at most 28px tall at 100% zoom', async () => {
    const c = makeContainer();
    const mount = mountBlockly(c, NO_PALETTE);
    try {
      const block = (await encode(engine, { $: 'set', name: 'x' })) as Json;
      const rec = measure(mount, block);
      expect(rec.height).toBeGreaterThan(0);
      expect(rec.height).toBeLessThanOrEqual(28);
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it(
    'records blocks-visible + bounding box per example and compares to the committed baseline (no regression)',
    async () => {
      const c = makeContainer();
      const mount = mountBlockly(c, NO_PALETTE);
      const recorded: DensityBaseline = {};
      try {
        for (const example of corpus) {
          const block = (await encode(engine, example.template)) as Json;
          recorded[example.name] = measure(mount, block);
        }
      } finally {
        mount.dispose();
        c.remove();
      }

      if (process.env.UPDATE_DENSITY) {
        writeFileSync(BASELINE_PATH, JSON.stringify(recorded, null, 2) + '\n');
        return; // regen only — a normal run never rubber-stamps (AD-030 idiom)
      }

      const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as DensityBaseline;
      expect(Object.keys(recorded).sort()).toEqual(Object.keys(baseline).sort());

      const regressions: string[] = [];
      for (const [name, rec] of Object.entries(recorded)) {
        const base = baseline[name];
        if (!base) continue;
        if (rec.blocksVisible < base.blocksVisible) {
          regressions.push(`${name}: blocksVisible ${rec.blocksVisible} < baseline ${base.blocksVisible}`);
        }
        if (rec.width > base.width + TOLERANCE_PX) {
          regressions.push(`${name}: width ${rec.width} > baseline ${base.width} (+${TOLERANCE_PX} tolerance)`);
        }
        if (rec.height > base.height + TOLERANCE_PX) {
          regressions.push(`${name}: height ${rec.height} > baseline ${base.height} (+${TOLERANCE_PX} tolerance)`);
        }
      }
      expect(regressions, regressions.join('\n')).toEqual([]);
    },
    // CI runners took ~55s pre-§12.6 at 121 corpus examples; the RFC-008 re-pin grew the corpus
    // to 163 and CI now measures 98–120s (main 98.6s / PR#17 112.3s / PR#18 120.3s — the last hit
    // the old 120s ceiling exactly, on runner variance alone). 240s is headroom over that
    // measured band, not license to slow down: the empty-palette mount above keeps the per-run
    // cost, and local runs stay ~13s.
    240_000,
  );
});
