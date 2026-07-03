import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly/core';
import type { JsonPathBlockMap } from '@transon/editor-core';
import { mountBlockly } from '../src/blockly/mount.js';
import { buildPathIndex, highlightErrors, clearHighlights } from '../src/blockly/highlight.js';

// D4 — error→block highlighting (FR-091..094, AC-017). Mechanism tested on a rendered workspace (a
// warning icon is rendered-block state, so the mount is required) with a synthetic block map; the
// path-index↔block_map agreement over REAL encoded documents is proven against the engine in the
// adapter (test/ui/path-index.test.ts).
const WARNING = Blockly.icons.IconType.WARNING;

// { x: <literal 1> } as an object_literal block (KEY0='x', VALUE0→literal).
const DOC_BLOCK = {
  type: 'transon_object_literal',
  extraState: { keys: ['x'] },
  inputs: { VALUE0: { block: { type: 'transon_literal', fields: { VALUE: 1 } } } },
};
const BM: JsonPathBlockMap = [
  { template_path: '$', block_id: '$' },
  { template_path: '$/x', block_id: '$/x', nearest_parent_block_id: '$' },
  // a constant-param-like leaf with no own block → resolves to its parent
  { template_path: '$/x/op', block_id: '$/x/op', nearest_parent_block_id: '$/x' },
];

function container(): HTMLElement {
  const c = document.createElement('div');
  c.style.width = '800px';
  c.style.height = '600px';
  document.body.appendChild(c);
  return c;
}

describe('buildPathIndex', () => {
  it('indexes live blocks by document path (matching the block_map scheme)', () => {
    const c = container();
    const mount = mountBlockly(c);
    try {
      mount.loadDocument(DOC_BLOCK);
      const idx = buildPathIndex(mount.workspace);
      expect(idx.get('$')?.type).toBe('transon_object_literal');
      expect(idx.get('$/x')?.type).toBe('transon_literal');
    } finally {
      mount.dispose();
      c.remove();
    }
  });
});

describe('highlightErrors (FR-092/093/094, AC-017)', () => {
  function withDoc(fn: (ws: Blockly.WorkspaceSvg) => void): void {
    const c = container();
    const mount = mountBlockly(c);
    try {
      mount.loadDocument(DOC_BLOCK);
      fn(mount.workspace);
    } finally {
      mount.dispose();
      c.remove();
    }
  }

  it('warns the exact mapped block when the path resolves', () => {
    withDoc((ws) => {
      const idx = buildPathIndex(ws);
      highlightErrors(ws, BM, [{ code: 'runtime_transformation', message: 'boom', template_path: '$/x' }]);
      expect(idx.get('$/x')?.hasIcon(WARNING)).toBe(true);
      expect(idx.get('$')?.hasIcon(WARNING)).toBe(false);
    });
  });

  it('warns the nearest parent when the path has no own block (constant param)', () => {
    withDoc((ws) => {
      const idx = buildPathIndex(ws);
      highlightErrors(ws, BM, [{ code: 'template_definition', message: 'bad op', template_path: '$/x/op' }]);
      expect(idx.get('$/x')?.hasIcon(WARNING)).toBe(true); // nearest_parent_block_id
    });
  });

  it('falls back to the root block when no path is available (AC-017 "nearest")', () => {
    withDoc((ws) => {
      const idx = buildPathIndex(ws);
      highlightErrors(ws, BM, [{ code: 'template_definition', message: 'engine said no' }]);
      expect(idx.get('$')?.hasIcon(WARNING)).toBe(true);
    });
  });

  it('clears prior highlights before re-highlighting and on demand', () => {
    withDoc((ws) => {
      const idx = buildPathIndex(ws);
      highlightErrors(ws, BM, [{ code: 'runtime_transformation', message: 'boom', template_path: '$/x' }]);
      expect(idx.get('$/x')?.hasIcon(WARNING)).toBe(true);
      clearHighlights(ws);
      expect(idx.get('$/x')?.hasIcon(WARNING)).toBe(false);
      highlightErrors(ws, BM, [{ code: 'template_definition', message: 'x' }]);
      expect(idx.get('$/x')?.hasIcon(WARNING)).toBe(false);
      expect(idx.get('$')?.hasIcon(WARNING)).toBe(true);
    });
  });
});
