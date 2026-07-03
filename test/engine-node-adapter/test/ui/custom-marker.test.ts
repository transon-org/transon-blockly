// AC-026 / FR-110 — the editor configured with a non-default marker key imports and exports
// accordingly. The codec-level marker substitution is proven in codec/marker.test.ts (FR-063); this
// proves the EDITOR session paths honour the configured marker end-to-end through the real engine:
//   - import  → the §7.15 reverse gate (tryReverse) accepts a template written with the marker,
//   - export  → the forward projection (runForward) regenerates JSON using that same marker,
//   - and a `$`-keyed object is treated as a literal (not a rule) when the marker is not `$`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EngineProvider, Json } from '@transon/editor-core';
import { encode } from '@transon/editor-core';
import { toWorkspaceState } from '@transon/editor-blockly';
import { tryReverse, runForward } from '@transon/editor-ui';
import { createNodeEngineProvider } from '../../src/index.js';

let engine: EngineProvider;
beforeAll(async () => {
  engine = createNodeEngineProvider();
  await engine.init();
});
afterAll(() => engine?.dispose());

const MARK = '@@'; // the editor's configured non-default marker (host.marker)

describe('custom-marker editor configuration (AC-026, FR-110)', () => {
  it('imports a template written with the configured marker (reverse §7.15)', async () => {
    const doc: Json = { [MARK]: 'attr', name: 'email', default: 'n/a' };
    const outcome = await tryReverse(engine, JSON.stringify(doc), MARK);
    expect(outcome.status).toBe('accepted');
    if (outcome.status === 'accepted') {
      // the accepted candidate decodes back to the same custom-marker document
      expect(outcome.document).toEqual(doc);
      expect(outcome.block).toMatchObject({ type: 'transon_rule_attr__name' });
    }
  });

  it('exports/generates JSON using the configured marker (forward)', async () => {
    const doc: Json = { [MARK]: 'attr', name: 'email' };
    const workspace = toWorkspaceState(await encode(engine, doc, MARK)) as Json;
    const r = await runForward(engine, workspace, MARK);
    expect(r.generation_status).toBe('complete');
    // generation reproduces the document with its `@@` marker (not `$`)
    expect(r.template_json).toEqual(doc);
  });

  it('a `$`-keyed object is a literal (not a rule) when the marker is @@ — meaning preserved (FR-110)', async () => {
    const doc: Json = { $: 'attr', name: 'x' }; // `$` is data here, not the configured marker
    const workspace = toWorkspaceState(await encode(engine, doc, MARK)) as Json;
    const r = await runForward(engine, workspace, MARK);
    expect(r.generation_status).toBe('complete');
    expect(r.template_json).toEqual(doc); // round-trips as a literal object under the @@ marker
  });

  it('the same document executes identically under the configured marker after a round-trip (AC-026)', async () => {
    const doc: Json = { [MARK]: 'attr', name: 'k' };
    const workspace = toWorkspaceState(await encode(engine, doc, MARK)) as Json;
    const regenerated = (await runForward(engine, workspace, MARK)).template_json!;
    const input = { k: 42 };
    const a = await engine.transform(doc, input, { marker: MARK });
    const b = await engine.transform(regenerated, input, { marker: MARK });
    expect(b.output).toEqual(a.output);
    expect(a.output).toBe(42);
  });
});
