// The root React component (ARCHITECTURE §5.1, §6). It owns a single EditorController (the
// framework-agnostic orchestrator) created once on mount against the canvas container, subscribes to
// its store for re-renders, and lays out the panels per editor mode (§12.1 sandbox / §12.2 compact).
// React stays thin: all data flow lives in the controller; this only renders state + dispatches
// actions.

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import {
  createEditorController,
  type EditorController,
  type EditorControllerOptions,
} from '../session/controller.js';
import type { TransonTheme } from '../session/host.js';
import { emptySession, type EditorSession } from '../session/types.js';
import {
  JsonPanel,
  InputPanel,
  OutputPanel,
  FilesPanel,
  StatusBar,
  Toolbar,
  type ViewMode,
} from './panels.js';

export type TransonEditorProps = EditorControllerOptions & {
  /** Called once with the EditorController after it mounts — the seam the vanilla
   *  `createTransonEditor()` / `<transon-editor>` surface uses to build its handle (D6). */
  onReady?(controller: EditorController): void;
};

/**
 * Build the inline style carrying the theme's scoped CSS custom properties (FR-108/FR-128). Only
 * `--transon-*` keys are honored (chrome-only); other keys are ignored so a theme cannot inject
 * arbitrary style. Block/category colours stay data-driven (FR-127) — they are not CSS vars here.
 */
function themeStyle(theme: TransonTheme | undefined): CSSProperties | undefined {
  if (!theme) return undefined;
  const vars = Object.entries(theme).filter(([k]) => k.startsWith('--transon-'));
  return vars.length ? (Object.fromEntries(vars) as CSSProperties) : undefined;
}

export function TransonEditor(props: TransonEditorProps): JSX.Element {
  const canvasRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<EditorController | null>(null);
  const [state, setState] = useState<EditorSession>(() =>
    emptySession({
      marker: props.host.marker ?? '$',
      editor_mode: props.mode ?? 'sandbox',
      sample_input_json: props.input ?? null,
    }),
  );
  const [view, setView] = useState<ViewMode>('visual');

  useEffect(() => {
    const c = createEditorController(canvasRef.current!, props);
    controllerRef.current = c;
    setState(c.store.getState());
    props.onReady?.(c);
    const unsub = c.store.subscribe(setState);
    return () => {
      unsub();
      c.dispose();
      controllerRef.current = null;
    };
    // Created once; prop-driven updates flow through the controller imperatively (D6 handle).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const controller = controllerRef.current;
  const mode = state.editor_mode;
  const readOnly = props.readOnly ?? false;
  const shellStyle = themeStyle(props.host.theme);

  // The Blockly container is ALWAYS mounted (the controller's workspace is bound to this exact DOM
  // node); view switches toggle visibility via CSS so the instance is never orphaned.
  const canvasHidden = mode === 'compact' && view === 'json';
  const canvas = (
    <div
      className="transon-canvas"
      data-testid="transon-canvas"
      ref={canvasRef}
      style={canvasHidden ? { display: 'none' } : undefined}
    />
  );

  if (mode === 'compact') {
    return (
      <div
        className="transon-editor-shell"
        data-testid="editor-shell"
        data-mode="compact"
        data-readonly={readOnly ? '' : undefined}
        style={shellStyle}
      >
        <Toolbar state={state} controller={controller} view={view} onView={setView} readOnly={readOnly} />
        <div className="transon-body transon-compact">
          {canvas}
          {view !== 'visual' ? (
            <JsonPanel
              state={state}
              onEdit={(t) => controller?.setTemplateText(t)}
              readOnly={readOnly}
            />
          ) : null}
        </div>
        <StatusBar state={state} />
      </div>
    );
  }

  // Sandbox / playground (§12.1).
  return (
    <div
      className="transon-editor-shell"
      data-testid="editor-shell"
      data-mode="sandbox"
      data-readonly={readOnly ? '' : undefined}
      style={shellStyle}
    >
      <Toolbar state={state} controller={controller} readOnly={readOnly} />
      <div className="transon-body transon-sandbox">
        <div className="transon-canvas-col">{canvas}</div>
        <div className="transon-side-col">
          <JsonPanel state={state} onEdit={(t) => controller?.setTemplateText(t)} readOnly={readOnly} />
          <InputPanel state={state} onInput={(t) => controller?.setInputText(t)} />
          <OutputPanel state={state} />
          <FilesPanel state={state} />
        </div>
      </div>
      <StatusBar state={state} />
    </div>
  );
}
