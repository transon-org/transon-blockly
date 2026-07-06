---
"@transon/editor-react": minor
"@transon/editor-element": minor
---

Embedding host controls (RFC-005): `autorun` (re-run on every accepted template/input change,
debounced — realizes NFR-027), `hideToolbarActions` (hide individual toolbar buttons; not rendered
vs read-only's disable), an optional leading `onBack` toolbar action (`backLabel`), and an initial
`paletteView` + `hidePaletteControls` for embeds that present all blocks with the progressive-
disclosure chrome omitted. Widen the `@transon/editor-react` React peer range to `^18.0.0` (React
18+) so hosts on 18.2.x can consume it.
