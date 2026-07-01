// The scoped stylesheet must lay out the shell, not merely theme it (§12.1 sandbox two-pane, §12.2
// compact, NFR-025 responsive). Regression guard: the D6 sheet shipped colour/focus tokens only, so
// the structural classes the React shell renders (.transon-body / .transon-canvas / .transon-side-col)
// had ZERO rules — the sandbox collapsed to a flat vertical stack and the Blockly canvas mounted into
// a 0px container (AD-017). jsdom has no layout engine (getBoundingClientRect is stubbed to 0 in
// setup.ts), so — like the a11y contrast checks — pixels are verified in a real browser; here we
// assert the stylesheet DECLARES the layout for each structural selector.
import { describe, it, expect } from 'vitest';
import { TRANSON_CSS, TRANSON_STYLE_ID, ensureTransonStyles } from '../src/styles.js';

/** Concatenated declaration bodies of the top-level (non-@media) rules whose selector list contains
 *  `selector` exactly. Good enough to assert "this selector declares property X" without a CSS parser. */
function decls(selector: string): string {
  const css = TRANSON_CSS.replace(/\/\*[\s\S]*?\*\//g, ''); // strip comments so they don't pollute selectors
  const bodies: string[] = [];
  for (const chunk of css.split('}')) {
    const [rawSel, ...rest] = chunk.split('{');
    if (rawSel === undefined || rest.length === 0) continue;
    const sel = rawSel.trim();
    if (sel.startsWith('@')) continue; // skip @media wrappers — base rules carry the contract
    const selectors = sel.split(',').map((s) => s.trim());
    if (selectors.includes(selector)) bodies.push(rest.join('{'));
  }
  return bodies.join(';');
}

describe('scoped stylesheet lays out the shell, not just theme (§12.1, FR-002)', () => {
  it('the shell fills its container as a vertical flex column', () => {
    const d = decls('.transon-editor-shell');
    expect(d).toMatch(/display:\s*flex/);
    expect(d).toMatch(/flex-direction:\s*column/);
    expect(d).toMatch(/height:\s*100%/);
  });

  it('the body fills the space between toolbar and status bar and can shrink to scroll', () => {
    const d = decls('.transon-editor-shell .transon-body');
    expect(d).toMatch(/display:\s*flex/);
    expect(d).toMatch(/flex:\s*1/);
    expect(d).toMatch(/min-height:\s*0/); // the canonical flexbox overflow fix
  });

  it('sandbox mode is a side-by-side split (§12.1 two-pane)', () => {
    expect(decls('.transon-editor-shell .transon-body.transon-sandbox')).toMatch(/flex-direction:\s*row/);
  });

  it('the Blockly canvas is given a non-zero size so the workspace renders (AD-017)', () => {
    const d = decls('.transon-editor-shell .transon-canvas');
    expect(d).toMatch(/flex:\s*1/);
    expect(d).toMatch(/min-height:\s*\d/); // an explicit floor — never 0px
  });

  it('the side panel column scrolls independently of the canvas', () => {
    const d = decls('.transon-editor-shell .transon-side-col');
    expect(d).toMatch(/flex-direction:\s*column/);
    expect(d).toMatch(/overflow:/);
  });

  it('degrades to a single column on a narrow container (NFR-025 responsive)', () => {
    expect(TRANSON_CSS).toMatch(/@media[^{]*max-width[^{]*\{/);
  });
});

describe('ensureTransonStyles injects the layout sheet once (idempotent)', () => {
  it('injects a single <style> into the head carrying the layout rules', () => {
    ensureTransonStyles();
    ensureTransonStyles(); // idempotent — keyed by id
    const nodes = document.querySelectorAll(`#${TRANSON_STYLE_ID}`);
    expect(nodes.length).toBe(1);
    expect(nodes[0]?.textContent ?? '').toContain('.transon-body');
  });
});
