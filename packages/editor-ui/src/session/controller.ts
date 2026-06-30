// EditorController — the framework-agnostic orchestrator that binds the EditorSession store, the
// interactive Blockly mount, and the host engine (ARCHITECTURE §6). Both the React shell (D2) and
// the vanilla createTransonEditor()/<transon-editor> surface (D6) drive this same object, so all the
// data-flow logic lives here, not in React.

import { encode } from '@transon/editor-core';
import type { Json } from '@transon/editor-core';
import { createEditorStore, type EditorStore } from './store.js';
import { DEFAULT_MARKER, type EditorMode } from './types.js';
import { applyEngineStatus } from './engine-status.js';
import { runForward, applyForward, debounce } from './forward.js';
import { validateTemplate } from './validate.js';
import { executeTemplate, type ExecuteOptions } from './execute.js';
import { mountBlockly, type TransonMount } from '../blockly/mount.js';
import type { TransonEditorHost } from './host.js';

export interface EditorControllerOptions {
  host: TransonEditorHost;
  mode?: EditorMode;
  template?: Json;
  input?: Json;
  readOnly?: boolean;
  onChange?(template: Json | null): void;
  onValidate?(): void;
  onExecute?(): void;
  /** Forward-projection debounce (ms). Default 150. */
  debounceMs?: number;
  /** Host include resolver passed to execute (AD-010, §16.6). */
  includeLoader?: ExecuteOptions['includeLoader'];
}

export interface EditorController {
  readonly store: EditorStore;
  /** Current generated canonical template (null when empty/ungenerated). */
  getTemplate(): Json | null;
  /** Load a document into the canvas (New / Import / Load-Example reverse path). Engine-gated. */
  setTemplate(doc: Json): Promise<void>;
  /** Clear the canvas (New). */
  newWorkspace(): void;
  setInput(input: Json | null): void;
  setMode(mode: EditorMode): void;
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

  // Re-project the live workspace into the session (forward, one-way). Used by the change listener
  // (debounced) and by programmatic loads (immediate).
  const project = async (): Promise<void> => {
    const workspace = mount.serialize();
    store.setState({ workspace, json_sync_status: 'in_sync' });
    applyForward(store, await runForward(engine, workspace, marker));
    opts.onChange?.(store.getState().template_json);
  };
  const debouncedProject = debounce(() => void project(), opts.debounceMs ?? 150);

  const mount: TransonMount = mountBlockly(container, {
    readOnly: opts.readOnly,
    onWorkspaceChange: () => debouncedProject(),
  });

  // Eager engine init + status polling (Q2: the reference Pyodide host loads on mount). The port has
  // no status event, so poll while idle/loading; re-project when it *becomes* `ready` so generation
  // appears, and reflect the status into the gating each tick (NFR-028/AC-023/§10.4).
  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const refreshStatus = (): void => {
    if (disposed) return;
    const before = store.getState().engine_runtime_status;
    applyEngineStatus(store, engine);
    const now = store.getState().engine_runtime_status;
    if (now === 'ready' && before !== 'ready') void project();
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

  // Optional initial template.
  if (opts.template !== undefined) void loadDocumentSafely(opts.template);

  async function loadDocumentSafely(doc: Json): Promise<void> {
    // Reverse path (New/Import/Load-Example): encode the document to a workspace block and project
    // it onto the canvas. Engine-gated — without a ready engine the codec cannot run. The strict
    // §7.15 JSON-panel accept/reject (surface check) is layered on in D5 (reverse.ts).
    if (engine && engine.status === 'ready') {
      const block = await encode(engine, doc, marker);
      mount.loadDocument(block);
      await project();
    }
  }

  return {
    store,
    getTemplate: () => store.getState().template_json,
    setTemplate: (doc) => loadDocumentSafely(doc),
    newWorkspace() {
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
      });
      opts.onChange?.(null);
    },
    setInput(input) {
      store.setState({ sample_input_json: input });
    },
    setMode(mode) {
      store.setState({ editor_mode: mode });
    },
    async validate() {
      await validateTemplate(store, engine, marker);
      opts.onValidate?.();
    },
    async run() {
      await executeTemplate(store, engine, marker, { includeLoader: opts.includeLoader });
      opts.onExecute?.();
    },
    dispose() {
      disposed = true;
      if (statusTimer) clearTimeout(statusTimer);
      debouncedProject.cancel();
      mount.dispose();
    },
  };
}
