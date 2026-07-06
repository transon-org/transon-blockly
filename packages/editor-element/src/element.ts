// <transon-editor> — the custom element surface (AD-019). It mounts createTransonEditor() into a
// LIGHT-DOM child (never shadow — Blockly injects global CSS that a shadow root would hide, AD-018),
// reads configuration from attributes (mode/marker/readonly/template/input) and a `host` JS property
// (the engine + examples, which can't be attributes), and re-emits the editor's change/validate/
// execute callbacks as DOM CustomEvents (FR-010/011). Ships no engine (AD-008).

import type { Json } from '@transon/editor-core';
import type { EditorMode, ToolbarActionId, TransonEditorHost } from '@transon/editor-ui';
import { createTransonEditor, type TransonEditorHandle } from './create.js';

export const TRANSON_EDITOR_TAG = 'transon-editor';

function parseAttr(value: string | null): Json | undefined {
  if (value == null) return undefined;
  try {
    return JSON.parse(value) as Json;
  } catch {
    return undefined;
  }
}

const TOOLBAR_ACTIONS: readonly ToolbarActionId[] = [
  'new',
  'import',
  'copy',
  'download',
  'validate',
  'run',
];

/** Parse the space/comma-separated `hide-actions` attribute into known toolbar action ids (FR-136). */
function parseHideActions(value: string | null): ToolbarActionId[] | undefined {
  if (value == null) return undefined;
  const ids = value
    .split(/[\s,]+/)
    .filter(Boolean)
    .filter((v): v is ToolbarActionId => (TOOLBAR_ACTIONS as readonly string[]).includes(v));
  return ids.length ? ids : undefined;
}

const EDITOR_MODES: readonly EditorMode[] = ['sandbox', 'compact'];

/** Validate the `mode` attribute against the supported EditorMode values (default: sandbox). */
function parseMode(value: string | null): EditorMode {
  return EDITOR_MODES.includes(value as EditorMode) ? (value as EditorMode) : 'sandbox';
}

export class TransonEditorElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['mode', 'marker', 'readonly', 'autorun', 'hide-actions'];
  }

  /** Host config (engine, examples, metadata, includes) — set as a JS property; objects can't be
   *  attributes. Assign before connecting, or reassign to re-mount. */
  host: TransonEditorHost = {};

  #handle?: TransonEditorHandle;
  #mountPoint?: HTMLElement;

  connectedCallback(): void {
    this.#mount();
  }

  disconnectedCallback(): void {
    this.#unmount();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#mount();
  }

  #mount(): void {
    // A remount (attribute change) must not drop live edits: prefer the current workspace
    // template over the static `template` attribute when one exists.
    const liveTemplate = this.#handle?.getTemplate();
    this.#unmount();
    const mountPoint = document.createElement('div'); // light-DOM child (AD-018)
    this.appendChild(mountPoint);
    this.#mountPoint = mountPoint;
    const marker = this.getAttribute('marker');
    this.#handle = createTransonEditor(mountPoint, {
      host: marker ? { ...this.host, marker } : this.host,
      mode: parseMode(this.getAttribute('mode')),
      readOnly: this.hasAttribute('readonly'),
      autorun: this.hasAttribute('autorun'), // FR-135 — re-run on every accepted change
      hideToolbarActions: parseHideActions(this.getAttribute('hide-actions')), // FR-136
      template: liveTemplate ?? parseAttr(this.getAttribute('template')),
      input: parseAttr(this.getAttribute('input')),
      // Re-emit the editor callbacks as DOM CustomEvents; the payloads travel in `event.detail`
      // (FR-011): change → the generated template, validate → the ValidationResult, execute → the
      // ExecutionResult (ARCHITECTURE §5.3).
      onChange: (t) => this.dispatchEvent(new CustomEvent('change', { detail: t })),
      onValidate: (result) => this.dispatchEvent(new CustomEvent('validate', { detail: result })),
      onExecute: (result) => this.dispatchEvent(new CustomEvent('execute', { detail: result })),
    });
  }

  #unmount(): void {
    this.#handle?.destroy();
    this.#mountPoint?.remove();
    this.#handle = undefined;
    this.#mountPoint = undefined;
  }

  // ---- imperative API mirroring the handle (ARCHITECTURE §5.3) ----
  getTemplate(): Json | null {
    return this.#handle?.getTemplate() ?? null;
  }
  setTemplate(doc: Json): Promise<void> {
    return this.#handle?.setTemplate(doc) ?? Promise.resolve();
  }
  validate(): Promise<void> {
    return this.#handle?.validate() ?? Promise.resolve();
  }
  run(): Promise<void> {
    return this.#handle?.run() ?? Promise.resolve();
  }
}

/** Register the <transon-editor> custom element (idempotent). The IIFE entry calls this on load. */
export function registerTransonEditorElement(): void {
  if (typeof customElements !== 'undefined' && !customElements.get(TRANSON_EDITOR_TAG)) {
    customElements.define(TRANSON_EDITOR_TAG, TransonEditorElement);
  }
}
