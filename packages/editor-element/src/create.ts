// createTransonEditor() — the vanilla, framework-agnostic factory (ARCHITECTURE §5.3, AD-019). It
// mounts the internal React UI (@transon/editor-ui) into a host element via React DOM and returns a
// TransonEditorHandle whose methods delegate to the underlying EditorController. React is an internal
// detail bundled by this package (AD-019/020); callers see only this handle. Ships no engine — the
// host supplies an EngineProvider via options.host (AD-008).

import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { Json } from '@transon/editor-core';
import { TransonEditor, type EditorController, type EditorControllerOptions } from '@transon/editor-ui';

export type CreateTransonEditorOptions = EditorControllerOptions;

/** The imperative handle returned by createTransonEditor (ARCHITECTURE §5.3). */
export interface TransonEditorHandle {
  /** The current generated canonical template (null when empty/ungenerated). */
  getTemplate(): Json | null;
  /** Load a document into the canvas (New / Import / Load-Example). */
  setTemplate(doc: Json): Promise<void>;
  /** Validate the current template through the host engine. */
  validate(): Promise<void>;
  /** Execute the current template against the sample input. */
  run(): Promise<void>;
  /** Unmount and release the editor. */
  destroy(): void;
}

/**
 * Mount a Transon editor into `target` and return an imperative handle. The React tree + the
 * EditorController are created synchronously (flushSync), so the handle is usable immediately.
 */
export function createTransonEditor(
  target: HTMLElement,
  options: CreateTransonEditorOptions,
): TransonEditorHandle {
  let controller: EditorController | null = null;
  const root: Root = createRoot(target);
  // flushSync forces the render + mount effect to run now, so onReady fires before we return.
  flushSync(() => {
    root.render(createElement(TransonEditor, { ...options, onReady: (c) => (controller = c) }));
  });

  return {
    getTemplate: () => controller?.getTemplate() ?? null,
    setTemplate: (doc) => controller?.setTemplate(doc) ?? Promise.resolve(),
    validate: () => controller?.validate() ?? Promise.resolve(),
    run: () => controller?.run() ?? Promise.resolve(),
    destroy: () => root.unmount(),
  };
}
