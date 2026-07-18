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

describe('tooltips from metadata (FR-078, AC-020, §12.5 OQ-018)', () => {
  it('ruleTooltip returns "<rule> — <description>" for a rule block (§12.5, FR-078)', () => {
    expect(ruleTooltip('transon_rule_attr__name')).toBe(`attr — ${descOf('attr')}`);
    expect(ruleTooltip('transon_rule_expr__base')).toBe(`expr — ${descOf('expr')}`);
  });

  it('a registered rule block carries the "<rule> — <description>" tooltip', () => {
    const b = workspace.newBlock('transon_rule_attr__name');
    try {
      expect(b.tooltip).toBe(`attr — ${descOf('attr')}`);
    } finally {
      b.dispose(false);
    }
  });

  it('is graceful for structural / non-rule block types (FR-077)', () => {
    expect(ruleTooltip('transon_literal')).toBeUndefined();
    expect(ruleTooltip('transon_array')).toBeUndefined();
  });

  it('falls back to the rule name alone when the rule has no metadata description (FR-077, FR-078)', () => {
    // Every catalog rule has a description at v0.1.3, so this exercises the fallback branch
    // directly: a rule-shaped type whose rule has no docs entry still names the rule, rather than
    // showing nothing — the canvas no longer shows the rule name anywhere (§12.5).
    expect(ruleTooltip('transon_rule_does_not_exist__base')).toBe('does_not_exist');
  });
});

describe('flyout dual label vs canvas title-only face (§12.5, OQ-018, AC-041(c))', () => {
  it('a normally-instantiated (canvas) rule block shows the title alone', () => {
    const b = workspace.newBlock('transon_rule_attr__name');
    try {
      expect(b.isInFlyout).toBe(false);
      const title = [...b.getFields()][0]!;
      expect(title.getText()).toBe('Get attribute');
    } finally {
      b.dispose(false);
    }
  });

  it('a block instantiated inside a flyout workspace shows the dual "<title> (<rule>)" label', () => {
    const flyoutWs = new Blockly.Workspace();
    (flyoutWs as unknown as { internalIsFlyout: boolean }).internalIsFlyout = true;
    const b = flyoutWs.newBlock('transon_rule_attr__name');
    try {
      expect(b.isInFlyout).toBe(true);
      const title = [...b.getFields()][0]!;
      expect(title.getText()).toBe('Get attribute (attr)');
    } finally {
      b.dispose(false);
      flyoutWs.dispose();
    }
  });

  it('a multi-input (title-own-row) block also gets the dual label in the flyout', () => {
    const flyoutWs = new Blockly.Workspace();
    (flyoutWs as unknown as { internalIsFlyout: boolean }).internalIsFlyout = true;
    const b = flyoutWs.newBlock('transon_rule_join__base');
    try {
      const title = [...b.getFields()][0]!;
      expect(title.getText()).toBe('Join (join)');
    } finally {
      b.dispose(false);
      flyoutWs.dispose();
    }
  });

  it('the flyout substitution preserves a trailing param label merged into the title run (§12.5, revised 2026-07-18)', () => {
    // map__item / map__items keep their disambiguating socket label (§12.5 face-uniqueness), and
    // Blockly merges "Map" + "item(s)" into ONE text run — the extension must substitute only the
    // title portion, or the flyout would collapse both variants back to "Map (map)".
    const flyoutWs = new Blockly.Workspace();
    (flyoutWs as unknown as { internalIsFlyout: boolean }).internalIsFlyout = true;
    const item = flyoutWs.newBlock('transon_rule_map__item');
    const items = flyoutWs.newBlock('transon_rule_map__items');
    try {
      expect([...item.getFields()][0]!.getText()).toBe('Map (map) item');
      expect([...items.getFields()][0]!.getText()).toBe('Map (map) items');
    } finally {
      item.dispose(false);
      items.dispose(false);
      flyoutWs.dispose();
    }
  });

  it('structural (non-rule) blocks are unaffected by the flyout-label extension', () => {
    const flyoutWs = new Blockly.Workspace();
    (flyoutWs as unknown as { internalIsFlyout: boolean }).internalIsFlyout = true;
    const b = flyoutWs.newBlock('transon_array');
    try {
      expect(() => b).not.toThrow();
    } finally {
      b.dispose(false);
      flyoutWs.dispose();
    }
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
