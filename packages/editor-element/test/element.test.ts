import { describe, it, expect, vi } from 'vitest';
import {
  registerTransonEditorElement,
  TransonEditorElement,
  TRANSON_EDITOR_TAG,
} from '../src/element.js';
import { fakeEngine } from './fake.js';

// D6 — <transon-editor> custom element (FR-010/011, AD-018 light DOM, AD-019).
registerTransonEditorElement();

function makeElement(): TransonEditorElement {
  const el = document.createElement(TRANSON_EDITOR_TAG) as TransonEditorElement;
  el.style.width = '800px';
  el.style.height = '600px';
  el.host = { engine: fakeEngine() };
  return el;
}

describe('<transon-editor> (AD-019, AD-018)', () => {
  it('registers the custom element', () => {
    expect(customElements.get(TRANSON_EDITOR_TAG)).toBe(TransonEditorElement);
  });

  it('mounts into LIGHT DOM on connect (no shadow root, AD-018)', () => {
    const el = makeElement();
    el.setAttribute('mode', 'sandbox');
    document.body.appendChild(el); // connectedCallback
    try {
      expect(el.shadowRoot).toBeNull(); // never shadow (AD-018)
      expect(el.querySelector('[data-testid="transon-canvas"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="editor-shell"]')).toBeTruthy();
      expect(el.getTemplate()).toBeNull();
    } finally {
      el.remove();
    }
  });

  it('re-emits the editor callbacks as DOM CustomEvents, payload in event.detail (FR-011)', async () => {
    const el = makeElement();
    let changeEvent: CustomEvent | undefined;
    el.addEventListener('change', (e) => (changeEvent = e as CustomEvent));
    document.body.appendChild(el);
    try {
      // the initial projection fires onChange(null) asynchronously, carried in event.detail
      await vi.waitFor(() => expect(changeEvent).toBeInstanceOf(CustomEvent));
      expect(changeEvent).toHaveProperty('detail'); // template payload travels in `detail`
      expect(changeEvent!.detail).toBeNull(); // empty workspace → null template
      // validate/execute use the identical `new CustomEvent(name, { detail: result })` construction
      // (element.ts); the ValidationResult/ExecutionResult payloads are proven at the controller in
      // editor-ui/test/callbacks.test.tsx.
    } finally {
      el.remove();
    }
  });

  it('tears down on disconnect', () => {
    const el = makeElement();
    document.body.appendChild(el);
    expect(el.querySelector('[data-testid="editor-shell"]')).toBeTruthy();
    el.remove(); // disconnectedCallback
    expect(el.querySelector('[data-testid="editor-shell"]')).toBeNull();
  });
});
