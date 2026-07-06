// §12.1 side-panel resizing — the splitter between canvas and side column resizes the panel stack,
// bounded to 50%–200% of the stylesheet default width, keyboard-operable per the ARIA separator
// pattern. The chosen width is UI-only state (§11.5): inline flex-basis, never serialized.
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransonEditor } from '../src/components/TransonEditor.js';
import { createFakeEngine } from './fake-engine.js';

// jsdom has no layout engine (setup.ts stubs getBoundingClientRect to 0), so give the body and
// side column deterministic geometry: body 1200px wide → CSS default side width would be
// clamp(320, 34% of 1200 = 408, 460) = 408px.
const BODY_W = 1200;
const DEFAULT_W = 408;

function mountSandbox(): { splitter: HTMLElement; side: HTMLElement } {
  const engine = createFakeEngine({ status: 'ready' });
  const { container } = render(<TransonEditor host={{ engine }} mode="sandbox" />);
  const body = container.querySelector('.transon-body') as HTMLElement;
  const side = container.querySelector('.transon-side-col') as HTMLElement;
  const rect = (w: number) =>
    ({ x: 0, y: 0, top: 0, left: 0, right: w, bottom: 0, width: w, height: 600, toJSON: () => ({}) }) as DOMRect;
  body.getBoundingClientRect = () => rect(BODY_W);
  side.getBoundingClientRect = () =>
    // reflect the applied inline width, else the CSS default
    rect(side.style.flexBasis ? parseFloat(side.style.flexBasis) : DEFAULT_W);
  return { splitter: screen.getByTestId('side-resizer'), side };
}

describe('side panel splitter (§12.1)', () => {
  it('renders as an accessible vertical separator at 100% of the default width', () => {
    const { splitter } = mountSandbox();
    expect(splitter.getAttribute('role')).toBe('separator');
    expect(splitter.getAttribute('aria-orientation')).toBe('vertical');
    expect(splitter.getAttribute('tabindex')).toBe('0');
    expect(splitter.getAttribute('aria-valuemin')).toBe('50');
    expect(splitter.getAttribute('aria-valuemax')).toBe('200');
    expect(splitter.getAttribute('aria-valuenow')).toBe('100');
    expect(splitter.getAttribute('aria-label')).toBeTruthy();
  });

  it('pointer drag widens the panel (dragging left) and applies an inline flex-basis', () => {
    const { splitter, side } = mountSandbox();
    fireEvent.pointerDown(splitter, { clientX: 792, pointerId: 1 });
    fireEvent.pointerMove(splitter, { clientX: 692, pointerId: 1 }); // 100px left → +100px wide
    fireEvent.pointerUp(splitter, { pointerId: 1 });
    expect(parseFloat(side.style.flexBasis)).toBeCloseTo(DEFAULT_W + 100, 0);
    expect(splitter.getAttribute('aria-valuenow')).toBe(String(Math.round(((DEFAULT_W + 100) / DEFAULT_W) * 100)));
  });

  it('clamps the drag to 50%–200% of the default width', () => {
    const { splitter, side } = mountSandbox();
    // way past the left edge → clamp at 200% (816px), which also fits the canvas floor (1200-816 ≥ 320… not quite: cap = min(816, 1200-320=880) = 816)
    fireEvent.pointerDown(splitter, { clientX: 792, pointerId: 1 });
    fireEvent.pointerMove(splitter, { clientX: -2000, pointerId: 1 });
    fireEvent.pointerUp(splitter, { pointerId: 1 });
    expect(parseFloat(side.style.flexBasis)).toBeCloseTo(DEFAULT_W * 2, 0);
    expect(splitter.getAttribute('aria-valuenow')).toBe('200');
    // way past the right edge → clamp at 50%
    fireEvent.pointerDown(splitter, { clientX: 792, pointerId: 1 });
    fireEvent.pointerMove(splitter, { clientX: 4000, pointerId: 1 });
    fireEvent.pointerUp(splitter, { pointerId: 1 });
    expect(parseFloat(side.style.flexBasis)).toBeCloseTo(DEFAULT_W / 2, 0);
    expect(splitter.getAttribute('aria-valuenow')).toBe('50');
  });

  it('arrow keys step the width; Home/End jump to the bounds; Enter resets to the default', () => {
    const { splitter, side } = mountSandbox();
    fireEvent.keyDown(splitter, { key: 'ArrowLeft' }); // widen by one step (5%)
    expect(parseFloat(side.style.flexBasis)).toBeCloseTo(DEFAULT_W * 1.05, 0);
    fireEvent.keyDown(splitter, { key: 'ArrowRight' }); // back to 100%
    expect(splitter.getAttribute('aria-valuenow')).toBe('100');
    fireEvent.keyDown(splitter, { key: 'End' }); // max
    expect(splitter.getAttribute('aria-valuenow')).toBe('200');
    fireEvent.keyDown(splitter, { key: 'Home' }); // min
    expect(splitter.getAttribute('aria-valuenow')).toBe('50');
    fireEvent.keyDown(splitter, { key: 'Enter' }); // reset — back to the stylesheet default
    expect(side.style.flexBasis).toBe('');
    expect(splitter.getAttribute('aria-valuenow')).toBe('100');
  });

  it('double-click resets to the default width', () => {
    const { splitter, side } = mountSandbox();
    fireEvent.keyDown(splitter, { key: 'End' });
    expect(side.style.flexBasis).not.toBe('');
    fireEvent.doubleClick(splitter);
    expect(side.style.flexBasis).toBe('');
  });

  it('compact mode renders no splitter (single-surface layout, §12.2)', () => {
    const engine = createFakeEngine({ status: 'ready' });
    render(<TransonEditor host={{ engine }} mode="compact" />);
    expect(screen.queryByTestId('side-resizer')).toBeNull();
  });
});
