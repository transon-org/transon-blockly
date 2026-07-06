// FR-134: double-clicking a block toggles its collapsed state — a discoverable alternative to the
// native context-menu "Collapse/Expand Block". Collapse is UI-only state (§11.5): the codec reads
// inputs/fields by name and ignores it, so the generated JSON is byte-identical collapsed vs
// expanded. Extracted from the mount so the detection is unit-testable without driving Blockly's
// event queue (whose synthetic-delivery timing is unreliable under jsdom).
//
// Why CLICK events (not a DOM `dblclick`): Blockly's per-block gesture swallows a raw DOM double
// click, but it emits a `Click` ui-event per click that rides that same gesture. Two clicks on one
// block within the threshold is the double-click.
//
// Why the toggle is deferred to a macrotask: the CLICK fires mid-gesture (on pointerup), and
// mutating the block synchronously there is reverted as Blockly finishes the gesture — letting it
// settle first makes the collapse stick (verified against the real reference host).

import * as Blockly from 'blockly/core';

/** Default max gap between the two clicks of a double-click, in ms. */
export const DEFAULT_DOUBLE_CLICK_MS = 400;

export interface DoubleClickCollapse {
  /** Feed every workspace change event here; only block `Click`s are acted on. */
  handleEvent(e: Blockly.Events.Abstract): void;
  /** Cancel a pending deferred toggle (call from the mount's dispose). */
  dispose(): void;
}

/**
 * Wire double-click-to-collapse for `workspace`. Returns a change-event handler to register plus a
 * `dispose`. Read-only workspaces (FR-107) and flyout blocks are ignored; the innermost clicked
 * block is whatever Blockly's own hit-testing reports as the click target.
 */
export function collapseOnDoubleClick(
  workspace: Blockly.WorkspaceSvg,
  doubleClickMs = DEFAULT_DOUBLE_CLICK_MS,
): DoubleClickCollapse {
  let lastClick: { id: string; t: number } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  return {
    handleEvent(e) {
      if (e.type !== Blockly.Events.CLICK) return;
      const click = e as Blockly.Events.Click;
      if (workspace.isReadOnly() || click.targetType !== Blockly.Events.ClickTarget.BLOCK) return;
      const id = click.blockId;
      if (!id) return;
      const now = Date.now();
      if (lastClick && lastClick.id === id && now - lastClick.t < doubleClickMs) {
        lastClick = null;
        timer = setTimeout(() => {
          const block = workspace.getBlockById(id);
          if (block && !block.isInFlyout) block.setCollapsed(!block.isCollapsed());
        }, 0);
      } else {
        lastClick = { id, t: now };
      }
    },
    dispose() {
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}
