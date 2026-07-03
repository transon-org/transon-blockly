// M5 D4 — metadata-driven block presentation: tooltips from metadata (FR-078, AC-020), graceful
// handling when a rule has no metadata description (FR-077), and the constant-choice dropdown built
// from the resolved enum (FR-058). Headless: the block defs register + instantiate, and the tooltip/
// dropdown come from data, not per-rule TypeScript.
import { beforeAll, describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import { editorMetadata } from '@transon/editor-core';
import { registerTransonBlocks, ruleTooltip } from '../src/index.js';

let workspace: Blockly.Workspace;
beforeAll(() => {
  registerTransonBlocks();
  workspace = new Blockly.Workspace();
});

const descOf = (rule: string): string | undefined =>
  editorMetadata.docs.rules.find((r) => r.name === rule)?.description as string | undefined;

describe('tooltips from metadata (FR-078, AC-020)', () => {
  it('ruleTooltip returns the metadata description for a rule block', () => {
    expect(ruleTooltip('transon_rule_attr__name')).toBe(descOf('attr'));
    expect(ruleTooltip('transon_rule_expr__base')).toBe(descOf('expr'));
  });

  it('a registered rule block carries the metadata tooltip', () => {
    const b = workspace.newBlock('transon_rule_attr__name');
    try {
      expect(b.tooltip).toBe(descOf('attr'));
    } finally {
      b.dispose(false);
    }
  });

  it('is graceful for structural / unknown block types (FR-077)', () => {
    expect(ruleTooltip('transon_literal')).toBeUndefined();
    expect(ruleTooltip('transon_array')).toBeUndefined();
    expect(ruleTooltip('transon_rule_does_not_exist__base')).toBeUndefined();
  });
});

describe('constant-choice dropdown from the resolved enum (FR-058)', () => {
  it('the expr operator block instantiates with a dropdown of resolved operator tokens', () => {
    const b = workspace.newBlock('transon_rule_expr__base');
    try {
      const field = b.getField('op');
      expect(field).toBeInstanceOf(Blockly.FieldDropdown);
      const options = (field as Blockly.FieldDropdown).getOptions(false);
      expect(options.length).toBeGreaterThan(1); // many operator tokens (resolved enum)
      const values = options.map((o) => o[1]);
      expect(values).toContain('<'); // a known operator token
    } finally {
      b.dispose(false);
    }
  });
});
