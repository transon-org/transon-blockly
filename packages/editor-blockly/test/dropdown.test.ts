// FR-130 — the generic curated-dropdown field (`field_transon_dropdown`): display-only curation
// that keeps every metadata-valid token accepting, displaying (verbatim, never blank), and
// round-tripping through workspace serialization — never rewritten to a curated/canonical
// spelling (AD-004, §21.12). Mirrors the setup style of runtime.test.ts / palette-load.test.ts.
import { beforeAll, describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import { PALETTE_BLOCKS, editorMetadata, ruleBlockType } from '@transon/editor-core';
import { registerTransonBlocks, registerTransonRuntime, loadCodecOutput } from '../src/index.js';

interface DropdownField extends Blockly.Field {
  getText(): string;
  saveState(): unknown;
}

beforeAll(() => {
  registerTransonRuntime();
});

describe('field_transon_dropdown registration (FR-130)', () => {
  it('is registered in the field registry after registerTransonRuntime()', () => {
    const field = Blockly.fieldRegistry.fromJson({
      type: 'field_transon_dropdown',
      options: [['< (lt)', '<']],
    });
    expect(field).toBeTruthy();
  });

  it('fromJson constructs from options + accept', () => {
    const field = Blockly.fieldRegistry.fromJson({
      type: 'field_transon_dropdown',
      options: [['< (lt)', '<']],
      accept: ['<', 'lt'],
    }) as DropdownField;
    expect(field).toBeTruthy();
    expect(field.getValue()).toBe('<'); // constructor selects the first menu option
  });
});

describe('field_transon_dropdown behavior (FR-130, §13.6)', () => {
  const menu: Blockly.MenuOption[] = [
    ['< (lt)', '<'],
    ['== (eq)', '=='],
  ];
  const accept = ['<', 'lt', '==', 'eq'];

  function freshField(): DropdownField {
    return Blockly.fieldRegistry.fromJson({
      type: 'field_transon_dropdown',
      options: menu,
      accept,
    }) as DropdownField;
  }

  it('a canonical (menu) value shows its curated label via getText()', () => {
    const field = freshField();
    field.setValue('==');
    expect(field.getValue()).toBe('==');
    expect(field.getText()).toBe('== (eq)');
  });

  it('an alias value (accept-only, no menu entry) is accepted, displays its raw token, and saves verbatim', () => {
    const field = freshField();
    field.setValue('lt'); // alias of '<', not itself a menu value
    expect(field.getValue()).toBe('lt'); // accepted verbatim — never rewritten to '<'
    expect(field.getText()).toBe('lt'); // non-menu token displays raw (never blank)
    expect(field.saveState()).toBe('lt'); // serializes verbatim
  });

  it('an unknown (non-accepted) token is rejected; the prior value is retained', () => {
    const field = freshField();
    field.setValue('==');
    expect(field.getValue()).toBe('==');
    field.setValue('nope'); // not in menu, not in accept
    expect(field.getValue()).toBe('=='); // rejected — unchanged
  });
});

describe('PALETTE_BLOCKS projects expr.op with field_transon_dropdown (FR-130)', () => {
  interface ArgDef { type: string; name?: string; options?: unknown[]; accept?: string[] }
  interface BlockDef { type: string; args0?: ArgDef[]; args1?: ArgDef[] }

  it('menu is strictly shorter than accept, and accept equals the full metadata options', () => {
    const exprMeta = editorMetadata.catalog.rules.find((r) => r.name === 'expr')!;
    const opMeta = (exprMeta.params as Array<{ name: string; options?: string[] }>).find((p) => p.name === 'op')!;
    const def = (PALETTE_BLOCKS as unknown as BlockDef[]).find((b) => b.type === ruleBlockType('expr', 'base'))!;
    const opArg = [...(def.args0 ?? []), ...(def.args1 ?? [])].find((a) => a.name === 'op')!;
    expect(opArg.type).toBe('field_transon_dropdown');
    expect(opArg.accept).toEqual(opMeta.options);
    expect((opArg.options ?? []).length).toBeLessThan((opMeta.options ?? []).length);
  });
});

describe('codec-emitted alias round-trips through a headless workspace (FR-130)', () => {
  let workspace: Blockly.Workspace;
  beforeAll(() => {
    registerTransonBlocks();
    workspace = new Blockly.Workspace();
  });

  it('loads fields.op="and" then Blockly save() returns fields.op==="and" verbatim', () => {
    const block = {
      type: ruleBlockType('expr', 'value'),
      fields: { op: 'and' },
      inputs: { value: { block: { type: 'transon_literal', fields: { VALUE: 1 } } } },
    };
    expect(() => loadCodecOutput(block, workspace)).not.toThrow();
    const top = workspace.getTopBlocks(false)[0]!;
    expect(top.getFieldValue('op')).toBe('and');
    const saved = Blockly.serialization.workspaces.save(workspace) as {
      blocks: { blocks: Array<{ fields?: { op?: unknown } }> };
    };
    expect(saved.blocks.blocks[0]!.fields!.op).toBe('and');
  });
});
