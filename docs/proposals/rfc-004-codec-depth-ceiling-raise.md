# RFC-004: Raise the codec depth ceiling — open every committed projection file (full FR-121)

- **Status:** **IMPLEMENTED** (2026-07-06; maintainer ratified the host-recursion-limit revision
  in-session). Contract homes: `metadata-contract.md` §6.5 (ceiling + engine floor + host
  recursion budget), `SPEC.md` **AC-042** + §16.4 (error-mapping note), `ARCHITECTURE.md`
  **AD-035**, `traceability.md` (AC-042 row), `metadata-snapshot.json` (engine pin ≥ 0.1.7).
  Test-first landing: `test/engine-node-adapter/test/ui/selfhosting.test.ts` (all nine files,
  red→green), `packages/editor-ui/test/errors.test.ts` (§16.4 mapping),
  `test/engine-node-adapter/test/codec/ceiling.test.ts` (rebased onto the constant).
- **Revision (same day, before landing):** the first draft proposed cap 45 with no host change,
  from a pre-verification that turned out to be flawed — it measured the codec walk over the
  committed fragments **without the document-marker substitution**, so `G_encode`'s `$`-nodes
  were walked as cheap literals. The red test through the real editor seam caught it. True
  numbers (below) forced the revision: cap **55** + a host recursion budget of **1400**,
  reversing this RFC's own earlier "declined" stance on touching the interpreter limit — with
  the new evidence that no safe include-cap alone can open `G_encode` (its walk peaks above the
  default interpreter limit regardless of the guard value).
- **Type:** Codec runtime-limit change + error-taxonomy clarification. **No projection, surface,
  or round-trip semantics change** — the codec artifacts stay byte-identical; only the depth at
  which the editor stops projecting moves, plus one error-code mapping fix.
- **Baseline:** SPEC v2.1 (FR-114…FR-134 landed; FR-135/AD-034 are RFC-003 P-E *reservations*, not
  landed — this RFC takes the next free IDs **AC-042** and **AD-035**). Engine baseline: `transon`
  **v0.1.7** (Roadmap **R-32** — the `walk`/`_walk` recursion-budget fix this RFC depends on; see
  `../transon/docs/proposals/transformer-recursion-depth-budget.md`).

## Problem (one line)

FR-121 requires the editor's projection templates to be *"openable and round-trippable in the
editor they configure"* — but the codec's depth ceiling (`CODEC_MAX_INCLUDE_DEPTH = 25`) makes the
deepest ones (`G_encode`, nesting depth 41; `encoder.json`/`G_decode`, 26) un-openable, a
documented D5 limitation. AC-036's "at least one" bar hid the gap. The goal: **every** file in
`packages/editor-core/src/codec/generators/` and `…/codec/artifacts/` opens, is in-surface, and
round-trips to identity.

## Evidence (measured, engine v0.1.7; walk = the REAL marker-substituted codec)

The codec walks a document by self-`include`; its reach is bounded by the **host call stack**, not
by `max_include_depth`. Engine R-32 (v0.1.7) collapsed the `walk`/`_walk` frame doubling (literal
wall 37 → 49 at the default limit). Measured through the committed encoder with the document
marker substituted (the walk the editor actually runs — an unsubstituted walk treats `$`-nodes as
literals and understates rule-dense cost, the first draft's error):

| Input | Structural depth | Real requirement (marker-substituted walk) |
|---|---|---|
| `G_encode.json` (deepest) | 41 | include cap ≥ **52**; peak **~1113 Python frames** — above the default 1000 limit |
| other 8 generators + artifacts | 5–26 | all open at cap 45; verified in-surface + round-trip identical |
| *(pathological)* rule-per-level nesting | — | raw overflow past ~26 at limit 1000 (~36 at 1400) — caught at the provider boundary |

Consequences:

1. **No safe include-cap alone opens `G_encode`.** Its walk needs more Python frames (~1113) than
   the default interpreter limit (1000) allows — the guard value is irrelevant to that. Engine-side
   frame reduction is exhausted (R-32 was the win; `walk_rule`'s contextmanager holds no live
   frame at depth — measured zero effect).
2. **A bounded host recursion budget closes the gap.** At `sys.setrecursionlimit(1400)` the
   `G_encode` walk (peak ~1113) carries ~290 frames of headroom, and the literal-nesting wall
   moves to ~68 — above a cap of 55, so ordinary deep nesting still trips the engine's clean
   depth-limit guard first. Structural depth is only a *lower bound* on the include cap a
   rule-dense document needs (~2 include levels per rule node: 41-deep `G_encode` → 52).
3. **The "guard always trips first" property is preserved for literal nesting, given up only for
   pathological rule-per-level inputs** (a shape no committed file has) — those raw-overflow
   inside the engine call, are caught at the `EngineProvider` boundary, and are mapped to the
   same runtime-limit error code.

## Decision (as landed)

1. **Raise `CODEC_MAX_INCLUDE_DEPTH` 25 → 55** (`packages/editor-core/src/codec/run.ts`):
   `G_encode` needs 52; +3 margin; 55 < the ~68 literal wall at the 1400 budget.
2. **Host recursion budget 1400 in both reference hosts** — `test/engine-node-adapter/src/runner.py`
   and the Pyodide glue (`examples/reference-host/src/glue.ts`), as
   `sys.setrecursionlimit(max(current, 1400))`. This *revises the first draft's "declined"
   stance*: with the true numbers, it is the only path to the stated goal short of restructuring
   `G_encode` itself (kept as the fallback below). CPython: trivial (8 MB stack ≫ 1400 frames).
   Pyodide: same glue line; verified in a real browser (§19.4) before merge.
3. **Require engine ≥ 0.1.7** (R-32 recursion budget). `docs/metadata-snapshot.json` re-pins
   `engine_version` to `0.1.7`; the engine-parity gate enforces the floor; the reference host's
   `PINNED_ENGINE_VERSION` moves 0.1.6 → 0.1.7 (its smoke test now asserts against the snapshot
   itself instead of a copied literal).
4. **Reshape the §6.5 clean-failure contract** to *"over-depth always fails cleanly and is
   labelled `runtime_transformation`, whichever limit trips"*: `codecErrorCode` (editor-ui
   `session/errors.ts`) maps a caught host recursion overflow (`RecursionError` /
   "maximum recursion depth" messages) to `runtime_transformation`, exactly as it already maps
   the engine's `"depth limit"` guard — extending the D5 fix (`1cf0be6`). Unit-locked in
   `packages/editor-ui/test/errors.test.ts`.
5. **New acceptance bar — AC-042:** *every* committed codec generator and artifact (all nine
   files) imports through the §7.15 gate in-surface and round-trips to identity in the running
   editor. AC-036 ("at least one") stays as the minimal criterion; AC-042 is the complete one.
   FR-121 becomes fully true for the first time — no new FR is needed.
6. **Fix a stale doc:** `metadata-contract.md` §6.5 said over-depth fails "with an
   `include_loader` error"; D5 already corrected the behavior to `runtime_transformation` — the
   text now matches.

## IDs introduced

**AC-042** (`SPEC.md` §20), **AD-035** (`ARCHITECTURE.md`). Append-only above the landed baseline
(max landed AC-041, AD-033; FR-135/AD-034 remain RFC-003 reservations — untouched). No FR/NFR/UC/OQ
changes; no deprecations.

## What this explicitly does NOT change

- **Codec artifacts** — byte-identical; no regeneration. The regeneration gate (AD-030) must stay
  green with zero diff.
- **Surface (§15.7) / round-trip (AD-004) semantics** — untouched; the cap is a runtime limit.
- **Engine-free boundary (AD-008)** — the editor still ships no engine; the floor is expressed as
  a snapshot pin + parity gate, not a bundled runtime.
- **Marker, variants, metadata contract shape** — untouched.

## Rollout (as executed, test-first)

1. Rewrote `test/engine-node-adapter/test/ui/selfhosting.test.ts` citing AC-042 (RED first — the
   deep files failed at the old ceiling, and the red run *itself* exposed the first draft's flawed
   pre-verification): all nine files accepted by the import gate + forward regeneration identical;
   the "rejected at the ceiling" block replaced by a derived past-the-ceiling clean-failure case +
   a structural-depth lower-bound pin.
2. Raised the constant to 55; added the host recursion budget (runner.py + Pyodide glue); bumped
   the reference-host engine pin; added the `RecursionError`→`runtime_transformation` mapping +
   `errors.test.ts`; rebased the M1 `ceiling.test.ts` bounds onto the constant.
3. Gates re-run green: engine parity (0.1.7 pin), full turbo suite (incl. round-trip corpus +
   byte-zero regeneration), traceability; AC-036/AC-042/self-hosting rows updated in the same
   change (§21 loop).
4. Independent `round-trip-reviewer` pass before merge (maker ≠ checker — this touches the codec
   runtime-safety surface).

## Out of scope (declined / deferred)

- **Runtime engine-version gating** (cap 25 unless `engine.version()` ≥ 0.1.7 at init). Deferred:
  the snapshot pin + parity gate covers the reference host and CI; a dynamic downgrade path adds a
  second behavior mode to test for a host configuration the project does not ship. Revisit if an
  embedder actually runs an older engine (NFR-040 already surfaces the version mismatch).
- **Engine-side `RecursionError` → `TransformationError` catching** (would-be engine R-33). The
  cleanest host-agnostic form of the same guarantee; not required now because both reference hosts
  already contain the overflow at the provider boundary. Recorded in AD-035 as the designated
  follow-up if a host is found that does not.
- **Restructuring `G_encode` into shallower named fragments.** The fallback if the host budget
  ever proves untenable on a constrained host (e.g. a Pyodide build that cannot honor 1400): it
  would shrink both the authored depth and the walk's frame peak, at the cost of a codec-authoring
  project with its own review cycle. Not needed while the budget holds.
- **Chasing the rule-heavy pathological wall upward** — the remaining engine frame cost per rule
  level is intrinsic; an iterative engine evaluator (R-32's deferred option) is the only real fix
  and is out of this repo's hands.
