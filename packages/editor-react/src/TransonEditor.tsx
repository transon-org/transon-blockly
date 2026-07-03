// <TransonEditor> — the native React surface (AD-019, ARCHITECTURE §5.3). A thin wrapper over the
// internal @transon/editor-ui React component that forwards a `ref` to an imperative handle. React is
// a PEER dependency: this component does not create a React root of its own (unlike the vanilla
// createTransonEditor(), which mounts via ReactDOM into a host element) — it renders directly in the
// host app's React tree, so the app's single React instance owns reconciliation.

import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { ForwardedRef, ReactElement } from 'react';
import {
  TransonEditor as InternalTransonEditor,
  type EditorController,
  type EditorControllerOptions,
} from '@transon/editor-ui';
import type { Json } from '@transon/editor-core';

/**
 * Props for the public `<TransonEditor>`: the framework-agnostic controller options (`host`, `mode`,
 * `template`, `input`, `readOnly`, `theme`, `categories`, and the `onChange`/`onValidate`/`onExecute`
 * embedding callbacks). Identical to the vanilla `createTransonEditor()` options object.
 */
export type TransonEditorProps = EditorControllerOptions;

/**
 * The imperative handle exposed via `ref` (ARCHITECTURE §5.3). Mirrors the vanilla
 * `TransonEditorHandle` minus `destroy` — React unmounting releases the editor automatically.
 */
export interface TransonEditorRef {
  /** The current generated canonical template (null when empty/ungenerated). */
  getTemplate(): Json | null;
  /** Load a document into the canvas (New / Import / Load-Example). Engine-gated. */
  setTemplate(doc: Json): Promise<void>;
  /** Validate the current template through the host engine. */
  validate(): Promise<void>;
  /** Execute the current template against the sample input. */
  run(): Promise<void>;
}

export const TransonEditor = forwardRef(function TransonEditor(
  props: TransonEditorProps,
  ref: ForwardedRef<TransonEditorRef>,
): ReactElement {
  const controllerRef = useRef<EditorController | null>(null);

  useImperativeHandle(
    ref,
    (): TransonEditorRef => ({
      getTemplate: () => controllerRef.current?.getTemplate() ?? null,
      setTemplate: (doc: Json) => controllerRef.current?.setTemplate(doc) ?? Promise.resolve(),
      validate: () => controllerRef.current?.validate() ?? Promise.resolve(),
      run: () => controllerRef.current?.run() ?? Promise.resolve(),
    }),
    [],
  );

  return (
    <InternalTransonEditor
      {...props}
      onReady={(c) => {
        controllerRef.current = c;
      }}
    />
  );
});
