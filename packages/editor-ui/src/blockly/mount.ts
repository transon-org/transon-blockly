// Interactive Blockly mount (AD-017 Zelos, AD-018 light DOM + scoped CSS). This is the only place
// the editor injects a *rendered* Blockly workspace; the M3 gates were headless (new Workspace()).
//
// Boundary (ARCHITECTURE §5.1): @transon/editor-blockly owns the block definitions + runtime +
// (de)serialization helpers; this module owns the mounted SVG instance, change-listener wiring, and
// the workspace↔document bridge. The codec/decoder logic is NOT here — the store runs core's
// decode()/encode() through the host engine (AD-008/AD-032).

import * as Blockly from 'blockly/core';
import * as En from 'blockly/msg/en';
import { ZoomToFitControl } from '@blockly/zoom-to-fit';
import { PositionedMinimap } from '@blockly/workspace-minimap';
import type { Json } from '@transon/editor-core';
import { registerTransonBlocks, getTransonToolbox, loadCodecOutput } from '@transon/editor-blockly';
import {
  filterToolbox,
  progressiveToolbox,
  type ToolboxCategoryConfig,
  type ToolboxView,
} from './toolbox.js';
import { ensureTransonStyles } from '../styles.js';
import { TRANSON_THEME, TRANSON_RENDERER } from './theme.js';

/** Scoped root class applied to the host container (AD-018: light DOM, scoped CSS prefix). */
export const TRANSON_ROOT_CLASS = 'transon-editor';

let blocklyReady = false;
/** Idempotently load the English messages (Blockly.inject needs Msg, e.g. WORKSPACE_ARIA_LABEL) and
 *  register the Transon block definitions + behavior runtime. */
export function ensureBlocklyReady(): void {
  if (!blocklyReady) {
    Blockly.setLocale(En as unknown as Record<string, string>);
    blocklyReady = true;
  }
  registerTransonBlocks();
}

export interface TransonMountOptions {
  /** Read-only canvas (FR-107). */
  readOnly?: boolean;
  /** Hide/reorder the §12.4 toolbox categories (FR-109). */
  categories?: ToolboxCategoryConfig;
  /** Initial progressive-disclosure view — advanced toggle + search (§12.6). */
  view?: ToolboxView;
  /** Fired on a meaningful (non-UI, non-programmatic) workspace edit, with the serialized envelope. */
  onWorkspaceChange?(workspace: Json): void;
}

export interface TransonMount {
  readonly workspace: Blockly.WorkspaceSvg;
  /** The current Blockly workspace-serialization envelope (`save()`), the forward-flow input. */
  serialize(): Json;
  /** Replace the canvas contents from a bare codec block (New/Import/accepted §7.15 sync). Reverse
   *  path: programmatic, so change events are suppressed to avoid a forward-flow feedback loop. */
  loadDocument(block: Json): void;
  /** Clear the canvas (New). */
  clear(): void;
  /** Update the palette view — advanced-blocks toggle + search (§12.6). Re-projects the toolbox. */
  setToolboxView(view: ToolboxView): void;
  /** Toggle read-only after mount (FR-107): controlled embeds can flip the prop at runtime, and the
   *  injected workspace must follow (Blockly 13 `WorkspaceSvg.setIsReadOnly`). */
  setReadOnly(readOnly: boolean): void;
  dispose(): void;
}

/**
 * Inject a rendered Zelos workspace into `container` (light DOM). Returns a handle that serializes
 * the workspace, loads a codec block, clears, and disposes. The change listener fires
 * `onWorkspaceChange` only for genuine user edits — UI-only events (selection/viewport) and our own
 * programmatic loads are filtered out.
 */
export function mountBlockly(container: HTMLElement, opts: TransonMountOptions = {}): TransonMount {
  ensureBlocklyReady();
  ensureTransonStyles(); // scoped light-DOM stylesheet (AD-018, NFR-045 contrast + focus)
  container.classList.add(TRANSON_ROOT_CLASS);

  // Base toolbox = the committed §12.4 toolbox with the embedder's category config applied (FR-109);
  // the progressive-disclosure view (advanced/search, §12.6) is layered on top and can change later.
  const baseToolbox = filterToolbox(getTransonToolbox(), opts.categories);
  let view: ToolboxView = opts.view ?? {};
  const workspace = Blockly.inject(container, {
    toolbox: progressiveToolbox(baseToolbox, view) as Blockly.utils.toolbox.ToolboxDefinition,
    renderer: TRANSON_RENDERER, // thrasos — conventional puzzle connections (AD-017/AD-033, FR-129)
    theme: TRANSON_THEME, // block-surface theme: font + surface; colours stay data-driven (FR-127)
    readOnly: opts.readOnly ?? false,
    trashcan: true,
    // FR-133 (§7.17, AC-041(a), NFR-029): canvas navigation for large templates. Zoom/scroll are
    // UI-only state (§11.5) — never part of the exported template (§11.6).
    zoom: { controls: true, wheel: true, pinch: true, startScale: 0.9, minScale: 0.2, maxScale: 3 },
    move: { scrollbars: true, drag: true, wheel: true },
  });

  // FR-133 zoom-to-fit — one-action framing of the whole template (@blockly/zoom-to-fit).
  const zoomToFit = new ZoomToFitControl(workspace);
  zoomToFit.init();

  // FR-133 minimap — overview of large templates (OQ-020, @blockly/workspace-minimap).
  const minimap = new PositionedMinimap(workspace);
  minimap.init();

  let suppress = false;
  const serialize = (): Json => Blockly.serialization.workspaces.save(workspace) as Json;

  const listener = (e: Blockly.Events.Abstract): void => {
    if (suppress) return;
    if (e.isUiEvent) return; // ignore selection/viewport/click (no semantic change)
    if (workspace.isDragging()) return; // wait until a drag settles
    opts.onWorkspaceChange?.(serialize());
  };
  workspace.addChangeListener(listener);

  /** Run a programmatic mutation with change events suppressed (no forward-flow feedback loop). */
  const programmatic = (fn: () => void): void => {
    suppress = true;
    Blockly.Events.disable();
    try {
      fn();
    } finally {
      Blockly.Events.enable();
      suppress = false;
    }
  };

  return {
    workspace,
    serialize,
    loadDocument(block) {
      programmatic(() => loadCodecOutput(block, workspace));
    },
    clear() {
      programmatic(() => workspace.clear());
    },
    setToolboxView(next) {
      view = next;
      workspace.updateToolbox(
        progressiveToolbox(baseToolbox, view) as Blockly.utils.toolbox.ToolboxDefinition,
      );
    },
    setReadOnly(readOnly) {
      workspace.setIsReadOnly(readOnly);
    },
    dispose() {
      minimap.dispose(); // FR-133 — tear down the navigation plugins before the workspace itself
      zoomToFit.dispose();
      workspace.removeChangeListener(listener);
      workspace.dispose();
    },
  };
}
