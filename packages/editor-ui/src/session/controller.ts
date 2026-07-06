// EditorController — the framework-agnostic orchestrator that binds the EditorSession store, the
// interactive Blockly mount, and the host engine (ARCHITECTURE §6). Both the React shell (D2) and
// the vanilla createTransonEditor()/<transon-editor> surface (D6) drive this same object, so all the
// data-flow logic lives here, not in React.

import { encode } from '@transon/editor-core';
import type { Json, ValidationResult, ExecutionResult } from '@transon/editor-core';
import { createEditorStore, type EditorStore } from './store.js';
import { DEFAULT_MARKER, type EditorMode } from './types.js';
import { applyEngineStatus, loadEngineVersions } from './engine-status.js';
import { runForward, applyForward, debounce, isEmptyWorkspace } from './forward.js';
import { validateTemplate } from './validate.js';
import { executeTemplate } from './execute.js';
import { tryReverse } from './reverse.js';
import { mountBlockly, type TransonMount } from '../blockly/mount.js';
import type { ToolboxView } from '../blockly/toolbox.js';
import { highlightErrors, clearHighlights } from '../blockly/highlight.js';
import { createLatestGuard } from './latest.js';
import type { TransonEditorHost, ExampleCase } from './host.js';

/** The toolbar actions an embedder can hide (FR-136). Hidden = not rendered (vs read-only = disabled).
 *  Canonical runtime list — the `ToolbarActionId` type derives from it, so a new action id is added
 *  in exactly one place and consumers (e.g. the `<transon-editor>` attribute parser) stay in sync. */
export const TOOLBAR_ACTION_IDS = ['new', 'import', 'copy', 'download', 'validate', 'run'] as const;
export type ToolbarActionId = (typeof TOOLBAR_ACTION_IDS)[number];

export interface EditorControllerOptions {
  host: TransonEditorHost;
  mode?: EditorMode;
  template?: Json;
  input?: Json;
  readOnly?: boolean;
  /** Hide individual toolbar actions (FR-136): a hidden action is NOT rendered — distinct from
   *  `readOnly`, which disables. Compose with `onBack` / no palette chrome for a minimal embed. */
  hideToolbarActions?: ToolbarActionId[];
  /** Optional host-provided LEADING toolbar action (FR-137): when supplied, the editor renders it as
   *  the FIRST toolbar item and invokes this callback on activation. The editor performs no
   *  navigation itself (AD-008) — the host owns routing (e.g. docs-site "Back to docs"). */
  onBack?(): void;
  /** Label for the `onBack` leading action (default `"Back"`). */
  backLabel?: string;
  /** Initial palette view (FR-138): open in this progressive-disclosure state (advanced-blocks
   *  shown + search seed) instead of the default, so an embed can present all blocks with the
   *  palette search/advanced chrome omitted (§12.6). */
  paletteView?: ToolboxView;
  /** Omit the palette search box + advanced-blocks toggle from the toolbar (FR-138): pair with
   *  `paletteView:{showAdvanced:true}` for an embed that shows all blocks with no palette chrome.
   *  Consumed by the React shell (`<TransonEditor>`), not the controller itself. */
  hidePaletteControls?: boolean;
  /** Fired with the current generated template after each projection (FR-104). */
  onChange?(template: Json | null): void;
  /** Fired with the engine's `ValidationResult` after Validate (ARCHITECTURE §5.3, FR-011/105). */
  onValidate?(result: ValidationResult): void;
  /** Fired with the engine's `ExecutionResult` after Run (ARCHITECTURE §5.3, FR-011/106). */
  onExecute?(result: ExecutionResult): void;
  /** Called before an action would REPLACE a non-empty workspace (New / Import). Return `false` to
   *  abort (FR-101). Defaults to `window.confirm`; a host can supply a custom confirmation. */
  confirmReplace?(): boolean;
  /** Forward-projection debounce (ms). Default 150. */
  debounceMs?: number;
  /** Autorun (FR-135): when true, re-execute the template against the current sample input on every
   *  accepted template change and on every sample-input change — debounced per NFR-027 — keeping the
   *  Output panel live without an explicit Run. Gated on a ready engine + valid input (§10.4, §16.4). */
  autorun?: boolean;
}

export interface EditorController {
  readonly store: EditorStore;
  /** Current generated canonical template (null when empty/ungenerated). */
  getTemplate(): Json | null;
  /** Load a document into the canvas (New / Import / Load-Example reverse path). Engine-gated. */
  setTemplate(doc: Json): Promise<void>;
  /** Clear the canvas (New). Warns before discarding a non-empty workspace (FR-101). */
  newWorkspace(): void;
  /** Import a Transon JSON string (paste/file, FR-096/007): warns before replacing a non-empty
   *  workspace (FR-101), then loads via the strict §7.15 gate (invalid/out-of-surface → error,
   *  workspace unchanged). */
  importText(text: string): Promise<void>;
  /** Copy the generated canonical template to the clipboard (FR-097/008). Resolves `false` when
   *  there is nothing to copy or the clipboard is unavailable. */
  copyTemplate(): Promise<boolean>;
  /** Download the generated canonical template as a JSON file (FR-098/008, §11.6 canonical-only).
   *  Returns `false` when there is nothing to download. */
  downloadTemplate(filename?: string): boolean;
  /** Load a documentation example: its template onto the canvas, its sample input, and its expected
   *  output for actual-vs-expected display (FR-009/099, AC-018/019). Engine-gated. */
  loadExample(example: ExampleCase): Promise<void>;
  /** Set the sample input from raw panel text; surfaces `json_input` on invalid JSON (§16.4). */
  setInputText(text: string): void;
  /** Strict bidirectional JSON edit (§7.15): a valid in-surface edit syncs to the workspace; an
   *  invalid/out-of-surface edit is reported and the workspace is left unchanged. Debounced. */
  setTemplateText(text: string): void;
  setMode(mode: EditorMode): void;
  /** Toggle read-only mode at runtime (FR-107): the mounted workspace and the §7.15 JSON-panel
   *  reverse sync both follow, so a controlled embed flipping the prop stays consistent. */
  setReadOnly(readOnly: boolean): void;
  /** Update the palette progressive-disclosure view — advanced toggle + search (§12.6). */
  setPaletteView(view: ToolboxView): void;
  /** Validate the current template through the host engine (§6.4). */
  validate(): Promise<void>;
  /** Execute the current template against the sample input (§6.4). */
  run(): Promise<void>;
  dispose(): void;
}

export function createEditorController(
  container: HTMLElement,
  opts: EditorControllerOptions,
): EditorController {
  const { host } = opts;
  const marker = host.marker ?? DEFAULT_MARKER;
  const engine = host.engine;

  const store = createEditorStore({
    marker,
    editor_mode: opts.mode ?? 'sandbox',
    sample_input_json: opts.input ?? null,
  });

  // Live read-only flag (FR-107): initialized from the option, flipped at runtime via setReadOnly.
  let readOnly = opts.readOnly ?? false;

  // Latest-call guard shared by the forward projection and the §7.15 reverse sync (§17.8
  // stale-result safety): both mutate workspace/template state, so an older async completion
  // (runForward/tryReverse resolving out of order) must not overwrite a newer one's result.
  const beginSync = createLatestGuard<EditorStore>();

  // Re-project the live workspace into the session (forward, one-way). Used by the change listener
  // (debounced) and by programmatic loads (immediate).
  const project = async (): Promise<void> => {
    const isCurrent = beginSync(store);
    const workspace = mount.serialize();
    store.setState({ workspace, json_sync_status: 'in_sync' });
    const forward = await runForward(engine, workspace, marker);
    if (!isCurrent() || disposed) return; // superseded, or teardown won the race: drop the stale result
    applyForward(store, forward);
    clearHighlights(mount.workspace); // a new generation supersedes prior error highlights
    opts.onChange?.(store.getState().template_json);
  };
  const debouncedProject = debounce(() => void project(), opts.debounceMs ?? 150);

  const mount: TransonMount = mountBlockly(container, {
    readOnly,
    categories: host.categories,
    view: opts.paletteView, // FR-138: open in the seeded palette view (advanced-shown / search)
    onWorkspaceChange: () => debouncedProject(),
  });

  // Reverse §7.15 path: try to sync an edited JSON string back to the workspace. On accept, load the
  // candidate block and re-project (in_sync); on reject, leave the workspace untouched and surface
  // the error marked out_of_sync (FR-112/113, AD-024).
  const applyReverse = async (text: string): Promise<void> => {
    if (!engine || engine.status !== 'ready') return; // gated; the panel is read-only when not ready
    const isCurrent = beginSync(store);
    const outcome = await tryReverse(engine, text, marker);
    if (!isCurrent() || disposed) return; // superseded, or teardown won the race: drop the stale outcome
    if (outcome.status === 'accepted') {
      mount.loadDocument(outcome.block);
      await project(); // sets workspace/template_json, json_sync in_sync, clears errors + highlights
    } else {
      store.setState({ json_sync_status: 'out_of_sync', errors: [outcome.error] });
    }
  };
  const debouncedReverse = debounce((text: string) => void applyReverse(text), opts.debounceMs ?? 150);

  // FR-101: warn before an action replaces a non-empty workspace. An empty workspace has nothing to
  // lose (no prompt). Defaults to window.confirm; a host can override via opts.confirmReplace.
  const guardReplace = (): boolean => {
    if (isEmptyWorkspace(store.getState().workspace)) return true;
    if (opts.confirmReplace) return opts.confirmReplace();
    if (typeof globalThis.confirm === 'function') {
      return globalThis.confirm('Discard unsaved changes to the current template?');
    }
    return true;
  };

  // Eager engine init + status polling (Q2: the reference Pyodide host loads on mount). The port has
  // no status event, so poll while idle/loading; re-project when it *becomes* `ready` so generation
  // appears, and reflect the status into the gating each tick (NFR-028/AC-023/§10.4).
  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let inputInvalid = false; // last setInputText could not parse (§16.4 json_input)
  // Initial opts.template awaiting a ready engine (FR-102): loadDocumentSafely is engine-gated, so
  // with an async host (e.g. the Pyodide reference host) the engine is still idle/loading at
  // construction — refreshStatus consumes this on the idle/loading→ready transition.
  let pendingInitialTemplate: Json | undefined = opts.template;
  const refreshStatus = (): void => {
    if (disposed) return;
    const before = store.getState().engine_runtime_status;
    applyEngineStatus(store, engine);
    const now = store.getState().engine_runtime_status;
    if (now === 'ready' && before !== 'ready') {
      if (pendingInitialTemplate !== undefined) {
        // Deferred initial template (FR-102): load it now that the codec can run; loadDocumentSafely
        // ends in project(), so the plain re-projection below would be redundant.
        const doc = pendingInitialTemplate;
        pendingInitialTemplate = undefined;
        void loadDocumentSafely(doc);
      } else {
        void project();
      }
    }
    // Load engine + metadata versions once ready (FR-080 diagnostics); idempotent, load once.
    if (now === 'ready' && store.getState().engine_version === null) void loadEngineVersions(store, engine);
    if (engine && (engine.status === 'idle' || engine.status === 'loading')) {
      statusTimer = setTimeout(refreshStatus, 200);
    }
  };

  if (engine) {
    void Promise.resolve(engine.init()).catch(() => {
      /* init failure surfaces via status === 'failed' on the next poll (§17.9) */
    });
  }
  applyEngineStatus(store, engine); // initial gating (absent/idle/loading → projection disabled)
  void project(); // initial projection: `unavailable` when not ready, `empty`/generated when ready
  if (engine) refreshStatus(); // poll for the ready transition

  // Optional initial template (FR-102). Loaded now only when the engine is already ready (e.g. the
  // synchronous test host); otherwise it stays pending and refreshStatus loads it on the ready
  // transition above — without this the engine-gated loadDocumentSafely would silently drop it.
  if (pendingInitialTemplate !== undefined && engine?.status === 'ready') {
    const doc = pendingInitialTemplate;
    pendingInitialTemplate = undefined;
    void loadDocumentSafely(doc);
  }

  async function loadDocumentSafely(doc: Json): Promise<void> {
    // Reverse path (New/Import/Load-Example): encode the document to a workspace block and project
    // it onto the canvas. Engine-gated — without a ready engine the codec cannot run. The strict
    // §7.15 JSON-panel accept/reject (surface check) is layered on in D5 (reverse.ts).
    if (engine && engine.status === 'ready') {
      const isCurrent = beginSync(store);
      const block = await encode(engine, doc, marker);
      if (!isCurrent() || disposed) return; // superseded, or teardown won the race, while encoding: drop it (§17.8)
      mount.loadDocument(block);
      await project();
    }
  }

  // Shared execution used by both the Run action and autorun (FR-135). §16.4 json_input: a bad
  // sample input blocks execution (don't run on stale/last-valid input).
  async function runExecution(): Promise<void> {
    if (inputInvalid) {
      store.setState({
        execution_status: 'error',
        errors: [{ code: 'json_input', message: 'Sample input is not valid JSON' }],
      });
      return;
    }
    const result = await executeTemplate(store, engine, marker, {
      includeLoader: host.includeLoader,
      includes: host.includes,
    });
    if (disposed) return; // teardown won the race: don't touch the destroyed workspace / fire callbacks
    highlightErrors(mount.workspace, store.getState().block_map, store.getState().errors);
    if (result) opts.onExecute?.(result);
  }

  // Autorun (FR-135): re-execute whenever the execution inputs change — the generated template (set
  // by project()) or the sample input (setInputText). Subscribing to the store keeps this at a
  // single source; executeTemplate no-ops when gated (engine not ready / no template), and an
  // execution only writes execution_*/errors (never template_json/sample_input_json), so there is no
  // feedback loop. Debounced per NFR-027.
  let autorunDebounced: { (): void; cancel(): void } | undefined;
  let unsubscribeAutorun: (() => void) | undefined;
  if (opts.autorun) {
    autorunDebounced = debounce(() => void runExecution(), opts.debounceMs ?? 150);
    let prevTemplate = store.getState().template_json;
    let prevInput = store.getState().sample_input_json;
    unsubscribeAutorun = store.subscribe((s) => {
      if (disposed) return;
      if (s.template_json !== prevTemplate || s.sample_input_json !== prevInput) {
        prevTemplate = s.template_json;
        prevInput = s.sample_input_json;
        autorunDebounced!();
      }
    });
  }

  return {
    store,
    getTemplate: () => store.getState().template_json,
    setTemplate: (doc) => loadDocumentSafely(doc),
    newWorkspace() {
      if (!guardReplace()) return; // FR-101: keep the current workspace if the user cancels
      // Programmatic clear suppresses the workspace-change event, so invalidate any in-flight
      // project()/applyReverse()/encode explicitly — a slow completion must not repopulate the
      // canvas or the store after the clear (§17.8).
      beginSync(store);
      mount.clear();
      store.setState({
        workspace: mount.serialize(),
        template_json: null,
        execution_output_json: null,
        files_written: null,
        generation_status: 'empty',
        validation_status: store.getState().engine_runtime_status === 'ready' ? 'idle' : 'disabled',
        execution_status: store.getState().engine_runtime_status === 'ready' ? 'idle' : 'disabled',
        errors: [],
        json_sync_status: 'in_sync',
        selected_example: null,
        expected_output_json: null,
      });
      opts.onChange?.(null);
    },
    async importText(text) {
      if (!guardReplace()) return; // FR-101
      await applyReverse(text); // strict §7.15 gate (parse→encode→surface→round-trip)
    },
    async copyTemplate() {
      const template = store.getState().template_json;
      if (template == null) return false;
      const text = JSON.stringify(template, null, 2);
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false; // clipboard blocked/unavailable — the caller may fall back to Download
      }
    },
    downloadTemplate(filename = 'template.transon.json') {
      const template = store.getState().template_json;
      if (template == null) return false;
      // Export the canonical Transon JSON only — no workspace/UI-state bundle (§11.6, OQ-002).
      const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return true;
    },
    async loadExample(example) {
      // Record the example's input + expected output first, then load its template (engine-gated).
      // A fresh execution is required to compare actual vs expected (§12.9), so clear prior output.
      store.setState({
        selected_example: example.name,
        sample_input_json: example.data ?? null,
        expected_output_json: example.result ?? null,
        execution_output_json: null,
        execution_status: store.getState().engine_runtime_status === 'ready' ? 'idle' : 'disabled',
        errors: [],
      });
      inputInvalid = false;
      await loadDocumentSafely(example.template);
    },
    setInputText(text) {
      if (text.trim() === '') {
        inputInvalid = false;
        store.setState({
          sample_input_json: null,
          errors: store.getState().errors.filter((e) => e.code !== 'json_input'),
        });
        return;
      }
      try {
        const parsed = JSON.parse(text) as Json;
        inputInvalid = false;
        store.setState({
          sample_input_json: parsed,
          errors: store.getState().errors.filter((e) => e.code !== 'json_input'),
        });
      } catch (e) {
        inputInvalid = true;
        store.setState({
          errors: [{ code: 'json_input', message: `Invalid input JSON: ${(e as Error).message}` }],
        });
      }
    },
    setTemplateText(text) {
      if (readOnly) return; // read-only mode: the JSON panel does not sync edits back (FR-107)
      store.setState({ json_sync_status: 'editing' });
      debouncedReverse(text);
    },
    setMode(mode) {
      store.setState({ editor_mode: mode });
    },
    setReadOnly(next) {
      readOnly = next;
      mount.setReadOnly(next); // keep the injected workspace in step with the shell (FR-107)
    },
    setPaletteView(view) {
      mount.setToolboxView(view);
    },
    async validate() {
      const result = await validateTemplate(store, engine, marker);
      if (disposed) return; // teardown won the race: don't touch the destroyed workspace / fire callbacks
      highlightErrors(mount.workspace, store.getState().block_map, store.getState().errors);
      if (result) opts.onValidate?.(result);
    },
    run: runExecution,
    dispose() {
      disposed = true;
      if (statusTimer) clearTimeout(statusTimer);
      debouncedProject.cancel();
      debouncedReverse.cancel();
      autorunDebounced?.cancel();
      unsubscribeAutorun?.();
      mount.dispose();
    },
  };
}
