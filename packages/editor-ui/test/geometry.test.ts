// NFR-050 — rendered block geometry invariants (a) zero-gap stacking + shared left edge, (b)
// label/field ↔ value-input-connection vertical alignment, (c) grid-quantized vertical constants.
// Added alongside the NFR-049 density harness (density.test.ts) after real geometry defects were
// found on canvas at ~100% zoom with the M6 compact renderer: thin background seams between stacked
// value-input children, puzzle tabs visibly off-center from their row's label, a child protruding
// past its row/parent edges, and (reportedly) siblings not sharing a left edge.
//
// Fixture idiom matches density.test.ts / collapse.test.ts: hand-built `Blockly.serialization
// .workspaces` block-state entries (never the live codec — editor-ui has no engine of its own,
// AD-008/AD-032), reusing real projected block types (`transon_array`, `transon_rule_format__base`,
// etc.) so the fixtures are representative of §13.10's external-value-input surface, not a
// reimplementation of it.
//
// ROOT CAUSE (verified against the actual Blockly 13 renderer sources — the installed npm package
// ships only compiled/minified bundles, so the sources were fetched from the `blockly-v13.0.0` tag,
// `packages/blockly/core/renderers/`):
//
// (a) zero-gap + no protrusion past a parent/sibling edge: `thrasos/info.ts#getSpacerRowHeight_`
//     uses `LARGE_PADDING` as the spacer-row height between two consecutive external-value-input
//     rows (our surface's only "stack", §13.10 — no statement/prev-next connections here). The M6
//     density pass shrank `MIN_BLOCK_HEIGHT` (a connected child's rendered height) but never touched
//     `LARGE_PADDING` or `TAB_OFFSET_FROM_TOP` (both stayed at thrasos's base values, 10 and 5). The
//     algebra (`renderers/measurables/external_value_input.ts` + `common/drawer.ts
//     #positionExternalValueConnection_`) shows the visible gap between two stacked connected
//     children reduces to `LARGE_PADDING - TAB_OFFSET_FROM_TOP - MEDIUM_PADDING`, independent of the
//     children's own height — a nonzero 2px background seam at the base M6 values. Fixed in
//     `theme.ts` by deriving `LARGE_PADDING = TAB_OFFSET_FROM_TOP + MEDIUM_PADDING` (see that file's
//     banner for the full derivation) — this test proves the fix (zero gap, no protrusion past the
//     parent's own bottom edge).
// (b) label/field ↔ connection alignment: traced to `common/drawer.ts
//     #positionExternalValueConnection_`, which places a value input's connection at `row.yPos` (the
//     row's TOP edge), while `common/info.ts` / `thrasos/info.ts#getElemCenterline_` place the row's
//     field/label at `row.yPos + row.height / 2` (the row's CENTER) — an unconditional half-row-height
//     offset baked into thrasos's OWN drawing algorithm, present identically in UNMODIFIED stock
//     `thrasos` (verified directly against a stock `Blockly.thrasos.Renderer` with no constant
//     overrides at all: a `name` row still places its connection at the row's top, off-center from
//     the row's field by exactly half the row height). No renderer CONSTANT feeds
//     `positionExternalValueConnection_`'s use of `row.yPos` — the only way to force the connection
//     to the row's vertical center is to override `positionExternalValueConnection_` /
//     `getElemCenterline_` themselves, i.e. subclass `Drawer`/`RenderInfo` (not `ConstantProvider`),
//     which SPEC v2.2's NFR-050 banner and AD-033 direct against absent an explicit STOP. This is
//     reported as UNSATISFIABLE via constants-only tuning rather than silently weakened: the
//     alignment-gap test below measures and documents the actual (nonzero) offset instead of
//     asserting the literal "≤0.5px" bound.
import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly/core';
import type { Json } from '@transon/editor-core';
import { mountBlockly } from '../src/blockly/mount.js';
import { GRID_UNIT, CompactConstantProvider } from '../src/blockly/theme.js';

function makeContainer(): HTMLElement {
  const c = document.createElement('div');
  c.style.width = '1440px';
  c.style.height = '900px';
  document.body.appendChild(c);
  return c;
}

type BlockState = Record<string, Json>;

/** A parent with 3 value-input children stacked under external inputs (§13.10) — the visual "stack"
 *  this surface has instead of statement/prev-next connections (a `transon_array` with 3 literal
 *  items, matching density.test.ts's mutator-child idiom). */
const ARRAY_STACK: BlockState = {
  type: 'transon_array',
  extraState: { items: [0, 1, 2] },
  inputs: {
    ITEM0: { block: { type: 'transon_literal', fields: { VALUE: 1 } } },
    ITEM1: { block: { type: 'transon_literal', fields: { VALUE: 2 } } },
    ITEM2: { block: { type: 'transon_literal', fields: { VALUE: 3 } } },
  },
};

/** A parent with 3 named value-input rows of DIFFERENT rule-block child types/widths (reported: "Set
 *  variable a few px left of Expression op / Build object under the same parent") — the same
 *  external-input stack, but exercising heterogeneous sibling widths rather than 3 identical
 *  literals. */
const MIXED_STACK: BlockState = {
  type: 'transon_array',
  extraState: { items: [0, 1] },
  inputs: {
    ITEM0: {
      block: {
        type: 'transon_rule_set__base',
        inputs: { name: { block: { type: 'transon_literal', fields: { VALUE: 'x' } } } },
      },
    },
    ITEM1: {
      block: {
        type: 'transon_rule_expr__value',
        fields: { op: '!' },
        inputs: { value: { block: { type: 'transon_literal', fields: { VALUE: 1 } } } },
      },
    },
  },
};

/** A rule block with multiple NAMED value-input rows on its own body (title on its own row, named
 *  inputs on subsequent rows per §13.10) — `attr`'s `name %1 default %2` rows, the fixture the
 *  reported defect 2 (puzzle-tab vertically off-center vs the row's label) names directly. */
const ATTR_NAME: BlockState = {
  type: 'transon_rule_attr__name',
  inputs: {
    name: { block: { type: 'transon_literal', fields: { VALUE: 'a' } } },
    default: { block: { type: 'transon_literal', fields: { VALUE: 'fallback' } } },
  },
};

/** `format`'s 3 named rows (`pattern %1 value %2 default %3`) — reported defect 5 ("a Format
 *  string's `pattern` child almost overlaps the next input's child"). */
const FORMAT_BASE: BlockState = {
  type: 'transon_rule_format__base',
  inputs: {
    pattern: { block: { type: 'transon_literal', fields: { VALUE: '{}' } } },
    value: { block: { type: 'transon_literal', fields: { VALUE: 1 } } },
    default: { block: { type: 'transon_literal', fields: { VALUE: 2 } } },
  },
};

/** Every value-input row on `block`, in input-list order, each with its connection's offset-in-block
 *  and (if connected) the child block's own rendered geometry. */
function valueInputRows(
  block: Blockly.BlockSvg,
): Array<{ name: string; connX: number; connY: number; child: Blockly.BlockSvg | null }> {
  const rows: Array<{ name: string; connX: number; connY: number; child: Blockly.BlockSvg | null }> =
    [];
  for (const input of block.inputList) {
    if (!input.connection) continue;
    const off = (input.connection as Blockly.RenderedConnection).getOffsetInBlock();
    const child = (input.connection.targetBlock() as Blockly.BlockSvg | null) ?? null;
    rows.push({ name: input.name, connX: off.x, connY: off.y, child });
  }
  return rows;
}

describe('NFR-050(a) zero-gap stacking + shared left edge', () => {
  it('consecutive value-input children of one parent have zero background seam between them', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      mount.workspace.setScale(1);
      mount.loadDocument(ARRAY_STACK);
      const parent = mount.workspace.getTopBlocks(false)[0] as Blockly.BlockSvg;
      const rows = valueInputRows(parent);
      expect(rows.length).toBe(3);

      let prevBottom: number | null = null;
      for (const row of rows) {
        expect(row.child).not.toBeNull();
        const child = row.child as Blockly.BlockSvg;
        const xy = child.getRelativeToSurfaceXY();
        expect(Number.isFinite(xy.y)).toBe(true);
        expect(Number.isFinite(child.height)).toBe(true);
        expect(child.height).toBeGreaterThan(0);
        if (prevBottom !== null) {
          // No background seam beyond the renderer's own declared spacing: siblings must be
          // FLUSH (zero-gap), not merely "close".
          expect(xy.y).toBe(prevBottom);
        }
        prevBottom = xy.y + child.height;
      }
      // The last child must not protrude below the parent's own bottom edge.
      expect(prevBottom).toBe(parent.height);
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('stacked siblings under one parent share the same left edge, even with different child types', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      mount.workspace.setScale(1);
      mount.loadDocument(MIXED_STACK);
      const parent = mount.workspace.getTopBlocks(false)[0] as Blockly.BlockSvg;
      const rows = valueInputRows(parent);
      expect(rows.length).toBe(2);
      // Sanity: the two children really are different types/widths (else this proves nothing).
      expect(rows[0]!.child!.type).not.toBe(rows[1]!.child!.type);
      expect(rows[0]!.child!.width).not.toBe(rows[1]!.child!.width);

      const leftEdges = rows.map((r) => r.child!.getRelativeToSurfaceXY().x);
      expect(new Set(leftEdges).size).toBe(1);
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('a multi-named-input rule block (format: pattern/value/default) stacks its rows with zero gap', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      mount.workspace.setScale(1);
      mount.loadDocument(FORMAT_BASE);
      const parent = mount.workspace.getTopBlocks(false)[0] as Blockly.BlockSvg;
      const rows = valueInputRows(parent);
      expect(rows.length).toBe(3);

      let prevBottom: number | null = null;
      let leftX: number | null = null;
      for (const row of rows) {
        const child = row.child as Blockly.BlockSvg;
        const xy = child.getRelativeToSurfaceXY();
        if (leftX === null) {
          leftX = xy.x;
        } else {
          expect(xy.x).toBe(leftX); // shared left edge (defect 4)
        }
        if (prevBottom !== null) {
          expect(xy.y).toBe(prevBottom); // zero gap (defect 1/5 — adjacent rows nearly collide)
        }
        prevBottom = xy.y + child.height;
      }
      expect(prevBottom).toBe(parent.height); // no protrusion past the parent (defect 3)
    } finally {
      mount.dispose();
      c.remove();
    }
  });
});

/** Measured field/icon centerlines of a RenderInfo row (the values the drawer actually places
 *  fields at — NOT the default `row.yPos + row.height/2` formula, which is exactly what the
 *  NFR-050(b) anchoring override replaces for external-input rows). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fieldCenterlines(row: any): number[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (row.elements as any[])
    .filter((e) => e.field !== undefined || e.icon !== undefined)
    .map((e) => e.centerline as number);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function measuredExternalRows(mount: TransonMountLike, parent: Blockly.BlockSvg): any[] {
  const renderer = mount.workspace.getRenderer() as unknown as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    makeRenderInfo_(block: Blockly.BlockSvg): any;
  };
  // White-box introspection (NOT a reimplementation): ask the SAME RenderInfo class Blockly itself
  // uses to measure this exact block, then read the real rows/centerlines it computed.
  const info = renderer.makeRenderInfo_(parent);
  info.measure();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (info.rows as any[]).filter((r) => r.hasExternalInput);
}
interface TransonMountLike {
  workspace: Blockly.WorkspaceSvg;
}

describe('NFR-050(b) label/field ↔ connection anchoring', () => {
  // The specified quantity is what is DRAWN: every external-value-input row's label/field anchors
  // to the drawn connection tab — centerline == row.yPos + TAB_HEIGHT/2 (the interlocked tab glyph
  // spans [row.yPos, row.yPos + TAB_HEIGHT] because the child's top sits TAB_OFFSET_FROM_TOP above
  // the row top and its output tab is drawn TAB_OFFSET_FROM_TOP below its own top). For a
  // minimal-height row this equals the stock row-center placement, so short rows are unchanged;
  // for a row STRETCHED by a tall child, stock thrasos re-centers the label across the stretched
  // height (the reported "label floats in the middle of a huge blank interior" defect) while the
  // anchoring override keeps it at the tab. Implemented in theme.ts's CompactRenderInfo
  // (`getElemCenterline_`), sanctioned by NFR-050(b).
  const anchorOf = (row: { yPos: number }, constants: CompactConstantProvider): number =>
    row.yPos + constants.TAB_HEIGHT / 2;

  it('short rows: label centerline == drawn tab center == connected pill center (unchanged behavior)', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      mount.workspace.setScale(1);
      mount.loadDocument(ATTR_NAME);
      const parent = mount.workspace.getTopBlocks(false)[0] as Blockly.BlockSvg;
      const externalRows = measuredExternalRows(mount, parent);
      const rows = valueInputRows(parent);
      expect(rows.length).toBe(2);
      expect(externalRows.length).toBe(rows.length);

      const constants = new CompactConstantProvider();
      // A minimal literal "pill" child: the scalar field's border rect plus the top/bottom row
      // minimums (both MEDIUM_PADDING-derived in this provider).
      const pillHeight =
        constants.FIELD_BORDER_RECT_HEIGHT +
        constants.TOP_ROW_MIN_HEIGHT +
        constants.BOTTOM_ROW_MIN_HEIGHT;
      const parentXY = parent.getRelativeToSurfaceXY();
      for (let i = 0; i < rows.length; i++) {
        const row = externalRows[i];
        const child = rows[i]!.child;
        expect(child).not.toBeNull();
        const centerlines = fieldCenterlines(row);
        expect(centerlines.length).toBeGreaterThan(0);
        for (const cl of centerlines) {
          // (b) core invariant: label/field centerline anchors to the drawn tab.
          expect(Math.abs(cl - anchorOf(row, constants))).toBeLessThanOrEqual(0.5);
        }
        // For a minimal pill child the anchor also coincides with the pill's own center.
        if (child!.height === pillHeight) {
          const childTop = child!.getRelativeToSurfaceXY().y - parentXY.y;
          expect(
            Math.abs(anchorOf(row, constants) - (childTop + child!.height / 2)),
          ).toBeLessThanOrEqual(0.5);
        }
      }
      // Sanity: at least one of the two attr children really is a minimal pill.
      expect(rows.some((r) => r.child!.height === pillHeight)).toBe(true);
      // Structural precondition pinned by name: the zero-gap derivation and the child-top offset
      // both assume TAB_OFFSET_FROM_TOP == MEDIUM_PADDING.
      expect(constants.TAB_OFFSET_FROM_TOP).toBe(constants.MEDIUM_PADDING);
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('STRETCHED rows: the label stays anchored at the tab, not re-centered across a tall child', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      mount.workspace.setScale(1);
      // attr whose `name` child is itself an attr with two inputs — guaranteed taller than
      // minimal, so its row is stretched well beyond the label height.
      mount.loadDocument({
        type: 'transon_rule_attr__name',
        inputs: {
          name: { block: ATTR_NAME },
          default: { block: { type: 'transon_literal', fields: { VALUE: 0 } } },
        },
      });
      const parent = mount.workspace.getTopBlocks(false)[0] as Blockly.BlockSvg;
      const externalRows = measuredExternalRows(mount, parent);
      const rows = valueInputRows(parent);
      const constants = new CompactConstantProvider();
      const tallRowIndex = rows.findIndex(
        (r) => r.child !== null && r.child.height > 2 * constants.TAB_HEIGHT,
      );
      expect(tallRowIndex).toBeGreaterThanOrEqual(0); // the fixture really produced a tall child
      const row = externalRows[tallRowIndex];
      // Sanity: the row really is stretched — its height far exceeds the anchor band, so anchored
      // and re-centered placements are DISTINGUISHABLE (else this test proves nothing).
      expect(row.height).toBeGreaterThan(2 * constants.TAB_HEIGHT);
      const centerlines = fieldCenterlines(row);
      expect(centerlines.length).toBeGreaterThan(0); // else the anchoring loop proves nothing
      for (const cl of centerlines) {
        // Anchored at the tab (NFR-050(b)) …
        expect(Math.abs(cl - anchorOf(row, constants))).toBeLessThanOrEqual(0.5);
        // … and demonstrably NOT re-centered across the stretched row.
        expect(Math.abs(cl - (row.yPos + row.height / 2))).toBeGreaterThan(0.5);
      }
    } finally {
      mount.dispose();
      c.remove();
    }
  });
});

describe('NFR-050(c) grid-quantized vertical constants', () => {
  it('every explicitly-overridden vertical constant on CompactConstantProvider is a GRID_UNIT multiple', () => {
    const constants = new CompactConstantProvider();
    // The exact set this subclass explicitly assigns in its constructor (theme.ts) — vertical-only;
    // SMALL_PADDING is intentionally excluded (horizontal in-row spacing, out of NFR-050(c) scope,
    // see theme.ts's banner).
    const verticalConstants: Array<[string, number]> = [
      ['MEDIUM_PADDING', constants.MEDIUM_PADDING],
      ['TAB_HEIGHT', constants.TAB_HEIGHT],
      ['DUMMY_INPUT_MIN_HEIGHT', constants.DUMMY_INPUT_MIN_HEIGHT],
      ['DUMMY_INPUT_SHADOW_MIN_HEIGHT', constants.DUMMY_INPUT_SHADOW_MIN_HEIGHT],
      ['TAB_OFFSET_FROM_TOP', constants.TAB_OFFSET_FROM_TOP],
      ['NOTCH_HEIGHT', constants.NOTCH_HEIGHT],
      ['MIN_BLOCK_HEIGHT', constants.MIN_BLOCK_HEIGHT],
      ['EMPTY_STATEMENT_INPUT_HEIGHT', constants.EMPTY_STATEMENT_INPUT_HEIGHT],
      ['TOP_ROW_MIN_HEIGHT', constants.TOP_ROW_MIN_HEIGHT],
      ['BOTTOM_ROW_MIN_HEIGHT', constants.BOTTOM_ROW_MIN_HEIGHT],
      ['LARGE_PADDING', constants.LARGE_PADDING],
      ['EMPTY_INLINE_INPUT_HEIGHT', constants.EMPTY_INLINE_INPUT_HEIGHT],
      ['FIELD_BORDER_RECT_HEIGHT', constants.FIELD_BORDER_RECT_HEIGHT],
    ];
    expect(verticalConstants.length).toBeGreaterThan(0);
    for (const [name, value] of verticalConstants) {
      expect(Number.isFinite(value), `${name} must be finite`).toBe(true);
      expect(value % GRID_UNIT, `${name}=${value} must be a multiple of GRID_UNIT=${GRID_UNIT}`).toBe(
        0,
      );
    }
  });

  it('rendered block heights land on a GRID_UNIT multiple for every fixture — including mutator-bearing blocks', () => {
    // No exemptions: the +/- mutator-control glyphs are sized GLYPH_SIZE=15 in
    // `packages/editor-blockly/src/runtime.ts#appendControls` precisely so `FieldImage.getSize()`
    // (imageHeight + a PRIVATE STATIC Y_PADDING=1 hardcoded in Blockly core's `field_image.ts`,
    // verified against the fetched `blockly-v13.0.0` source) lands on the grid: 15+1=16. At the
    // previous 16px icon the row measured 17px and the odd height propagated into EVERY ancestor of
    // an array/object block, breaking corpus-wide height quantization (the corpus sweep in
    // test/engine-node-adapter/test/ui/geometry-corpus.test.ts now asserts this with zero
    // exemptions).
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      mount.workspace.setScale(1);
      for (const fixture of [ATTR_NAME, FORMAT_BASE, ARRAY_STACK, MIXED_STACK]) {
        mount.workspace.clear();
        mount.loadDocument(fixture);
        for (const block of mount.workspace.getAllBlocks(false) as Blockly.BlockSvg[]) {
          expect(Number.isFinite(block.height)).toBe(true);
          expect(block.height).toBeGreaterThan(0);
          expect(
            block.height % GRID_UNIT,
            `${block.type} height ${block.height} must be a multiple of GRID_UNIT=${GRID_UNIT}`,
          ).toBe(0);
        }
      }
    } finally {
      mount.dispose();
      c.remove();
    }
  });
});

describe('segmented +/- mutator control (AC-038 presentation)', () => {
  // The two FieldImage button chips form ONE visual segmented control: 15x15 squares (symmetrical,
  // each button square) joined with ZERO gap (CompactRenderInfo.getInRowSpacing_ returns 0 between
  // adjacent image fields — the only FieldImages in the transon surface are these buttons).
  it('the two image fields are square, equal, and flush (no gap) on the title row', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      mount.workspace.setScale(1);
      mount.loadDocument(ARRAY_STACK);
      const parent = mount.workspace.getTopBlocks(false)[0] as Blockly.BlockSvg;
      const minus = parent.getField('TRANSON_MINUS');
      const plus = parent.getField('TRANSON_PLUS');
      expect(minus).toBeTruthy();
      expect(plus).toBeTruthy();
      // square + symmetrical: equal 15-wide buttons drawn as 15×15 squares (the field BOX height
      // is 16 — image 15 + Blockly's private 1px Y_PADDING — exactly the 16px grid row,
      // NFR-050(c))
      for (const f of [minus!, plus!]) {
        const size = f.getSize();
        expect(size.width).toBe(15);
        expect(size.height).toBe(16);
      }
      // flush + ordered (rendered DOM is the source of truth): the field groups sit exactly one
      // button-width apart — minus (red) left, plus (green) right, zero gap between the squares
      const xOf = (f: Blockly.Field): number => {
        const m = /translate\((-?[\d.]+)/.exec(f.getSvgRoot()!.getAttribute('transform') ?? '');
        return m ? parseFloat(m[1]!) : NaN;
      };
      expect(xOf(plus!) - xOf(minus!)).toBe(15);
    } finally {
      mount.dispose();
      c.remove();
    }
  });
});
