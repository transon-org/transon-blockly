# @transon/editor-react

## 0.2.1

### Patch Changes

- FR-132 (SPEC v2.8) Examples-picker hardening for host-supplied corpora: a corpus in which no
  entry carries tier or rule membership now renders as a flat, ungrouped list (previously every
  entry was shoved under one fabricated "Reference · other" optgroup), and entries in the same
  group whose doc-first-sentence labels collide are disambiguated with a ` — <case name>` suffix
  (the engine guarantees unique names, not unique doc sentences). Selection semantics unchanged.
- New embedder seam: `buildExampleCorpus` / `buildExampleCorpusFromDocs` (and the
  `EditorDocs`/`EditorMetadata` types) are exported. Hosts overriding `host.examples` should
  derive their corpus from the engine docs payload (`get_editor_metadata().docs` or the
  `get_all_docs()` export) via `buildExampleCorpusFromDocs` instead of hand-mapping — a
  hand-mapped corpus drops the `rule`/`tier` joins the tiered picker groups by.

## 0.2.0

### Minor Changes

- Opt-in runtime engine metadata (RFC-007, SPEC v2.5 §7.18, AD-036): `metadataSource: 'engine'`
  fetches the engine's editor-metadata once on the engine-ready transition through the new
  **optional** `EngineProvider.getEditorMetadata()` port method and regenerates the session's
  projection surface (palette, toolbox, encoder, decoder, block map) from the fetched catalog —
  so a newer engine's rules appear with no editor release and no snapshot re-pin (FR-139).
  Guarded by a same-major `metadata_version` compatibility gate with fail-safe fallback to the
  bundled snapshot and a persistent `metadata_fallback` diagnostic; the surface never mixes
  sources (FR-140). Rules unknown to the committed presentation project with a data-declared
  fallback (title = metadata name, the `presentation.json` fallback category, advanced; FR-141).
  The default `'snapshot'` path is unchanged; imperative loads issued during the arrival window
  now wait for it instead of racing it. The status bar shows `catalog: engine` on success and
  the fallback diagnostic on failure.

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
