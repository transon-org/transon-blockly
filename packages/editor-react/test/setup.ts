// Vitest jsdom setup for editor-react. <TransonEditor> renders a live Blockly workspace, so stub the
// SVG/canvas/layout APIs jsdom lacks (same set as editor-ui / editor-element). RTL cleanup after each.

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

function polyfill(proto: object | undefined, name: string, impl: () => unknown): void {
  if (proto && typeof (proto as Record<string, unknown>)[name] !== 'function') {
    Object.defineProperty(proto, name, { value: impl, configurable: true, writable: true });
  }
}

const svgProto = typeof SVGElement !== 'undefined' ? SVGElement.prototype : undefined;
polyfill(svgProto, 'getBBox', () => ({ x: 0, y: 0, width: 0, height: 0 }));
polyfill(svgProto, 'getComputedTextLength', () => 0);
polyfill(svgProto, 'getScreenCTM', () => null);

const elemProto = typeof Element !== 'undefined' ? Element.prototype : undefined;
polyfill(elemProto, 'getBoundingClientRect', () => ({
  x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}),
}));

if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: () => ({
      measureText: (text: string) => ({ width: String(text).length * 8 }),
      fillText: () => {}, font: '', save: () => {}, restore: () => {}, scale: () => {},
      clearRect: () => {}, fillRect: () => {}, beginPath: () => {}, moveTo: () => {},
      lineTo: () => {}, stroke: () => {},
    }),
  });
}

if (typeof globalThis.matchMedia !== 'function') {
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }),
  });
}
