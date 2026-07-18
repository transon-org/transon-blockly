# Current state — working handoff

> **Non-authoritative working memory** (G-06). A session-to-session handoff, not part of the
> contract. Where this and the contract docs (`SPEC.md`, `ARCHITECTURE.md`, `ROADMAP.md`,
> `AGENTS.md`) disagree, **they win**. Update the narrative below at the end of a work session;
> regenerate the header with `python harness/scripts/update_memory.py --state`.

<!-- BEGIN generated: at-a-glance · python harness/scripts/update_memory.py --state -->
| | |
|---|---|
| Repo HEAD | `fb2a4ed` — Merge pull request #16 from transon-org/rfc-008-generator-shrink |
| Branch | `fix-variant-face-collision` |
| Engine pin | transon `v0.2.0` @ `58391ecc49bd` (see [metadata-snapshot.md](metadata-snapshot.md)) |
| Metadata snapshot | committed ([metadata-snapshot.json](metadata-snapshot.json)) |
<!-- END generated: at-a-glance -->

## Last action

_**NFR-052 NETWORK-HERMETIC MOUNT (2026-07-18, branch `fix-hermetic-mount`):** main's
`agentic-checks/tests` went red on the last two merge pushes with 8 unhandled `fetch failed`
rejections — diagnosed to Blockly's DEFAULT media path: `mountBlockly` passed no `media`/`sounds`
option, so `WorkspaceAudio` preloaded 4 sounds from `static.blockly.com` (IPs in the CI error
match that domain exactly; reproduced locally with a `--require` fetch logger) on every jsdom
mount; PR runs passed only because the CDN happened to respond. SPEC-first: **NFR-052** appended
(§8.8): mount is network-hermetic, sounds disabled (the audio preload is the media path's only
consumer in our surface); id-ledger +1; traceability row. Red-first:
`packages/editor-ui/test/hermetic-mount.test.ts` (rejecting fetch spy + `hasSounds === false`;
failed pre-fix with the exact CI signature). Fix: `sounds: false` in `mount.ts` inject options.
Verified: fetch-logger sweep over geometry+density corpus suites shows ZERO fetches; full suite +
gates green. Display-only, no artifact change._

_**VARIANT FACE-COLLISION FIX (2026-07-18, branch `fix-variant-face-collision`, not merged):**
user-reported: `call`/`expr` `value` vs `values` and `map` `item` vs `items` rendered
pixel-identical in palette AND canvas — §12.5's unconditional "lone value input goes bare"
assumed the socket unambiguous, false across sibling variants differing only by that param's
name; the variant-agnostic flyout dual label + rule-level tooltip masked nothing. SPEC-first
revision of **§12.5** (2026-07-18): bare socket ONLY when the face stays unique among the rule's
variants; colliding variants keep the param label; flyout substitution preserves trailing label
text merged into the title run. Implementation: `enrichForPalette` computes per-param `bare` via
a rendered-face signature (collision ⇒ labelled), `G_palette`'s `P_PARAM_SEG_DEFAULT` now conds
on `bare` (not `kind`); the flyout-label extension (`blocks.ts`) substitutes only the title
portion of the first FieldLabel (Blockly merges "Map"+"items" into ONE text run — wholesale
replacement would re-collapse the flyout faces; bonus: `expr__base`'s "op" / `call`'s "name"
label no longer swallowed in the flyout). Tests: face-uniqueness regression gate (no two rule
defs render the same face, names/accept stripped) + concrete labelled/bare assertions
(palette.test.ts), flyout suffix-preservation (metadata-blocks.test.ts). **Regen trap applies**
(rebuild editor-core → regen → rebuild again — first regen runs the stale inlined G_palette);
density baseline regenerated (`UPDATE_DENSITY=1` — labelled sockets widen expr/call faces
~+50px, accepted cost). All gates green (traceability, parity 23/29/34, snapshot check), full
suite green, **live-verified** (Pyodide): palette shows `Map (map) item` / `Map (map) items`,
`Call function (call) name [str▾] value/values` distinct; canvas face `Call function name [str▾]
values`; console clean. Display-only (§21.12): codec, artifacts encoder/decoder, round-trip
untouched (only `G_palette.json` + `palette.json` regenerated)._

_**RFC-008 SLICES 2–3 IMPLEMENTED (2026-07-18, branch `rfc-008-generator-shrink`, SPEC v2.7):**
slice 2 SPEC-first: **FR-142** (§7.19 session-init codec engine-floor check, §16.4 `engine_floor`
persistent non-blocking diagnostic), **NFR-051** (structural predicates = total `in`/`length`,
never value sentinels), **AC-044**, **AD-037** (ARCHITECTURE), metadata-contract §5 floor note,
id-ledger +4. Slice 3 red-first: `sentinel-collision.test.ts` + 3 `unsupported-sentinel-*`
corpus entries reproduced the AD-004 defect (5 tests red), then the `codegen.ts` rewrite —
`keyPresent`/`thisHasKey`/`fieldsHasMarkerKey`/dec presence → direct `in`;
`allRequiredPresent`/`noForeignKey`/escape emptiness → `length == 0` (R1 empty-operand fix
preserved vacuously, `_rp`/`_fk` save-restore dances deleted); `@`-time predicates → `length > 0`;
marker presence → `in`; negation = chained unary `!` (OQ2); ALL four sentinel strings deleted.
**Regen trap:** after editing the builders, rebuild editor-core → regen → rebuild AGAIN (the
dist inlines G_*.json + artifacts at build time; first regen otherwise runs the stale inlined
generators and writes a near-noop). Artifacts: encoder **419→244 KB (−42%)**, decoder
**163→104 KB (−36%)**. FR-142: `CODEC_ENGINE_FLOOR='0.1.8'` + total `isBelowEngineFloor`
(run.ts, exported), wired into `loadEngineVersions`, `engine_floor` store field + StatusBar
badge; unit + wiring tests. All gates green; full suite green (**full-package runs**: 1611
engine-node-adapter + 198 editor-ui — a wider scope than AC-027's seven-suite workspace figure
in traceability, which counts only the workspace suites);
**live-verified** (Pyodide, engine 0.2.0): no floor badge; `{"$":"this","transon::absent-key":1}`
JSON edit now **rejected** `import_unsupported` workspace-unchanged (previously silently accepted
+ key dropped); control `{"$":"this"}` accepted; console clean. **Review done (maker≠checker): `round-trip-reviewer` verdict READY TO
MERGE, no 🔴/🟡** — it independently verified `in`/`length`/`!` totality against the pinned
engine source, predicate equivalence (incl. zero-param vacuous cases), escape/malformed operand
totality, the decoder `default:{}` hardening (472 resave/load cases), blockmap parity, and
FR-142 wiring (floor probes incl. `-rc`/unknown)._

_**RE-PINNED ENGINE 0.1.7 → 0.2.0 (2026-07-18, RFC-008 slice 1, SPEC v2.6, NOT committed):**
snapshot regenerated from a clean `v0.2.0` tag worktree (23 rules / 15 operators / 34 functions;
metadata 3.0); `presentation.json` +`split` (Composition) + `expr.op` menu `in` entry
(alias-free — symbol == name, `menuFor` rejects duplicate tokens); artifacts regenerated
(`UPDATE_ARTIFACTS=1`, **rebuild `@transon/editor-core` first** — the adapter consumes the
built dist, so a stale build silently regenerates from the old snapshot); density baseline
regenerated (`UPDATE_DENSITY=1`, corpus 121→163); reference-host `PINNED_ENGINE_VERSION`
0.1.7→0.2.0 (wheel confirmed on PyPI); count-assertion tests updated (23 rules / 15 ops / 34 fns;
the `expr.op` symbol-first test now exempts `in`, whose symbol IS the word); SPEC **v2.6** (§14.14
`in`, §14.15 function library, **§14.17 `split`** appended per §21.1, FR-040 +`split`). **Trap
found:** the pyenv `python3` (used by pre-commit/CI gates) carries the pinned wheel — upgraded
to 0.2.0, else `update_memory.py --check` fails on engine_version drift. **All gates green**
(parity: 23/29/34), full suite green (1579 adapter tests), **live-verified** in the Pyodide
reference host: status `engine 0.2.0 · metadata 3.0`, `Split (split)` in the default palette,
`SplitString` corpus example loads, round-trips, runs → `["refs","heads","main"]` matches
expected, console clean. RFC-008 slices 2–3 (sentinel→`in` rewrite) NOT started._

_**RFC-008 DRAFTED (2026-07-18, analysis session, no code change):**
[`docs/proposals/rfc-008-generator-shrink-via-in.md`](proposals/rfc-008-generator-shrink-via-in.md)
— the editor-side follow-up to **engine RFC 0007** (0.1.8's builtin-function batch; its changelog
names "`transon-blockly` generator shrink via `in`"). Proposes: re-pin snapshot 0.1.7 → 0.2.1
(the RFC-007 skew test is done; `presentation.json` needs a `split` entry + `expr.op` `in` menu
entry or `generateToolbox` fail-louds), then rewrite the `codegen.ts` membership/emptiness
helpers onto the total `in` operator + `length` (kills the `transon::absent-key` /
`@gen`/`@noopt`/`__transon_no_marker__` sentinels; est. encoder −38 %, decoder −21 %). **Found &
reproduced an AD-004 violation** against the committed artifacts (real engine): a rule node whose
only foreign key is literally `"transon::absent-key"` encodes as the rule and decodes with the
key silently dropped (`{"$":"this","transon::absent-key":1}` → `{"$":"this"}`) — the join-sentinel
`noForeignKey` guard is forgeable from user documents; the `in` rewrite is the structural fix.
Maintainer decisions pending (RFC-008 OQs: engine-floor check FR or docs-only; negation form;
hotfix sequencing; `call` menu curation). Not committed/pushed by the analysis session._

_**RELEASED 0.2.0 (2026-07-17):** PR #13 merged (`feef227`); `@transon/editor-react` +
`@transon/editor-element` **0.2.0**, `@transon/reference-host` 0.0.3 (`6a94b4c`, tag `v0.2.0`);
release workflow attached `transon-editor-react-0.2.0.tgz`; docs site
(`transon-org.github.io` `ab160fc`) pin bumped to the v0.2.0 tarball — the site's embed is now
ALSO opted into the runtime metadata source (`transon-org.github.io` `9248650`:
`transon_editor_metadata` glue in script.py + `SharedPyScriptProvider.getEditorMetadata()` +
`metadataSource="engine"` on the EditorView embed) — live-verified in production: status bar
`engine 0.1.8 · metadata 3.0 · catalog: engine`, `split (split)` in the palette, no fallback
diagnostic. OQ-R3 CI smoke still deferred._

_**RFC-007 IMPLEMENTED — opt-in runtime engine metadata, live-verified against the 0.1.8 skew
(2026-07-17, branch `rfc-007-dynamic-metadata`, 7 commits, NOT pushed/merged).** Maintainer
directives: implement per the harness; **NO snapshot re-pin** — the 0.1.8-engine vs 0.1.7-pin skew
is the deliberate real-world test. **Phase 0 (SPEC-first, `83418a9`):** SPEC **v2.5** §7.18
(**FR-139** opt-in `metadataSource:'engine'` fetch+regenerate at session init; **FR-140**
same-major `metadata_version` gate + snapshot fallback, never a mixed catalog; **FR-141**
data-driven presentation fallback), **AC-043**, §16.4 `metadata_fallback`, **AD-036**,
metadata-contract §3 (optional `EngineProvider.getEditorMetadata()`) + §5 (same-major policy),
ledger + traceability rows, RFC-007 ratified (OQ-R1 explicit flag · OQ-R2 same-major · OQ-R3 CI
smoke DEFERRED · OQ-R4 depth constants = conservative floor · OQ-R5 full payload · OQ-R6 before
Tier B · OQ-R7 `presentation.json fallbackCategory: "Custom"`). **Phase 1 (P-C, `8f302be`):**
`encode`/`decode`/`blockMap` take an optional `CodecArtifacts` bundle (default committed);
`applyPaletteSurface()` override re-registration (Blockly registry is global — one dynamic
session per page, AD-036 trade-off); mount `toolbox` option + `setBaseToolbox()`; controller
session `codecArtifacts` threaded through forward/reverse/encode; byte-identical default.
**Phase 2 (`0c308e0`):** `metadata/dynamic.ts` (`fetchRuntimeSurface` /
`validateMetadataPayload` / `isCompatibleMetadataVersion` / `presentationWithFallback` /
`MetadataFallbackError`); Pyodide glue `transon_editor_metadata` + provider proxy; Node runner
`editor_metadata` op + adapter method; controller `maybeApplyRuntimeSurface` on the ready
transition (all-or-nothing swap); persistent `metadata_fallback` store field + StatusBar
`catalog: engine` / fallback badge; `<transon-editor metadata-source="engine">`. **AC-043 live
pass (`c0fcf9f`):** demo URL knobs (`?engine=0.1.8&metadata=engine` — `main.ts`); real Pyodide:
dynamic session status `engine 0.1.8 · metadata 3.0 · catalog: engine`, `split (split)` in
palette (FR-141 fallback), `{"$":"split","sep":","}` accepted + regenerated + Run `"a,b,c"` →
`["a","b","c"]`; default session same engine: split rejected `import_unsupported`, workspace
unchanged. **Review (maker≠checker):** `round-trip-reviewer` verdict **READY TO MERGE, no 🔴**;
its 🟡 (imperative import racing the dynamic-arrival projection → silent drop) FIXED (`7080482`:
`arrivalSettled` serialization + regression test); 🟢 `__proto__` note recorded in the RFC, not
fixed (trusted host, AD-008). Tests added: `packages/editor-core/test/dynamic.test.ts`,
`packages/editor-ui/test/dynamic-metadata.test.tsx` (4),
`test/engine-node-adapter/test/codec/dynamic-surface.test.ts` (8, real engine — NOTE the local
`../transon` checkout is AHEAD of the pin, tests assert superset not equality),
reference-host provider proxy tests. Full workspace: **1588 tests / 7 suites green**, all
deterministic gates green ×5 commits (traceability, parity, snapshot `--check`, presentation,
behavior-size, corpus, append-only ids, no-codec-mapping); committed codec artifacts + snapshot
**byte-unchanged** (pin still 0.1.7 on purpose). One non-reproducible engine-node-adapter flake
under full-parallel turbo (request timeout under load; passes alone + on rerun). **ARCH body sync (`10b826b`, user-caught):** AD-036 had landed but ARCHITECTURE.md prose was
stale — §5.2 `EngineProvider` snippet now carries the optional `getEditorMetadata()`, the
same-port projection list gained the session-init execution point, §2 principle 5 / §5.4 / §5.1
note AD-036, header bumped v2.0→v2.1 (stale `AD-001..031` ranges fixed to `..036`). **Next:**
(1) review/merge the branch (PR off `rfc-007-dynamic-metadata`); (2) consider OQ-R3 floating-
engine CI smoke as follow-up; (3) RFC-006 Tier B sequencing now unblocked (OQ-R6); (4) optional
hardening: null-prototype rules map in `presentationWithFallback`._

_**RFC-007 proposed — optional runtime engine metadata (2026-07-16, `main`, UNCOMMITTED).**
Motivating incident: engine **v0.1.8** released → deployed editors project its new/changed shapes
as `transon_unsupported` because the catalog + codec artifacts are compiled in from the pinned
snapshot (engine pin still **0.1.7**). Session traced the full pipeline (snapshot →
catalog-parameterized generators `generateCodec`/`generatePalette`/`generateToolbox`
(`codegen.ts:685/728/857`, all `(engine, rules, catalog[, presentation])` with snapshot only as
default) → committed artifacts → engine-executed at runtime) and wrote
[`docs/proposals/rfc-007-dynamic-engine-metadata.md`](proposals/rfc-007-dynamic-engine-metadata.md)
(**Status: Proposed** — design record only, **no SPEC IDs registered**; hints FR-139/AC-43/AD-36/
OQ-21). Shape: **hybrid, opt-in** — snapshot stays default + CI anchor (AD-030 regen gate
untouched); a host opting into `metadataSource: 'engine'` fetches `get_editor_metadata()` via a
new optional `EngineProvider.getEditorMetadata()` at session init, runs the generators over the
fetched catalog, falls back to the snapshot on `metadata_version` mismatch (NFR-038/039). Key work
items identified: P-C module-level constants (`editorMetadata`, `PALETTE_BLOCKS`/`TOOLBOX`,
`ENCODER`/`DECODER`/`BLOCKMAP`) → session state (ships first, byte-identical); P-D presentation
fallback (`codegen.ts:742` throws for a rule with no committed category — every new engine
built-in hits this); P-E RFC-004's depth/recursion constants are 0.1.7-measured. 7 open questions
(OQ-R1…R7: option shape, version-range policy, floating-engine CI, Tier-B sequencing). Gates
verified green (traceability, append-only ids). **NOT DONE:** the immediate **0.1.8 re-pin**
(`update_memory.py --snapshot` after refreshing the engine venv editable install + bump
`PINNED_ENGINE_VERSION` in `provider.ts:12`, smoke test couples them) — user hasn't asked yet.
**Next:** (1) maintainer answers the RFC-007 "Decision asked" section (ratify hybrid; OQ-R1/R2;
sequence vs RFC-006 Tier B); (2) re-pin snapshot to 0.1.8 regardless; (3) if ratified, Phase 1 =
P-C plumbing refactor (snapshot-only, artifacts byte-identical)._

_**Stop-hook loop fixed + RFC-006 handoff (2026-07-12, `main`, UNCOMMITTED).** After RFC-006 +
handoff narrative were already written, the `handoff-memory` stop hook kept re-prompting in a
loop. Root cause: `harness/scripts/update_memory.py` `_git()` used `.strip()` on
`git status --porcelain`, which ate the leading space on unstaged ` M path` lines; `_changed_paths`
then sliced `line[3:]` and turned `docs/current-state.md` into `ocs/current-state.md`, so
`handoff_nudge()` never saw the handoff update and kept firing. Fix: `_git`/`_git_in` use
`.rstrip("\\n")` only. Verified: `handoff_nudge()` → `None` with current-state in the dirty set.
Also: RFC-006 proposed earlier this session (see below)._

_**RFC-006 proposed — post-M6 consistency backlog Tiers A–D (2026-07-12, `main`, UNCOMMITTED).**
Analyzed the Blockly project (M0–M6 shipped, v0.1.1 live, docs-site embedded) and wrote
[`docs/proposals/rfc-006-post-m6-consistency-backlog.md`](proposals/rfc-006-post-m6-consistency-backlog.md)
(**Status: Proposed** — design/sequencing only; **no SPEC IDs registered**; all decisions left as
open questions). **Tier A** = contract honesty / consistency debt (FR-017, UC-010, FR-033, FR-048,
evidence pack, stale handoff/traceability rows). **Tier B** = R-28 consumer (`container`/`arm` in
snapshot 3.0 but `metadata-contract.md` §2.2 undocumented and unused by palette/runtime). **Tier C**
= M7 RFC-003 P-E adaptive layout (OQ-019 ratified; **FR-135 collision**: RFC-005 already used
FR-135…138 → P-E must take next-free **FR-139+ / AD-36+**). **Tier D** = process (post-hoc
review-gate on minimap fix, maturity M-10…15, handoff hygiene). Suggested order A→B→C→D but
**OQ-B0** (B before/after/parallel M7) undecided. **No product/SPEC behavior edits** — proposal +
handoff + the porcelain-strip hook fix only. Uncommitted: RFC-006, `current-state.md`,
`harness/scripts/update_memory.py`._

_**Coverage plumbing — Vitest workspace + CI + Codecov badge (2026-07-07, `main`, `07ce7de` + later
handoff syncs; Codecov end-to-end later fixed — see entries below).**
Added `@vitest/coverage-v8`, root `vitest.config.ts` (v8 provider, lcov/html reporters, `packages/**/src`
scope), expanded `vitest.workspace.ts` to all six test projects, `pnpm run coverage` + `make coverage`
(build-first), Codecov upload in `agentic-checks.yml` tests job, badge in README. Local run: **83.7%**
lines. _(Historical note in this entry: the original “unpushed / no token” state was cleared
2026-07-08 — see Codecov entries below.)_

_**UAT bug fix — minimap detached array/object children on +/- mutation (2026-07-07, `main`, uncommitted).**
FR-133 minimap divergence: adding then removing an array slot (or object field) detached all children
**on the minimap only**, canvas fine. Cause: the +/- buttons (`addItem_`/`removeItem_` in
`packages/editor-blockly/src/runtime.ts`) touch only the tail input, but the stock
`@blockly/workspace-minimap` mirrors each `BLOCK_CHANGE` by REPLAYING it on its mirror
(`Events.fromJson(...).run(true)`) → for a `'mutation'` change runs `loadExtraState()` →
`rebuildArray_`/`rebuildObject_`, which did `removeInputs()` (remove ALL item inputs, orphaning every
mirrored child) then re-appended empties. Fix: replaced `removeInputs` with `reconcileValueInputs`
(reconciles to target count, touching only the tail — preserves existing inputs + connected children);
both rebuilds use it, so `loadExtraState` now matches the incremental +/- path (also fixes latent
undo/redo corruption on-canvas, same replayed event). Object variant refreshes preserved KEY labels
(no-op setValue on tail-only replay). Added 2 FR-133 regression tests to `test/mutator.test.ts`
(connect children → drive mirror-replay add-then-remove → assert still connected); red before, green
after. `editor-blockly` 39/39, `editor-ui` 190/190, typecheck clean. **Released as a patch:** changeset
`.changeset/minimap-array-child-detach.md` → `pnpm changeset version` bumped **editor-react +
editor-element 0.1.0 → 0.1.1** (reference-host 0.0.1→0.0.2, private) + CHANGELOGs; editor-react@0.1.1
build clean (dist 259 kB, fix bundled). Pointed the docs-site (`../transon-org.github.io`, `master`)
`@transon/editor-react` dep at `.../releases/download/v0.1.1/transon-editor-react-0.1.1.tgz`.
**SHIPPED (per user directive commit+tag+push):** fix committed `main` `09dc71b`, tagged **`v0.1.1`**,
pushed; `release-editor-react.yml` succeeded → `transon-editor-react-0.1.1.tgz` attached to the
`v0.1.1` release (asset verified). Docs-site committed+pushed `1fff245`. **review-gate NOT run**
(direct-to-main per user) — post-hoc review still advisable (mutator/codec surface). Docs-site
`yarn.lock` still pins v0.1.0 → regenerate via `yarn install` (tarball now exists) + deploy._

_**CI fix — unresolvable Codecov action pin (2026-07-07, `main` `88e677a`, pushed).** Pushing the
queued coverage commit (`07ce7de`) reded `agentic-checks/tests`: `codecov/codecov-action` was pinned
to a non-existent SHA (`5a10915c…fd52` — first 7 chars right, rest fabricated). Corrected to the real
v5.5.1 commit `5a1091511ad55cbe89839c7260b706298ca349f7`, and — since no `CODECOV_TOKEN` secret is
configured and the step is strict (`fail_ci_if_error`) — gated the upload behind a job-level
`env.CODECOV_TOKEN != ''` so it skips cleanly until the token lands, then runs strict. `agentic-checks`
green again on `main`. (Provisioning `CODECOV_TOKEN` remains the way to actually enable upload.)_

_**Codecov upload now working end-to-end (2026-07-08, `main` `f487f18`, pushed).** The user provisioned
the `CODECOV_TOKEN` secret (~23:50), so the gated step ran for the first time — and failed: the
`codecov/codecov-action` wrapper downloads the signed CLI from `cli.codecov.io` and verifies its GPG
signature by importing Codecov's public key from keybase.io, which returned nothing (`no valid OpenPGP
data found` → `Can't check signature: No public key` → wrapper exit 1), so `fail_ci_if_error` reded
the tests job on an upstream key-fetch flake — not a token/coverage-file problem. Fix: `use_pypi: true`
on the step → the CLI installs from PyPI (`codecov-cli-11.2.8`, own integrity, no keybase fetch; the
job already sets up Python 3.12). Verified live: `agentic-checks` green, the upload step queued the
report (`app.codecov.io/github/transon-org/transon-blockly/commit/f487f18…`). **Codecov CI is fully
wired now** — token set, pin correct, PyPI install path, strict on real errors._

_**RFC-005 Part 4 — packaging + release plumbing (2026-07-06, branch `rfc-005-docs-site-embedding`
`3b98738`; docs-site `rfc-005-embed-editor` `ca04f3c`).** Made `@transon/editor-react` consumable
without the internal packages: `vite-plugin-dts` `bundledPackages: [editor-ui, editor-core,
editor-blockly]` inlines their types into the emitted `.d.ts` (was `import … from '@transon/editor-ui'`,
unresolvable downstream), and the package index now exports the engine-port types a host implements
(`EngineProvider`, `Json`, `ValidationResult`, `ExecutionResult`, `ToolbarActionId`). Verified the
rebuilt `.d.ts` is self-contained (only the package-name string remains) → **removed the docs-site
`src/transon-editor.d.ts` shim**; `EditorView`/`transonEngine` now import straight from
`@transon/editor-react`, docs-site `tsc --noEmit` + `yarn build` both clean. Added
`.github/workflows/release-editor-react.yml`: on a `v*` tag, `pnpm turbo run build --filter=@transon/
editor-react` + `npm pack` → attach the tarball to the GitHub release via `gh` (SHA-pinned actions,
`persist-credentials:false`, `contents:write`); `npm pack --dry-run` = `transon-editor-react-0.0.0.tgz`
(dist only), YAML valid. **NOT triggered** — pushing the first `v*` tag (→ cut the release) is the
remaining MAINTAINER step; after that the docs-site prod dep switches `file:` → the release-asset URL.
**RFC-005 is now IMPLEMENTED end-to-end (Parts 1–4) except that one manual release step.** Nothing
pushed; both branches local. **Next:** review/merge the two branches; cut a `v*` release to exercise
the workflow, then flip the docs-site prod dep. (Minor nit noted, not fixed: the packed tarball
includes `dist/tsconfig.tsbuildinfo` — harmless cruft; a `.npmignore`/files tweak could drop it.)_

_**RFC-005 Part 3 COMPLETE + BROWSER-VERIFIED — docs-site embedding wired (2026-07-06, repo
`../transon-org.github.io` branch `rfc-005-embed-editor`, commit `462184c`).** The docs-site now
embeds the visual editor, reusing its OWN PyScript runtime (no second Pyodide). **B0** upgraded
PyScript **2023.03.1 → 2026.3.1** (new `core.js` module + `<script type="py" src config>`; dropped
`<py-config>`/`<py-script>` + the interpreter-globals bridge). **B1** pinned `transon>=0.1.7`
(`config.toml`). **B2** `public/script.py` keeps the docs `transform`/`init`, adds
`setrecursionlimit(1400)` + `transon_validate`/`transon_transform`/`transon_version`, and exposes
them on `window` via `create_proxy` (the robust Pyodide-persist pattern; `import js` + `js.foo =
create_proxy(fn)`). **B3** `src/transonEngine.ts` = `SharedPyScriptProvider` (proxies `window.transon_*`
over JSON strings, polls readiness, no-op dispose) + `toExampleCases`. **B4** `App.tsx` holds a
once-created shared engine + `editorExample` state; `EditorView.tsx` renders `<TransonEditor autorun
onBack backLabel="Back to docs" hideToolbarActions=[all six] paletteView={{showAdvanced:true}}
hidePaletteControls host={{engine, examples: toExampleCases(props.examples)}}>`; `ExampleEditor.tsx`
got the "Open this sample in the editor" button (via `ExamplesContext.openInEditor`). Consumed
`@transon/editor-react` via a **`file:`** dep (dev); a local `src/transon-editor.d.ts` **type shim**
covers the package's internal `@transon/*` type imports (→ self-contained-types packaging follow-up,
recorded in RFC Part 4). **Verification:** `yarn build` compiled (main.js +256 kB = editor+Blockly);
served `build/` + drove Chrome (preview MCP) — network showed PyScript 2026.3.1 + Pyodide 0.29.3 +
`transon-0.1.7-py3-none-any.whl` from PyPI; docs render ("version 0.1.7"), zero console errors;
opening WorkedExampleNestedArithmetic mounted 57 blocks, engine `ready`, **autorun output "20" =
(2+3)*4 with no Run button**, toolbar = ONLY "← Back to docs" (all six hidden, no palette
search/advanced chrome, advanced blocks shown in palette), status "engine 0.1.7 / metadata 3.0",
Back returns to docs. **NEXT = Part 4** (transon-blockly CI: build+`npm pack` on tag `v*`, attach
tarball to the GitHub release; docs-site prod switches the `file:` dep → release-asset URL) + the
**self-contained editor-react types** fix (vite-plugin-dts `bundledPackages`). transon-blockly
`main`-vs-branch commits unchanged from Part 2; this turn only updated the RFC status + this handoff._

_**RFC-005 Part 2 COMPLETE — all editor embedding options implemented, test-first (2026-07-06,
branch `rfc-005-docs-site-embedding`, COMMITTED).** Five slices, one commit each, red-first then
green + traceability row flipped to `[x]`, all pre-commit gates green + full workspace turbo
test/typecheck exit 0, codec artifacts byte-unchanged (UI-only, §21.12): **A1** `0c4e4a8` autorun
(FR-135) — store-subscription in `createEditorController` re-executes (shared `runExecution`,
debounced per NFR-027) on `template_json`/`sample_input_json` change; `executeTemplate` no-ops when
gated so not-ready never runs; `autorun.test.tsx` (5). **A2** `ec114f4` hide-toolbar-actions
(FR-136) — `hideToolbarActions?: ToolbarActionId[]`, `Toolbar` omits each named element;
`toolbar-visibility.test.tsx` (4). **A3** `a0d1af1` leading `onBack`+`backLabel` (FR-137) — first
toolbar item, invokes host callback, no navigation (AD-008); `toolbar-back.test.tsx` (4). **A5**
`6d0c8b3` initial `paletteView` + `hidePaletteControls` (FR-138) — controller forwards the seed as
the mount's initial `view` (mount already honored `view`); `hidePaletteControls` withholds
`onPaletteView` → `Toolbar` drops search + advanced toggle; `initial-palette.test.tsx` (4). **A4**
`dbcce52` widen `@transon/editor-react` React peer `^18.3.1`→`^18.0.0` + Changeset. All options
threaded EditorControllerOptions→TransonEditor prop→`<transon-editor>` attrs (`autorun`,
`hide-actions`, `back-label`, `show-advanced`, `hide-palette-controls`); `ToolbarActionId` exported
from editor-ui index. **Design gap found + closed during A5:** `<TransonEditor>` always wired its
palette handler, so the embed could NOT strip the search/advanced chrome by omission → added
`hidePaletteControls` (folded into FR-138). Net embed toolbar = only "← Back to docs". **Next =
Part 3 (docs-site `transon-org.github.io`):** B0 upgrade PyScript to latest (real migration — new
globals API), B1 pin `transon>=0.1.7`, B2 `script.py` glue (setrecursionlimit 1400 +
transon_validate/transform/version), B3 `SharedPyScriptProvider` (proxy the existing interpreter, no
loadPyodide, no-op dispose), B4 app wiring (`<TransonEditor autorun onBack
hideToolbarActions=[all six] paletteView={{showAdvanced:true}} hidePaletteControls
host={{engine,examples}}>`); then Part 4 (CI tarball-on-tag + release-asset dep). Dev consumption:
`file:`/link the built editor-react._

_**RFC-005 Part 1 LANDED — SPEC alignment for docs-site embedding (2026-07-06, branch
`rfc-005-docs-site-embedding`, COMMITTED).** Branch off `main`; two commits: `daa5bd0` (RFC-005
proposal doc + handoff) and `0ddfeed` (SPEC v2.4). SPEC-first, append-only, UI-only (§21.12) — no
projection/surface/round-trip change, no new AD. Added **FR-135** autorun (realizes dormant
**NFR-027**), **FR-136** hide-toolbar-actions (not-rendered vs read-only's disable), **FR-137**
leading host toolbar action (`onBack`; editor invokes callback, no navigation, AD-008), **FR-138**
initial palette view (advanced-shown + search seed) — all in `SPEC.md` §7.14, with section notes in
§12.3/§12.6/§12.9 and the v2.4 changelog block. `traceability.md` rows added (all `[ ]` — SPEC
landed, impl pending Part 2); NFR-027 row marked SPEC-realized-by-FR-135. `id-ledger.json` registered
FR-135..138 (contiguous next-free = 135; **supersedes RFC-003 P-E's informal FR-135 reservation**,
which re-numbers at landing per §21.1). All pre-commit gates green (traceability, links, maturity,
engine-parity, append-only ids, presentation, behavior-size, corpus). **Verified for A5:**
`TransonEditor.tsx:61` hardcodes `useState({showAdvanced:false, search:''})` with NO seeding prop →
FR-138 is a genuine new option (not just host config). **Next = Part 2** (editor impl, test-first,
per the RFC sequencing): A1 autorun → A2 hide-actions → A3 onBack → A5 initial-palette (FR-138) → A4
peer-widen; then Part 3 docs-site (B0 PyScript upgrade first). Each editor slice: red-first test
citing the FR, thread the option through `EditorControllerOptions`→`TransonEditorHost`→
`<TransonEditor>`→`<transon-editor>`, flip the traceability row to `[x]`, keep codec artifacts
byte-identical._

_**Planning proposal written — embed the visual editor inside the docs-site (2026-07-06, on
`main`, UNCOMMITTED; DISCUSSION/PLANNING only, no behavior code).** User wants a visual Blockly
editor mode in `transon-org.github.io` reusing that site's EXISTING PyScript runtime (no second
Pyodide). Read the controller, engine port, reference `provider.ts`/`glue.ts`, SPEC §7.14/§12.3 +
NFR-027, `host.ts`, `Toolbar` (panels.tsx), and docs-site `index.html`/`config.toml`/`script.py`/
`App.tsx`/`ExampleEditor.tsx`. Verified the split: reqs 1/2/3/4/7 are docs-site glue; reqs 5/6 are
NEW editor capability — **autorun** (NFR-027 is present but DORMANT) and **hide-toolbar-actions**
(Toolbar always renders New/Import/Copy/Download/Validate/Run; `readOnly` only DISABLES). Key
finding: `get_editor_metadata()` is NOT a hard runtime dep (editor uses the committed snapshot,
AD-012; glue calls it only in the guarded `transon_version()`) — the hard needs are transon >=
0.1.7 + `setrecursionlimit(>=1400)`. Reuse moots the Pyodide-load concern (no second load).
**User decisions (interactive):** SPEC-first FRs, no milestone; `pnpm link`/`file:` dev +
CI-built tarball on a tagged release; examples = dropdown of all docs examples; editor React-18+
compatible (widen peer `^18.3.1`→`^18.0.0`). Captured the whole plan as **RFC-005**
`docs/proposals/rfc-005-docs-site-editor-embedding.md` (house RFC style; Parts A editor additions /
B docs-site integration / C packaging; sequencing, gates, open questions, non-goals). User then
asked for the plan to be an RFC (upgraded from the initial "no RFC" governance choice); the
normative behavior still lands SPEC-first as append-only FRs — the RFC is the design record. **ID note:**
ledger next-free FR is 135 but RFC-003 P-E holds an unregistered FR-135 reservation — coordinate at
registration (likely FR-135/136). **NOT DONE:** no SPEC/code edits yet — awaiting explicit
"proceed". Three open questions remain (see RFC-005): keep Validate under autorun?; pin
`==0.1.7` vs `>=0.1.7`?; docs-site tarball ref = vendored `file:` vs release-asset URL?
**Design-review Q&A refinements (same session):** (a) the embed uses **sandbox** shell mode, which
renders **no** Visual/JSON/Split view switcher — that switcher is COMPACT-mode only (sandbox
`Toolbar` is called without `onView`, TransonEditor.tsx:165-172); so the kept toolbar controls in
the embed are just Validate(?) + palette Search + Advanced toggle. (b) In sandbox the Generated-JSON
panel is an ALWAYS-ON right-column panel (Examples ▸ JSON ▸ Input ▸ Output ▸ Files-when-present) —
there is currently NO option to hide side PANELS (only toolbar actions), so hiding/omitting the JSON
panel in the embed would be an ADDITIONAL editor capability (a further FR) → still OPEN.
(c) rendered an inline mockup (first version wrongly drew a view switch; corrected per (a)).
**Decisions folded into RFC-005 (2026-07-06):** the standalone docs⇄editor mode switcher is DROPPED
as redundant (req 1) — enter via the per-example "Open in the editor" button, exit via a
"← Back to docs" button placed FIRST in the editor toolbar (req 3). That is a NEW editor capability →
**RFC-005 slice A3**: an optional host-provided leading toolbar action `onBack?()` + `backLabel?`
(editor renders it first, invokes the host callback, does NO navigation itself — engine-free, AD-008);
the peer-widen slice renumbered A3→A4; likely FR-135…137. **Validate RESOLVED (2026-07-06): hidden
too** — redundant under autorun (engine runs continuously, errors surface live in Output), so the
embed hides ALL SIX action buttons (`hideToolbarActions` = new/import/copy/download/validate/run).
**ALL open questions resolved (2026-07-06); folded into RFC-005.** (1) JSON panel = EDITABLE
(bidirectional, like the demo). (2) transon pin = FLOOR `>=0.1.7` (docs-site already floats to
latest). (3) tarball = dev `file:`/link, production = URL to the GitHub RELEASE ASSET (version-tagged;
CI builds+attaches on release). (4) out-of-surface examples: HOST provides the example list
(`host.examples`) — editor asks the environment, no pre-filter; unsupported → normal error path.
(5) palette chrome STRIPPED (no Search, no Advanced toggle) + advanced blocks ALWAYS shown → new
slice **A5** (confirm/add an initial `showAdvanced:true` palette config; may be a tiny FR). Net: the
embed toolbar is now ONLY "← Back to docs". (6) no blank-editor entry (per-example only). (7) UPGRADE
PyScript to latest & reuse it → new slice **B0** (real migration: 2023.03.1 `<py-script>`/
`pyscript.interpreter.globals` API differs from current PyScript; the `SharedPyScriptProvider`
accessor + `transform()` bridge get re-pointed once the target version is chosen). (8) floor pin keeps
docs rendering on latest transon (verify no regression). (9) verify no CSS bleed with docs-site
Bootstrap 5.3. Part A now A1 autorun / A2 hide-actions / A3 onBack / A5 palette-advanced / A4
peer-widen (likely FR-135…137+). **RFC RESTRUCTURED (2026-07-06, per user):** the RFC now leads with
**Part 1 — SPEC alignment** (SPEC-first, land FIRST): a consolidated table of the new FRs (FR-α
autorun→realizes NFR-027, FR-β hide-toolbar-actions, FR-γ leading onBack action, FR-δ conditional
initial-palette-view) with exact SPEC homes (§7.14 + §12.3/§12.6/§12.9 notes), the NFR-027 dormant→
realized flip, and cross-doc bookkeeping (traceability rows, id-ledger `--update`, SPEC v2.3→v2.4
header bump, editor-react Changeset, explicit "no new AD / no metadata-contract change"). Parts
renumbered: Part 2 editor impl (A1/A2/A3/A5/A4, test-first, minus the SPEC bullets now in Part 1),
Part 3 docs-site (B0 PyScript upgrade → B1 floor → B2 glue → B3 provider → B4 wiring), Part 4
packaging. Sequencing step 0 = land Part 1 before any code. **NOT DONE:** no SPEC/code yet — still
awaiting "proceed"; best first VERIFY step = does the editor already support an initial
advanced-palette config (A5 → decides whether FR-δ is needed) + the latest PyScript globals API (B0)._

_**UAT round 3b — the splitter is now a true divider (2026-07-06, on `palette-flat-list`,
UNCOMMITTED).** User follow-up: the panel resized but the CANVAS didn't follow. Cause: Blockly
re-measures its SVG only on WINDOW resize; a container-level resize (splitter drag) left the SVG
at its stale size. Fix: `mountBlockly` now attaches a `ResizeObserver` on the mount container
forwarding to `Blockly.svgResize(workspace)` (guarded for jsdom/older embeds; disconnected in
dispose()); SPEC §12.1 amended ("behaves as a true divider … re-measures live"). Test gotcha:
`svgResize` measures the svg's PARENT (Blockly's own injection div), not our container — the
mount.test.ts regression test stubs offsetWidth/Height on `svg.parentElement`. Live-verified
(Playwright drag): side 460→920px, Blockly SVG 900px→440px, dblclick reset restores both._

_**UAT round 3 — resizable side panel (2026-07-06, on `palette-flat-list`, UNCOMMITTED).** User
asked for a horizontally resizable examples/input/output column, 50%–200% of the current width.
SPEC-first: §12.1 gained "Side-panel resizing (ratified 2026-07-06)" — splitter between canvas
and panel stack, bounds 50%–200% of the stylesheet default (`clamp(320px, 34%, 460px)`, now
single-sourced as `SIDE_COL`/`sideColDefaultWidth()` in `styles.ts`), canvas keeps a 320px floor,
ARIA separator pattern (focusable, valuemin/max/now as % of default, arrows step 5%, Home/End →
bounds, Enter/dblclick reset), width is UI-only state (§11.5), splitter hidden in the ≤900px
single-column layout. Pieces: `components/splitter.tsx` (SideSplitter; pointer-capture drag +
keyboard), TransonEditor sandbox branch wires bodyRef/sideRef + inline flex-basis. Tests
red-first: `resize.test.tsx` (6 — aria contract, drag math, both clamps, keyboard, dblclick
reset, no splitter in compact) + a styles-layout rule test. **Verification gotcha worth
remembering:** synthetic `dispatchEvent` from the preview-eval console does NOT reach this app's
React delegation (trusted Playwright input and jsdom fireEvent both do) — Run-button "dead click"
in UAT round 2 and the splitter's "dead drag" were BOTH this automation artifact; verify with
Playwright MCP (`browser_drag` clamped at exactly 920px = 200%, dblclick reset to 460px live)._

_**UAT round 2 — five UX flaws fixed on `palette-flat-list` (2026-07-06, UNCOMMITTED).** User
reported: (1) +/- mutator controls active on palette blocks (grown specimen overlaps flyout
neighbours) — `appendControls()` now skips `block.isInFlyout` (SPEC §12.6 sentence added; pristine
palette shape, controls only on canvas copies; mutator.test.ts red-first); (2) "Import" label and
the native "Choose file" control rendered as a flush/stacked blob — `.transon-import-label` is now
`inline-flex` + 8px gap; (3) per-UA control thickness — one explicit height (24px, `font:inherit`)
for all shell buttons/selects/search/file inputs (styles-layout.test.ts asserts both); (4) **Run
was dead in the browser host** — root cause: RFC-004's `maxIncludeDepth` plumbing passed JS `null`
into `transon_transform`, Pyodide delivers it as **JsNull (not Python None)**, so
`int(max_include_depth)` threw BEFORE the glue's try, and the rejection vanished through `void
controller.run()`. Three-layer fix: provider OMITS the arg when unset (provider.test.ts fake now
throws on null like real Pyodide), glue guards the int() conversion, and `executeTemplate`/
`validateTemplate` catch transform/validate REJECTIONS → `editor_internal` surfaced (new
`execute-errors.test.ts`; validate deliberately returns to `idle`, never a fabricated `invalid`,
NFR-004). Browser-verified: Run → "✓ Output matches expected" on WorkedExampleReshapeRecords;
(5) divider labels drifted per-label ("random left margin") — Blockly centers label text at
measuredWidth/2 but measures with renderer font constants, not the divider CSS (uppercase +
letter-spacing) — `LeftAnchoredLabelInflater` (registry-overrides the stock `label` FLYOUT_INFLATER
in `ensureBlocklyReady`) left-anchors text at x=0 (mount.test.ts asserts). All browser-verified at
uniform left=25px. Gates green (traceability, engine-parity)._

_**UAT — palette presentation: flat always-visible list, no category column (branch
`palette-flat-list`, 2026-07-06, UNCOMMITTED).** User asked to replace the pop-right category
palette with one long list with category dividers (motivation: chrome crowds the canvas; few
blocks per category) and flagged a UX flaw — palette blocks scaled with workspace zoom.
**SPEC-first:** §12.6 gained a "Palette presentation (ratified 2026-07-06)" paragraph: palette =
Blockly `flyoutToolbox` derived mechanically from the committed `categoryToolbox` (category →
divider label + contents; pure view, committed artifact untouched per AD-030/FR-127; FR-109 +
§12.6 filters apply BEFORE flattening), and palette scale is FIXED, decoupled from canvas zoom
(§11.5). **Pieces:** `flattenToolbox()` in `editor-ui/src/blockly/toolbox.ts`; mount injects the
flat definition with `plugins: {flyoutsVerticalToolbox: FixedScaleFlyout}` (a `VerticalFlyout`
whose `getFlyoutScale()` returns 1 — stock Blockly returns the target workspace's scale, which was
the flaw); `setToolboxView` re-flattens (updateToolbox stays flyout-kind — it must never switch
kinds against a flyout-only injection); divider styling `.transonFlyoutDivider` in `styles.ts`.
Tests red-first: 2 new flatten units (`toolbox.test.ts`), 2 new mount tests (dividers present +
scale fixed under `setScale(2.5)`); `embedding.test.tsx`/`progressive-disclosure.test.tsx`
`categoryNames()` helpers now read flyout divider labels (`getContents()` → `FlyoutItem`, the
Blockly 13 public API) instead of `getToolbox()` (now null). Gates green (traceability,
engine-parity); browser-verified in reference-host (flyout `scale(1)` vs main canvas
`scale(0.625)` after zoom; dividers render as uppercase muted labels). **Considered and
rejected:** `@blockly/continuous-toolbox` (needs blockly ^13.1.0 vs our 13.0.0 pin AND keeps the
category column — more chrome, not less). Accordion-style categories remain an unexplored option
if the palette grows. **Next:** user review of the branch → PR; the broader "too much chrome"
concern (side panel, minimap, zoom controls, trashbin footprint) is untouched._

_**RFC-004 IMPLEMENTED — full self-hosting (AC-042): all 9 committed codec files open + round-trip
(2026-07-06, on `main`, UNCOMMITTED; `round-trip-reviewer` pass in flight).** Goal (user): every
file in `packages/editor-core/src/codec/generators/` + `…/artifacts/` opens in the editor. Root
cause chain (this session): the "max recursion" failure was CPython's 1000-frame wall, not
`max_include_depth`; the engine's `walk`/`_walk` doubling was fixed as **transon v0.1.7 R-32**
(engine proposal + SPEC §4.6 invariant + regression tests, landed by maintainer, on PyPI).
**Mid-implementation correction (red test caught it):** the draft's cap-only pre-verification had
measured the walk WITHOUT marker substitution (G_encode's `$`-nodes walked as literals) — truly,
G_encode needs include depth **52**, peak **~1113 frames** > default limit, so no cap alone works.
Maintainer ratified the revision: **cap 25→55** (`CODEC_MAX_INCLUDE_DEPTH`, exported from
editor-core) + **host recursion budget 1400** (`runner.py` + Pyodide `glue.ts`,
`setrecursionlimit(max(cur,1400))`) + engine floor ≥ 0.1.7 (snapshot re-pin; reference-host
`PINNED_ENGINE_VERSION` 0.1.6→0.1.7, smoke test now asserts against the snapshot). Also fixed a
**latent browser bug found during §19.4 verification**: the Pyodide provider silently dropped
`maxIncludeDepth` (browser ran at engine default 50) — glue + provider now forward it
(provider.test.ts asserts). `codecErrorCode` maps caught RecursionError → `runtime_transformation`
(new `packages/editor-ui/test/errors.test.ts`); selfhosting.test.ts rewritten red-first (all 9
files accepted + regenerated identically, past-ceiling clean failure, depth lower-bound pin);
M1 `ceiling.test.ts` rebased onto the constant. **Browser-verified (§19.4, real Pyodide):** engine
0.1.7 ready, G_encode → 333 blocks + `in_sync` + round-trip identical; nest(70) → clean "include
depth limit (55)" Runtime error. Docs synced: SPEC v2.3/AC-042/§16.4, AD-035, metadata-contract
§6.5, traceability (AC-042 [x]), RFC-004 marked IMPLEMENTED with the revision recorded. Gates
green: turbo build+test+typecheck 13/13, traceability, engine-parity, snapshot `--check`; codec
artifacts byte-unchanged. **`round-trip-reviewer` verdict: READY TO MERGE, no 🔴** — it
independently re-probed the RecursionError path in both hosts (no uncaught escape; subprocess
rc=0), confirmed taxonomy/coherence/test integrity, and flagged 2 🟡 doc-integrity nits (stale
`45` in two new test comments; the `## Use-case coverage (§5)` heading swallowed by the AC-042
row insertion) — **both fixed**, touched tests + traceability re-green. **Next:** commit (single
change per §21 loop; awaiting maintainer go) → consider engine R-33 (engine-side RecursionError→
TransformationError) as the deferred follow-up._

_**Mutator +/- controls inlined into the title row, button-styled (2026-07-05, branch
`mutator-controls-inline` off `m6-canvas-density`).** User-requested UX change: the array/object
+/- controls moved from their dedicated `TRANSON_CONTROLS` dummy row onto the title row
(`Array [+] [−]` — the blockly-samples plus-minus idiom), drawn as button chips (rounded-rect
20×15 data-URI SVGs; height 15 keeps the FieldImage row at 16 = grid, NFR-050(c)); named fields
`TRANSON_PLUS`/`TRANSON_MINUS` (idempotency guard via getField; FieldImage non-serializable, so
still UI-only); `cursor: pointer` on canvas `image` fields in the scoped stylesheet. Red-first
placement tests in `packages/editor-blockly/test/mutator.test.ts` (3 new). Density win: corpus
total bbox height **−13.5%** (recovers most of the geometry-fix give-back; zero examples taller;
median width +14px — horizontal is the abundant dimension), baseline regenerated. All 20 turbo
tasks + geometry corpus sweep green; browser-verified with REAL clicks (+ adds a row, − removes,
JSON stays in_sync) — evidence `retro/evidence/mutator-controls-inline.jpeg`. **Next:** open a PR
for this branch after PR #7 merges (stacked), or fold into PR #7 if preferred._


_**NFR-050(b) anchoring hardening LANDED (2nd user feedback round; 2026-07-05, on PR #7):** on
rows stretched by a tall child, labels re-centered across the stretched height (the first (b)
formulation had specified exactly that — superseded). Amended in place (unmerged PR): label/field
centerline anchors to the DRAWN connection tab (`row.yPos + TAB_HEIGHT/2`) for every
external-value-input row, any child height; short rows provably unchanged. Implemented via the
previously-STOPped, now user-sanctioned single placement override — `CompactRenderInfo extends
Blockly.thrasos.RenderInfo`, `getElemCenterline_` only (`theme.ts`). Red-first stretched-row test
+ corpus-wide anchoring assertions (121 examples, RenderInfo introspection). Density baseline
byte-identical (no row-height change; ratchet green). Browser-verified + screenshot
`retro/evidence/m6-nfr050b-anchoring.jpeg`. Traceability (b) clause rewritten._

_**M6 pushed — PR #7 OPEN (`m6-canvas-density` → `main`, 2026-07-05):** the full milestone
(FR-133/134, §12.5 labels, NFR-049 density, NFR-050 geometry hardening, AC-041) in one PR;
spec PR #6 already merged. **Next:** shepherd PR #7 review (CodeRabbit + CI), then M7 (P-E
adaptive layout prototype, OQ-019)._

_**NFR-050 geometry hardening LANDED (user feedback on the M6 compact renderer; 2026-07-05, branch
`m6-canvas-density`).** User reported 5 visual defects (seams between stacked blocks, off-center
tabs, child protrusion, unshared left edges, near-colliding rows). SPEC-first: **NFR-050** (§8.5,
SPEC **v2.2**, id-ledger 294) — zero-gap stacking + shared left edge · label↔child **visual**
alignment (drawn-glyph invariant; the connection *coordinate* sits at the row top by thrasos
convention and is explicitly not the specified quantity) · `GRID_UNIT`-quantized heights.
**Root causes** (verified against `blockly-v13.0.0` sources): the density pass never shrank
`LARGE_PADDING`/`TAB_OFFSET_FROM_TOP` — seam = `LARGE_PADDING − TAB_OFFSET_FROM_TOP −
MEDIUM_PADDING` = exactly 2px, any child height. **Fix (theme.ts):** `GRID_UNIT = 4`; every
vertical constant derived from it; `LARGE_PADDING = TAB_OFFSET_FROM_TOP + MEDIUM_PADDING` (zero
gap, child bottom flush with parent bottom); two pinned preconditions give exact visual centering —
`TAB_OFFSET_FROM_TOP == MEDIUM_PADDING` (label↔child centers cancel, ANY height) and
`2·TAB_OFFSET_FROM_TOP + TAB_HEIGHT == pillHeight` (`TAB_HEIGHT` 12→16); mutator +/- glyphs
`GLYPH_SIZE=15` in editor-blockly runtime.ts (15 + Blockly's private 1px `Y_PADDING` = 16 → the
17px odd-height propagation into array/object ancestors is gone; quantization holds with ZERO
exemptions). **Harnesses:** `packages/editor-ui/test/geometry.test.ts` (7, red-first: 5 failed
pre-fix) + `test/engine-node-adapter/test/ui/geometry-corpus.test.ts` (all 121 examples; an
unconnected socket legitimately breaks a stacked run). **Density trade (honest):** median bbox
height 109→120px (pre-M6 127 → net −5.5% instead of −14.2%), blocksVisible unchanged 721,
`set__base` 20→24px (≤28 ✓), baseline regenerated. **Browser-verified** on the exact reported
workspace shape: zero gaps/left-edge deltas/protrusions programmatically + screenshot
`retro/evidence/m6-nfr050-geometry.jpeg`. All 20 turbo tasks green; traceability/parity/
presentation/behavior-size gates green. NFR-049/NFR-050/AC-041 traceability rows updated._

### Prior last action (M6 milestone)

_**M6 COMPLETE (`/run-milestone M6`) — ROADMAP ☑, `round-trip-reviewer`-signed-off, AC-041(a–e) green
incl. the §19.4 real-browser pass; all DoD gates green (2026-07-05, branch `m6-canvas-density`,
stacked on `m6-canvas-density-spec`/PR #6; NOT pushed).** Canvas density + navigation (RFC-003
phases 1–3), display-only throughout (§21.12): round-trip corpus zero-diff, `G_palette.json`+
`palette.json` the ONLY regenerated artifacts (byte-equal regen gate green). **Slices:**
**FR-133 (`2a8f22f`)** — `Blockly.inject` `zoom` (controls/wheel/pinch, 0.2–3.0, start 0.9) +
`move` (scrollbars/drag/wheel) in `mount.ts`; `@blockly/zoom-to-fit@13.1.0` +
`@blockly/workspace-minimap@13.1.0` pinned exact (AD-021), init after inject / disposed with the
mount. Both plugins ship UMD → treated as EXTERNAL runtime deps like `blockly` itself (external in
editor-ui/react/element ESM builds, real deps of element/react; bundling them had broken the IIFE
build via a synthesized `blockly/core` default-import). *Watch-out: plugins peer-require `^13.1.0`
vs our `blockly@13.0.0` pin (non-fatal warning) — consider a 13.1.0 bump at the next pin review.*
**FR-134 (`d5bafd9`)** — explicit `collapse: true` (native context-menu items; Blockly's
categoryToolbox default already implied it — now contract, not accident); collapsed state UI-only
(§11.5); byte-identical JSON collapsed vs expanded proven vs the real engine + committed decoder
(`test/codec/collapse.test.ts`). **§12.5 labels (`875fc5a`)** — canvas `message0` = title only
(OQ-018 supersedes OQ-008 on canvas); flyout dual label carried as display-only `flyoutLabel` def
data + ONE shared `transon_flyout_label` extension keyed on `Block.isInFlyout` (title field is a
non-serializable `FieldLabel` → can never leak into `save()`, reviewer-verified); ≤1-value-input
variants drop the socket's param-name prefix (constant field/dropdown params KEEP labels);
`presentation.json paramLabels` short display labels (contract §2.9; `check_presentation.py`
validates + selftest; demo `attr.default → "fallback"`); `ruleTooltip` = `<rule> — <description>`
(FR-078). Independent `round-trip-reviewer`: **SAFE TO MERGE** (all 6 adversarial concerns refuted;
encoder/decoder/toolbox/blockmap byte-identical; placeholder/args parity across all 30 defs).
**NFR-049 (`b9d17fb`)** — `CompactThrasosRenderer` (`transon-thrasos-compact`, thrasos-derived so
AC-040 holds; vertical paddings/notch/tab/min-height tightened, font stays 12px per NFR-045);
single-value-input block 26→**20px** (bound ≤28); §19.4 density harness = fast fixture bound test
in editor-ui + full 121-example corpus sweep in `test/engine-node-adapter/test/ui/
density-corpus.test.ts` (real engine + per-file jsdom; editor-ui has no engine and a dep cycle
forbids one) ratcheting vs committed `packages/editor-ui/test/density-baseline.json`
(`UPDATE_DENSITY=1` regen idiom); corpus median bbox height **−14.2%**, area −15.9%, zero
regressions. **Browser pass (Playwright MCP, evidence `retro/evidence/m6-ac041-browser.jpeg` +
`retro/sessions/M6.md`)** verified AC-041(a–d) live (zoom-to-fit 0.9→0.587; minimap mirrors all
blocks; context-menu collapse → label+ellipsis, JSON byte-identical; canvas title-only/flyout dual;
25px flyout blocks) **and caught one real bug fixed in the close-out commit:** the event-mirroring
minimap never saw event-suppressed programmatic loads (empty mirror + "associated block is
undefined" on every later event) → `SyncablePositionedMinimap.syncFrom()` resync after each
programmatic mutation (red-first test in `navigation.test.ts`). Suites: editor-ui 132 · blockly 32
· core 25 · adapter 1271 · element 12 · react 5 — all green; all 11 pre-commit gates green ×5
commits. **Not in M6 (explicit):** P-E adaptive inline/external layout (OQ-019) → M7 after a
corpus prototype; `inputsInline`/§13.10/FR-129/AC-040 untouched. **Next:** review/merge PR #6
(spec) + open the M6 implementation PR off it; then M7 (P-E prototype) or the M5-era follow-ups
(committed Playwright/axe CI job, structured engine error paths)._

### Prior last action (M6 spec landing)

_**RFC-003 phases 1–3 LANDED in the contract docs — SPEC v2.1 + ROADMAP v2.1 + milestone M6
authored (2026-07-05, branch `m6-canvas-density-spec`, off `main` @ `6058e45`).** SPEC-first
landing of the ratified RFC: **SPEC v2.1** — new §7.17 (FR-133 zoom controls/wheel+pinch/
zoom-to-fit/**minimap**/pan; FR-134 subtree collapse, UI-only §11.5, generated JSON byte-identical
collapsed vs expanded), NFR-049 (§8.5 density target: ≤28px single-value-input block @100% + a
§19.4 density harness over the example corpus with committed no-regression numbers), AC-041
(5-part acceptance: navigation · collapse · labels · harness · zero-diff corpus + byte-equal
`G_palette` regen), §12.5 rewritten per OQ-018 (canvas title-only · flyout dual label · tooltip
`<rule> — <description>` · single-value-input variants drop the param-name prefix · optional short
param labels), FR-078 tooltip note, §12.6 ref updated, v2.1 header changelog. **ROADMAP v2.1** —
M6 milestone section (goal/scope/3-phase deliverables/DoD additions/**explicit P-E exclusion**:
do not touch `inputsInline`/§13.10/FR-129/AC-040 in M6), tracker row (☐), mermaid M5→M6,
OQ-018…020 ratified rows, OQ-008 superseded-on-canvas note (deprecate in place, §21.1).
**metadata-contract** §2.9 addendum: optional short param display labels (editor-owned
presentation data; engine export unchanged; date note bumped). **traceability** — AC-041 row,
§7.17 row, NFR-049 row, NFR-029 note (M6 = its realization path), OQ intro extended.
**id-ledger** registered FR-133/134, NFR-049, AC-041, OQ-018/019/020 (`--update`; 293 IDs). RFC-003
status flipped to phases-1–3-APPLIED (normative homes listed; **P-E stays PROPOSED** → M7, IDs
assigned at next-free when it lands). Gates green: traceability, engine-parity, append-only IDs,
snapshot `--check` (skip-note only). Prior commit on `main` (`6058e45`): OQ ratification + gain
entries. **Next:** merge or review `m6-canvas-density-spec`, then `/run-milestone M6`
(`milestone-planner` optional first)._

_**Proposal naming aligned (2026-07-05, on `main`; UNCOMMITTED; housekeeping only).** Renamed
`docs/proposals/template-driven-editor.md` → `docs/proposals/rfc-001-template-driven-editor.md`
(`git mv`) and retitled it `RFC-001: Template-driven editor — APPLIED (…)` to match the
`rfc-NNN-` file naming and `RFC-NNN:` title pattern of RFC-002/RFC-003. Content unchanged (already
the shared tombstone format); no cross-references to the old filename existed anywhere in the repo._

_**RFC-003 written — canvas density + navigation for large templates (2026-07-05, on `main`;
UNCOMMITTED; PROPOSAL ONLY, no code/SPEC changes).** User reported the editor shows ~50 blocks max
and large templates are un-navigable. Root-caused to four factors: (1) `Blockly.inject` in
`packages/editor-ui/src/blockly/mount.ts` passes NO `zoom`/`move` options (Blockly defaults are
off — viewport pinned at 100%, no wheel zoom, no fit, no minimap); (2) the FR-129/§13.10
external-inputs staircase + title-own-row for ≥2-input variants (width grows with nesting depth);
(3) OQ-008 dual labels `"<title> (<rule>)"` + raw param-name prefixes on every socket (`G_palette`
`P_LABEL`/`P_PARAM_SEG` in `codegen.ts`); (4) untuned thrasos renderer constants. Wrote
`docs/proposals/rfc-003-canvas-density-and-navigation.md` (house RFC style, status Proposed):
P-A zoom/fit/pan (additive; §11.5 already reserves `zoom` UI metadata), P-B compact renderer
constants + pinned density target, P-C label diet (canvas title-only, rule name → tooltip + flyout;
re-answers OQ-008), P-D subtree collapsing (additive; `collapsed_state` already in §11.5),
P-E **balanced adaptive inline/external layout** (runtime flips `inputsInline` on connection
changes, damped, manual override wins; revises FR-129/§13.10/AC-040, AD-034 updates AD-033).
Key design principle codified from the discussion: *small children read densely; complex
(multiline) children get their own block* — the inline/external split cannot be static because the
same socket can hold a literal or a subtree. Proposed IDs at verified next-free (`id-ledger.json`):
FR-133…135, NFR-049, AC-041, AD-034, OQ-018…020. Everything display-only (§21.12); round-trip
corpus must stay zero-diff. Anchored to NFR-029 (already prohibits an unusable large-template
canvas). Same day: added a **Gain** entry per proposal + a per-phase/cumulative gain column to
the sequencing table (envelope: ~50 blocks capped → ~2–3.5× at 100% legibility; phase 1 alone
makes any-size templates navigable; all figures pre-measurement, to be replaced by the NFR-049
harness numbers per phase). Same day: **all three open questions ratified by the user** (via an
interactive prompt) and recorded in the RFC — OQ-018 title-only canvas labels (C1+C3, dual label
stays in flyout, rule name in tooltip), OQ-019 adaptive layout + manual override (prototype now
only pins threshold/damping), OQ-020 **adopt minimap now** (user overrode the RFC's proposed
defer; minimap folded into P-A/FR-133 + phase 1/M6 with a pinned `@blockly/workspace-minimap`
dep). **Next:** land the SPEC/ARCHITECTURE/ROADMAP edits SPEC-first + author milestone M6
(phases 1–3 only), then `/run-milestone M6`; P-E prototypes on the largest corpus examples before
FR-135/AD-034 are finalized (→ M7). Full route in Next steps 0c._

_**CodeRabbit review analysis → config hardening + 2 new deterministic gates (2026-07-04, on `main`;
UNCOMMITTED).** Analyzed how PRs #1–#4 were reviewed (49 CodeRabbit findings, ~91% signal, ~13 real
runtime bugs — but ZERO comments on the codec core: its path instruction demanded corpus execution a
static reviewer cannot do). Remediation: **(1)** `.coderabbit.yaml` — round-trip instruction #1
rewritten to statically-checkable asks only (hand-written mapping, manual edits to generated
`codec/*.json`, string-compare round-trip assertions, new DSL, silent out-of-surface rewrites) with
an explicit "do not assert semantic round-trip either way"; tests instruction now demands the
`docs/traceability.md` row update in the SAME PR; `tone_instructions` added (verify API claims
against pinned versions not web search — PR #4's false-positive modes); `reviews.tools.github-checks`
enabled (CI results fold into reviews, 300s timeout); `very-beginning` added to
`auto_review.base_branches` (PRs #2/#3 were silently skipped). **(2)** New gate
`check_corpus_coverage.py` — every snapshot rule/variant needs ≥1 corpus invocation matching exactly
one variant (SPEC §15.8/§15.6), optional params exercised with AND without (FR-045/046); lexical
scanner over `test/engine-node-adapter/test/codec/corpus.ts` (86 invocations → all 30 variants
covered; the 5 uncredited are the deliberate out-of-surface cases; object/fields is covered by the
FR-123 escape entries). **(3)** New gate `check_append_only_ids.py` + committed `docs/id-ledger.json`
(286 IDs, maturity-baseline pattern) — deletion/renumbering of any FR/NFR/AC/UC/AD/OQ fails;
new IDs register via `--update`, which refuses non-contiguous numbering (SPEC §21.1). Both wired
into pre-commit + `agentic-checks.yml` (steps 9–10) + harness/README gate list; negative-tested
(removal, unregistered add, gap-skip refusal, corpus-entry removal). All 11 gates green.
**Next:** commit, then watch the next PR to confirm github-checks + the rewritten instructions
change CodeRabbit's behavior as intended._

_**PR #4 review comments addressed — all 38 CodeRabbit threads dispositioned (2026-07-04, branch
`recent-changes`).** 36 fixed / 2 skipped-with-reason (theme.ts `name`: Blockly 13's installed
`ITheme` typings REQUIRE `name` in the second arg, CodeRabbit's web claim was wrong; the
current-state.md intro finding was already obsolete). Highlights: CI actions pinned to commit SHAs
+ `persist-credentials: false`; MCP servers pinned (`@playwright/mcp@0.0.77`,
`@upstash/context7-mcp@3.2.2`); drift-watch fails the job on watcher exit 1 (drift 2 still flows to
the issue step); fail-closed `--require-engine` on the snapshot gate (drift_watch.py +
worktrees.md); traceability scan excludes vendor dirs; check_no_codec_mapping catches multiline
destructuring (+selftest); check_engine_parity survives malformed exports (reports, no crash);
engines.node ≥22 (blockly@13 + engine-strict) in package.json/README/CI comment; reference-host
provider hardened (engineVersion validated pre-interpolation, memoized concurrent init, closure
status, guarded accessors, full dispose reset) + glue normalizes unexpected Python errors into the
JSON envelope; editor-blockly +/- mutators fire `BlockChange('mutation')` (undo/redo + JSON sync);
editor-element preserves live template across attribute remounts, validates `mode`, nulls the
controller on destroy, no-engine bundle test fails loud (turbo `test` now depends on own `build`);
editor-ui: live `readOnly` sync (`setIsReadOnly` through mount/controller + React effect),
stale-async guards (shared `session/latest.ts` generation tokens) on
project/applyReverse/execute/validate, pending initial template consumed on the idle→ready
transition, vacuous embedding readOnly test fixed. All 20 turbo tasks green (build/typecheck/test)
+ all 8 harness gates green. **Round 2 (same day):** CodeRabbit confirmed all 36 fixes and
withdrew its 2 disputed findings; its follow-up pass produced 7 more fixes — collapsed the now
redundant narrow except branches in glue.py (+ same envelope for `transon_version`), a dispose
generation token so a stale `init()` can't resurrect the Pyodide host, post-await
`isEngineReady` re-checks in execute/validate, `beginSync` invalidation on
`newWorkspace()`/`loadDocumentSafely` (slow encode/project can't repopulate a cleared canvas),
os.walk dir-pruning in check_traceability (rglob still descended into node_modules),
stderr logging in stop-traceability.py, FR-107 marker in embedding.test.tsx. Declined 2:
the pnpm/action-setup SHA "mismatch" (CodeRabbit compared the annotated tag OBJECT sha; the pin
is the dereferenced v4.3.0 COMMIT `b906affc`, which is correct) and the "future date" complaint
(2026-07-04 is the actual date). **Next:** merge PR #4 once CI is green._

_**Deep completeness audit DONE + M-09 flipped + CI now runs the full test suite (2026-07-03;
UNCOMMITTED).** Swept all 269 SPEC/ARCH IDs (4 read-only agents classified the 117 with no test
citation) and remediated the structural findings. **Audit verdicts:** nothing claimed done is false;
the genuine NOT-implemented set is FR-017 (block comments), FR-033 (import rejections never carry
`template_path`), FR-048 (param-level docs never rendered), FR-086's "limited generic block" half,
UC-010's context-restriction half, AD-013's advisory-typing half, NFR-021 (zero snapshot tests),
NFR-029 (no perf benchmark; OQ-005 targets never set), NFR-027 (dormant — no auto-run exists);
implemented-but-untested: FR-026/049/057/066/083(ops/fns)/085, `onImportFile`, NFR-026/030/031/034/039.
**The umbrella gap was CI: `agentic-checks` ran ONLY the Python gates — the 1448-test vitest suite,
typecheck, and builds were enforced nowhere.** Remediation: **(1)** new CI `tests` job (pinned engine
wheel + pnpm/turbo typecheck → build → full test). **(2) M-09 flipped** — transon is on PyPI; the
gates job pip-installs the wheel at the snapshot's own `engine_version` (pin read from
`metadata-snapshot.json`, cannot drift) and runs parity + snapshot checks `--require-engine`;
`drift-watch` deliberately installs the *latest* wheel (upstream movement → proposal issue).
**(3)** Snapshot re-pinned from the released wheel: the committed `engine_version` was `null`
(source-tree import has no dist metadata; the checkout venv's stale editable install even reports
0.1.5) → now `"0.1.6"`, byte-identical to what CI verifies. `update_memory.py` gained (a) wheel
provenance fallback (sidecar: `v0.1.6 (pip wheel)`; commit honestly `unknown` for a wheel) and
(b) a *tolerant-locally, strict-in-CI* drift check: a live export whose ONLY difference is
`engine_version: null` (source import) is a SKIP note, never a pass-through under
`--require-engine`. **(4)** traceability.md: new **Use-case coverage (§5)** table (UC-001..016 —
previously absent entirely; 9× [x], 5× [~] composition gaps, UC-010 [ ]); audit-note annotations on
the §7.4/§7.7/§7.9/§7.11 rows; the §7.9 note's **FR-068 mislabel fixed** (FR-068 = error→block
mapping, tested — the deferred edge is the FR-057 missing-required path); AD-028 [~]→[x]
(escape long tested); new NFR-021/027/029 rows ([ ]). **(5)** ROADMAP M-09 passages updated; Next
steps gained the ordered verification burn-down (step 5). All gates + full 11-task turbo suite green
after the re-pin (engine_version is informational in `snapshot.ts`; UI reads the live engine)._

_**External-review remediation DONE (2026-07-03) — 17 findings triaged: 15 fixed, 2 refuted; all gates
green; UNCOMMITTED.** Verified each finding of an external code review against the tree. **Fixed
(docs):** AGENTS.md stale `AD-001..AD-032` range (now unbounded `AD-*`) + stale Zelos package label;
CLAUDE.md re-thinned to a pure pointer (single-source description now only in `harness/README.md` /
`docs/portability.md`); ARCHITECTURE.md §5.1 row / mermaid label / §6.3 bullet + README package table
aligned to the thrasos default (AD-033); traceability.md one-shot grep now covers all real test
locations (`packages/*/test`, `test/`, `examples/*/test`); review-gate.md Stage-3 snapshot gate is now
blocking (`update_memory.py --check --require-engine`, skip must be an explicit waived-gate record).
**Fixed (harness code):** `drift_watch.py` keeps watcher errors (exit 1) distinct from drift (exit 2)
via a `WATCHER_ERROR` sentinel; `run_evals.py` cost-tier check now compares the writer against BOTH
judge roles, rejects boolean `loop_limit` (bool⊂int), and requires the adjacent "test…first" phrase;
`commit-msg` hook comment points at `harness/githooks` and its path regex mirrors `CODE_DIRS` exactly
(dropped `lib|app`); `check_maturity.py` D2 trailer credit needs actual `Refs:`/`Slice:` hook content,
not mere commit-msg file presence (ratchet still L4); `check_traceability.py` coverage gate (3) now
accepts only test-scoped citations (`test_id_refs` filter — still green, so all done rows genuinely
have test citations); `update_memory.py` watches `harness/` for the handoff nudge and propagates a
`write_state()` failure into the exit code. **Refuted (no change):** the "unchecked presentation
source-scan row" (already `[x]` in both tables) and the README `createTransonEditor` example ("engine
at top level" is wrong — the real options shape IS `{ host: { engine } }`, per `EditorControllerOptions`
/ `TransonEditorHost`). Validated: traceability, links, evals, maturity (`--check`), engine parity,
snapshot `--check`, full `drift_watch` run — all exit 0; watcher-error path + new eval guards
smoke-tested directly._

_**Docs-vs-reality synchronization pass DONE (2026-07-03) — statuses reconciled; all gates + all 7 test
suites verified green (core 21 · blockly 27 · ui 116 · element 12 · react 5 · adapter 1260 ·
reference-host 7 = 1448).** Independent audit (3 read-only investigation agents + local gate/test runs)
of every "done" claim vs the tree. **Verdict: every functional claim checked out** — FR-130/131/132,
R-31 (snapshot `3.0`, 121-case flat corpus, contract v2.1), and all still-open items (M-09, Playwright/axe
CI job, UAT #1/#2 editor side, context-sensitive examples, root-fallback highlighting) are exactly as
recorded. The drift was all in the OTHER direction — docs under-reporting reality: **(1)** the milestone
work is no longer "NOT pushed": every milestone/UAT branch (`m0`…`m5`, `fix-editor-layout-css`,
`fr-130`, `fr-131`, `r31-corpus-migration`) is an ancestor of `main`, and `main` == `origin/main`
(`ca3a975`) — the old Next-step-1 "push train" is superseded (history landed linearly on `main`; no PRs
were used; the stale local branch refs can be deleted at leisure). The header's old `9864a2e` pin was a
dangling pre-rebase duplicate of `467c36a`. **(2)** `traceability.md` carried stale rows contradicted by
its own body: the "Pre-implementation baseline" header/legend boilerplate; `[ ]` rows for work long
gated `[x]` elsewhere (FR-127/NFR-048 vs the parity-table row; NFR-035/AD-009 + AD-010 vs AC-024/025;
NFR-001..005/AD-003/004, AD-008, AD-011 vs the corpus); AC-002..005/009/010/027 never flipped after
M2–M5 delivered them; §7.5 + §7.16 notes still deferring FR-037/038 + FR-121 "to M4/M5". All fixed —
rows flipped **with ID citations added to the covering tests** (roundtrip/escape/import-export/sync
headers) per the §"How to keep this current" discipline; `mount.test.tsx`→`.ts` path typo fixed.
**(3) One genuine gap surfaced: FR-017 (block comments/descriptions) was never implemented** — its
traceability note said "M5" but M5's scope never included it; now recorded honestly as an open backlog
item in §7.2. Remaining honest `[~]`/`[ ]`: the §7.1/7.3/7.4/7.6/7.7/7.9/7.10/7.11 range rows (per-ID
sweep not yet done; known open members FR-017, FR-068), NFR-030 (review-only), AD-027/029 (engine-repo
test halves), NFR-036..040, NFR-047. Gates re-run green after the edits._

_**Review-gate on the R-31 + FR-132 tree DONE (2026-07-03) — 1 critical + 4 suggestions confirmed, all fixed; branch `r31-corpus-migration`; committed.** Ran the `harness/workflows/review-gate.md` adversarial pass (5 dimensions fan-out, per-finding refutation; maker ≠ checker — the slices were implemented in prior sessions) over the then-uncommitted working tree. 14 candidates → 6 refuted, 8 confirmed (deduped to 6). **Fixed:** (🔴) `groupExamples` derived curated-tier membership from tag literals (`'worked-example'`/`'recipe'`) — exactly the tag-convention join contract §2.7 v2.1 forbids; `ExampleCase` now carries `tier`, resolved in `buildExampleCorpus` from the `docs.worked_examples`/`docs.recipes` name-reference lists, and the panel groups on it (adversarial fixture: a mistagged non-curated case must stay in its rule group). (🟡) rule ownership now falls back to parameter-level `docs.rules[*].params[*].examples` references — previously all 30 "Reference · other" entries were engine-rule-owned; FR-132 text aligned (SPEC-first). (🟡) the §15.8 sweeps' corpus-size assertion was tautological (`collectDocsExamples().length === docs.examples.length` by construction) — added a `CORPUS_FLOOR = 121` anti-truncation ratchet (docs-examples.ts + the three sweeps + the editor-ui corpus test). (🟡) handoff narrative contradicted the tree on the 0.1.6 pin bump — reconciled. (🟢) stale `"2.0"` comment in `snapshot.ts` fixed. **Known accepted nit (recorded, not fixed):** multi-referenced examples group under the first referencing rule in `docs.rules` emission order, so context rules (`this`, `item`, …) absorb some operation examples — any smarter owner pick would be an editor-side heuristic (AD-012 tension); revisit only with an engine-emitted primary-owner field. All gates green (traceability, links, parity, snapshot, evals, maturity); editor-ui 116 + core 21 + adapter 1260 green._

_**FR-132 DONE — tiered/grouped Examples picker with doc-sentence labels (SPEC-first; tests + gates green; browser-verified; UNCOMMITTED).** New append-only **FR-132** in `SPEC.md` §7.1 (after FR-009): picker presents curated tiers first (worked examples, then recipes, each in the engine `docs.worked_examples`/`docs.recipes` reference-list order, contract §2.7), then reference examples grouped by owning rule; entries labeled by the first sentence of the engine `doc` (fallback: case name), case name stays the selection value + tooltip; all derivation mechanical over engine corpus data (AD-012), host `examples` overrides flow through the same path. Implementation: `buildExampleCorpus` orders curated-first (`packages/editor-ui/src/session/examples.ts`); `groupExamples`/`exampleLabel` + `<optgroup>` rendering in `ExamplesPanel` (`packages/editor-ui/src/components/panels.tsx`). Tests first: `packages/editor-ui/test/examples-picker.test.tsx` (ordering vs real pinned lists, optgroup structure, labels/value/tooltip, unchanged selection semantics AC-018, host-override flow-through); traceability row added. All workspace tests + traceability/parity/snapshot gates green. **Browser-verified** in the reference host (7 worked examples, 12 recipes, per-rule reference groups render; selecting "Swap the keys and values of a dict" loads blocks + input + expected). Side finds: `.claude/launch.json` switched to `autoPort` + new `examples/reference-host/vite.config.ts` honoring `PORT` (another dev server held 5173); the reference host `PINNED_ENGINE_VERSION` was then bumped 0.1.3 → **0.1.6** in this same tree (transon 0.1.6 verified on PyPI 2026-07-03), clearing the NFR-040 mismatch flag._

_**Revalidation pass DONE — R-31 consumer migration verified against released engine v0.1.6; provenance re-pin completed (2026-07-02).** Independent revalidation of the migration below, now that the engine releases are committed (`v0.1.5` R-29/R-30 example tags + curated tiers, `v0.1.6` R-31 flat corpus, metadata `3.0`): snapshot corpus integrity confirmed (121 unique names; zero dangling `name` references across rules/params/operators/functions/tiers; 7 worked-examples + 12 recipes; curated cases carry only their tier tag; no untagged cases); all 11 packages test green (incl. 1260 adapter tests); `--check`, traceability, engine-parity, and evals gates green. The one misalignment found — the sidecar caveat below (pin taken from the then-uncommitted engine tree, recorded as `v0.1.5 @ 56833618fa29`) — is now RESOLVED: re-ran `update_memory.py --snapshot` against released HEAD; provenance now `v0.1.6 @ b64b340b9090`, JSON byte-identical. Still UNCOMMITTED in this repo; the **review-gate note below still stands** (maker ≠ checker) before merge._

_**Engine R-31 consumer migration DONE — normalized example corpus (engine `metadata_version` `2.2`→`3.0`; contract v2.1; all typecheck/tests/gates green; UNCOMMITTED in both repos).** The engine (`../transon`, roadmap R-31, RFC `example-corpus-normalization.md`) stopped re-inlining examples: `docs.examples` is now the **flat corpus** (every tagged case exactly once, `{name, doc, template, data, result, tags}`; 121 cases @ v0.1.5) and every other `examples` field + the curated `worked_examples`/`recipes` tiers are ordered **name references** into it. Editor-side changes: `metadata-contract.md` **v2.1** (§2.1–§2.4, §2.7, §5 — join stays engine-owned, editor never re-derives tag conventions); snapshot re-pinned (v0.1.5 @ `56833618fa29`, metadata `3.0` — **note:** the engine changes were uncommitted at pin time, so the sidecar commit hash predates them; re-run `update_memory.py --snapshot` after the engine commits land to record honest provenance); `snapshot.ts` gains `ExampleEntry` + normalized `EditorDocs` (examples/worked_examples/recipes); `buildExampleCorpus` (FR-079) is now a direct map over the flat corpus (content-hash dedupe deleted; owning `rule` resolved from `docs.rules[*].examples` references; engine tags travel; curated tiers now appear in the Examples picker — corpus 89→121 entries); the four §15.8 docs-example sweeps (`examples-corpus`, `blockmap`, `workspace-shape`, `blockly-load`/`blockly-resave`) share a new `test/codec/docs-examples.ts` collector iterating the corpus once (147 inlined→121 distinct; worked-examples/recipes templates newly round-tripped); metadata-version fakes/tests bumped `2.0`→`3.0`; traceability rows refreshed. All 11 packages typecheck+test green; all gates green. **Codec untouched** (structural catalog identical; only the docs payload reshaped). **Review note:** this slice touches the round-trip corpus surface — run the `review-gate` workflow (maker ≠ checker) before merge._

_**UAT #1/#2 step (a) DONE — R-28 RFC placed in `../transon` (UNCOMMITTED; user reviews + manages implementation; editor work waits).** Wrote `../transon/docs/proposals/editor-metadata-structural-params.md` + the R-28 ROADMAP entry (checklist row `accepted` + Theme F section, decision provenance 2026-07-02) — both left uncommitted in that repo's working tree for the maintainer. RFC = the agreed engine-first export: `_catalog_params` emits `container: "list"|"mapping"|"arms"` (omitted for the default `template`) + a serialized `arm` schema for ARMS params (recursive serializer, same shape as rule params); optional arm-slot docstrings in the docs payload; `METADATA_VERSION` 2.0→**2.1** additive; tests extend `tests/test_metadata.py`. **One correction vs the brainstorm note below:** `arm(...)` collapses `_variants` at declaration time — `ArmSpec` stores only `required` + `params`, so the export emits exactly that (NO `variants` key; extending `ArmSpec` is flagged in the RFC as separate future work). **Editor repo untouched** (no snapshot re-pin — that happens only after the engine change ships). **Resume trigger:** when R-28 lands in `../transon`, continue at Next steps 2(b)._

_**UAT #1/#2 brainstorm DONE — collection/struct inputs: shape hints will come from the ENGINE export (decision made; no files changed yet).** Analysis of `../transon` found the structural facts **already declared and validated internally but dropped at the export boundary**: `ParamSpec.container` (`ContainerType.TEMPLATE|MAPPING|LIST|ARMS`, `transformers.py`) with `chain.funcs=LIST`, `object.fields=MAPPING`, `switch.cases=MAPPING`, `cond.cases=ARMS` via `arm(_variants=[{'when','then'}], …)` — a full sub-schema incl. per-slot docs; `map.items`/`join.items`/`expr.values` are deliberately TEMPLATE (dynamic-capable → must stay a single socket). `metadata.py _catalog_params` exports only `name`/`kind`/`options`. **Agreed plan:** (1) engine PR — additive export of `container` (omit when TEMPLATE) + serialized `arm` schema (`required`/`variants`/`params`, same shapes as rule params) + arm-slot docs; `METADATA_VERSION` 2.0→**2.1**; tests + `docs/proposals/editor-metadata-export.md` update. (2) editor — re-pin snapshot, `metadata-contract.md` §2, new FRs (append-only); mechanical container→shape mapping: `list`→repeating numbered value inputs (+/−), `arms`→repeating labeled when/then groups (`controls_if`-style), `mapping`→key-field+value rows; ~2 new rule-agnostic runtime primitives (NFR-046 baseline 5→~7, deliberate gated bump); `G_encode`/`G_decode` grow a third @-time container branch (numbered inputs + `extraState` counts) — **round-trip-critical** → extend corpus FIRST (empty `cases`; foreign arm key→unsupported not silent repair; nested cond-in-chain; §11.4 escape interplay with `object.fields`; dynamic `map.items` stays socketed), then `round-trip-reviewer`. **Spike order:** `chain` (list) + `cond` (arms) end-to-end before generalizing. **Rejected:** editor-side `paramShapes` presentation stopgap (parallel semantic catalog, golden rule #5); statement/prev-next connections (fights the expression language); typed connection checks (transon is dynamically typed). **Open Qs:** does `cond` spawn with 1 arm pre-attached?; `switch` case-key scalar typing (reuse `FieldTransonScalar`?); write the contract's minor-version policy into `metadata-contract.md` with the 2.1 bump._

_**UAT follow-up DONE — FR-131 (branch `fr-131-json-edit-focus`): an accepted mid-typing JSON edit no longer rewrites the focused panel text.** UAT reported the editor "interfering with typing" in the Template JSON panel: a keystroke pause let the 150 ms debounced reverse sync ACCEPT the text, re-project, flip to `in_sync` — and `JsonPanel`'s reflect-effect replaced the textarea with the canonical pretty-print mid-edit (reformat + cursor jump). **SPEC-first:** FR-131 (§7.15 after FR-113) + §12.7 note — while the editor retains focus, an accepted edit syncs the workspace but preserves the user's exact text; canonical form appears on blur or a non-edit-origin change; read-only always mirrors (FR-107). **Fix:** `JsonPanel` tracks `editing` (focus/blur) and guards the reflect-effect (`in_sync && !editing`) — `packages/editor-ui/src/components/panels.tsx`; tests `packages/editor-ui/test/json-edit-preserve.test.tsx` (5, red-first); editor-ui 106 green, gates green, browser-verified (typed one-liner survives the accept verbatim; blur canonicalizes; caveat learned: background-tab `focus()` defers focus events — drive `focusin` when probing). Codec/round-trip untouched (panel-only)._

_**UAT #4 DONE — FR-130 curated dropdown menus (branch `fr-130-curated-operator-dropdown`), `round-trip-reviewer`-signed-off SAFE TO MERGE (47 adversarial probes, zero findings).** The `expr.op` dropdown listed all 28 metadata tokens (each operator twice: symbol + word alias) — now a **14-entry curated menu** (`< (lt)`, `== (eq)`, …; canonical = symbol), **display-only**: every metadata token stays accepted, displays verbatim, round-trips verbatim (AD-004/§21.12; proven per-alias byte-identical through the full codec AND the Blockly resave path). **SPEC-first:** FR-130 (§7.7 after FR-058) + §13.6 note + metadata-contract §2.9. **Pieces:** `presentation.json dropdownMenus` (+ typed loader); `enrichForPalette` builds validated `menu` pairs (`menuFor` throws on unknown/duplicate token); `G_palette` `P_ARG` emits generic `field_transon_dropdown` (curated menu + full-domain `accept`) for all constant+options params; 5th rule-agnostic runtime primitive (FieldDropdown subclass — alias-accepting validator, raw-token `getText_` for non-menu values, verbatim saveState; NFR-046: 5/8 ceiling, honest `BEHAVIOR_PRIMITIVES`); `check_presentation.py` gained curation validity/disjoint/**coverage** checks (+selftest; coverage is gate+test-enforced, deliberately NOT in `menuFor` — reviewer design note: bypassing the gate could only cause a display regression, never data loss); regen: only `G_palette.json`+`palette.json` drifted. Tests 1564→**1588**; all gates green; browser-verified (14-entry menu, alias `lt` displayed + exported verbatim). **Next:** UAT #1/#2 (collection/struct inputs — needs the shape-hint decision: engine metadata vs interim presentation data)._

_**Post-M5 UI polish — demo layout CSS + conventional block rendering (branch `fix-editor-layout-css`, squashed into `5422caf`).** (1) Demo/shell **layout CSS** so the sandbox isn't flat + a sized Blockly canvas (§12.1, NFR-025); top-level `Makefile` (`demo`/`test`/`cloc`/`gates`). (2) **Blocks:** the **thrasos** renderer (conventional puzzle connections) + a committed `Blockly.Theme` (system font, chrome-aligned surface; block/category colours stay data-driven, FR-127); value/output blocks with **external puzzle inputs**; **title on its own row** when a block has ≥2 value inputs (FR-129, AC-040, §13.10; **AD-033** updates AD-017, Zelos→thrasos). Codec untouched — only `palette.json`/`G_palette.json` regenerated, round-trip green. editor-ui 101, editor-core 14, adapter 1405; typecheck + all gates green; browser-verified. **Next:** UAT #4 (operator dropdown), #1/#2 (collection/struct inputs)._
_**M5 COMPLETE (`/run-milestone M5`) — ROADMAP ☑, `round-trip-reviewer`-signed-off, all DoD gates green;
NOT pushed.** Branch `m5-react-embedding` (off `m4-editor-ui`). The complete consumer-facing surface:
React entry, examples, embedding, progressive disclosure, self-hosting, accessibility. **SPEC-first
(`26691ee`):** ratified **FR-128** (theming = scoped `--transon-*` CSS custom properties, chrome-only;
block/category colours stay data-driven, FR-127) + **AC-039** (accessibility baseline binds the §19.5
suite to a checkable DoD) — both were `should`-level with no contract/DoD; user-approved the minimal
designs. **Slices:** **D0 (`4404b3d`)** `@transon/editor-react` — `<TransonEditor ref>` with React as a
**PEER** (internals + Blockly bundled, React/engine external; a build test proves peer-not-bundled,
AD-019) + embedding callbacks carry the engine `ValidationResult`/`ExecutionResult` payloads
(`validate.ts`/`execute.ts` now RETURN the result; the controller threads it — FR-011/105/106).
**D1 (`b68b1f6`)** embedding config over the one `EditorControllerOptions` funnel: read-only (FR-107,
gates reverse edits + New), chrome-only CSS-var theming (FR-108/128, only `--transon-*` keys on the shell
root), configurable §12.4 categories (FR-109, `filterToolbox` over a COPY, unknown names reported),
custom-marker import+export round-trip (FR-110/AC-026, real engine), `<transon-editor>` event payloads in
`detail` (FR-011). **D2 (`0ddb2bd`)** `buildExampleCorpus` (147 raw docs examples → **89 content-deduped**
`ExampleCase`; the 44 dups are one example under several operators) + Examples picker + `loadExample`
(template+input+expected; InputPanel re-keyed on `selected_example`) + OutputPanel expected-vs-actual with
a **non-colour** ✓matches/✗differs label (FR-009/075/076/079/099, AC-018/019); new session field
`expected_output_json`. **D3 (`2edf480`)** toolbar Import (file → §7.15 gate)/Copy/Download (Blob,
canonical-only §11.6) + FR-101 `confirmReplace` unsaved guard (empty ws → no prompt) + no-backend
(FR-096…101, AC-021). **D4 (`5a49cfb`)** metadata tooltips (FR-078/AC-020 via `ruleTooltip` enriching
palette defs in `blocks.ts`, graceful FR-077), engine+metadata versions in the StatusBar (FR-080,
`loadEngineVersions`, NFR-040 mismatch flag), FR-058 dropdown cited, **§12.6 progressive disclosure**
(`progressiveToolbox`: advanced-blocks toggle + palette search — **data-driven from committed
`presentation.json`, NO `G_toolbox` regen** → codec byte-unchanged; via `mount.setToolboxView`→
`updateToolbox` + `controller.setPaletteView` + Toolbar toggle/search). **D5 (`630186f`)** self-hosting
through the running editor (UC-016): the §7.15 import gate ACCEPTS `G_palette`/`G_toolbox` (in-surface +
round-trip faithful) + forward regenerates them identically; the deepest `G_encode`/`G_decode` exceed the
host-stack recursion ceiling (§6.5) → rejected cleanly. **D6 (`689a50c`)** accessibility: committed scoped
light-DOM stylesheet (`styles.ts`: AA-contrast `--transon-*` tokens + `:focus-visible`, injected by the
mount) + ARIA audit (labels on every panel/region, canvas `role=region`, status `role=status`/`aria-live`,
textareas labelled) + deterministic jsdom **axe-core** scan (0 critical/serious ARIA violations).
**Real-browser verified** via the reference-host (Playwright MCP): axe **0 violations incl. contrast**,
`:focus-visible` 2px outline, and the in-browser **Pyodide engine reaches `ready`** — closing M4 watch-out
(c) that Pyodide load was CI-unverified. **Independent `round-trip-reviewer` (maker≠checker): SAFE TO
MERGE** — verified **codec byte-identity** (editor-core tree hash IDENTICAL to M4 `282fce6`, zero
drift/regen), refuted every concern (marker consistency under 5 adversarial probes, faithful self-hosting,
un-weakened import gate + `guardReplace` can't skip the surface check, purely-additive callbacks/
`expected_output_json`); one SHOULD-FIX — the §6.5 depth-cap `CodecError` was mislabelled
`import_unsupported` (≡ a §15.7 surface violation) — **fixed (`1cf0be6`)** → `runtime_transformation`
(faithful to the engine `TransformationError`) + a D5 assertion. **1551 tests** (core 12 + blockly 20 +
ui 92 + element 12 + react 5 + adapter 1403 + reference-host 7); typecheck + no-codec-mapping +
behavior-runtime-size + presentation + engine-parity + traceability + maturity + evals — all green.
**Key M5 mechanics learned:** the three surfaces share ONE `EditorControllerOptions` (config lands once);
editor-react must BUNDLE the private internals (editor-ui is `private:true`) while keeping react a peer;
docs example names are NOT unique (dedupe by content); an uncontrolled InputPanel needs a `key` to reflect
a programmatic example-input load; progressive disclosure stays FR-127-clean by reading `presentation.json`
(not a TS rule list); a `<footer role=status>` trips axe (footer's implicit contentinfo) → use a `div`;
the depth ceiling makes the editor's own G_encode/G_decode un-openable (clean reject), so AC-036 scopes to
palette/toolbox ("at least one"). **Next:** push `m1`/`m2`/`m3`/`m4`/`m5` + open PR(s) — **M0–M5 all
complete**, none pushed. Remaining known item: the by-design M-09 CI engine-pin flip (`--require-engine`),
waiting on `transon` pip-installable in CI. **M5 follow-ups (non-blocking):** the Playwright/axe browser
checks were run live via MCP (verified) but NOT committed as a CI job — a `@playwright/test` +
`@axe-core/playwright` e2e job against the built reference-host would make contrast/keyboard/Pyodide checks
CI-gated; real engine errors still carry only a text location trail (highlighting falls back to root) —
structured paths need an engine change._

### Prior last action (M4)

_**M4 COMPLETE (`/run-milestone M4`) — ROADMAP ☑, `round-trip-reviewer`-signed-off, all DoD gates green;
NOT pushed.** Branch `m4-editor-ui` (off `m3-editor-blockly`). The runnable editor in both UI modes,
wired to a host engine that runs user templates **and** the projection codecs (AD-030). Three new
packages: `@transon/editor-ui` (private React UI), `@transon/editor-element` (public, ESM + IIFE), and
`examples/reference-host` (the Pyodide demo host, AD-025). **SPEC-first (`1902f64`):** resolved the design
STOPs — §10.4/§17.9 corrected so the visual⇄JSON projection is **engine-gated** (the prior "engine-free
generation" was superseded pre-pivot text; under AD-026/030 generation/import run the codec through the
host engine), ARCH §6/§6.4 encode/decode naming fixed (forward=`decode`, reverse=`encode`), and AC-038 +
§13.13 on-canvas mutators moved out of "Future". **Slices:** **D0 (`4da6c18`)** scaffold + AD-021 pins
(React 18.3.1, @vitejs/plugin-react 5.2.0, jsdom 27.4.0); **D1 (`58b6dd6`)** the framework-agnostic
`EditorSession` store (§9.3 + flow fields) + forward projection (workspace→JSON via core `decode`+`blockMap`,
gated on engine-ready) + §16.4 taxonomy; **D2 (`204c0ac`)** the React shell (sandbox §12.1 / compact §12.2
over the `EditorController`) + the interactive light-DOM Zelos mount (AD-017/018 — **Blockly 13 `inject`
works under jsdom** with the En locale + SVG/canvas stubs in `test/setup.ts`) + editable
`field_transon_scalar` (FR-015) + AC-038 +/- mutators (**object keys became editable `KEY{i}` fields
collected back into `extraState.keys`**, decoder contract unchanged); **D3 (`b9703d2`)** validate/execute
via the host (AC-012…016) + captured `file` writes (AC-024) + include loader pre-resolved map & dynamic JS
callback (AC-025) + `json_input` validation + engine status (AC-023) + the Pyodide `createPyodideHost`
(glue mirrors `runner.py` over a JSON-string boundary, no `eval`); **D4 (`8f698a4`)** error→block
highlighting via a path-index↔block_map walk (Blockly API only, scan-clean) resolving exact/nearest-parent/
root (FR-091…095, AC-017); **D5 (`e32e04a`)** strict §7.15 sync (`tryReverse`: parse→encode→surface-check→
round-trip gate; accept loads, reject leaves the workspace unchanged — FR-111…113, AC-033, AD-024); **D6
(`8b0b9ba`)** `createTransonEditor()` + `<transon-editor>` (light DOM, ESM + self-contained IIFE, **ships no
engine** AD-019/020/008, AC-022) + the runnable Pyodide playground. **Independent `round-trip-reviewer`
(maker≠checker) refuted every concern except one MUST-FIX** — the §7.15 surface check matched the bare
token `transon_unsupported` ANYWHERE in the serialized block, so an in-surface document whose *data*
contained that string was wrongly rejected (FR-111 break) — **fixed (`98e70eb`)** with a structural
block-type walk (`Object.values` + `.type`, gate-clean) + a 4-case regression; reviewer also confirmed
scalar type-fidelity, object-key round-trip, path-index, forward unwrap, and the no-engine IIFE all sound.
**Key M4 mechanics learned:** an empty Blockly workspace serializes to `{}` (save() omits empty sections);
the store's `workspace` is the Blockly ENVELOPE, the codec's `decode` takes the unwrapped top block;
`setWarningText` needs a RENDERED (injected) workspace to register a WARNING icon (headless doesn't); an
out-of-surface doc round-trips too (via the exact-preserving placeholder), so the SURFACE CHECK (not the
round-trip gate) rejects it; the editor-ui↔adapter dep must stay one-directional (a circular dev-dep
breaks turbo `^build`) — the §7.15 controller integration mocks `tryReverse` instead. **1477 tests**
(core 12 + blockly 16 + ui 41 + element 12 + adapter 1389 + reference-host 7); build + typecheck + all gates
green. **Next:** push `m1`/`m2`/`m3`/`m4` + open PR(s); then **M5** (`/run-milestone M5`): `@transon/
editor-react`, example expected-vs-actual UX, import/export UX (FR-096…110), full embedding API
(FR-102…110), accessibility, the self-hosting demo. **M5 watch-outs from M4:** (a) the JSON-panel
controlled-textarea reflects `template_json` only while in_sync (preserves the edit while out_of_sync);
(b) real engine errors carry only a text location trail (not a structured path), so highlighting falls
back to the root block — structured paths would need an engine change; (c) the Pyodide host's real
in-browser load is unverified by CI (jsdom can't load Pyodide) — verify it in a browser / M5 Playwright;
(d) the IIFE no-engine assertion skips if `dist/iife.js` is absent (the dep+source scans always run)._

### Prior last action (M3)

_**M3 COMPLETE (`/run-milestone M3`) — ROADMAP ☑, `round-trip-reviewer`-signed-off, all DoD gates green;
NOT pushed.** Branch `m3-editor-blockly` (off `m2-full-catalog`). The metadata catalog is projected to the
full Blockly surface — palette + toolbox + the finite rule-agnostic behavior runtime — folded in by metadata
+ the `G_palette`/`G_toolbox` projections + the committed `presentation.json`, with **no per-rule code**
(AC-037/NFR-046). **Slices:** **D0 (`12b2751`)** — new `@transon/editor-blockly` package (Blockly `13.0.0`
pinned, AD-021; engine-free, loads the committed artifacts) + `presentation.json` (metadata-contract §2.9
single source: per-rule title/category/advanced + categoryOrder + categoryColour + structuralBlocks/
structuralTitles/unsupportedColour) + typed loader + `check_presentation.py` (FR-127/NFR-048 source-scan that
strips comments + completeness). **D1 (`e17b28f`)** — `G_toolbox` (single-stage `@`-marker projection — the
toolbox is loaded, not executed) → committed `artifacts/toolbox.json`: 13 §12.4 categories in order, colours
from data, block-type names derived in-projection. **D2 (`16d59ca`)** — `G_palette` → committed
`artifacts/palette.json`: 34 Zelos defs (30 rule variants + 4 structural). The FR-118 widget decision is made
IN the projection via `@:cond` (dynamic→`input_value`, constant+options→`field_dropdown` from the resolved
enum, constant→`field_input`), mirroring the encoder's `kind`-based disposition so palette block == encoder
block; label "<title> (<rule>)" (OQ-008); colour = category colour; `object/fields` → single value input (M2
STOP-3). **D3a (`3b2e515`)** — the behavior runtime (`packages/editor-blockly/src/runtime.ts`): the ONLY
first-party Blockly code — a custom `field_transon_scalar` (any JSON scalar) + 3 structural mutators
(array/object/unsupported) that rebuild ITEM{n}/VALUE{n} inputs from the encoder's UI-only extraState in
`loadExtraState` (Blockly runs it BEFORE attaching connections). Keyed by structural vocabulary, NEVER by rule
name (NFR-046). `blocks.ts`: registerTransonBlocks + the structure-blind envelope wrap (`toWorkspaceState`,
§11.5). + FR-125 gate (all 34 defs register + instantiate headlessly) + FR-126 forward gate (the full
147-example + M1 corpus encode→loads in headless Blockly, 1 top block each). **One rule-agnostic skeleton
change drove this:** the encoder's array arm now emits `extraState.items` (item indices) so the array mutator
can rebuild ITEM{n} — Blockly ERRORS on a connection to an undeclared input (verified), and counting inputs
in TS would violate the no-codec-mapping scan (FR-126c); symmetric with object_literal's extraState.keys,
decode ignores it → round-trip unchanged, encoder.json regenerated byte-equal. **D3b (`cd18877`)** — the
NFR-046 `check_behavior_runtime_size.py` gate (no rule-name dispatch literal + a bounded primitive count ==
the declared BEHAVIOR_PRIMITIVES list; found+fixed: the field register went through an alias the count regex
missed → register directly) + AC-037 (a synthetic `greet` rule projects into palette+toolbox from data,
runtime untouched) + AC-036 (G_palette/G_toolbox are in-surface — encode→decode to identity, no
transon_unsupported). **Independent `round-trip-reviewer` (maker≠checker) refuted nothing in M3 scope; one
SHOULD-FIX:** Blockly's save() drops an empty `inputs:{}`, so a Blockly-resaved empty array (no inputs key)
made the array decoder throw → **fixed (`f4de4c8`)** with the decoder reading `inputs default:{}`
(behavior-preserving — ignored when inputs is present; decoder.json regenerated byte-equal) + promoted to the
**FR-126 reverse-path gate** `blockly-resave.test.ts` (217: encode→Blockly load→SAVE→decode over the full
corpus + structural edge cases, proving the decoder consumes Blockly's actual save output incl. scalar TYPE
FIDELITY 42/false/null/3.5). One NIT (the runtime-size scan only catches `case`/`===` dispatch, not a
bracket/object-literal dispatch table) acknowledged-by-design. **New gates wired into pre-commit + CI:**
check_presentation, check_behavior_runtime_size, and the previously-unwired check_no_codec_mapping. **1387
tests** (1364 adapter + 12 core + 11 blockly); all gates green. **Next:** push `m1`/`m2`/`m3` + open PR(s);
then **M4** (`/run-milestone M4`): editor-ui + element shell, host execution wiring, error highlighting from
the `JsonPathBlockMap`, the **interactive Zelos render into a light-DOM scoped container (AD-017/AD-018, needs
jsdom/browser)** + strict bidirectional JSON sync (§7.15). **M4 watch-outs from M3:** (a) the reverse path is
codec-proven (`blockly-resave`) but the editor SYNC wiring (accept/reject in-surface edits, EditorSession) is
M4; (b) the structural mutators provide state hooks only — the visual gear/⊕/⊖ mutator UI is M4/future; (c)
`field_transon_scalar` holds any JSON scalar headlessly — its editable widget + validation UI is M4._

### Prior last action (M2)

_**M2 COMPLETE (`/run-milestone M2`) — ROADMAP ☑, two `round-trip-reviewer` sign-offs, all DoD gates
green; NOT pushed.** Branch `m2-full-catalog` (off `m1-codec-skeleton`). The full 22-rule catalog
round-trips by construction through the generated codec, folded in by metadata + one rule-agnostic
generator change (no skeleton growth per rule, AC-034). **Four reviewed slices:** **D1 (`142bbc9`)** —
catalog fold (`CATALOG_RULES` = metadata-derived) + **empty-operand-safe matcher**: the M1 matcher used
`expr and` over a `$`-runtime list that is EMPTY for the six zero-param rules (`this/parent/item/key/
index/value`) → engine `DefinitionError` (verified); reframed `allRequiredPresent`/`isForeignKey` onto
the join-of-empty membership pattern (`joinNames(...) == KEY_NIL`). **D2 (`3925e18`)** — **field-vs-input
disposition** (FR-118): the only two `kind:"constant"` params (`expr.op`, `call.name`) project to block
`fields` (verbatim scalar, key-based presence), dynamic → `inputs`; `kind` is joined onto variant params
in `generateCodec` (`enrichEntry`) — variant params lack `kind`, only rule-level params carry it — so the
generators branch at `@`-time; operators (28 tokens) + functions (4) round-trip with the constant verbatim
in `fields` (FR-041/042, AC-007/008). **D3 (`6dfacdb`)** — full §15.8 corpus: **all 147** engine
`docs.{rules,operators,functions}[*].examples` round-trip (structural + execution identity); import-failure
(ambiguous multi-variant, foreign param, unknown rule, zero-param+foreign) → `transon_unsupported` + exact
preservation (§15.6/FR-055); multi-rule custom marker; workspace-shape (FR-124) over the full 147 + corpus.
**D4 (`69d1472`)** — **AC-034** proof: a synthetic rule folds into the codec via a new
`generateCodec(engine, rules, catalog?)` override with ZERO projection-file change (constant field + dynamic
input + variant match + unsupported); added `runCodecArtifact` (runs any artifact; the seam for M4's runtime
metadata-source policy). **The example corpus caught a real bug the 1st review under-rated as a NIT — the
`object/fields` escape collision:** the M1 literal-marker escape matched `{$:object, fields:X}` by shape and
encoded it as `transon_object_literal`, shadowing the now-folded-in `object`/`fields` RULE — a marker-FREE
`{$:object, fields:{...}}` decoded to a bare literal, dropping the rule wrapper (round-trip AND semantic
break: the rule omits NoContent, the literal errors; that `TypeError` then crashed `runner.py`'s `json.dumps`
and **hung the suite** → orphaned vitest workers). **Fixed surgically** (skeleton, rule-agnostic): the escape
fires ONLY when the `fields` payload itself contains the **active** marker key (`fieldsHasMarkerKey`, §11.4:
"a literal object that must contain the marker key"); a marker-free payload falls through to the rule arm →
`transon_rule_object__fields`. **SPEC-first:** FR-123 + §11.4 refined; `escape.test.ts` + `marker.test.ts`
(custom-marker discrimination — `{@@:object, fields:{$:1}}` → RULE, proving the active-marker check) lock it.
**Test bridge hardened** so this class of failure can never silently hang again: `runner.py` guards
`json.dumps` (returns a structured `SerializationError` instead of crashing); the adapter adds a 30s
per-request timeout + teardown that fails fast (also fixes the zombie-process accumulation seen mid-session).
**763 tests pass** (757 adapter + 6 editor-core); engine-parity (22/28/4), no-codec-mapping + selftest,
traceability, byte-equal codec-regeneration (AD-030), maturity 93%, evals — all green. **2nd
`round-trip-reviewer` verdict: object/fields fix CORRECT + COMPLETE (incl. custom marker), bridge hardening
SAFE, M2 ready to mark done** (one SHOULD-FIX — committed custom-marker escape test — now landed; one NIT:
`{$:object, fields:<non-dict>}` → `CodecError` not `transon_unsupported`, pre-existing invalid-input behavior,
unchanged by the fix). **Next:** push `m1-codec-skeleton` + `m2-full-catalog` and open PR(s) (one branch/PR
per milestone — neither pushed); then **M3** (`/run-milestone M3`): `G_palette`/`G_toolbox` + Blockly Zelos +
the finite behavior runtime. **M3 watch-outs from M2:** the `object/fields` `fields` param is a map-of-templates
with no metadata `kind` for it — the field/input widget projection must handle it; and `{$:object, fields:X}`
renders as the escape (`transon_object_literal`) only for marker-bearing X, else the `object/fields` rule block._

_**Post-M2 deferred-items audit + cleanup (`47b073d`, round-trip-reviewer-signed-off; not pushed).** Swept all
prior-milestone deferrals; closed the actionable ones. **(c)** the M2-review NIT: `{<marker>:object, fields:X}`
with a NON-dict payload (scalar/list/null/bool) now → `transon_unsupported` + exact preservation (was a raw
`CodecError`) via a skeleton guard `isMalformedObjectFields` (checked before the escape; detects a non-mapping
`fields` with `call type`). **Gotcha (regression I caught + fixed):** `expr and` does NOT short-circuit and
`call type` RAISES on `NoContent`, so the `fields` lookup needs a `{}` default — without it, every non-object
node (`expr`/`this`/unknown) threw. SPEC FR-123/§11.4/§15.7 noted; skeleton-only, rule-agnostic (AC-034 holds);
encoder regenerated byte-equal. **(b)** `JsonPathBlockMap` invariants now hold over all 147 engine examples
(unique escaped paths, parent integrity, rule_name count == marker-bearing dicts). **(a)** traceability accuracy
(workspace-shape-validity + blockmap → [x]; §7.5 pins FR-039 done, FR-037/FR-038 → M4). **915 tests; all gates
green.** Reviewer verdict: correct/complete/regression-free, safe (2 doc/comment NITs fixed). **Only remaining
open item across M0–M2: the by-design M-09 CI engine-pin flip** (`--require-engine`), waiting on `transon`
being pip-installable in CI. Everything else (push/PRs aside) is closed._

### Prior last action (M1)

_**M1 codec slice committed (`d4c550e`) — round-trip-reviewer-signed-off, all gates green.** Branch
`m1-codec-skeleton`. (0) **Engine re-pin to v0.1.3** committed (`197d034`) — the M1 prerequisite (`type`
fn + `include` `IncludeContext` loader); cascaded `v0.1.1`→`v0.1.3` doc refs. (1) **T0 adapter fix**
committed (`bb9c0d9`): the v0.1.3 `include` loader is `loader(name, context=…)` → must build via
`context.transformer(…)` (self-`include` recursion + depth guard); added the `EngineProvider.transform`
`includes` bundle channel + fixed `collectIncludes`. (2) **The M1 codec slice landed (`d4c550e`):**
`packages/editor-core/src/codec/` = `codegen.ts` (the `@`-staged
`G_encode`/`G_decode` arms projected from `attr` metadata + fixed skeleton + `generateCodec`/`serializeArtifact`),
`run.ts` (engine-free encode/decode via the host port, `CODEC_MAX_INCLUDE_DEPTH=25`), `vocabulary.ts`
(block types + `WorkspaceBlock`/`JsonPathBlockMap`), committed `artifacts/{encoder,decoder}.json`;
codec tests live in `test/engine-node-adapter/test/codec/` (round-trip structural+execution, encode,
decode, workspace-shape, ceiling, regen) + `harness/scripts/check_no_codec_mapping.py` (FR-126). The
**de-risk is proven**: `decode(encode(T)) == T` structurally AND by execution (AC-035) over the M1
corpus; per-rule arms are projected from metadata (AD-026) with **byte-equal regen** (AD-030);
out-of-surface → `transon_unsupported`; deep nesting fails cleanly with a `CodecError` (§6.5 — found +
fixed a real raw-stack-overflow via the `maxIncludeDepth` cap). **Independent `round-trip-reviewer`
found 2 must-fix correctness bugs — both fixed + independently re-verified (sign-off: round-trip sound,
safe to merge for the M1 prototype scope):** (#1) presence was decided
by comparing a param's VALUE to a sentinel, so a valid `attr` whose `default` equalled the sentinel
string was silently dropped (AC-035/AD-004 break); (#2) variant matching only checked required-present
+ first-match, so ambiguous (`name`+`names`) / foreign-param `attr` nodes were silently rewritten
instead of → `transon_unsupported`. **Fix:** presence is now KEY-based (the codec `set`s the node,
compares key NAMES against generation-time-known param names; no value sentinel — `ABSENT` deleted),
and variant matching is EXACT (all required present AND no foreign key → else the cond default →
unsupported); decode `decInput` is key-based too. Also hardened the FR-126 scan (bracket/destructuring
access) and fixed a dead regex in `isRuleBlockType`. Regression coverage added (sentinel-default,
ambiguous, foreign). **107 tests pass**; typecheck + build + all gates green (parity 4 fns, traceability,
no-codec-mapping + selftest, snapshot-drift, maturity 93%, evals). Traceability rows + ROADMAP M1
tracker (☐→◐) updated. **Key codec mechanics learned** (load-bearing):
`map`/`filter` iterate `this` (not a `value` source — chain into `this` first); `set` stores `this` (no
`value` param); `include` passes only `this` (navigate via `chain` before recursing); `switch.cases`
must be a literal mapping (merge fixed+generated cases at codegen time, not via runtime `join`); `join`
merges dicts; `object key+value` builds a single dynamic-key dict; `object/fields` omits NO_CONTENT
values (drives optional-param omission); **presence/membership must be KEY-based** (a value-sentinel
collides — review #1) and the engine `!`/`not` operator does NOT negate (use `!=` / restructure).
Reviewer signed off (maker≠checker). **Since `d4c550e`:** (a) **`a913514`** — committed the
`G_encode`/`G_decode` generators as inspectable projection DATA (`src/codec/generators/*.json`);
`generateCodec` now runs the committed JSON (load-bearing), TS builders are the gate-verified authoring
source, regen holds them byte-equal. (b) **`4efc0e2`** — **T5 literal-marker escape** (FR-059/060/061/062/123):
the skeleton owns the `{<marker>:object,fields:X}` escape (exact shape, precedence over rule dispatch →
`transon_object_literal`; decode re-wraps when content carries the marker); centralized the inspected
DOCUMENT marker as `DOC_MARKER`. (c) **`d3280df`** — **T7 `JsonPathBlockMap`** (FR-091/094/122): a fixed,
metadata-free block-map encoder (`artifacts/blockmap.json`) walks the document and emits a segment tree;
`run.ts` flattens it into the flat map (the main codec is untouched). **+ FR-063 custom marker:** the codec
carries a marker placeholder (`DOC_MARKER_PLACEHOLDER`); `run.ts` substitutes the configured marker
(default `$`) at runtime, so one codec serves any marker. (d) **`db451c0`** — should-fix from the 2nd
reviewer pass: `block_id`/`template_path` now use RFC-6901 escaping (assembled in `run.ts`) so paths are
unique even for keys containing `/`. **M1 is COMPLETE (ROADMAP ☑):** the 2nd independent `round-trip-reviewer`
pass signed off escape + custom marker + blockMap as sound; **133 tests; all gates green** (parity 4 fns,
traceability, no-codec-mapping + selftest, snapshot-drift, maturity 93%, evals). **Next:** push
`m1-codec-skeleton` + open a PR referencing the M1 IDs (one branch/PR per milestone — not yet done), then
**M2** (`/run-milestone M2`): fold the full 22-rule catalog by extending `generateCodec`'s `M1_RULES` list +
the committed `G_*` arms (no skeleton change, AC-034; watch field-`kind` disposition, FR-118).
(Prior: RFC-002 absorption + coherence fixes committed `b3e6669`/`cb5b738`; M0 editor build `8751707`.)_

### Prior last action (M0)

_**M0 editor-side build landed** on branch `m0-editor-scaffolding` (uncommitted, in the working tree).
Scaffolded the pnpm/Turborepo monorepo with the AD-021 pins (Node ≥20, pnpm 10.27.0, TS 5.9.3, Vite
6.4.3, Vitest 2.1.9, Turbo 2.10.0, Changesets 2.31.0); stubbed `@transon/editor-core` (deliverable #1)
with the `EngineProvider` port + §9.9/§9.10 result types and a typed `metadata-snapshot.json` loader;
built the test-only Node→Python `transon` adapter (`test/engine-node-adapter`, AD-011/AD-025) — a
long-lived subprocess speaking newline-JSON to `runner.py` — and the `@`/`$` two-pass staging proof
(FR-116/FR-119/AD-027/AD-030). All gates green: typecheck, `pnpm -r test` (13/13), build,
`check_traceability.py`, `check_engine_parity.py` (22 rules/28 ops/3 fns). Engine pin resolved: local
`../transon/.venv` is at `0.1.2` but its metadata export is identical to the pinned `5812b63`, so parity
holds — no checkout/re-pin. **Independent `round-trip-reviewer` sign-off complete**: the staging proof,
no-`eval` discipline, adapter↔engine fidelity, and the FIFO subprocess protocol were all verified
correct via counterfactual tests; the one must-fix — a hardcoded `DEFAULT_VENV_PYTHON` absolute path —
is fixed (the adapter now resolves `<transonRepo>/.venv/bin/python`, proven by the suite passing with
`TRANSON_PYTHON` unset); a stale doc comment in `snapshot.ts` was also corrected. Gates re-run green.
Traceability rows for AD-008/AD-011/AD-027·FR-116/FR-119·AD-030/NFR-047 stay `[~]` on purpose — those
IDs are only *partially* covered by M0 and complete across M1/M2/M4. **M0 editor-side slice committed
as `8751707` on `m0-editor-scaffolding` (not pushed); ROADMAP M0 tracker flipped to ☑.** Deferred
follow-up: add a request-id to the bridge protocol (currently safe, see M1)._

## Status by milestone

The authoritative milestone tracker is [`ROADMAP.md`](ROADMAP.md#milestone-tracker); this is the
living read of it.

- **M0 — engine `switch`/`cond` + projection-ready export + Node adapter** — ☑ done (committed
  `8751707`, since merged to `main` and pushed; CI pin flip deferred). Engine half: `../transon` exports
  `get_editor_metadata()` (`switch`/`cond` + projection-ready split catalog/docs, `metadata_version
  2.0`) — captured in [`metadata-snapshot.json`](metadata-snapshot.json). Editor half: monorepo
  scaffolding + AD-021 pins, `@transon/editor-core` stub (`EngineProvider` port + snapshot loader), and
  the Node→Python `test/engine-node-adapter` running markers `@`/`$` — reviewed + gate-green. Only the
  CI engine-pin flip (M-09: `--require-engine`) remains, waiting on `transon` being pip-installable in CI.
- **M1 — `editor-core` codec skeleton + `G_encode`/`G_decode` for `attr`** — ☑ done (committed, since merged
  to `main` and pushed; two `round-trip-reviewer` sign-offs). Codec in `packages/editor-core/src/codec/`;
  engine-executed tests in `test/engine-node-adapter/test/codec/`. `decode(encode(T)) == T` structurally
  + by execution (AC-035); arms projected from committed-JSON generators with byte-equal regen
  (AD-026/030); literal-marker escape (FR-059…063/123), exact-variant surface check (§15.7),
  `JsonPathBlockMap` (FR-091/094/122), custom marker (FR-063); workspace-shape + FR-126 gates pass; clean
  recursion ceiling (§6.5). 133 tests.
- **M2 — full catalog** — ☑ done (committed `142bbc9`→`69d1472` + the closeout, since merged to `main` and pushed; two
  `round-trip-reviewer` sign-offs). All 22 rules + every variant round-trip by construction (147 engine
  examples + corpus); constant-field disposition (FR-118); import-failure → `transon_unsupported`;
  AC-034 synthetic-rule proof; object/fields escape-collision fix (FR-123/§11.4 refined); test bridge
  hardened. 763 tests. See **Last action** for detail.
- **M3 — `editor-blockly`: `G_palette`/`G_toolbox` + Zelos + behavior runtime** — ☑ done (committed
  `12b2751`→`f4de4c8`, since merged to `main` and pushed; `round-trip-reviewer` sign-off). The full catalog projects to Blockly
  (committed `palette.json`/`toolbox.json` from `G_palette`/`G_toolbox`) + the finite rule-agnostic behavior
  runtime (`@transon/editor-blockly`: 1 field + 3 structural mutators). FR-125 (palette-load) + FR-126
  (encoder-load, both directions) + FR-127/NFR-048 (presentation-from-data) + NFR-046 (runtime-size) + AC-036
  (self-hosting in-surface) + AC-037 (synthetic-rule-from-data) all gated. 1387 tests. See **Last action**.
- **M4 — `editor-ui` + `editor-element`: shell + host execution + bidirectional sync** — ☑ done
  (committed `1902f64`→`98e70eb`, since merged to `main` and pushed; `round-trip-reviewer` sign-off). The runnable editor in
  sandbox + compact modes over the `EditorController`/`EditorSession` store; interactive light-DOM Zelos
  mount (AD-017/018, jsdom); host validate/execute (AC-012…016/024/025); error→block highlighting
  (AC-017); strict §7.15 bidirectional sync (AC-033); editable scalar field (FR-015) + on-canvas
  array/object mutators (AC-038); `createTransonEditor()` + `<transon-editor>` (ESM + IIFE, no engine,
  AC-022); the Pyodide reference host (AD-025). One reviewer must-fix (§7.15 surface check) fixed +
  regression-locked. 1477 tests. See **Last action**.
- **M5 — `editor-react` + examples + embedding + accessibility + self-hosting** — ☑ done (committed
  `26691ee`→`1cf0be6`, since merged to `main` and pushed; `round-trip-reviewer`-signed-off, codec byte-unchanged). New public
  `@transon/editor-react` (React peer); full embedding config (read-only/theming FR-128/categories/marker);
  examples corpus (89 deduped) with expected-vs-actual; import/copy/download + unsaved guard; tooltips +
  version diagnostics; §12.6 progressive disclosure (data-driven, no regen); self-hosting through the
  editor (UC-016); accessibility (§19.5, real-browser axe-verified: 0 violations incl. contrast, Pyodide
  `ready`). **1551 tests**; all gates green. See **Last action**.

## Next steps (ordered)

-1. **RFC-008 — COMPLETE on this branch; remaining action: merge PR #16** (see
   [`proposals/rfc-008-generator-shrink-via-in.md`](proposals/rfc-008-generator-shrink-via-in.md)).
   Slice 1 (re-pin 0.2.0) merged via PR #14; all four OQs ratified 2026-07-18 (PR #15); slices
   2–3 (SPEC v2.7 — FR-142 engine floor + §16.4 `engine_floor` + metadata-contract §5 note;
   red-first AD-004 collision fixtures; the total-membership `codegen.ts` rewrite + AD-030
   regen) implemented and reviewed on `rfc-008-generator-shrink` (PR #16, stacked on #15) —
   `round-trip-reviewer` verdict READY TO MERGE (see **Last action**). One deliberately-deferred
   remainder: `call`-menu curation rides the canvas-UX track (M7 / RFC-006 Tier C, OQ4).

0. **Answer RFC-006 open questions** (or defer with owner/date) — checklist in
   [`docs/proposals/rfc-006-post-m6-consistency-backlog.md`](proposals/rfc-006-post-m6-consistency-backlog.md)
   appendix. Highest leverage first: **OQ-B0** (Tier B before/after/parallel M7), **OQ-A3/A4**
   (FR-048 / FR-033 implement vs paper), **OQ-A1/A2** (descope FR-017 / soften UC-010). Until
   answered, do **not** start SPEC or code slices from the RFC. Optional: commit the untracked
   RFC-006 + this handoff + the `update_memory.py` porcelain-strip fix when ready.

1. **Tier A (after OQ answers) — contract honesty.** (a) Docs honesty: fix stale
   `traceability.md` NFR-027 row (FR-135 autorun is `[x]`); keep this Next-steps list current.
   (b) SPEC decide-or-descope PR for phantoms (FR-017, UC-010/FR-053, AD-013 advisory half,
   FR-086 “limited generic”). (c) FR-033 and/or FR-048 per OQ-A3/A4. (d) Evidence pack
   (FR-057/049/066, FR-085/086 negative, FR-083 op/fn, `onImportFile`). Full inventory = RFC-006
   Tier A + 2026-07-03 audit notes in `traceability.md`.

2. **Tier B — R-28 editor consumer (was UAT #1/#2).** Engine export **done** (`container`/`arm` in
   snapshot 3.0). Editor still open: document §2.2 → FRs at next-free (**FR-139+**; P-E also
   claims that range — coordinate) → spike `chain`+`cond` → generalize `switch`/`object.fields`;
   NFR-046-gated runtime primitives; `review-gate` on codec/mutator. **Coordinate** before
   touching contract/codec/runtime (may overlap another session). Sequencing vs M7 = **OQ-B0**.

3. **Tier C — M7 adaptive layout (RFC-003 P-E).** M6 **DONE**. Next: prototype on largest corpus
   examples → pin threshold/damping (**OQ-C1/C2**) → SPEC at true next-free (**not** FR-135 —
   consumed by RFC-005) → implement. Guardrail until SPEC: no production `inputsInline` flips.
   Optional polish (context-sensitive examples, shadows, a11y CI) = OQ-C6…C9 / Tier D.

4. **Tier D (capacity).** (a) Optional post-hoc `review-gate` on v0.1.1 minimap mutator fix
   (**OQ-D1**). (b) M-14 a11y CI / M-15 coverage ratchet / M-10…12 harness polish (**OQ-D2**).
   (c) Optional docs-site cleanup (dead `predeploy`/`deploy` scripts).

~~Historical (DONE — kept for provenance; do not re-open):~~ v0.1.1 minimap fix shipped; Codecov
wired (`use_pypi`); RFC-005 Parts 1–4 + docs-site embed live; M0–M6 complete; R-31 / FR-132 /
M-09 CI engine pin done. Detail lives in **Last action** archive below.

**Regen flow** (only if a codec generator changes): write generators →
`pnpm --filter editor-core build` → `UPDATE_ARTIFACTS=1` test → rebuild (double-build, run.ts bundles the
artifacts) → a normal run must be byte-equal.

## Open blockers / waiting-on

- **RFC-006 open questions** — maintainer answers (or explicit defer) before Tier A–C implementation.
- **Tier B surfaces** — coordinate before editing `metadata-contract.md` §2.2 / codec container
  branch / runtime primitives (possible cross-session overlap).
- No product blocker on shipped M0–M6 / v0.1.1 / docs-site embed.

## Do-not-relitigate (pointers, not copies)

- Locked decisions → [`ROADMAP.md` §Locked decisions](ROADMAP.md#locked-decisions).
- Architecture decisions `AD-001…AD-032` → [`ARCHITECTURE.md`](ARCHITECTURE.md).
- Golden rules / always-on invariants → [`AGENTS.md`](../AGENTS.md).
