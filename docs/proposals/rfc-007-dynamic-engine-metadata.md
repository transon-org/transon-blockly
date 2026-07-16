# RFC-007: Optional runtime engine metadata — dynamic catalog + codegen at session init

- **Status:** **IMPLEMENTED** (2026-07-17, branch `rfc-007-dynamic-metadata`, Phases 0–2 +
  AC-043 live browser pass; maintainer directive: *no snapshot re-pin* — the live 0.1.8-engine vs
  0.1.7-pin skew was kept deliberately and served as the real-world AC-043 test: dynamic session →
  `split` in palette, imports in-surface, executes; default session → `import_unsupported`).
  Independent `round-trip-reviewer`: **READY TO MERGE, no 🔴**; its one 🟡 (imperative load
  racing the dynamic-arrival projection → silent drop) fixed same-branch via `arrivalSettled`
  serialization + regression test; 🟢 note recorded, not fixed: `presentationWithFallback` would
  mishandle a fetched rule literally named `__proto__` (trusted-host boundary per AD-008 —
  harden with a null-prototype map if the trust model ever changes). Phase 3 (floating-engine CI
  smoke, OQ-R3) remains DEFERRED. Contract homes: `SPEC.md` **v2.5** §7.18 (**FR-139/140/141**),
  **AC-043**, §16.4 `metadata_fallback`; `ARCHITECTURE.md` **AD-036**; `metadata-contract.md` §3
  (runtime delivery) + §5 (same-major range policy). Ratified answers: **OQ-R1** explicit
  `metadataSource` flag (presence of the method alone changes nothing); **OQ-R2** same-major
  (contract §5); **OQ-R3** deferred (no CI job in this slice — the live skew is the test);
  **OQ-R4** option (a) — constants carried as a conservative floor (SPEC §7.18 note); **OQ-R5**
  full payload at once (catalog + docs; lazy split deferred); **OQ-R6** RFC-007 lands before
  Tier B; **OQ-R7** fallback category declared in `presentation.json`, `advanced: true` (FR-141).
  Design record; where this and the contract docs disagree, **they win**.
- **Type:** Architecture extension — an **opt-in runtime path** for engine metadata + codec
  generation, alongside (never replacing) the committed snapshot + artifacts. Extends **AD-012**
  (engine-owned metadata) and **AD-030** (build-time codegen); adds one optional method to the
  `EngineProvider` port (`SPEC.md` §10.4, `metadata-contract.md` §3); realizes the §8.7
  compatibility machinery (NFR-036…040) at runtime.
- **Baseline:** SPEC v2.1, M0–M6 done; engine pin `transon` **v0.1.7**, snapshot
  `metadata_version` **3.0**; RFC-004 landed (depth ceiling 55 / host recursion 1400, measured
  against 0.1.7); RFC-006 proposed (Tier B touches the same contract sections). Ledger next-free
  (2026-07-16): **FR-139 · NFR-51 · AC-43 · UC-17 · AD-36 · OQ-21**.
- **Motivating incident:** engine **v0.1.8** released 2026-07-16 → its new/changed rule shapes
  project as `transon_unsupported` in every deployed editor until the snapshot is re-pinned
  **and** the editor is re-released. The unsupported path is *correct* (AD-004: never silently
  change meaning) — but the release coupling is avoidable.

## Problem (one line)

FR-120/AC-034 promise "a new rule with complete metadata appears with **no editor code change**" —
but today that promise is only redeemable through a **snapshot re-pin + editor release**, because
the catalog, the codec artifacts, and the palette/toolbox are all compiled in at build time; a host
that already runs engine 0.1.8 still projects against the 0.1.7 catalog and shows new surface as
unsupported.

## Why this is nearly free architecturally (evidence)

The expensive design work already exists; what is missing is orchestration and state plumbing.

1. **Codegen is pure, engine-executed, and catalog-parameterized.** All three generators take the
   catalog as a parameter that merely *defaults* to the pinned snapshot —
   `generateCodec(engine, rules, catalog)` (`codegen.ts:685`), `generateToolbox(…)`
   (`codegen.ts:728`), `generatePalette(…)` (`codegen.ts:857`). The catalog override exists
   precisely so AC-034 can prove "a synthetic rule folds in by metadata alone." Running them at
   session init over a *fetched* catalog is the same call.
2. **The generators run through the host engine already.** They are `@`-staged Transon templates
   executed via `EngineProvider.transform` (AD-030 two-pass generate-then-run). The dynamic path
   introduces **no new execution machinery** — the same port that will supply the metadata also
   runs the generators.
3. **The editor already cannot function without a live engine.** `encode`/`decode` execute the
   codec artifacts through the host (`run.ts`, AD-032/FR-126). "Snapshot = works offline" is not a
   property the codec ever had; fetching `get_editor_metadata()` at the same boundary adds no new
   runtime dependency.
4. **The engine export exists.** `get_editor_metadata()` is shipped engine-side
   (metadata-contract §3, engine R-23…R-25 done); only the *provider proxy* to it is missing —
   `EngineProvider` exposes `validate`/`transform`/`version` but no metadata method
   (`packages/editor-core/src/engine/ports.ts`).

## Proposal

**Hybrid, not a switch.** The committed snapshot + committed artifacts remain the default catalog,
the CI anchor, and the gate substrate (AD-030's strict regeneration gate is untouched). A host may
**opt in** to dynamic metadata at session construction; nothing changes for hosts that don't.

### P-A — `EngineProvider.getEditorMetadata()` (contract extension)

Add one **optional** method to the port (`ports.ts`; `metadata-contract.md` §3;
`SPEC.md` §10.4):

```ts
/** Proxy the engine's get_editor_metadata() export (metadata-contract §3).
 *  Optional: absent on hosts that predate RFC-007. */
getEditorMetadata?(): Promise<Json>;
```

The reference hosts implement it as a thin proxy (Pyodide `provider.ts`; Node `runner.py`
adapter). The editor **consumes, never normalizes** (contract §4): the payload must already be the
full §2 shape, validated only for `metadata_version` compatibility and structural presence.

### P-B — Opt-in dynamic session init

A session-level option (name illustrative):

```ts
createEditorSession({ engine, metadataSource: 'snapshot' /* default */ | 'engine' })
```

With `'engine'`, session init becomes:

1. `engine.init()` → `engine.getEditorMetadata()`;
2. **compatibility gate** (§8.7): check `metadata_version` against the editor's declared
   compatible range (see OQ-R2); on incompatibility or fetch failure → **fall back to the bundled
   snapshot**, surface a diagnostic (NFR-038/039) — never a hard crash, never a silently mixed
   catalog;
3. run `generateCodec` / `generatePalette` / `generateToolbox` over the fetched catalog (through
   the same engine);
4. register blocks/toolbox from the *generated* palette; execute the *generated* codec artifacts
   for the session's lifetime.

The fetch happens **once, at session init** — never mid-session. A metadata swap while a document
is open is out of scope (re-create the session to re-fetch).

### P-C — Module-level constants become session state (the real refactor)

Today the catalog and artifacts are top-level constants consumed across five packages:

| Constant | Home | Consumers |
|---|---|---|
| `editorMetadata` / `metadataVersion` | `editor-core/src/metadata/snapshot.ts` | codegen, docs/tooltips (`editor-blockly/src/blocks.ts:21`), examples (`editor-ui/src/session/examples.ts`) |
| `PALETTE_BLOCKS` / `TOOLBOX` | `editor-core/src/codec/surface.ts` | block registration, toolbox |
| `ENCODER` / `DECODER` / `BLOCKMAP` | `editor-core/src/codec/run.ts:45-47` | every encode/decode |

These become fields of a session-scoped **catalog context** (constructed from the snapshot by
default — byte-identical behavior), threaded explicitly instead of imported. This slice ships
**alone first**, with `metadataSource: 'snapshot'` as the only mode, proving zero behavior change
(gates + corpus green, artifacts byte-identical) before any dynamic fetch exists.

### P-D — Presentation fallback for unknown rules

`title`/`category` are **editor-owned for built-in rules** (contract §2.1/§2.8, FR-127): a rule
that is *new in the engine* has no committed presentation entry, and `generateToolbox` currently
throws on a catalog rule missing presentation. The dynamic path needs a deterministic fallback —
proposal: title = rule `name`, category = a dedicated "New in engine" (or "Other") category,
advanced = true — so an unknown-to-presentation rule degrades to a *plain but functional* block
rather than an error (mirrors the FR-086 custom-rule policy, which already requires
`title`/`category` in metadata for custom rules — those need no fallback).

### P-E — Version-measured limits must stop being constants

`CODEC_MAX_INCLUDE_DEPTH = 55` and `HOST_RECURSION_LIMIT = 1400` were **measured against engine
0.1.7** (RFC-004; `run.ts:22-38`). Under a floating engine these are assumptions, not
measurements. Options (undecided, OQ-R4): (a) keep the constants as a **conservative floor** and
document that a dynamic-engine host inherits them; (b) have the engine export a per-version
recursion budget in metadata; (c) re-derive at init via a probe. Lean: **(a)** for the first
slice — the ceiling only governs when *deep* documents fail cleanly vs. raw overflow; a
regression here degrades an error message, not correctness.

## What does NOT change

- The **committed snapshot and artifacts** stay: default catalog, deterministic CI substrate,
  and the parity / round-trip / regen gates all keep running against the pin exactly as today
  (AD-030 strict regeneration gate untouched).
- **Snapshot re-pin discipline stays** (`update_memory.py --snapshot` / `--check`): the pin is
  still what CI proves correctness against, and still what non-opting hosts ship.
- **AD-004/AD-008 are preserved**: unknown shapes still take the unsupported path (now only for
  *genuinely* out-of-surface JSON, not version skew); the editor still bundles no engine — the
  metadata now comes from the same host boundary as validation/execution, which is *more*
  AD-012-faithful, not less.
- The 0.1.8 incident still gets the **re-pin fix now**; this RFC removes the *class* of incident
  for opted-in hosts going forward.

## Risks

- **Untested engine×editor combinations.** Today the gates prove exactly one pairing. Dynamic
  hosts run pairings CI never saw. Mitigations: the `metadata_version` gate (hard), a
  floating-engine smoke job in CI (OQ-R3), and the engine remaining authoritative for
  validation/execution regardless of what the projection shows (NFR-004 already guarantees a
  stale projection can't execute wrongly — worst case is surface lag, the very thing being fixed).
- **Init latency.** Metadata fetch + three generator runs move from build time to session init on
  the opted-in path. RFC-004's measurements suggest the generator walks are the heavy part;
  needs one benchmark before ratification (hint: measure in the Pyodide reference host, the
  slowest realistic host).
- **Docs payload size at runtime.** The split catalog/docs payload (NFR-047) lets the dynamic path
  fetch the lean catalog first and the examples/docs payload lazily — recommended, not required,
  for the first slice.
- **Trust boundary.** Fetched metadata drives codegen. This grants the host no authority it lacks:
  the host already supplies the engine that executes every template (AD-008); malformed metadata
  fails the compatibility/shape gate and falls back to the snapshot.
- **RFC-006 Tier B contention.** Tier B edits `metadata-contract.md` §2.2 and the palette/codec
  for `container`/`arm`. Both RFCs touch the same files; sequence them (OQ-R6) — they are
  compatible (Tier B enriches *what* the catalog says; this RFC changes *when* it is read).

## Open questions

| ID (hint) | Question | Notes |
|----|----------|-------|
| **OQ-R1** | Session option shape: constructor flag (`metadataSource`) vs. capability-detect (`getEditorMetadata` present → offer dynamic)? | Lean: explicit flag; presence alone must not change behavior. |
| **OQ-R2** | Compatible-range policy for `metadata_version`: exact match ("3.0"), same-major ("3.x"), or a declared range table? | Contract §5 says "declared compatible ranges" — this ratifies what that means concretely. |
| **OQ-R3** | CI: add a scheduled floating-engine job (latest PyPI `transon` × dynamic path, corpus subset)? | Catches skew before users do; keeps main gates deterministic. |
| **OQ-R4** | P-E options (a)/(b)/(c) for the depth/recursion limits? | Lean (a); (b) needs engine-repo work. |
| **OQ-R5** | Does the dynamic path also refresh `docs.examples` (load-example surface), or catalog-only first? | Lean: catalog first; examples lazily later (NFR-047 split enables it). |
| **OQ-R6** | Sequence vs. RFC-006 Tier B: before, after, or land P-C (plumbing) first as a common substrate? | P-C-first helps both. |
| **OQ-R7** | Presentation fallback category name + whether fallback blocks are `advanced: true` by default (P-D)? | |

## Phasing (each slice independently gated, test-first)

| Phase | Slice | Contract homes touched | Proof |
|---|---|---|---|
| 0 | Ratify: SPEC FRs (from **FR-139**) for opt-in dynamic metadata + fail-safe fallback; **AD-36** (this decision, extending AD-030); contract §3 method + §5 range policy | `SPEC.md`, `ARCHITECTURE.md`, `metadata-contract.md` | docs gates |
| 1 | **P-C** constants → session state, snapshot-only mode | none (pure refactor) | artifacts byte-identical; parity + corpus + regen green |
| 2 | **P-A/P-B/P-D** provider method, reference-host proxies, opt-in init, compat gate + fallback, presentation fallback | `ports.ts`, both reference hosts | new AC (from **AC-43**): dynamic session over a synthetic vNext catalog projects a rule the snapshot lacks; fallback AC on version mismatch |
| 3 | **OQ-R3** floating-engine smoke CI; docs (`agentic-development.md`, embedding guide) | CI | scheduled job green against current PyPI |

## Decision asked of the maintainer

1. Ratify the hybrid direction (snapshot = default + CI anchor; dynamic = opt-in at session init).
2. Answer OQ-R1/R2 (option shape, version-range policy) — required before Phase 0 lands.
3. Sequence against RFC-006 Tier B (OQ-R6).
