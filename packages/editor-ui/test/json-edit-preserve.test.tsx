// FR-131 — an accepted mid-typing JSON edit must not rewrite the focused panel text (§7.15,
// §12.7). Reproduces the UAT defect: type → debounced reverse accepts → re-projection flips the
// session to in_sync with fresh generated JSON → the panel replaced the user's text with the
// canonical pretty-print (reformat + cursor jump) WHILE they were still typing. The contract:
// while the textarea retains focus the user's exact text survives an accept; the canonical form
// appears only when editing ends (blur) — and a read-only panel always mirrors (FR-107).
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JsonPanel } from '../src/components/panels.js';
import { emptySession, type EditorSession } from '../src/session/types.js';

/** A session whose generation is available (the panel renders its editable textarea). */
function session(over: Partial<EditorSession>): EditorSession {
  return emptySession({ generation_status: 'complete', json_sync_status: 'in_sync', ...over });
}

// Deliberately NON-canonical formatting: same document as the canonical pretty-print, different
// whitespace — exactly what a user's half-typed-but-valid text looks like when accepted.
const TYPED = '{"$":"expr","op":"lt"}';
const ACCEPTED_DOC = { $: 'expr', op: 'lt' };

describe('FR-131 — accepted edits never rewrite the focused panel text', () => {
  it('preserves the exact typed text (formatting included) across an accept while focused', () => {
    const { rerender } = render(<JsonPanel state={session({ template_json: 1 })} onEdit={() => {}} />);
    const ta = screen.getByTestId('json-content') as HTMLTextAreaElement;

    fireEvent.focus(ta);
    fireEvent.change(ta, { target: { value: TYPED } }); // user typing (panel marks 'editing' upstream)
    rerender(<JsonPanel state={session({ json_sync_status: 'editing', template_json: 1 })} onEdit={() => {}} />);
    expect(ta.value).toBe(TYPED);

    // the debounced reverse ACCEPTS: session flips to in_sync with the re-projected document
    rerender(<JsonPanel state={session({ template_json: ACCEPTED_DOC })} onEdit={() => {}} />);
    expect(ta.value).toBe(TYPED); // NOT the canonical pretty-print — typing is uninterrupted
  });

  it('reflects the canonical generated JSON when editing ends (blur)', () => {
    const { rerender } = render(<JsonPanel state={session({ template_json: 1 })} onEdit={() => {}} />);
    const ta = screen.getByTestId('json-content') as HTMLTextAreaElement;

    fireEvent.focus(ta);
    fireEvent.change(ta, { target: { value: TYPED } });
    rerender(<JsonPanel state={session({ template_json: ACCEPTED_DOC })} onEdit={() => {}} />);

    fireEvent.blur(ta);
    expect(ta.value).toBe(JSON.stringify(ACCEPTED_DOC, null, 2)); // canonical, once editing ends
  });

  it('a rejected edit keeps the user text (with the out-of-sync state) even after blur (§7.15)', () => {
    const { rerender } = render(<JsonPanel state={session({ template_json: 1 })} onEdit={() => {}} />);
    const ta = screen.getByTestId('json-content') as HTMLTextAreaElement;

    fireEvent.focus(ta);
    fireEvent.change(ta, { target: { value: '{ broken' } });
    rerender(<JsonPanel state={session({ json_sync_status: 'out_of_sync', template_json: 1 })} onEdit={() => {}} />);
    fireEvent.blur(ta);
    expect(ta.value).toBe('{ broken'); // preserved until accepted or reverted (FR-113)
  });

  it('a canvas-originated change reflects immediately when the panel is not being edited', () => {
    const { rerender } = render(<JsonPanel state={session({ template_json: 1 })} onEdit={() => {}} />);
    const ta = screen.getByTestId('json-content') as HTMLTextAreaElement;
    rerender(<JsonPanel state={session({ template_json: ACCEPTED_DOC })} onEdit={() => {}} />);
    expect(ta.value).toBe(JSON.stringify(ACCEPTED_DOC, null, 2));
  });

  it('a read-only panel always mirrors the generated JSON, focus or not (FR-107)', () => {
    const { rerender } = render(<JsonPanel state={session({ template_json: 1 })} readOnly />);
    const ta = screen.getByTestId('json-content') as HTMLTextAreaElement;
    fireEvent.focus(ta);
    rerender(<JsonPanel state={session({ template_json: ACCEPTED_DOC })} readOnly />);
    expect(ta.value).toBe(JSON.stringify(ACCEPTED_DOC, null, 2));
  });
});
