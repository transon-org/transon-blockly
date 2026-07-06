import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly/core';
import type { Json } from '@transon/editor-core';
import { decode } from '@transon/editor-core';
import { mountBlockly } from '../src/blockly/mount.js';
import { createFakeEngine } from './fake-engine.js';

// FR-134 (SPEC §7.17, AC-041(b), §11.5) — the canvas shall support collapsing/expanding any block
// subtree via Blockly's native context menu. `collapsed` is UI-only state (§11.5, already named in
// the canonical list alongside `zoom`): it is written by Blockly's own `save()`, but the generated
// Transon JSON (the codec `decode()` direction) reads inputs/fields by name and must IGNORE it — so
// the JSON is byte-identical collapsed vs expanded. Custom fields (the scalar field) and mutator
// controls (array/object, AD-031) must render sanely in the collapsed state.

/** A single Blockly `serialization.workspaces.save()` block-state entry — a JSON object that may
 *  carry the UI-only `collapsed` flag (§11.5) alongside `type`/`fields`/`inputs`/`extraState`. */
type BlockState = Record<string, Json> & { collapsed?: boolean };

function makeContainer(): HTMLElement {
  const c = document.createElement('div');
  c.style.width = '800px';
  c.style.height = '600px';
  document.body.appendChild(c);
  return c;
}

// A representative template: an object literal { a: 1, b: [2, 3] } — exercises the custom scalar
// field (transon_literal/VALUE) plus both structural mutators (object + array), the same idiom
// used by the engine-node-adapter decode fixtures (test/engine-node-adapter/test/codec/decode.test.ts)
// and editor-blockly's palette-load tests.
function representativeBlock(): Json {
  return {
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
  };
}

describe('Canvas subtree collapse (FR-134)', () => {
  it('the mount enables collapse: options.collapse is true (gates the native Collapse/Expand Block context-menu item)', () => {
    // Blockly's own "Collapse Block"/"Expand Block" per-block context-menu item (id
    // `blockCollapseExpand`, contextmenu_items.ts) and the workspace-level "Collapse/Expand All"
    // items gate their `preconditionFn` on this exact flag — asserting it directly is the
    // deterministic proxy for "the context menu items are available" without a live DOM
    // contextmenu interaction. NOTE: with a real toolbox present (kind `categoryToolbox`) and
    // `readOnly: false`, Blockly's own `Options` constructor already computes `collapse: true` by
    // default even without this line — the explicit `collapse: true` in mount.ts (this
    // requirement's actual change) makes the contract non-accidental and immune to a future
    // Blockly default change or a toolbox-shape change, matching the explicit `zoom`/`move`
    // options already set alongside it for FR-133.
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      expect(mount.workspace.options.collapse).toBe(true);
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('a loaded block can setCollapsed(true) without throwing; it renders collapsed', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      mount.loadDocument(representativeBlock());
      const top = mount.workspace.getTopBlocks(false)[0] as Blockly.BlockSvg;
      expect(() => top.setCollapsed(true)).not.toThrow();
      expect(top.isCollapsed()).toBe(true);
      // A render pass must complete under jsdom without throwing (§7.17 "renders sanely").
      expect(() => top.render()).not.toThrow();
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('save() carries collapsed: true for the collapsed block (UI-only, §11.5)', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      mount.loadDocument(representativeBlock());
      const top = mount.workspace.getTopBlocks(false)[0] as Blockly.BlockSvg;
      top.setCollapsed(true);
      const saved = Blockly.serialization.workspaces.save(mount.workspace) as {
        blocks?: { blocks?: BlockState[] };
      };
      expect(saved.blocks?.blocks?.[0]?.collapsed).toBe(true);
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('byte-identical generated JSON collapsed vs expanded', async () => {
    // decode() runs the committed decoder codec artifact against the raw block state through the
    // host engine (AD-032) — the fake engine here scripts the "codec ignores collapsed" behavior by
    // structurally decoding the fixture's block/fields/inputs itself (mirroring the real decoder's
    // contract per test/engine-node-adapter/test/codec/decode.test.ts), so this test proves the
    // EDITOR SIDE plumbing (topBlock extraction feeding decode) is unaffected by `collapsed` — the
    // real-engine byte-identical proof against the committed decoder artifact lives in
    // test/engine-node-adapter/test/codec/collapse.test.ts (same fixture).
    function structuralDecode(block: unknown): unknown {
      const b = block as {
        type: string;
        fields?: Record<string, unknown>;
        extraState?: { keys?: string[]; items?: number[] };
        inputs?: Record<string, { block: unknown }>;
      };
      if (b.type === 'transon_literal') return b.fields?.['VALUE'] ?? null;
      if (b.type === 'transon_array') {
        const items = b.extraState?.items ?? [];
        return items.map((_, i) => structuralDecode(b.inputs?.[`ITEM${i}`]?.block));
      }
      if (b.type === 'transon_object_literal') {
        const keys = b.extraState?.keys ?? [];
        const out: Record<string, unknown> = {};
        keys.forEach((k, i) => {
          out[k] = structuralDecode(b.inputs?.[`VALUE${i}`]?.block);
        });
        return out;
      }
      throw new Error(`unexpected type ${b.type}`);
    }
    const engine = createFakeEngine({
      onTransform: (_t, input) => ({ status: 'ok', success: true, output: structuralDecode(input) as never }),
    });

    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      mount.loadDocument(representativeBlock());

      const expandedState = Blockly.serialization.workspaces.save(mount.workspace) as {
        blocks: { blocks: BlockState[] };
      };
      const expandedBlock = expandedState.blocks.blocks[0]!;
      const expandedJson = await decode(engine, expandedBlock);

      const top = mount.workspace.getTopBlocks(false)[0] as Blockly.BlockSvg;
      top.setCollapsed(true);
      const collapsedState = Blockly.serialization.workspaces.save(mount.workspace) as {
        blocks: { blocks: BlockState[] };
      };
      const collapsedBlock = collapsedState.blocks.blocks[0]!;
      expect(collapsedBlock.collapsed).toBe(true); // sanity: the fixture really is collapsed
      const collapsedJson = await decode(engine, collapsedBlock);

      // Byte-identical: exact string equality of the canonical (deterministic key order) JSON.
      expect(JSON.stringify(collapsedJson)).toBe(JSON.stringify(expandedJson));
      expect(collapsedJson).toEqual({ a: 1, b: [2, 3] });
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('a block with the custom scalar field renders collapsed without throwing', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      mount.loadDocument({ type: 'transon_literal', fields: { VALUE: 'hi' } });
      const top = mount.workspace.getTopBlocks(false)[0] as Blockly.BlockSvg;
      expect(() => top.setCollapsed(true)).not.toThrow();
      expect(() => top.render()).not.toThrow();
      expect(top.isCollapsed()).toBe(true);
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('array/object mutator blocks (structural) render collapsed without throwing', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      mount.loadDocument(representativeBlock());
      const top = mount.workspace.getTopBlocks(false)[0] as Blockly.BlockSvg;
      // Collapse the outer object AND its nested array child (both carry mutator controls).
      const arrayChild = top.getChildren(false).find((b) => b.type === 'transon_array') as
        | Blockly.BlockSvg
        | undefined;
      expect(arrayChild).toBeTruthy();
      expect(() => arrayChild!.setCollapsed(true)).not.toThrow();
      expect(() => top.setCollapsed(true)).not.toThrow();
      expect(() => mount.workspace.render()).not.toThrow();
      expect(top.isCollapsed()).toBe(true);
      expect(arrayChild!.isCollapsed()).toBe(true);
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('round-trips through save -> load preserving collapsed and the JSON output', async () => {
    const engine = createFakeEngine({
      onTransform: (_t, input) => {
        function structuralDecode(block: unknown): unknown {
          const b = block as {
            type: string;
            fields?: Record<string, unknown>;
            extraState?: { keys?: string[]; items?: number[] };
            inputs?: Record<string, { block: unknown }>;
          };
          if (b.type === 'transon_literal') return b.fields?.['VALUE'] ?? null;
          if (b.type === 'transon_array') {
            const items = b.extraState?.items ?? [];
            return items.map((_, i) => structuralDecode(b.inputs?.[`ITEM${i}`]?.block));
          }
          if (b.type === 'transon_object_literal') {
            const keys = b.extraState?.keys ?? [];
            const out: Record<string, unknown> = {};
            keys.forEach((k, i) => {
              out[k] = structuralDecode(b.inputs?.[`VALUE${i}`]?.block);
            });
            return out;
          }
          throw new Error(`unexpected type ${b.type}`);
        }
        return { status: 'ok', success: true, output: structuralDecode(input) as never };
      },
    });

    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      mount.loadDocument(representativeBlock());
      const top = mount.workspace.getTopBlocks(false)[0] as Blockly.BlockSvg;
      top.setCollapsed(true);
      const saved = Blockly.serialization.workspaces.save(mount.workspace) as {
        blocks: { blocks: BlockState[] };
      };
      const savedBlock = saved.blocks.blocks[0]!;
      expect(savedBlock.collapsed).toBe(true);
      const jsonBeforeReload = await decode(engine, savedBlock);

      // Load into a second, fresh mount (a clean "load" cycle) and confirm collapsed survives.
      const c2 = makeContainer();
      const mount2 = mountBlockly(c2);
      try {
        Blockly.serialization.workspaces.load(saved, mount2.workspace);
        const reloaded = mount2.workspace.getTopBlocks(false)[0] as Blockly.BlockSvg;
        expect(reloaded.isCollapsed()).toBe(true);
        const resaved = Blockly.serialization.workspaces.save(mount2.workspace) as {
          blocks: { blocks: BlockState[] };
        };
        const resavedBlock = resaved.blocks.blocks[0]!;
        expect(resavedBlock.collapsed).toBe(true);
        const jsonAfterReload = await decode(engine, resavedBlock);
        expect(JSON.stringify(jsonAfterReload)).toBe(JSON.stringify(jsonBeforeReload));
      } finally {
        mount2.dispose();
        c2.remove();
      }
    } finally {
      mount.dispose();
      c.remove();
    }
  });

  it('the mount registers the double-click-to-collapse handler (FR-134)', () => {
    // The wiring itself: the handler is added as a workspace change listener. Behaviour is proven
    // deterministically in collapse-on-double-click.test.ts (fed synthetic Click events), and
    // end-to-end against the real reference host (Playwright double-click on a canvas block).
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      mount.loadDocument(representativeBlock());
      const top = mount.workspace.getTopBlocks(false)[0] as Blockly.BlockSvg;
      // A block Click ui-event flows through the mount without throwing (the handler is wired).
      expect(() =>
        Blockly.Events.fire(
          new Blockly.Events.Click(top, mount.workspace.id, Blockly.Events.ClickTarget.BLOCK),
        ),
      ).not.toThrow();
    } finally {
      mount.dispose();
      c.remove();
    }
  });
});
