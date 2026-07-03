// M3 D0 (AD-021) — @transon/editor-blockly scaffold smoke test.
//
// Confirms the new package and its Blockly 13.0.0 dependency load headlessly in a pure Node
// env (no DOM). The FR-125 (palette-load) and FR-126 (encoder-load) headless gates rely on
// Blockly registering block definitions and loading workspace-serialization JSON without a
// browser/jsdom — those test envs are deferred to M4 (ROADMAP), so M3 must stay headless.
import { describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import { EDITOR_BLOCKLY_PACKAGE } from '../src/index.js';

describe('editor-blockly scaffold (M3 D0)', () => {
  it('exposes the package id', () => {
    expect(EDITOR_BLOCKLY_PACKAGE).toBe('@transon/editor-blockly');
  });

  it('Blockly 13.0.0 instantiates a headless workspace with no DOM', () => {
    expect(Blockly.VERSION).toBe('13.0.0');
    const ws = new Blockly.Workspace();
    expect(ws).toBeTruthy();
    // The serialization API the FR-126 headless load gate depends on.
    expect(typeof Blockly.serialization.workspaces.load).toBe('function');
    expect(typeof Blockly.serialization.workspaces.save).toBe('function');
    ws.dispose();
  });
});
