import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// D0 — @transon/editor-react ships React as a PEER, not bundled (AD-019). Two proofs: the package
// manifest declares react/react-dom only under peerDependencies; and the built ESM leaves React
// external (imports it) rather than inlining React internals. The bundle assertion runs when the
// package has been built (turbo `build`); the manifest assertion always runs.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  peerDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
};

describe('@transon/editor-react is a React-peer distribution (AD-019)', () => {
  it('declares react + react-dom as peerDependencies and NOT as dependencies', () => {
    expect(pkg.peerDependencies?.react).toBeTruthy();
    expect(pkg.peerDependencies?.['react-dom']).toBeTruthy();
    expect(pkg.dependencies?.react).toBeUndefined();
    expect(pkg.dependencies?.['react-dom']).toBeUndefined();
  });

  it('does not bundle React into the ESM output (react stays external)', () => {
    const dist = resolve(root, 'dist/index.js');
    if (!existsSync(dist)) return; // built lazily; the manifest assertion above is the always-on gate
    const code = readFileSync(dist, 'utf8');
    // React external → the bundle imports the specifier rather than inlining React's implementation.
    const importsReact =
      /from ?["']react["']/.test(code) || /from ?["']react\/jsx-runtime["']/.test(code);
    expect(importsReact).toBe(true);
    // A telltale that React was INLINED would be its internal secret export marker.
    expect(code).not.toContain('__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED');
  });
});
