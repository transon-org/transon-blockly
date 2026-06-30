// Vitest jsdom setup for editor-ui (AD-021).
//
// 1. React Testing Library cleanup after each test (we don't enable vitest `globals`, so register
//    cleanup explicitly to match the rest of the monorepo's import-what-you-use style).
// 2. jsdom lacks the SVG measurement + layout APIs Blockly calls during `inject`/render. We stub
//    the minimum Blockly 13 touches so the interactive mount (D2) can run headlessly under jsdom.
//    These are inert for non-Blockly tests.

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

function polyfill(proto: object | undefined, name: string, impl: () => unknown): void {
  if (proto && typeof (proto as Record<string, unknown>)[name] !== 'function') {
    Object.defineProperty(proto, name, { value: impl, configurable: true, writable: true });
  }
}

// SVG text/geometry measurement Blockly uses for field/connection sizing.
const svgProto = typeof SVGElement !== 'undefined' ? SVGElement.prototype : undefined;
polyfill(svgProto, 'getBBox', () => ({ x: 0, y: 0, width: 0, height: 0 }));
polyfill(svgProto, 'getComputedTextLength', () => 0);
polyfill(svgProto, 'getScreenCTM', () => null);

const elemProto = typeof Element !== 'undefined' ? Element.prototype : undefined;
polyfill(elemProto, 'getBoundingClientRect', () => ({
  x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}),
}));

if (typeof globalThis.matchMedia !== 'function') {
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
