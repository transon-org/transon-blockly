# RFC-005: Embed the Transon visual editor inside the docs-site

- **Status:** **PROPOSED** (2026-07-06). Awaiting go-ahead to implement. No code/docs changed yet.
- **Type:** Cross-repo integration + a small set of **additive embedding options** on the editor.
  **No new `AD-*`; no projection/surface/round-trip semantics change** (§21.12 — codec artifacts
  stay byte-identical). The new behavior lands **SPEC-first** as append-only FRs (§21.2/§21.1);
  **Part 1 (SPEC alignment) is done first**, before any implementation. This RFC captures the design
  and the cross-repo integration that this repo's ROADMAP does not govern.
- **Scope split:** the editor stays **engine-free** (AD-008) and owns none of the app navigation or
  runtime — it only gains additive controls. All wiring (open-in-editor, back, examples, runtime
  reuse) lives in the docs-site repo.
- **Baseline:** SPEC v2.3 (FR-114…FR-134 landed; FR-135/AD-034 are RFC-003 P-E *reservations*, not
  landed). Engine baseline `transon` **v0.1.7** (R-32; the committed metadata snapshot's pin).
- **Repos (local siblings):** `transon-blockly` (this repo), `transon-org.github.io` (docs-site:
  CRA + craco + yarn, React ^18.2, PyScript 2023.03.1), `transon` (engine, PyPI ≥ 0.1.7).

## Problem (one line)

Add a visual Blockly editor mode to the Transon docs-site that **reuses the docs-site's existing
Python runtime** (no second Pyodide), lets a reader open any doc example in the editor, and always
runs in autorun with a minimal toolbar.

## Desired behavior (from the request)

1. ~~A standalone docs⇄editor mode switcher.~~ **Dropped as redundant.** Navigation is one-way in
   each direction: **enter** via the per-example button (req 2); **exit** via "Back to docs" (req 3).
2. On an open example: an "Open this sample in the editor" button.
3. In the editor: a **"← Back to docs"** button, placed **first in the editor toolbar** (leading
   action), that returns to docs — merges the old "close" affordance into the toolbar.
4. Editor shows all examples in a dropdown (**dropdown of all docs examples**, host-supplied).
5. **Hide** (not just disable) the Import, Copy, and Download toolbar buttons (extended: hide **all
   six** action buttons — Validate/Run are redundant under autorun).
6. Editor is **always** in autorun (re-run on every template/input change).
7. Editor **must reuse** the docs-site Python runtime — do **not** introduce a second Pyodide.

## Responsibility split (verified against the code)

- **Requirements 2, 4, 7 (and the docs-site half of 1/3)** are docs-site-side integration. The editor
  is engine-free and owns no app navigation or runtime.
- **Requirements 3, 5, 6 (and palette-always-advanced)** are new **editor** capabilities that do not
  exist yet:
  - **No autorun exists.** `NFR-027` ("Execution preview should debounce frequent edits where
    auto-run is enabled", SPEC:818) is present but **dormant** — nothing implements it.
  - **The toolbar cannot hide actions.** `Toolbar`
    (`packages/editor-ui/src/components/panels.tsx`, Toolbar ~L359-449) always renders
    New/Import/Copy/Download/Validate/Run; `readOnly` only **disables** New/Import. There is no hide.
  - **No leading/host toolbar action** exists (the "← Back to docs" button).
  - **Palette advanced-always with no toggle** may not be configurable at mount (to confirm, A5).
  All behavior-changing ⇒ SPEC-first (§21.2), new append-only FR IDs (§21.1).

## Decisions (locked 2026-07-06)

| # | Decision | Choice |
|---|---|---|
| Governance | RFC vs FRs vs milestone | **RFC-005 (this doc) + SPEC-first FRs; no milestone** |
| Packaging | how docs-site consumes `@transon/editor-react` | **dev = `pnpm link`/`file:`; production = URL to the GitHub release asset (tagged version); CI builds+attaches the tarball on the release** |
| Examples | selector in the embed | **Dropdown of all docs examples** (opened one preselected); **host supplies the list** via `host.examples` — the editor asks the environment, does not derive it |
| React | version alignment | **React-18+ compatible** (widen peer to `^18.0.0`) |
| Mode switcher | docs⇄editor toggle | **Dropped** — enter via per-example button, exit via leading "← Back to docs" |
| Toolbar actions | which to show | **Hide all six** (new/import/copy/download/validate/run) — Validate redundant under autorun |
| Generated-JSON panel | editable / read-only / hidden | **Editable** (bidirectional §7.15 — same as the reference demo) |
| Palette chrome | search + advanced toggle | **Strip both**; palette **always shows advanced blocks** (no toggle, no search) |
| Blank-editor entry | open editor with empty canvas | **No** (per-example entry only; maybe later) |
| transon pin | `==` vs `>=` | **Floor `>=0.1.7`** (docs-site keeps installing latest, as today) |
| PyScript | keep 2023.03.1 vs upgrade | **Upgrade to latest**; reuse it (no second runtime); extend its glue |
| Net toolbar | resulting embed toolbar | **Only "← Back to docs"** (six actions hidden + no view switcher in sandbox + palette chrome stripped) |

Governance note: the editor options are small and additive (comparable to the FR-130/131/132 UAT
slices, which landed SPEC-first without an RFC). This is captured as **RFC-005** anyway because it
spans two repos and pins the design/decisions for a cohesive feature; the normative behavior still
lands **SPEC-first** as append-only FRs in `SPEC.md` (the RFC is the design record, not the
contract). No new `AD-*`, no numbered milestone.

---

## Part 1 — SPEC alignment (SPEC-first; land this FIRST)

All contract-doc changes are collected here and land **before** any implementation (§21.2). Every
new item is **append-only** at the next free ID (§21.1); nothing is renumbered. All changes are
**UI-only** (§21.12) — no codec/projection/round-trip semantics move, so the committed codec
artifacts stay byte-identical.

### 1.1 New FRs (in `SPEC.md` §7.14 Component Embedding)

| Proposed ID | Requirement (draft wording) | Homes / notes |
|---|---|---|
| **FR-α (autorun)** | *"The component shall support an autorun mode that re-executes the template against the current sample input on every accepted template change and on sample-input change (debounced per NFR-027), keeping the output panel live without an explicit Run."* | §7.14; **realizes NFR-027**; note in §12.9 (Output Panel) |
| **FR-β (hide toolbar actions)** | *"The component shall support hiding individual toolbar actions (New, Import, Copy, Download, Validate, Run). A hidden action is **not rendered** — distinct from read-only (FR-107), which **disables**."* | §7.14; note in §12.3 (Toolbar Actions) |
| **FR-γ (leading toolbar action)** | *"The component shall support an optional host-provided **leading** toolbar action (a back/close affordance): when supplied, the editor renders it as the **first** toolbar item and invokes the host callback on activation. The editor performs no navigation itself (AD-008)."* | §7.14; note in §12.3 |
| **FR-δ (initial palette view)** — *conditional, A5* | *"The component shall accept an initial palette view (advanced-blocks shown, search term), so an embedder can present all blocks with the progressive-disclosure chrome omitted."* | §12.6 note. **Add only if** the editor has no initial-palette config today (verify first) |

### 1.2 NFR realized

- **NFR-027** flips from **dormant → realized** by FR-α (autorun debounce). Update its
  `traceability.md` row `[ ]→[x]` with the autorun test citation.

### 1.3 Existing-section notes (no new IDs)

- **§12.3 Toolbar Actions** — document that actions can be **hidden** (FR-β) and that an optional
  **leading** host action (FR-γ) renders first.
- **§12.6 Progressive Disclosure** — an embedder may **omit** the search/advanced chrome and force
  **advanced-always** (FR-δ / host config).
- **§12.9 Output Panel** — under autorun the output is **live** (updates on every accepted change).

### 1.4 Cross-doc bookkeeping (same changes)

- **`docs/traceability.md`** — one row per new FR (with its test id) + the NFR-027 flip.
- **`docs/id-ledger.json`** — register the new IDs via `--update` (refuses non-contiguous numbering).
- **`SPEC.md` header** — version bump (e.g. **v2.3 → v2.4**) + changelog line.
- **Changeset** (AD-021) — a minor entry for `@transon/editor-react` (new options + widened React
  peer, Part 2 A4).
- **`ARCHITECTURE.md`** — **no new AD**; `onBack` and host-supplied examples both fall under the
  existing host-boundary (AD-008/§5.2). `metadata-contract.md` — **no change**.

### 1.5 ID assignment

The id-ledger's next-free FR is **135**, but RFC-003 P-E holds an (unregistered) *reservation* of
FR-135. Register FR-α/β/γ(/δ) at the true next-free at implementation time and **coordinate to avoid
colliding** with the P-E reservation (§21.1 append-only; take next-free, deprecate-in-place if
needed). Likely **FR-135…FR-137** (plus one if FR-δ is needed).

---

## Part 2 — editor implementation (transon-blockly)

Each slice is **test-first** (cite the FR), threads the option through the one
`EditorControllerOptions` funnel → `TransonEditorHost` → `<TransonEditor>` prop → `<transon-editor>`
attribute, and adds its `traceability.md` row in the same change. Options are **orthogonal** so the
embed composes them.

### A1 — Autorun (`autorun?: boolean`) → FR-α

- In `controller.ts` (`packages/editor-ui/src/session/controller.ts`, `EditorControllerOptions` ~L21-38): when
  set, after each accepted forward `project()` and inside `setInputText` (valid parse), fire a
  debounced auto-`run()` (reuse the 150 ms debounce / NFR-027). Respect existing gating (engine
  `ready`, `inputInvalid` guard). Codec untouched.
- **Test:** `packages/editor-ui/test/autorun.test.tsx` — run fires on template change and on input
  change, debounced, and **not** when the engine is not ready.

### A2 — Hide toolbar actions (`hideToolbarActions?`) → FR-β

- `hideToolbarActions?: Array<'new'|'import'|'copy'|'download'|'validate'|'run'>` → `Toolbar` skips
  the matching elements (incl. the `import` `<label>`+`<input>`).
- **Test:** `packages/editor-ui/test/toolbar-visibility.test.tsx` — hidden actions absent from the
  DOM; unhidden unaffected; independent of `readOnly`.

### A3 — Leading toolbar action (`onBack?` + `backLabel?`) → FR-γ

- `onBack?(): void` + `backLabel?: string` (default `"Back"`; docs-site passes `"Back to docs"`).
  `<transon-editor>` carries the label as an attribute + emits a `back` event. `Toolbar` renders a
  leading button (chevron-left + label) **before** New when `onBack` is set. The editor only invokes
  the callback — no navigation itself (AD-008).
- **Test:** `packages/editor-ui/test/toolbar-back.test.tsx` — renders first only when provided; click
  calls it; absent otherwise.

### A5 — Palette advanced-always (conditional) → FR-δ

- Stripping the palette Search + Advanced toggle is host-side: the embed does **not** pass
  `onPaletteView`, so `Toolbar` renders neither (gated, `packages/editor-ui/src/components/panels.tsx` ~L426).
- Forcing **advanced-always** with no toggle needs the palette to default to `showAdvanced: true`.
  **Verify** the editor can set an initial palette view; if not, add a small option (e.g.
  `paletteView?: { showAdvanced; search }` or `showAdvancedBlocks?: boolean`) with a red-first test.
  If it already exists, A5 is host-config only (no FR-δ).

### A4 — React-18+ compatibility

- Widen `@transon/editor-react` `peerDependencies` react/react-dom **`^18.3.1` → `^18.0.0`**
  (`packages/editor-react/package.json`); keep 18.3.1 as the
  dev/build/test version. Changeset entry (folded into Part 1 §1.4).

---

## Part 3 — docs-site integration (`transon-org.github.io`)

The editor's forward projection runs the **codec through the engine** (AD-030), so the shared
interpreter must run **transon ≥ 0.1.7** and raise the recursion limit. Note: `get_editor_metadata()`
is **not** a hard runtime dependency — the editor uses its **committed** metadata snapshot (AD-012);
the glue only calls it inside `transon_version()` for the FR-080 diagnostic, already
`try/except`-guarded. Hard requirements: `transon >= 0.1.7` + `setrecursionlimit(≥1400)`.

### B0 — Upgrade PyScript to latest (prerequisite)

docs-site runs **PyScript 2023.03.1** (`public/index.html`), whose Pyodide (~0.23) is far older than
the reference host's 0.28.3 — a compatibility risk for `transon 0.1.7` + `setrecursionlimit(1400)`.
**Upgrade to the latest PyScript** and **reuse it** (still no second runtime). This is a real
migration: the 2023.03.1 API (`<py-config>`, `<py-script>`, `pyscript.interpreter.globals.get(...)`)
differs from current PyScript (`<script type="py">` / `pyscript.toml`, and a different globals
accessor). Work: update `index.html` + config, migrate the `transform()` JS bridge, and point the
`SharedPyScriptProvider` (B3) at the **new** globals API. Pin the exact accessor once the target
PyScript version is chosen.

### B1 — `public/config.toml` (engine floor)

Pin the engine to a **floor**: `packages = ["transon>=0.1.7"]` (currently unpinned → already floats
to latest PyPI, so the docs rendering path via `transon.docs` is unchanged — verify no regression).

### B2 — `public/script.py` glue upgrade

Keep the existing `transform(...)` and `js.init(...)` intact. Add, mirroring
`examples/reference-host/src/glue.ts` `GLUE_PY`:

- `import sys; sys.setrecursionlimit(max(sys.getrecursionlimit(), 1400))` (AD-035/§6.5).
- `transon_validate(template_json, marker)`,
- `transon_transform(template_json, input_json, marker, includes_json, js_loader, max_include_depth=None)`,
- `transon_version()`.

These land in the interpreter globals alongside `transform` (accessor per B0).

### B3 — `SharedPyScriptProvider` (new)

A thin `EngineProvider` (a variant of
`examples/reference-host/src/provider.ts` with **no
`loadPyodide`**) that proxies to the **existing** interpreter over JSON strings:

- `status`: `ready` once the glue (`transon_transform`) is reachable through the new PyScript globals
  API; present by the time React mounts (init hook runs after the Python module); else `idle`/`loading`.
- `init()`: resolve when the glue is present (no Pyodide load).
- `validate` / `transform` / `version`: call the globals, `JSON.parse` the returned string; map
  snake_case `files_written` → camelCase `filesWritten`; **omit** `max_include_depth` when unset
  (JsNull ≠ Python None — same trap the reference provider documents).
- `dispose()`: **no-op** — never tear down the shared interpreter.

### B4 — App shell wiring (`src/App.tsx`, `src/ExampleEditor.tsx`, `src/index.tsx`)

- App-level `view` state (`'docs' | 'editor'`) — **no persistent switcher**; entry/exit are the two
  buttons below.
- "Open this sample in the editor" button on `ExampleEditor` → `{view:'editor', template, data,
  result}` (req 2).
- Editor view renders (no `onPaletteView` → palette chrome stripped, A5):
  `<TransonEditor autorun onBack={()=>setView('docs')} backLabel="Back to docs"
  hideToolbarActions={['new','import','copy','download','validate','run']}
  template={…} input={…} host={{ engine: sharedProvider, examples }} />`. Toolbar contains **only**
  the "← Back to docs" leading action. Generated-JSON panel stays **editable** (bidirectional §7.15).
- **Examples come from the host** (req 4): map the docs corpus `IExampleData[] → ExampleCase[]` and
  pass as `host.examples` — the editor asks the environment for the list, does not pre-filter for
  surface; out-of-surface cases hit the editor's normal error path.
- **No blank-editor entry** (req 6): per-example only (New is hidden). Deferred.
- Create the `sharedProvider` once at app level (runtime is `ready` post-init).

---

## Part 4 — packaging & release plumbing

- **Release:** a transon-blockly CI job on a **version tag** (`v*`) runs
  `pnpm --filter @transon/editor-react build && npm pack` and **attaches the `.tgz` to the GitHub
  release** for that tag.
- **docs-site — dev:** `pnpm link` / `yarn add file:../transon-blockly/packages/editor-react` (after
  a local build) for live iteration.
- **docs-site — production:** depend on the **URL to the GitHub release asset** for the tagged
  version (`yarn add https://github.com/.../releases/download/v<x.y.z>/transon-editor-react-<x.y.z>.tgz`),
  so the deployed build is reproducible and versioned.

## Why the Pyodide-cost concern is largely moot

Reusing the runtime means **no second Pyodide load** — the ~10–15 s splash is Pyodide itself, which
is unchanged. The only additions are ~5 glue functions (negligible) and pinning the same `transon`
package that is already installed. Autorun issues more in-process `transform` calls per edit, cheap
for ordinary examples (the recursion-budget ceiling only bites the deepest self-hosting codec files,
not doc examples).

## Sequencing

0. **Part 1 — SPEC alignment** (SPEC-first): FR-α/β/γ(/δ), NFR-027 flip, §12.3/§12.6/§12.9 notes,
   traceability + id-ledger + version bump + Changeset. Land before any code.
1. **A1** — autorun impl (test-first).
2. **A2** — hide-toolbar-actions impl (test-first).
3. **A3** — leading `onBack` action impl (test-first).
4. **A5** — palette advanced-always config, if the editor lacks one (test-first, small).
5. **A4** — widen peer range.
6. **B0** — docs-site: upgrade PyScript to latest.
7. **B1–B4** — docs-site: engine floor, `script.py` glue, `SharedPyScriptProvider`, app wiring.
8. **Part 4** — CI tarball-on-tag + docs-site release-asset dependency.

Gates after each editor slice: `harness/scripts/check_traceability.py`, `check_engine_parity.py`,
full turbo build/test/typecheck; codec artifacts must stay byte-identical (UI-only, §21.12).

## Resolved questions (log)

1. ~~Validate under autorun~~ — **hidden** (redundant; errors surface live).
2. ~~transon pin~~ — **floor `>=0.1.7`**.
3. ~~tarball reference~~ — **dev `file:`/link; production = GitHub release-asset URL** (tagged).
4. ~~out-of-surface examples~~ — **host provides the list** (`host.examples`); no surface pre-filter;
   unsupported → normal error path.
5. ~~palette chrome~~ — **stripped**; **advanced blocks always shown**.
6. ~~blank-editor entry~~ — **no** (per-example only).
7. ~~PyScript compatibility~~ — **upgrade to latest** and reuse (B0).
8. ~~pin affects docs rendering~~ — floor keeps docs on latest `transon`; **must not regress**.
9. ~~style isolation~~ — **verify** editor `--transon-*` CSS ↔ docs-site Bootstrap 5.3 don't bleed.

**Verify during implementation (not decisions):** PyScript migration surface (B0) · advanced-always
config existence (A5 → FR-δ or not) · docs-rendering + CSS-bleed regression checks (8, 9).

## Non-goals

- No engine runtime shipped by the editor (AD-008 unchanged).
- No projection / surface / round-trip / codec change (§21.12; artifacts byte-identical).
- No new transformation language or DSL (§21.8).
- The docs-site repo's changes are **not** governed by this repo's ROADMAP/milestones.
