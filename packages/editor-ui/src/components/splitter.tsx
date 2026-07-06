// §12.1 side-panel splitter — a keyboard-operable ARIA separator between the canvas column and
// the side panel stack. Bounds: 50%–200% of the stylesheet's default side width (SIDE_COL in
// styles.ts), additionally capped so the canvas column keeps a usable floor. The chosen width is
// UI-only session state (§11.5): the owner applies it as an inline flex-basis; it is never part
// of any serialized template.

import { useRef } from 'react';
import type { JSX, KeyboardEvent, PointerEvent, RefObject } from 'react';
import { sideColDefaultWidth } from '../styles.js';

export const SIDE_MIN_PCT = 50;
export const SIDE_MAX_PCT = 200;
/** One arrow-key step, in % of the default width. */
export const SIDE_STEP_PCT = 5;
/** The canvas column never shrinks below this, whatever the 200% bound would allow. */
const CANVAS_FLOOR_PX = 320;

/** The applied side-column width: pixels for the inline flex-basis, percent (of the stylesheet
 *  default) for the separator's aria-valuenow. `null` means "the stylesheet default" (100%). */
export interface SideWidth {
  px: number;
  pct: number;
}

export function SideSplitter({
  bodyRef,
  sideRef,
  width,
  onWidth,
}: {
  /** The flex row containing canvas · splitter · side column (geometry source). */
  bodyRef: RefObject<HTMLDivElement | null>;
  sideRef: RefObject<HTMLDivElement | null>;
  width: SideWidth | null;
  onWidth(next: SideWidth | null): void;
}): JSX.Element {
  const drag = useRef<{ x: number; w: number } | null>(null);

  /** Clamp a pixel width to [50%, min(200%, canvas floor)] of the default and apply it. */
  const applyWidth = (px: number): void => {
    const bodyW = bodyRef.current?.getBoundingClientRect().width ?? 0;
    if (!bodyW) return; // no geometry (unmounted / hidden) — don't guess
    const base = sideColDefaultWidth(bodyW);
    const min = (base * SIDE_MIN_PCT) / 100;
    // The canvas floor may undercut the 50% guarantee on a degenerate-narrow body (the splitter
    // is CSS-hidden below the single-column breakpoint, but don't rely on that): never let the
    // effective max fall below min, so the reported pct stays inside [valuemin, valuemax].
    const max = Math.max(min, Math.min((base * SIDE_MAX_PCT) / 100, bodyW - CANVAS_FLOOR_PX));
    const clamped = Math.min(max, Math.max(min, px));
    onWidth({ px: clamped, pct: Math.round((clamped / base) * 100) });
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    drag.current = { x: e.clientX, w: sideRef.current?.getBoundingClientRect().width ?? 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    if (!drag.current) return;
    // the panel sits to the RIGHT of the handle: dragging left widens it
    applyWidth(drag.current.w + (drag.current.x - e.clientX));
  };
  const endDrag = (): void => {
    drag.current = null;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const stepToPct = (pct: number): void => {
      const bodyW = bodyRef.current?.getBoundingClientRect().width ?? 0;
      if (!bodyW) return;
      applyWidth((sideColDefaultWidth(bodyW) * pct) / 100);
    };
    const cur = width?.pct ?? 100;
    switch (e.key) {
      case 'ArrowLeft': // handle moves left → panel widens
        stepToPct(cur + SIDE_STEP_PCT);
        break;
      case 'ArrowRight':
        stepToPct(cur - SIDE_STEP_PCT);
        break;
      case 'Home':
        stepToPct(SIDE_MIN_PCT);
        break;
      case 'End':
        stepToPct(SIDE_MAX_PCT);
        break;
      case 'Enter': // reset to the stylesheet default
        onWidth(null);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <div
      className="transon-splitter"
      data-testid="side-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize side panel"
      aria-valuemin={SIDE_MIN_PCT}
      aria-valuemax={SIDE_MAX_PCT}
      aria-valuenow={width?.pct ?? 100}
      aria-valuetext={`${width?.pct ?? 100}% of default width`}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onWidth(null)}
    />
  );
}
