// The EditorSession store (ARCHITECTURE §5.1, §6) — a tiny framework-agnostic observable. React
// subscribes to it (D2); it imports no React so the store logic is unit-testable headlessly. State
// transitions for the forward projection, engine status, validate/execute, and the §7.15 reverse
// sync are computed by the sibling modules (forward/engine-status/validate/execute/reverse) as pure
// patches and applied here.

import type { EditorSession } from './types.js';
import { emptySession } from './types.js';

export type Listener = (state: EditorSession) => void;

export interface EditorStore {
  getState(): EditorSession;
  /** Shallow-merge a patch and notify subscribers. */
  setState(patch: Partial<EditorSession>): void;
  /** Subscribe to state changes; returns an unsubscribe function. */
  subscribe(listener: Listener): () => void;
}

export function createEditorStore(initial: Partial<EditorSession> = {}): EditorStore {
  let state = emptySession(initial);
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    setState(patch) {
      state = { ...state, ...patch };
      for (const l of listeners) l(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
