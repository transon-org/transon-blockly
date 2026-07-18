# @transon/editor-element

## 0.2.1

### Patch Changes

- FR-132 (SPEC v2.8) Examples-picker hardening for host-supplied corpora + the
  `buildExampleCorpus`/`buildExampleCorpusFromDocs` embedder exports — see
  @transon/editor-react 0.2.1 for the full behavior.

## 0.2.0

### Minor Changes

- Opt-in runtime engine metadata (RFC-007): new `<transon-editor metadata-source="engine">`
  attribute / `metadataSource: 'engine'` option — see @transon/editor-react 0.2.0 for the full
  behavior (fetch + regenerate on engine-ready, same-major gate, snapshot fallback, presentation
  fallback). Default behavior unchanged.

## 0.1.1

### Patch Changes

- Fix FR-133 minimap detaching array/object children on a +/- slot mutation. The stock minimap
  mirrors each mutation by replaying `loadExtraState()` on its mirror block, whose rebuild removed
  and re-added every ITEM/VALUE input — orphaning the mirrored children (canvas unaffected). The
  rebuild now reconciles only the tail, preserving existing inputs and their connected children (and
  fixing latent on-canvas mutation undo/redo corruption from the same replayed event).

## 0.1.0

### Minor Changes

- dbcce52: Embedding host controls (RFC-005): `autorun` (re-run on every accepted template/input change,
  debounced — realizes NFR-027), `hideToolbarActions` (hide individual toolbar buttons; not rendered
  vs read-only's disable), an optional leading `onBack` toolbar action (`backLabel`), and an initial
  `paletteView` + `hidePaletteControls` for embeds that present all blocks with the progressive-
  disclosure chrome omitted. Widen the `@transon/editor-react` React peer range to `^18.0.0` (React
  18+) so hosts on 18.2.x can consume it.
