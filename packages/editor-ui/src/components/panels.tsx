// Presentational panels for the editor shell (SPEC §12). Each reads EditorSession state and calls
// controller actions; none touch Blockly or the engine directly. Light styling only — the panels
// assert behavior (presence, content, actions), not pixels (NFR-045 baseline; M5 polishes a11y).

import { useEffect, useState } from 'react';
import type { ChangeEvent, JSX } from 'react';
import { stableStringify, metadataVersion } from '@transon/editor-core';
import type { EditorSession } from '../session/types.js';
import type { EditorController } from '../session/controller.js';
import type { ExampleCase } from '../session/host.js';
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
  // The user is actively editing (textarea focused, FR-131). While true, even an ACCEPTED edit
  // must not rewrite the text — the accept flips the session to in_sync with freshly generated
  // JSON, and reflecting it mid-typing reformats the text under the user's cursor.
  const [editing, setEditing] = useState(false);

  // Reflect a fresh generation into the editor only while in sync AND not actively edited
  // (FR-131): an accepted mid-typing edit keeps the user's exact text; the canonical form appears
  // when editing ends (blur — `editing` leaves the deps re-running this effect) or on a change
  // from another source (canvas/New/Import, which move focus away). A rejected edit stays
  // preserved until accepted or reverted (§7.15, FR-113). Read-only always mirrors the generated
  // JSON (there is no user edit to preserve).
  useEffect(() => {
    if (readOnly || (state.json_sync_status === 'in_sync' && !editing)) setText(generated);
  }, [generated, state.json_sync_status, readOnly, editing]);

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
          aria-label="Generated template JSON"
          value={text}
          spellCheck={false}
          readOnly={readOnly}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
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
        aria-label="Sample input JSON"
        defaultValue={pretty(state.sample_input_json)}
        onChange={(e) => onInput?.(e.target.value)}
        spellCheck={false}
      />
    </section>
  );
}

/**
 * Transformation output + errors (§12.9), with actual-vs-expected for a loaded example (AC-019). When
 * an example with an expected `result` is loaded, the expected output is shown alongside the actual
 * and — after a successful run — a text match/differ label (not colour-only, NFR-045).
 */
export function OutputPanel({ state }: { state: EditorSession }): JSX.Element {
  const hasExpected = state.expected_output_json !== null && state.selected_example !== null;
  const ran = state.execution_status === 'success';
  const matches =
    hasExpected && ran
      ? stableStringify(state.execution_output_json) === stableStringify(state.expected_output_json)
      : null;

  return (
    <section className="transon-panel transon-output-panel" data-testid="output-panel" aria-label="Output and errors">
      <header className="transon-panel-title">
        Output / Errors{state.execution_status === 'stale' ? ' (stale)' : ''}
      </header>
      {matches !== null ? (
        <p
          className="transon-match"
          data-testid="match-indicator"
          data-match={matches ? 'match' : 'differ'}
        >
          {matches ? '✓ Output matches expected' : '✗ Output differs from expected'}
        </p>
      ) : null}
      {state.errors.length > 0 ? (
        <ErrorList state={state} />
      ) : (
        <pre className="transon-code" data-testid="output-content">{pretty(state.execution_output_json)}</pre>
      )}
      {hasExpected ? (
        <div className="transon-expected" data-testid="expected-output">
          <header className="transon-panel-subtitle">Expected</header>
          <pre className="transon-code" data-testid="expected-content">
            {pretty(state.expected_output_json)}
          </pre>
        </div>
      ) : null}
    </section>
  );
}

/**
 * First sentence of an example's engine doc — the display label (FR-132). Markdown emphasis is
 * stripped and the trailing period dropped; a doc-less case falls back to its name.
 */
function exampleLabel(ex: ExampleCase): string {
  const doc = ex.doc?.replace(/\*/g, '').trim();
  if (!doc) return ex.name;
  const firstLine = (doc.split('\n', 1)[0] ?? doc).trim();
  const sentence = /^(.*?[.!?])(?:\s|$)/.exec(firstLine)?.[1] ?? firstLine;
  return sentence.replace(/\.$/, '');
}

/**
 * Tier/group the corpus for display (FR-132): curated tiers first (the corpus arrives
 * curated-first from `buildExampleCorpus`, which resolves `tier` from the engine
 * `worked_examples`/`recipes` name-reference lists — never from tag conventions, contract §2.7),
 * then reference examples grouped by owning rule (alphabetical, rule-less cases last). Mechanical
 * over the engine-emitted case data (AD-012) — host-supplied corpora flow through the same
 * derivation.
 */
function groupExamples(examples: ExampleCase[]): Array<{ label: string; entries: ExampleCase[] }> {
  const worked: ExampleCase[] = [];
  const recipes: ExampleCase[] = [];
  const byRule = new Map<string, ExampleCase[]>();
  for (const ex of examples) {
    if (ex.tier === 'worked-example') worked.push(ex);
    else if (ex.tier === 'recipe') recipes.push(ex);
    else {
      const rule = ex.rule ?? '';
      const group = byRule.get(rule) ?? [];
      group.push(ex);
      byRule.set(rule, group);
    }
  }
  const rules = [...byRule.keys()].filter((r) => r !== '').sort();
  if (byRule.has('')) rules.push('');
  return [
    { label: 'Worked examples', entries: worked },
    { label: 'Recipes', entries: recipes },
    ...rules.map((rule) => ({
      label: `Reference · ${rule === '' ? 'other' : rule}`,
      entries: byRule.get(rule)!,
    })),
  ].filter((group) => group.entries.length > 0);
}

/**
 * Examples picker (§12.8, FR-009/099, AC-018). Loads a documentation example's template + sample
 * input + expected output. Hidden when no corpus is available. "Reset Example" reloads the selected
 * example, reverting local edits (§12.3). Presented tiered/grouped with doc-sentence labels
 * (FR-132); the unique case name stays the selection value (and tooltip).
 */
export function ExamplesPanel({
  examples,
  selected,
  onSelect,
  onReset,
}: {
  examples: ExampleCase[];
  selected: string | null;
  onSelect(example: ExampleCase): void;
  onReset(): void;
}): JSX.Element | null {
  if (!examples.length) return null;
  return (
    <section className="transon-panel transon-examples-panel" data-testid="examples-panel" aria-label="Examples">
      <header className="transon-panel-title">Examples</header>
      <select
        className="transon-example-select"
        data-testid="example-select"
        aria-label="Load example"
        value={selected ?? ''}
        onChange={(e) => {
          const ex = examples.find((x) => x.name === e.target.value);
          if (ex) onSelect(ex);
        }}
      >
        <option value="" disabled>
          Choose an example…
        </option>
        {groupExamples(examples).map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.entries.map((ex) => (
              <option key={ex.name} value={ex.name} title={ex.name}>
                {exampleLabel(ex)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {selected ? (
        <button type="button" data-testid="btn-reset-example" onClick={onReset}>
          Reset Example
        </button>
      ) : null}
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

/**
 * Engine runtime status + sync state + diagnostics (NFR-028, AC-023, FR-080, §18). Surfaces the host
 * engine + metadata schema versions once known; a metadata-version mismatch against the version the
 * editor was built with is flagged (NFR-040, AD-012).
 */
export function StatusBar({ state }: { state: EditorSession }): JSX.Element {
  const metaMismatch =
    state.metadata_version !== null && state.metadata_version !== metadataVersion;
  return (
    <div
      className="transon-statusbar"
      data-testid="status-bar"
      role="status"
      aria-live="polite"
      aria-label="Editor status"
    >
      <span data-testid="engine-status" data-status={state.engine_runtime_status}>
        Engine: {state.engine_runtime_status}
      </span>
      <span data-testid="sync-status" data-sync={state.json_sync_status}>
        JSON: {state.json_sync_status}
      </span>
      {state.engine_version ? (
        <span data-testid="engine-version">engine {state.engine_version}</span>
      ) : null}
      {state.metadata_version ? (
        <span data-testid="metadata-version" data-mismatch={metaMismatch ? '' : undefined}>
          metadata {state.metadata_version}
          {metaMismatch ? ` (built for ${metadataVersion})` : ''}
        </span>
      ) : null}
    </div>
  );
}

export type ViewMode = 'visual' | 'json' | 'split';

/** Toolbar actions (§12.3). D2 wires New + Toggle View; Validate/Run are gated on engine-ready.
 *  Read-only (FR-107) disables the authoring actions (New) while keeping Validate/Run/View. D4 adds
 *  the progressive-disclosure controls: advanced-blocks toggle + palette search (§12.6). */
export function Toolbar({
  state,
  controller,
  view,
  onView,
  readOnly = false,
  showAdvanced = false,
  search = '',
  onPaletteView,
}: {
  state: EditorSession;
  controller: EditorController | null;
  view?: ViewMode;
  onView?(v: ViewMode): void;
  readOnly?: boolean;
  showAdvanced?: boolean;
  search?: string;
  /** §12.6 palette view change (advanced toggle / search). */
  onPaletteView?(next: { showAdvanced: boolean; search: string }): void;
}): JSX.Element {
  const ready = state.engine_runtime_status === 'ready';
  const hasTemplate = state.template_json != null;

  async function onImportFile(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-importing the same file
    if (!file) return;
    await controller?.importText(await file.text());
  }

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
      {/* Import a Transon JSON file (FR-096/007) — routed through the strict §7.15 gate. */}
      <label className="transon-import-label">
        Import
        <input
          type="file"
          className="transon-import-input"
          data-testid="btn-import"
          accept="application/json,.json"
          disabled={readOnly}
          onChange={(e) => void onImportFile(e)}
        />
      </label>
      <button
        type="button"
        data-testid="btn-copy"
        disabled={!hasTemplate}
        onClick={() => void controller?.copyTemplate()}
      >
        Copy
      </button>
      <button
        type="button"
        data-testid="btn-download"
        disabled={!hasTemplate}
        onClick={() => controller?.downloadTemplate()}
      >
        Download
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
      {/* Progressive disclosure (§12.6, OQ-009): advanced-blocks toggle + palette search. */}
      {onPaletteView ? (
        <>
          <input
            type="search"
            className="transon-palette-search"
            data-testid="palette-search"
            aria-label="Search palette"
            placeholder="Search blocks…"
            value={search}
            onChange={(e) => onPaletteView({ showAdvanced, search: e.target.value })}
          />
          <label className="transon-advanced-toggle">
            <input
              type="checkbox"
              data-testid="toggle-advanced"
              checked={showAdvanced}
              onChange={(e) => onPaletteView({ showAdvanced: e.target.checked, search })}
            />
            Advanced blocks
          </label>
        </>
      ) : null}
    </div>
  );
}
