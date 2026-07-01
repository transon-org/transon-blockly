// Presentational panels for the editor shell (SPEC §12). Each reads EditorSession state and calls
// controller actions; none touch Blockly or the engine directly. Light styling only — the panels
// assert behavior (presence, content, actions), not pixels (NFR-045 baseline; M5 polishes a11y).

import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { EditorSession } from '../session/types.js';
import type { EditorController } from '../session/controller.js';
import { ERROR_CATEGORY } from '../session/errors.js';

function pretty(value: unknown): string {
  if (value == null) return '';
  return JSON.stringify(value, null, 2);
}

/**
 * Generated Transon JSON (§12.7) with strict bidirectional editing (§7.15). When generation is
 * available the panel is an editable textarea: its text reflects the generated JSON while in sync,
 * and a user edit calls back (debounced sync in the controller) and marks out-of-sync until accepted
 * or reverted. When the engine cannot generate, it shows a gated message (read-only).
 */
export function JsonPanel({
  state,
  onEdit,
  readOnly = false,
}: {
  state: EditorSession;
  onEdit?(text: string): void;
  /** Read-only embedding (FR-107): the panel shows the generated JSON but does not sync edits. */
  readOnly?: boolean;
}): JSX.Element {
  const gated = state.generation_status === 'unavailable';
  const generated = pretty(state.template_json);
  const [text, setText] = useState(generated);

  // Reflect a fresh generation into the editor only while in sync (don't clobber an in-progress or
  // rejected edit — §7.15 preserves the user's text until accepted/reverted). Read-only always
  // mirrors the generated JSON (there is no user edit to preserve).
  useEffect(() => {
    if (readOnly || state.json_sync_status === 'in_sync') setText(generated);
  }, [generated, state.json_sync_status, readOnly]);

  return (
    <section
      className="transon-panel transon-json-panel"
      data-testid="json-panel"
      data-sync={state.json_sync_status}
      aria-label="Generated template JSON"
    >
      <header className="transon-panel-title">
        Template JSON{state.json_sync_status === 'out_of_sync' ? ' (out of sync)' : ''}
      </header>
      {gated ? (
        <p className="transon-gated" data-testid="json-gated">
          Generation needs the engine ({state.engine_runtime_status}).
        </p>
      ) : (
        <textarea
          className="transon-code transon-code-input"
          data-testid="json-content"
          value={text}
          spellCheck={false}
          readOnly={readOnly}
          onChange={
            readOnly
              ? undefined
              : (e) => {
                  setText(e.target.value);
                  onEdit?.(e.target.value);
                }
          }
        />
      )}
    </section>
  );
}

/** Sample input JSON (§12.8). Editing + json_input validation is wired in D3. */
export function InputPanel({
  state,
  onInput,
}: {
  state: EditorSession;
  onInput?(text: string): void;
}): JSX.Element {
  return (
    <section className="transon-panel transon-input-panel" data-testid="input-panel" aria-label="Sample input JSON">
      <header className="transon-panel-title">Input JSON</header>
      <textarea
        className="transon-code-input"
        data-testid="input-content"
        defaultValue={pretty(state.sample_input_json)}
        onChange={(e) => onInput?.(e.target.value)}
        spellCheck={false}
      />
    </section>
  );
}

/** Transformation output + errors (§12.9). */
export function OutputPanel({ state }: { state: EditorSession }): JSX.Element {
  return (
    <section className="transon-panel transon-output-panel" data-testid="output-panel" aria-label="Output and errors">
      <header className="transon-panel-title">
        Output / Errors{state.execution_status === 'stale' ? ' (stale)' : ''}
      </header>
      {state.errors.length > 0 ? (
        <ErrorList state={state} />
      ) : (
        <pre className="transon-code" data-testid="output-content">{pretty(state.execution_output_json)}</pre>
      )}
    </section>
  );
}

/** Errors rendered under their §16.4 category label — distinct, not colour-only (FR-095, NFR-045). */
export function ErrorList({ state }: { state: EditorSession }): JSX.Element {
  return (
    <ul className="transon-errors" data-testid="error-list">
      {state.errors.map((err, i) => (
        <li key={i} className="transon-error" data-error-code={err.code}>
          <span className="transon-error-category">{ERROR_CATEGORY[err.code]}</span>
          <span className="transon-error-message">{err.message}</span>
        </li>
      ))}
    </ul>
  );
}

/** Captured `file` writes (§12.11, AC-024). Hidden when the last execution produced none. */
export function FilesPanel({ state }: { state: EditorSession }): JSX.Element | null {
  const files = state.files_written;
  if (!files || Object.keys(files).length === 0) return null;
  return (
    <section className="transon-panel transon-files-panel" data-testid="files-panel" aria-label="Files produced">
      <header className="transon-panel-title">Files produced</header>
      <ul className="transon-files">
        {Object.entries(files).map(([name, content]) => (
          <li key={name} className="transon-file" data-file-name={name}>
            <span className="transon-file-name">{name}</span>
            <pre className="transon-code transon-file-content">{pretty(content)}</pre>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Engine runtime status + sync state (NFR-028, AC-023, §18). */
export function StatusBar({ state }: { state: EditorSession }): JSX.Element {
  return (
    <footer className="transon-statusbar" data-testid="status-bar">
      <span data-testid="engine-status" data-status={state.engine_runtime_status}>
        Engine: {state.engine_runtime_status}
      </span>
      <span data-testid="sync-status" data-sync={state.json_sync_status}>
        JSON: {state.json_sync_status}
      </span>
      {state.engine_version ? <span data-testid="engine-version">v{state.engine_version}</span> : null}
    </footer>
  );
}

export type ViewMode = 'visual' | 'json' | 'split';

/** Toolbar actions (§12.3). D2 wires New + Toggle View; Validate/Run are gated on engine-ready.
 *  Read-only (FR-107) disables the authoring actions (New) while keeping Validate/Run/View. */
export function Toolbar({
  state,
  controller,
  view,
  onView,
  readOnly = false,
}: {
  state: EditorSession;
  controller: EditorController | null;
  view?: ViewMode;
  onView?(v: ViewMode): void;
  readOnly?: boolean;
}): JSX.Element {
  const ready = state.engine_runtime_status === 'ready';
  return (
    <div className="transon-toolbar" data-testid="toolbar" role="toolbar" aria-label="Editor actions">
      <button
        type="button"
        data-testid="btn-new"
        disabled={readOnly}
        onClick={() => controller?.newWorkspace()}
      >
        New
      </button>
      <button
        type="button"
        data-testid="btn-validate"
        disabled={!ready}
        onClick={() => void controller?.validate()}
      >
        Validate
      </button>
      <button
        type="button"
        data-testid="btn-run"
        disabled={!ready}
        onClick={() => void controller?.run()}
      >
        Run
      </button>
      {onView ? (
        <select
          data-testid="view-switch"
          aria-label="View"
          value={view ?? 'visual'}
          onChange={(e) => onView(e.target.value as ViewMode)}
        >
          <option value="visual">Visual</option>
          <option value="json">JSON</option>
          <option value="split">Split</option>
        </select>
      ) : null}
    </div>
  );
}
