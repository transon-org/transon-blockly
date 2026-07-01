// FR-129 / AC-040 / AD-033 — the conventional renderer (thrasos) + committed block-surface theme.
// AD-033 updates AD-017 (Zelos → thrasos). jsdom has no layout engine, so — like the a11y contrast
// checks — pixels are verified in a real browser; here we assert the WIRING (thrasos renderer + the
// transon theme on the mounted workspace) and the FR-127 guardrail that block/category COLOURS stay
// data-driven (the theme declares no blockStyles/categoryStyles of its own, §21.12).
import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly/core';
import { mountBlockly } from '../src/blockly/mount.js';
import { TRANSON_THEME, TRANSON_THEME_NAME, TRANSON_RENDERER, TRANSON_FONT_STACK } from '../src/blockly/theme.js';

function makeContainer(): HTMLElement {
  const c = document.createElement('div');
  c.style.width = '800px';
  c.style.height = '600px';
  document.body.appendChild(c);
  return c;
}

describe('block-surface theme keeps colours data-driven (FR-127, §21.12)', () => {
  it('sets typography but adds NO block/category styles of its own', () => {
    // Inherit the base styles but contribute none — block/category colours come only from the
    // projected block defs (FR-127), never from this theme.
    expect(Object.keys(TRANSON_THEME.blockStyles).sort()).toEqual(
      Object.keys(Blockly.Themes.Classic.blockStyles).sort(),
    );
    expect(Object.keys(TRANSON_THEME.categoryStyles).sort()).toEqual(
      Object.keys(Blockly.Themes.Classic.categoryStyles).sort(),
    );
    expect(TRANSON_THEME.fontStyle?.family).toBe(TRANSON_FONT_STACK);
  });
});

describe('mounted workspace uses the conventional renderer + theme (FR-129, AC-040, AD-033)', () => {
  it('applies the transon theme and the thrasos (puzzle-connection) renderer', () => {
    const c = makeContainer();
    const mount = mountBlockly(c);
    try {
      expect(mount.workspace.getTheme().name).toBe(TRANSON_THEME_NAME);
      // thrasos — conventional puzzle-tab connections (not Zelos pills, AD-033).
      expect(mount.workspace.getRenderer().getClassName()).toContain(TRANSON_RENDERER);
    } finally {
      mount.dispose();
      c.remove();
    }
  });
});
