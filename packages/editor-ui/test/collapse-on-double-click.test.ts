// FR-134 — double-click-to-collapse detection, unit-tested deterministically against the helper
// (not Blockly's event queue, whose synthetic delivery timing is unreliable under jsdom). Uses fake
// timers so the threshold (Date.now) and the deferred toggle (setTimeout) are exact. End-to-end
// wiring is covered by collapse.test.ts + a real-browser Playwright pass.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Blockly from 'blockly/core';
import { collapseOnDoubleClick } from '../src/blockly/collapse-on-double-click.js';

/** Minimal fake matching what the helper reads off a WorkspaceSvg. */
interface FakeBlock {
  id: string;
  collapsed: boolean;
  inFlyout: boolean;
  isInFlyout: boolean;
  isCollapsed(): boolean;
  setCollapsed(v: boolean): void;
}
function fakeBlock(id: string, inFlyout = false): FakeBlock {
  return {
    id,
    collapsed: false,
    inFlyout,
    isInFlyout: inFlyout,
    isCollapsed() {
      return this.collapsed;
    },
    setCollapsed(v: boolean) {
      this.collapsed = v;
    },
  };
}
function fakeWorkspace(blocks: FakeBlock[], readOnly = false): Blockly.WorkspaceSvg {
  return {
    id: 'ws',
    isReadOnly: () => readOnly,
    getBlockById: (id: string) => blocks.find((b) => b.id === id) ?? null,
  } as unknown as Blockly.WorkspaceSvg;
}
/** A block CLICK ui-event, as Blockly emits one per click. */
function clickEvent(blockId: string): Blockly.Events.Abstract {
  return {
    type: Blockly.Events.CLICK,
    blockId,
    targetType: Blockly.Events.ClickTarget.BLOCK,
  } as unknown as Blockly.Events.Abstract;
}

describe('collapseOnDoubleClick (FR-134)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('two quick clicks on the same block collapse it (deferred to a macrotask)', () => {
    const block = fakeBlock('a');
    const dc = collapseOnDoubleClick(fakeWorkspace([block]));
    dc.handleEvent(clickEvent('a'));
    dc.handleEvent(clickEvent('a'));
    expect(block.collapsed).toBe(false); // not yet — the toggle is deferred
    vi.advanceTimersByTime(1); // run the setTimeout(0)
    expect(block.collapsed).toBe(true);
  });

  it('a second double-click expands a collapsed block', () => {
    const block = fakeBlock('a');
    const dc = collapseOnDoubleClick(fakeWorkspace([block]));
    dc.handleEvent(clickEvent('a'));
    dc.handleEvent(clickEvent('a'));
    vi.advanceTimersByTime(1);
    expect(block.collapsed).toBe(true);
    dc.handleEvent(clickEvent('a'));
    dc.handleEvent(clickEvent('a'));
    vi.advanceTimersByTime(1);
    expect(block.collapsed).toBe(false);
  });

  it('two clicks beyond the threshold are two singles — no collapse', () => {
    const block = fakeBlock('a');
    const dc = collapseOnDoubleClick(fakeWorkspace([block]), 400);
    dc.handleEvent(clickEvent('a'));
    vi.advanceTimersByTime(450); // > threshold
    dc.handleEvent(clickEvent('a'));
    vi.advanceTimersByTime(1);
    expect(block.collapsed).toBe(false);
  });

  it('clicks on two different blocks do not collapse either', () => {
    const a = fakeBlock('a');
    const b = fakeBlock('b');
    const dc = collapseOnDoubleClick(fakeWorkspace([a, b]));
    dc.handleEvent(clickEvent('a'));
    dc.handleEvent(clickEvent('b'));
    vi.advanceTimersByTime(1);
    expect(a.collapsed).toBe(false);
    expect(b.collapsed).toBe(false);
  });

  it('read-only workspace: a double-click does not collapse (FR-107)', () => {
    const block = fakeBlock('a');
    const dc = collapseOnDoubleClick(fakeWorkspace([block], true));
    dc.handleEvent(clickEvent('a'));
    dc.handleEvent(clickEvent('a'));
    vi.advanceTimersByTime(1);
    expect(block.collapsed).toBe(false);
  });

  it('a flyout (palette) block is never collapsed', () => {
    const block = fakeBlock('a', true);
    const dc = collapseOnDoubleClick(fakeWorkspace([block]));
    dc.handleEvent(clickEvent('a'));
    dc.handleEvent(clickEvent('a'));
    vi.advanceTimersByTime(1);
    expect(block.collapsed).toBe(false);
  });

  it('non-block clicks (workspace/zoom) are ignored', () => {
    const block = fakeBlock('a');
    const dc = collapseOnDoubleClick(fakeWorkspace([block]));
    const wsClick = {
      type: Blockly.Events.CLICK,
      targetType: Blockly.Events.ClickTarget.WORKSPACE,
    } as unknown as Blockly.Events.Abstract;
    dc.handleEvent(wsClick);
    dc.handleEvent(wsClick);
    vi.advanceTimersByTime(1);
    expect(block.collapsed).toBe(false);
  });

  it('dispose() cancels a pending deferred toggle', () => {
    const block = fakeBlock('a');
    const dc = collapseOnDoubleClick(fakeWorkspace([block]));
    dc.handleEvent(clickEvent('a'));
    dc.handleEvent(clickEvent('a')); // schedules the toggle
    dc.dispose(); // ...cancelled before it runs
    vi.advanceTimersByTime(1);
    expect(block.collapsed).toBe(false);
  });
});
