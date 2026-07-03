import { describe, it, expect } from 'vitest';
import { createRef } from 'react';
import { render } from '@testing-library/react';
import { TransonEditor, type TransonEditorRef } from '../src/TransonEditor.js';
import { fakeEngine } from './fake.js';

// D0 — the native React <TransonEditor> entry (AD-019, AC-022, FR-010). Renders in the host React
// tree (not via a self-created root) and forwards a `ref` to the imperative handle.
describe('<TransonEditor> React entry (AD-019, AC-022)', () => {
  it('renders the sandbox editor shell and exposes an imperative handle via ref', () => {
    const ref = createRef<TransonEditorRef>();
    const { container, unmount } = render(
      <TransonEditor ref={ref} host={{ engine: fakeEngine() }} mode="sandbox" />,
    );
    try {
      expect(container.querySelector('[data-testid="editor-shell"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="transon-canvas"]')).toBeTruthy();
      // the handle mirrors the vanilla TransonEditorHandle (minus destroy)
      expect(typeof ref.current?.getTemplate).toBe('function');
      expect(typeof ref.current?.setTemplate).toBe('function');
      expect(typeof ref.current?.validate).toBe('function');
      expect(typeof ref.current?.run).toBe('function');
      expect(ref.current?.getTemplate()).toBeNull(); // empty workspace initially
    } finally {
      unmount();
    }
  });

  it('renders compact mode when requested (AC-032)', () => {
    const { container, unmount } = render(
      <TransonEditor host={{ engine: fakeEngine() }} mode="compact" />,
    );
    try {
      expect(container.querySelector('[data-mode="compact"]')).toBeTruthy();
    } finally {
      unmount();
    }
  });

  it('works without a ref (ref is optional)', () => {
    const { container, unmount } = render(<TransonEditor host={{ engine: fakeEngine() }} />);
    try {
      expect(container.querySelector('[data-testid="editor-shell"]')).toBeTruthy();
    } finally {
      unmount();
    }
  });
});
