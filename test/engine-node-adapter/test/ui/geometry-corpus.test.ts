// @vitest-environment jsdom
//
// NFR-050 (§8.5) — the geometry-invariant harness, run over the FULL docs example corpus with the
// REAL engine (same idiom as density-corpus.test.ts: buildExampleCorpus() + encode() through
// createNodeEngineProvider(), per-file jsdom override, one mount reused across examples). The fast
// engine-free fixture harness lives in packages/editor-ui/test/geometry.test.ts and carries the
// white-box RenderInfo assertions (label↔child centering, constant quantization/preconditions);
// THIS sweep asserts the public-geometry invariants on every block of every corpus example so any
// future renderer-constant change that breaks geometry fails CI corpus-wide, not just on the
// hand-built fixtures:
//   (a) zero-gap stacking — consecutive connected value-input children of one parent are FLUSH
//       (next.top == prev.bottom) and share the same left edge;
//       no child protrudes above its parent's top or below its parent's bottom edge;
//   (c) grid quantization — every rendered block height is a GRID_UNIT multiple, with NO
//       exemptions: the +/- mutator-control row's Blockly.FieldImage is sized GLYPH_SIZE=15 in
//       editor-blockly's runtime.ts so its height (icon + Blockly's private 1px Y_PADDING in
//       field_image.ts) lands on the grid — transon_array / transon_object_literal /
//       transon_unsupported quantize like every other block type (see geometry.test.ts).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as Blockly from 'blockly/core';
import type { EngineProvider, Json } from '@transon/editor-core';
import { encode } from '@transon/editor-core';
import { mountBlockly, buildExampleCorpus, type TransonMount } from '@transon/editor-ui';
import { GRID_UNIT } from '@transon/editor-ui';
import { createNodeEngineProvider } from '../../src/index.js';

// ---- jsdom polyfills (identical idiom to density-corpus.test.ts / editor-ui test/setup.ts) ----
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

/** No exemptions: the +/- mutator-control FieldImage is sized GLYPH_SIZE=15 in editor-blockly's
 *  runtime.ts precisely so its field row (15 + Blockly's private 1px Y_PADDING = 16) lands on the
 *  grid — array/object/unsupported blocks quantize like every other block. */
const QUANTIZATION_EXEMPT = new Set<string>();

function makeContainer(): HTMLElement {
  const c = document.createElement('div');
  c.style.width = '1440px';
  c.style.height = '900px';
  document.body.appendChild(c);
  return c;
}

/** Check every NFR-050 public-geometry invariant on one loaded workspace; return violations. */
function checkWorkspace(mount: TransonMount, exampleName: string): string[] {
  const violations: string[] = [];
  for (const block of mount.workspace.getAllBlocks(false) as Blockly.BlockSvg[]) {
    const parentXY = block.getRelativeToSurfaceXY();
    const parentTop = parentXY.y;
    const parentBottom = parentXY.y + block.height;

    // (c) grid quantization of rendered block heights (rule/literal blocks).
    if (!QUANTIZATION_EXEMPT.has(block.type) && block.height % GRID_UNIT !== 0) {
      violations.push(`${exampleName}: ${block.type} height ${block.height} % ${GRID_UNIT} != 0`);
    }

    // Walk value inputs in order. The zero-gap/left-edge invariant applies to DIRECTLY consecutive
    // connected children: an unconnected value input between two connected ones renders its own
    // empty-socket row, which legitimately separates them (e.g. join items/sep/default with the
    // middle socket empty) — reset the run there instead of flagging a false seam.
    let prevBottom: number | null = null;
    let leftX: number | null = null;
    for (const input of block.inputList) {
      if (!input.connection) continue; // dummy rows (title/mutator controls) precede all sockets
      const child = (input.connection.targetBlock() as Blockly.BlockSvg | null) ?? null;
      if (!child) {
        prevBottom = null; // empty socket row breaks the stacked run
        leftX = null;
        continue;
      }
      const xy = child.getRelativeToSurfaceXY();
      // (b)-adjacent protrusion clause: a child stays inside its parent's vertical envelope.
      if (xy.y < parentTop) {
        violations.push(`${exampleName}: ${child.type} top ${xy.y} above parent ${block.type} top ${parentTop}`);
      }
      if (xy.y + child.height > parentBottom) {
        violations.push(
          `${exampleName}: ${child.type} bottom ${xy.y + child.height} below parent ${block.type} bottom ${parentBottom}`,
        );
      }
      // (a) zero-gap + shared left edge across consecutive stacked siblings.
      if (prevBottom !== null && xy.y !== prevBottom) {
        violations.push(
          `${exampleName}: ${block.type} stacked children gap — child top ${xy.y} != previous bottom ${prevBottom}`,
        );
      }
      if (leftX !== null && xy.x !== leftX) {
        violations.push(`${exampleName}: ${block.type} stacked children left edges differ (${xy.x} != ${leftX})`);
      }
      prevBottom = xy.y + child.height;
      leftX = xy.x;
    }
  }
  return violations;
}

let engine: EngineProvider;
const corpus = buildExampleCorpus();

beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

describe('NFR-050 geometry invariants over the docs example corpus (§19.4)', () => {
  it('the corpus is non-empty (anti-truncation floor shared with examples-corpus.test.ts)', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(121);
  });

  it(
    'zero-gap stacking, shared left edge, no protrusion, and grid-quantized heights hold for every corpus example',
    async () => {
      const c = makeContainer();
      const mount = mountBlockly(c);
      const violations: string[] = [];
      try {
        for (const example of corpus) {
          const block = (await encode(engine, example.template)) as Json;
          mount.workspace.clear();
          mount.loadDocument(block);
          mount.workspace.setScale(1);
          violations.push(...checkWorkspace(mount, example.name));
        }
      } finally {
        mount.dispose();
        c.remove();
      }
      expect(violations, violations.join('\n')).toEqual([]);
    },
    60_000,
  );
});
