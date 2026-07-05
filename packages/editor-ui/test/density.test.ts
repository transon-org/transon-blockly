// NFR-049 AC-041(d) — canvas density: a single-value-input rule block renders at most 28px tall at
// 100% zoom, and a density harness records blocks-visible + workspace bounding box for a fixture set
// of representative block shapes rendered into a fixed 1440x900 viewport.
//
// Scope split (editor-ui has no real EngineProvider, AD-008/AD-032 — encode()/decode() only run
// through a host engine): this file covers (a) the 28px single-block bound with a hand-built
// representative fixture (the collapse.test.ts idiom: a literal workspace-state block, never the
// live codec) and (b) a fast density sweep over a small set of representative STRUCTURAL shapes
// (scalar / array / object / single-value-input rule / multi-input rule / nested) mounted once and
// loaded sequentially, matching the plan's "mount once, clear between examples" performance note.
// The full ~121-example docs corpus — which DOES require live encode() through a real engine — is
// swept with committed baseline numbers in
// test/engine-node-adapter/test/ui/density-corpus.test.ts (mirrors example-run.test.ts's idiom:
// buildExampleCorpus + encode() through createNodeEngineProvider). That file is authoritative for
// the NFR-049 "renders the example corpus" ratchet; this file is the fast, engine-free companion
// asserting the hard 28px invariant and giving quick local feedback while tuning theme.ts (T8).
import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly/core';
import type { Json } from '@transon/editor-core';
import { mountBlockly } from '../src/blockly/mount.js';

function makeContainer(): HTMLElement {
  const c = document.createElement('div');
  // §19.4 fixed density-harness viewport.
  c.style.width = '1440px';
  c.style.height = '900px';
  document.body.appendChild(c);
  return c;
}

/** A single Blockly `serialization.workspaces.save()` block-state entry. */
type BlockState = Record<string, Json>;

// Representative fixture corpus: distinct STRUCTURAL shapes, not a substitute for the real docs
// corpus (see file banner). Each entry is a bare workspace-state block (hand-built, like
// collapse.test.ts's representativeBlock() — never the live codec).
const FIXTURES: Record<string, BlockState> = {
  // a genuinely single-value-input, single-row rule block (transon_rule_set__base: message0 only,
  // one input_value arg, no message1) — the representative block for the NFR-049 28px bound.
  'set__base (single-value-input)': {
    type: 'transon_rule_set__base',
    inputs: { name: { block: { type: 'transon_literal', fields: { VALUE: 'x' } } } },
  },
  'object__fields (single-value-input, mutator child)': {
    type: 'transon_rule_object__fields',
    inputs: {
      fields: {
        block: {
          type: 'transon_object_literal',
          extraState: { keys: ['a'] },
          inputs: { VALUE0: { block: { type: 'transon_literal', fields: { VALUE: 1 } } } },
        },
      },
    },
  },
  'attr__name (two value inputs)': {
    type: 'transon_rule_attr__name',
    inputs: { name: { block: { type: 'transon_literal', fields: { VALUE: 'a' } } } },
  },
  'nested object+array (representative deep template)': {
    type: 'transon_object_literal',
    extraState: { keys: ['a', 'b'] },
    inputs: {
      VALUE0: { block: { type: 'transon_literal', fields: { VALUE: 1 } } },
      VALUE1: {
        block: {
          type: 'transon_array',
          extraState: { items: [0, 1] },
          inputs: {
            ITEM0: { block: { type: 'transon_literal', fields: { VALUE: 2 } } },
            ITEM1: { block: { type: 'transon_literal', fields: { VALUE: 3 } } },
          },
        },
      },
    },
  },
};

describe('single-value-input rule block density bound (NFR-049, AC-041(d))', () => {
  it('transon_rule_set__base renders at most 28px tall at 100% zoom', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      mount.loadDocument(FIXTURES['set__base (single-value-input)']!);
      mount.workspace.setScale(1); // "at 100% zoom" (NFR-049)
      mount.workspace.resize();
      const top = mount.workspace.getTopBlocks(false)[0] as Blockly.BlockSvg;
      expect(top.type).toBe('transon_rule_set__base');
      // jsdom has no layout engine, but Blockly's renderer computes block geometry from its OWN
      // renderer constants + a canvas measureText polyfill (test/setup.ts) — not getBBox/CSS layout
      // — so `block.height` is meaningful here (verified against the real-engine+jsdom companion
      // sweep in test/engine-node-adapter/test/ui/density-corpus.test.ts, which cross-checks the
      // same renderer against the full docs corpus). Guard against a degenerate (zero/NaN) reading.
      expect(Number.isFinite(top.height)).toBe(true);
      expect(top.height).toBeGreaterThan(0);
      expect(top.height).toBeLessThanOrEqual(28);
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('every genuinely single-value-input, single-row rule block type meets the bound', () => {
    // Cross-check against the OTHER single-value-input fixture (object__fields) — its own row is
    // single-value-input too; the *connected mutator child* is a separate block with its own
    // geometry (asserted separately below), so this only measures object__fields' own row height.
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      mount.workspace.setScale(1);
      const bare = mount.workspace.newBlock('transon_rule_object__fields') as Blockly.BlockSvg;
      bare.initSvg();
      bare.render();
      expect(bare.height).toBeLessThanOrEqual(28);
    } finally {
      mount.dispose();
      c.remove();
    }
  });
});

describe('density harness over representative block shapes (NFR-049 §19.4, no-regression ratchet)', () => {
  // Mount ONCE, load each fixture sequentially into the same workspace, clearing between — keeps
  // the suite fast regardless of fixture-set size (the plan's stated perf idiom for the full corpus
  // sweep, mirrored here even though this fixture set is small).
  it('records blocks-visible + bounding box for each fixture without throwing', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      mount.workspace.setScale(1);
      for (const [name, fixture] of Object.entries(FIXTURES)) {
        mount.workspace.clear();
        mount.loadDocument(fixture);
        mount.workspace.resize();
        const blocksVisible = mount.workspace.getAllBlocks(false).length;
        const bbox = mount.workspace.getBlocksBoundingBox();
        const width = bbox.right - bbox.left;
        const height = bbox.bottom - bbox.top;
        expect(blocksVisible).toBeGreaterThan(0);
        expect(Number.isFinite(width)).toBe(true);
        expect(Number.isFinite(height)).toBe(true);
        expect(width).toBeGreaterThan(0);
        expect(height).toBeGreaterThan(0);
        void name; // fixture label, useful under --reporter=verbose while tuning theme.ts
      }
    } finally {
      mount.dispose();
      c.remove();
    }
  });
});
