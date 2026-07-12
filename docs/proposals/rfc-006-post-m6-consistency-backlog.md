# RFC-006: Post-M6 consistency backlog (Tiers A–D)

- **Status:** **Proposed** (2026-07-12). Design / sequencing record only — **not** part of the
  contract. Where this and `SPEC.md` / `ARCHITECTURE.md` / `ROADMAP.md` / `AGENTS.md` disagree,
  **they win**. No FR/NFR/AC/AD/OQ IDs are registered by this document; next-free numbers below are
  **hints** for when a slice lands (§21.1).
- **Type:** Cross-cutting backlog + decide-or-descope guide. Spans contract honesty, engine→editor
  metadata consumption, canvas UX (M7), and harness/process polish.
- **Baseline:** Product milestones **M0–M6 done**; RFC-004/005 landed; engine pin `transon` **v0.1.7**;
  metadata snapshot 3.0 already carries `container` / `arm` (engine R-28 shipped). Ledger next-free
  (2026-07-12): **FR-139 · NFR-51 · AC-43 · UC-17 · AD-36 · OQ-21**.
- **Companion analysis:** Tier A (consistency debt) was deep-dived in session; this RFC restates it
  briefly and deep-dives **Tiers B–D** the same way (SPEC/contract quote → reality → options →
  open questions). It does **not** ratify answers to those questions.

## Problem (one line)

M0–M6 shipped a working, gated visual editor, but **contract, canvas UX, and engine metadata still
disagree in places** — half-open SPEC rows, structural params exported but unused, adaptive layout
ratified but not implemented, and process/docs lag. Without an ordered backlog, agents and humans
chase ghosts or invent scope.

## Desired outcome

A single ranked plan that:

1. makes the **paper match the product** (Tier A);
2. finishes **engine→editor consistency** for structural params (Tier B);
3. lands the next **user-visible density** win as M7 (Tier C);
4. tightens **harness/process** without inflating maturity theatre (Tier D);

…while leaving **open questions open** until the maintainer decides.

## Tier map (recap)

| Tier | Theme | Nature |
|------|--------|--------|
| **A** | Contract honesty + evidence | SPEC/traceability/handoff vs code |
| **B** | Engine→editor structural params | Cross-repo; codec + runtime + contract |
| **C** | UX density / feel | M7 P-E + optional polish |
| **D** | Process / harness | Review, maturity leftovers, CI proof |

Suggested order: **A → B → C → D** (honesty before new surface; engine facts before adaptive
layout that may interact with new mutators; process last). **Open question OQ-B0 / OQ-C0** may
reorder B vs C.

---

## Tier A — Contract honesty (summary; decide-or-descope)

> Full inventory lived in the analysis session; this section is the actionable digest for the
> backlog. Do not implement new product surface here except FR-033 and optional FR-048.

### A1. Phantom / over-promised requirements

| ID | SPEC claim | Reality | Options (undecided) |
|----|------------|---------|---------------------|
| **FR-017** | Block comments/descriptions without affecting JSON | Never implemented; never scheduled | **A:** descope v1 · **B:** schedule small UI-only slice |
| **UC-010** / **FR-053** helpers | Restrict or warn out-of-scope `item`/`key`/`value`/`index` | Round-trip only; no scope UI | **A:** rewrite UC to “engine validate catches” · **B:** editor warnings · **C:** connection checks (needs scope metadata — Tier B-adjacent) |
| **AD-013** advisory half | Hybrid typing: advisory runtime types | Structural only; no advisory `check` | **A:** document “structural only in v1” · **B:** invent advisory checks |
| **FR-086** dual path | Limited generic block **or** reject | Reject/throw only | **A:** narrow SPEC to reject · **B:** build limited generic |

### A2. Real small gaps

| ID | Reality | Options |
|----|---------|---------|
| **FR-033** | `tryReverse` never sets `template_path` | **A:** implement cheap half (unsupported node → path) · **B:** descope “where possible” to validate/execute only |
| **FR-048** | Rule tooltips yes; param docs unused | **A:** implement param tooltips · **B:** descope to rule-level docs in v1 |

### A3. Evidence debt (behavior mostly OK)

FR-049 (test join), FR-057 (`incomplete` path), FR-066 (DOM error render), FR-085/086 negative,
FR-083 custom op/fn, `onImportFile`, UC-001/002/014 composition, NFR-021 wording vs round-trip
`toEqual`, NFR-030… “by design” notes.

### A4. Meta-debt (docs lying about docs)

- `current-state.md` **Next steps** still lists finished RFC-005 / M6 / Codecov work as open.
- `traceability.md` **NFR-027** row still says autorun pending while **FR-135** row is `[x]`.
- ROADMAP “Readiness assessment” still reads pre-implementation.

### Open questions — Tier A

| ID | Question | Notes |
|----|----------|-------|
| **OQ-A1** | Descope or implement **FR-017**? | Default lean: descope |
| **OQ-A2** | Soften **UC-010** to engine-backed, or build editor scope UX? | Soften avoids fake second truth (NFR-004) |
| **OQ-A3** | **FR-048**: implement param docs or descope? | Only Tier A item with clear UX upside |
| **OQ-A4** | **FR-033**: implement path plumbing or narrow SPEC? | Cheap code vs paper fix |
| **OQ-A5** | What does UC `[x]` require — composed E2E or “pieces + gates”? | Affects UC-001/002/014 forever |
| **OQ-A6** | Rewrite **NFR-021** to execution-identity, or add Vitest snapshots? | Snapshots of workspace JSON are brittle |

**Suggested first slice (if approved):** docs honesty + SPEC decide-or-descope PR → then FR-033
and/or FR-048 per OQ-A3/A4 → evidence pack. No codec regen expected.

---

## Tier B — Engine→editor structural params (R-28 consumer)

### Problem

The engine **already exports** structural facts (`container`: `list` | `mapping` | `arms`; `arm`
schema for `cond.cases`). The pinned snapshot carries them. The editor **ignores them**:

- `docs/metadata-contract.md` **§2.2 still does not document** `container` / `arm`.
- Palette/runtime treat collection params like any other dynamic template socket — users compose
  generic array/object blocks for `chain.funcs`, `object.fields`, `switch.cases`, `cond.cases`
  instead of one coherent rule-shaped block.
- That is the exact consistency failure R-28 was meant to unlock (engine RFC:
  `../transon/docs/proposals/editor-metadata-structural-params.md`; ROADMAP R-28 **done** on
  engine side).

### What “done” would mean (draft; not ratified)

1. **Contract:** extend `metadata-contract.md` §2.2 (+ parity checks) for `container` / `arm`
   (additive; version already ≥ 2.1 / snapshot 3.0).
2. **SPEC:** new FRs (next-free from **FR-139**) for container-aware projection + finite runtime
   primitives (NFR-046 bump gated).
3. **Spike then generalize** (from `current-state.md` Next step 2):
   - spike **`chain` (list)** + **`cond` (arms)** end-to-end (palette, ~2 runtime primitives,
     codec container branch, corpus);
   - then **`switch` / `object.fields` (mapping)**.
4. **Gates:** codec regen (AD-030), behavior-runtime size (NFR-046), `round-trip-reviewer` /
   `review-gate` (codec + mutator surface).

### Inventory (same shape as Tier A)

| Surface | Reality today | Gap |
|---------|---------------|-----|
| Engine export | `container`/`arm` present in snapshot | — |
| metadata-contract §2.2 | Documents `kind`/`options` only | **Must update before consumer FRs** |
| `G_palette` / codec | Dynamic params → single `input_value` (or literal array/object via structural blocks) | No container branch |
| Behavior runtime | Array/object/unsupported mutators only (AC-038) | Need list/arms (and maybe mapping) primitives — **finite**, rule-agnostic |
| Round-trip | `chain`/`cond`/`switch`/`object` **already** round-trip as JSON | UX inconsistency, not semantic breakage |
| UAT findings #1/#2 | Recorded; editor session marked “coordinate before touching” | Still the open product work |

### Risks

- **NFR-046:** new mutator primitives are allowed only as new *interaction kinds*, not per-rule
  branches. Design must stay vocabulary-keyed (`list` / `mapping` / `arms`), not `if rule === cond`.
- **Codec vs UI:** changing how `funcs`/`cases`/`fields` appear on canvas must preserve encode/
  decode identity. Prefer UI+palette+runtime first with codec changes only where the workspace
  shape must carry arity/keys (same pattern as array/object `extraState`).
- **Shadow / NO_CONTENT interaction** (ROADMAP future “shadow blocks”) can collide with list
  slots — do not combine with shadows in the same slice.
- **Cross-session:** `current-state.md` warned another session owns this — **coordinate** before
  starting.

### Sequencing options (undecided)

| Option | Sequence | Pros | Cons |
|--------|----------|------|------|
| **B-first** | Contract → spike chain+cond → generalize → then M7 | Metadata truth before layout churn | Delays user-visible density |
| **C-first** | M7 adaptive layout → then B | Faster “feels denser” | Risk redoing layout once list/arms mutators change block shape |
| **Parallel** | Contract+spike on one branch; M7 prototype on another | Throughput | Merge conflicts on `runtime.ts` / `G_palette` |

### Open questions — Tier B

| ID | Question | Notes |
|----|----------|-------|
| **OQ-B0** | Run Tier B before, after, or parallel to M7 (Tier C)? | Highest sequencing decision |
| **OQ-B1** | Spike order: `chain`+`cond` first (as drafted) or `object.fields` first (more common UAT pain)? | |
| **OQ-B2** | Mapping UX: key+value repeating rows (like object literal mutator) vs nested object block? | Affects runtime primitive count |
| **OQ-B3** | Arms UX: repeating `{when, then}` groups with fixed slots vs free object children constrained by validate? | Fixed slots match `arm` schema better |
| **OQ-B4** | Does container consumption need a new `metadata_version` bump on the **editor** contract, or is documenting 3.0 fields enough? | Snapshot already has data |
| **OQ-B5** | Should parity grow a **container/arm shape check** (like variant-signature parity)? | Recommended lean: yes |
| **OQ-B6** | Is any of this in-surface / §15.7 change, or pure presentation of already-valid JSON? | Likely presentation + workspace shape; confirm before SPEC |

**ID hint (when landing):** FR-139+ for container-aware blocks; possibly AD-36 if a new runtime
primitive class is an architecture decision; AC-43 for acceptance over chain/cond corpus.

---

## Tier C — UX consistency users feel

### C1. M7 — Balanced adaptive layout (RFC-003 P-E)

**Status:** OQ-019 **ratified** (adaptive + manual override). Phases 1–3 of RFC-003 = M6 **done**.
P-E remains **proposed for SPEC** — prototype pins multiline threshold + damping **before** SPEC
IDs land. Explicitly **out of M6**.

**Important ID collision:** RFC-003 reserved **FR-135 / AD-034** for P-E. RFC-005 later registered
**FR-135…138** for autorun / toolbar / palette embedding. **P-E must take true next-free
(FR-139+ / AD-36+)** — deprecate the informal reservation in RFC-003 text when M7 SPEC lands
(§21.1).

#### SPEC today vs P-E target

| Today (ratified) | P-E target (ratified in principle) |
|------------------|-------------------------------------|
| FR-129 / §13.10 / AC-040: **all** value params `inputsInline: false` | Adaptive flip on connection changes; manual override wins; title-own-row only in external mode |
| Static staircase for every nested literal | Small/single-row children → inline; multiline → external |

#### Inventory

| Piece | Reality | Gap |
|-------|---------|-----|
| Criterion | Documented in RFC-003 | Not in SPEC yet |
| Prototype | Mandated before SPEC | **Not done** |
| `G_palette` initial disposition | Everything external | E-default hybrid from metadata kinds |
| Behavior runtime | No `inputsInline` flip | E-adaptive + damping |
| Override | Blockly menu may exist; not wired as persisted UI metadata policy | Persist per §11.5 |
| Measurement | NFR-049 harness exists | Need before/after on largest corpus examples |
| Review | — | `review-gate` (runtime next to mutators) |

#### Risks

- Visual churn on every template; density harness must not regress NFR-050 geometry.
- Interaction with Tier B mutators (taller/wider repeating rows) — another reason for OQ-B0.
- Damping/threshold are taste parameters — **must** be measured, not prose-ratified.

#### Open questions — M7 / P-E

| ID | Question | Notes |
|----|----------|-------|
| **OQ-C1** | Multiline threshold: height px? row count? “has nested rule child”? | Prototype must pin |
| **OQ-C2** | Damping: debounce ms? only flip on connect/disconnect (never field edit)? | RFC-003 lean: connection-only |
| **OQ-C3** | E-default: derive initial inline from `kind` only, or also from presentation hints? | Avoid per-rule TS (AD-026) |
| **OQ-C4** | Does AC-040 get deprecated in place and replaced, or amended? | Append-only discipline |
| **OQ-C5** | Ship E-default+override first (smaller), or full E-adaptive in one milestone? | RFC-003 allowed shrinking scope after A–D |

### C2. Optional polish (non-blocking)

| Item | Notes | Open? |
|------|-------|-------|
| Context-sensitive examples (selected block → that rule’s examples) | Data joins exist (`rule`/`tier`/`tags`); needs new FR | **OQ-C6:** schedule or defer |
| Shadow-block defaults on dynamic params | ROADMAP future; NO_CONTENT / optional / missing-required hazards | **OQ-C7:** out of post-M6 or experimental spike? |
| Presentation `inputsInline` hint (static per rule) | Weaker than P-E; may be obsolete if M7 lands | **OQ-C8:** skip if M7 proceeds |
| Structured engine error paths for better highlight | Needs engine change; editor already falls back to root | **OQ-C9:** engine RFC or accept root fallback |
| Browser a11y as CI gate (Playwright + axe) | M-14; live MCP pass exists, not CI | See Tier D |
| Coverage ratchet | M-15; Vitest coverage ~84% already wired | See Tier D |

### C3. Explicitly *not* Tier C (out of scope / future)

Share links, accounts, collab, AI authoring, plugin marketplace, visual debugger — ROADMAP
“Future considerations” / “Out of scope”. Do not pull into this backlog without a new RFC + SPEC.

---

## Tier D — Process / harness consistency

### Inventory

| Item | Reality | Gap |
|------|---------|-----|
| **Post-hoc review-gate** on minimap mutator fix (`09dc71b` / v0.1.1) | Shipped direct-to-main per user; review-gate skipped | Optional adversarial review on mutator/`reconcileValueInputs` |
| **M-10** subagent model slugs | Unverified | Silent cost-tier collapse risk |
| **M-11** hook matcher tightening | Key-sniffing fallback | Score-neutral |
| **M-12** centralized watched paths | Possible silent skip | Score-neutral |
| **M-13 / M-15** coverage | Vitest + Codecov wired (~84%); no only-grows ratchet | Maturity D3 evidence |
| **M-14** proof/observability | MCP demos; no a11y CI job | D8 headroom |
| Handoff discipline | Stop hook exists; Next steps stale | Operational, not code |
| Docs-site lockfile / dead scripts | v0.1.1 live; optional cleanup noted in handoff | Cosmetic |
| Cross-repo **authoring** | Separate product (`transon-authoring`); not editor consumer | **OQ-D5:** any shared “consistency” beyond engine pin? |

### Open questions — Tier D

| ID | Question | Notes |
|----|----------|-------|
| **OQ-D1** | Run post-hoc `review-gate` on v0.1.1 mutator fix? | Trust surface |
| **OQ-D2** | Prioritize M-14 (a11y CI) vs M-15 (coverage ratchet) vs M-10–12? | All low urgency vs A–C |
| **OQ-D3** | Should maturity plan “ceiling” text be updated now that UI exists? | Doc drift in `maturity-plan.md` |
| **OQ-D4** | Encode “handoff Next steps must not list DONE items” as a harness eval? | Prevents recurrence |
| **OQ-D5** | Any required consistency work between **blockly** and **authoring** repos in this backlog? | Default: no — shared engine pin only |

---

## Cross-cutting sequencing (proposal, not decision)

```text
Phase 0  Tier A docs honesty + decide-or-descope SPEC   [paper]
Phase 1  Tier A FR-033 / FR-048 / evidence pack          [small code]
Phase 2  Tier B metadata-contract + spike (chain/cond)  [codec/runtime]
Phase 3  Tier B generalize mapping + parity check
Phase 4  Tier C M7 prototype → SPEC → implement P-E
Phase 5  Tier D review-gate / M-14 / M-15 as capacity allows
```

**Blocked on open questions:** OQ-B0 (B vs C order), OQ-A3 (FR-048), and whether Phase 0’s
descopes are accepted.

### What this RFC deliberately does *not* do

- Does not register IDs or edit SPEC/ROADMAP.
- Does not choose OQ-* answers.
- Does not start implementation.
- Does not expand scope into share links, AI, or backend persistence.

---

## Acceptance of *this* RFC (meta)

This proposal is **accepted** when the maintainer:

1. Answers or explicitly defers each **OQ-A\*** / **OQ-B\*** / **OQ-C\*** / **OQ-D\*** (defer = leave
   open with an owner/date is fine);
2. Confirms or revises the Phase 0–5 order;
3. Optionally promotes slices into ROADMAP milestones (e.g. **M7** already named; Tier B may become
   **M8** or a named UAT track).

Until then, status remains **Proposed**.

---

## References

- Tier A deep dive: session analysis (2026-07-12) — consistency debt inventory.
- `docs/ROADMAP.md` — M0–M6 done; M7 = P-E; Future considerations.
- `docs/proposals/rfc-003-canvas-density-and-navigation.md` — P-E design; stale FR-135 reservation.
- `docs/proposals/rfc-005-docs-site-editor-embedding.md` — consumed FR-135…138.
- `../transon/docs/proposals/editor-metadata-structural-params.md` + ROADMAP **R-28** (engine done).
- `docs/metadata-contract.md` §2.2 — still missing `container`/`arm`.
- `docs/traceability.md` — audit notes (2026-07-03) + stale NFR-027 row.
- `docs/current-state.md` — Next steps 2 (UAT structured params); handoff drift.
- `docs/guides/maturity-plan.md` — M-10…M-15 leftovers.

---

## Appendix — Open questions checklist (copy for decisions)

Use this list in review; leave unchecked until answered.

**Tier A**

- [ ] OQ-A1 FR-017 descope vs implement
- [ ] OQ-A2 UC-010 soften vs editor scope UX
- [ ] OQ-A3 FR-048 implement vs descope
- [ ] OQ-A4 FR-033 implement vs narrow SPEC
- [ ] OQ-A5 UC `[x]` definition (E2E vs pieces)
- [ ] OQ-A6 NFR-021 rewrite vs snapshots

**Tier B**

- [ ] OQ-B0 B before / after / parallel to M7
- [ ] OQ-B1 spike order (chain+cond vs object.fields)
- [ ] OQ-B2 mapping UX shape
- [ ] OQ-B3 arms UX shape
- [ ] OQ-B4 editor contract version bump needed?
- [ ] OQ-B5 container/arm parity check?
- [ ] OQ-B6 in-surface vs presentation-only?

**Tier C**

- [ ] OQ-C1 multiline threshold definition
- [ ] OQ-C2 damping rules
- [ ] OQ-C3 E-default derivation inputs
- [ ] OQ-C4 AC-040 deprecate vs amend
- [ ] OQ-C5 full adaptive vs E-default+override first
- [ ] OQ-C6 context-sensitive examples
- [ ] OQ-C7 shadow blocks in/out of backlog
- [ ] OQ-C8 static inline hint if M7 proceeds
- [ ] OQ-C9 engine structured paths vs accept root fallback

**Tier D**

- [ ] OQ-D1 post-hoc review-gate on v0.1.1
- [ ] OQ-D2 M-14 vs M-15 vs M-10–12 priority
- [ ] OQ-D3 update maturity-plan ceiling narrative
- [ ] OQ-D4 harness eval for stale handoff Next steps
- [ ] OQ-D5 blockly↔authoring consistency in scope?
