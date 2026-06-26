# traceability.md — Requirement Traceability

> **Version:** 2.0 · **Status:** Pre-implementation baseline · **Last updated:** 2026-06-27

> **v2.0 — template-driven projection pivot.** Adds coverage rows for the projection surface
> (`SPEC.md` §7.16, FR-114…FR-121, NFR-046/047, AC-034…AC-036, UC-016, AD-026…AD-031) and extends the
> anti-drift gates: the engine-parity check now compares **pre-derived variant signatures** and
> **resolved enum domains**, a **codec-regeneration** check guards that committed codec artifacts
> match the current metadata (AD-030), and the round-trip corpus is anchored by the
> **round-trip-by-construction** check per rule (AC-035).

Tracks every requirement in [`SPEC.md`](SPEC.md) through to code and tests, per the SPEC-first /
tests-required discipline (`SPEC.md` §21.1, §21.2, §21.13). Architecture is in
[`ARCHITECTURE.md`](ARCHITECTURE.md); the metadata shape in
[`metadata-contract.md`](metadata-contract.md).

> Milestone-level status (M0–M5) lives in [`ROADMAP.md`](ROADMAP.md); this file tracks
> per-requirement-ID coverage.

> **Status legend:** [ ] pending · [~] in progress · [x] done.
> The whole project is **pre-implementation**, so everything below is [ ] until code and tests
> land. Update the row (and add the test reference) in the same change that implements a
> requirement.

## How to keep this current

1. Cite the requirement ID in each test name or comment, e.g.
   `test('imports attr name variant', ...)  // FR-054`.
2. To find an ID's tests, grep the codebase for the ID (e.g. `FR-054`).
3. To list all IDs in the spec, grep `docs/SPEC.md` for `FR-\d+`, `AC-\d+`, etc.
4. Before a PR: every implemented FR must have a referencing test; flag any test that references
   a non-existent or `(deprecated)` ID.

Suggested one-shot check (manual until automated):

```bash
# IDs defined in the spec
grep -oE '\b(FR|AC)-[0-9]+\b' docs/SPEC.md | sort -u > /tmp/spec_ids.txt
# IDs referenced in tests
grep -rhoE '\b(FR|AC)-[0-9]+\b' --include='*.ts' --include='*.tsx' src test \
  | sort -u > /tmp/test_ids.txt
# requirements with no test reference
comm -23 /tmp/spec_ids.txt /tmp/test_ids.txt
```

## Engine-parity checks (anti-drift)

`SPEC.md` declares the Transon engine authoritative (NFR-004, §21.4) and enumerates the
rule/operator/function catalog (FR-040..FR-042, §14.14, §14.15). These hand-lists drift silently
when the engine changes. The following automated checks must exist and pass; they are the primary
defense against spec/engine drift:

| Check | Asserts | Source of truth | Status |
|-------|---------|-----------------|:------:|
| Rule parity | editor supported rule set == the engine rule set | `Transformer.get_rules()` (currently 20: this, parent, item, index, key, value, set, get, attr, object, map, filter, zip, file, join, chain, expr, call, format, include) | [ ] |
| Operator parity | editor operator list == engine operators | `transon/operators.py` (`Transformer.get_operators()`) | [ ] |
| Function parity | editor function list == engine functions | `transon/functions.py` (`Transformer.get_functions()`) | [ ] |
| Variant-signature parity | each rule's variants used by the projections == the engine's pre-derived variant signatures | engine editor-metadata export, pre-derived `variants` ([`metadata-contract.md`](metadata-contract.md) §2.5, §3) | [ ] |
| Resolved-enum parity | `options` domains used in the projection == engine operator/function catalogs | engine export `options` ([`metadata-contract.md`](metadata-contract.md) §2.6) | [ ] |
| Metadata export parity | editor-consumed structural catalog == engine projection-ready export (pre-derived `variants`, per-param `kind`/`options`, split payload) | engine `get_editor_metadata()` ([`metadata-contract.md`](metadata-contract.md) §3) | [ ] |
| Codec-regeneration | committed codec artifacts (encoder/decoder + palette/toolbox) == re-running `G_*` on the current metadata | `G_*` projections + build-time codegen (`SPEC.md` FR-119, AD-030) | [ ] |
| Behavior-runtime size | the rule-agnostic behavior runtime gains no per-rule branch as the catalog grows | `SPEC.md` NFR-046, AD-031 | [ ] |

A failing parity check means either the engine changed (update the editor + spec together) or the
editor drifted (fix the editor). Never silence the check by editing the expectation without a
corresponding `SPEC.md` change (§21.2).

## Round-trip corpus

Round-trip is the core trust property (`SPEC.md` §7.5, AD-004, AD-011, AC-011). The corpus is
defined in `SPEC.md` §15.8 and must cover: simple literals; literal arrays; literal objects;
literal marker-key objects; every built-in rule; every block variant; nested templates;
docs/example-corpus templates; custom marker configuration; and import-failure cases.

| Corpus group | SPEC ref | Status | Test reference |
|--------------|----------|:------:|----------------|
| Literals (scalar/array/object) | §15.8 | [ ] | |
| Literal marker-key object | §15.8, §11.4 | [ ] | |
| Every built-in rule | §15.8, §14 | [ ] | |
| Every block variant | §15.8, §7.7 | [ ] | |
| Nested templates | §15.8 | [ ] | |
| Docs/example-corpus templates | §15.8 | [ ] | |
| Custom marker configuration | §15.8, FR-063 | [ ] | |
| Import-failure cases | §15.8, §17 | [ ] | |
| Round-trip by construction (per rule, generated codec) | §15.1, FR-115, AC-035 | [ ] | encoder+decoder from one metadata source; semantic identity via engine |
| Self-hosting projection template | §7.16, FR-121, UC-016, AC-036 | [ ] | a `G_*`/codec template imports + round-trips as a normal in-surface template |

## Acceptance criteria coverage (§20)

ACs are the v1 acceptance gate. Each must be demonstrated by at least one test.

| AC | Summary | Status | Test reference |
|----|---------|:------:|----------------|
| AC-001 | Visual editor loads (sandbox panels) | [ ] | |
| AC-002 | Simple `attr` rule template | [ ] | |
| AC-003 | Nested template | [ ] | |
| AC-004 | Literal object | [ ] | |
| AC-005 | Literal marker-key object | [ ] | |
| AC-006 | All built-in rules available | [ ] | |
| AC-007 | Operators available | [ ] | |
| AC-008 | Functions available | [ ] | |
| AC-009 | Import supported template | [ ] | |
| AC-010 | Export generated template | [ ] | |
| AC-011 | Strict semantic round-trip | [ ] | |
| AC-012 | Validation with engine | [ ] | |
| AC-013 | Runtime execution with engine | [ ] | |
| AC-014 | Output preview | [ ] | |
| AC-015 | Runtime error visibility | [ ] | |
| AC-016 | Validation error visibility | [ ] | |
| AC-017 | Error-to-block mapping | [ ] | |
| AC-018 | Example loading | [ ] | |
| AC-019 | Example expected output | [ ] | |
| AC-020 | Tooltip from metadata | [ ] | |
| AC-021 | No backend persistence | [ ] | |
| AC-022 | Embeddable component | [ ] | |
| AC-023 | Host engine runtime loading state | [ ] | |
| AC-024 | Captured file writes | [ ] | |
| AC-025 | Include loader behavior | [ ] | |
| AC-026 | Custom marker | [ ] | |
| AC-027 | Tests (generation/import/export/round-trip/...) | [ ] | |
| AC-028 | Metadata-driven generic block (gated on metadata-contract §3) | [ ] | |
| AC-029 | Block variants for mutually exclusive parameters | [ ] | |
| AC-030 | Variant import matching | [ ] | |
| AC-031 | Sandbox mode | [ ] | |
| AC-032 | Compact editor mode | [ ] | |
| AC-033 | Bidirectional JSON editing (strict in-surface) | [ ] | |
| AC-034 | Projection coverage: new rule across all surfaces, no editor/projection change | [ ] | |
| AC-035 | Round-trip by construction (generated encoder/decoder, per rule) | [ ] | |
| AC-036 | Self-hosting projection template loads + round-trips | [ ] | |

## Functional requirement coverage (§7)

Tracked by SPEC subsection. Expand into per-ID rows as each is implemented; record the
implementing module and the test that cites the ID.

| Subsection | Requirement IDs | Status | Notes |
|------------|-----------------|:------:|-------|
| §7.1 Editor shell and modes | FR-001..FR-011 | [ ] | sandbox/compact modes, panels, embedding callbacks |
| §7.2 Blockly workspace | FR-012..FR-018 | [ ] | blocks, literals, rule-vs-literal distinction |
| §7.3 Transon JSON generation | FR-019..FR-026 | [ ] | marker key, params, stable JSON |
| §7.4 Import from Transon JSON | FR-027..FR-034 | [ ] | supported-surface boundary (§15.7) |
| §7.5 Round-trip | FR-035..FR-039 | [ ] | semantic equivalence; corpus above |
| §7.6 Rule coverage | FR-040..FR-044 | [ ] | parity checks above |
| §7.7 Rule parameters and variants | FR-045..FR-058 | [ ] | required/optional/kind + variant model & import matcher (§15.6) |
| §7.8 Literal object / marker escaping | FR-059..FR-063 | [ ] | object/fields escape |
| §7.9 Validation | FR-064..FR-070 | [ ] | engine `Transformer.validate()` via host `EngineProvider` |
| §7.10 Execution preview | FR-071..FR-076 | [ ] | engine `transform()` via host `EngineProvider` |
| §7.11 Documentation, metadata & block generation | FR-077..FR-090 | [ ] | see metadata-contract.md; gated on metadata-contract §3 |
| §7.12 Error mapping | FR-091..FR-095 | [ ] | canonical error taxonomy (§16.4) |
| §7.13 Import / export UX | FR-096..FR-101 | [ ] | |
| §7.14 Component embedding | FR-102..FR-110 | [ ] | component API |
| §7.15 Bidirectional JSON editing | FR-111..FR-113 | [ ] | strict in-surface sync (AD-024); now via the generated decoder/encoder |
| §7.16 Template-driven projection surface | FR-114..FR-121 | [ ] | `G_*` projections, generated codec, build-time codegen + runtime exec (AD-026..AD-031) |

## Non-functional & architecture decisions

NFRs (§8) and ADs ([`ARCHITECTURE.md`](ARCHITECTURE.md) §3) are largely verified by
integration/security tests and review rather than 1:1 unit tests. Key ones expected to have
dedicated tests:

| ID | Summary | Verified by | Status |
|----|---------|-------------|:------:|
| NFR-001..005 / AD-003 / AD-004 | Correctness, semantic preservation, round-trip | round-trip corpus + engine parity | [ ] |
| AD-008 | Engine is a host-provided port; authoring works engine-free | `EngineProvider` mock + integration tests | [ ] |
| AD-011 | Execution-based round-trip verification | round-trip corpus (Node engine adapter) | [ ] |
| NFR-030 / §21.11 | No arbitrary Python outside the engine runtime | engine/runtime isolation tests | [ ] |
| NFR-035 / AD-009 | `file` writes captured, not written to disk | execution tests (AC-024) | [ ] |
| AD-010 | `include` resolved via host loader; missing loader reported | execution tests (AC-025) | [ ] |
| NFR-036..039 / NFR-040 / AD-012 | Metadata schema versioning + mismatch detection | see metadata-contract.md §5 | [ ] |
| AD-026 / FR-114/115/120 / AC-034 | Editor surface = projections of metadata; new rule, no editor/projection change | projection-coverage test + codec-regeneration check | [ ] |
| AD-027 / FR-116 | Distinct-marker staging (`@`/`$`); `include` default-marker inheritance; no `eval` | generator staging tests; engine `include` marker test (engine repo) | [ ] |
| AD-028 / FR-117 | Codec = skeleton + projected arms; skeleton owns invariants | codec-skeleton unit tests (recursion/ordering/marker-escape/surface) | [ ] |
| AD-029 / FR-118 | `switch`/`cond` lazy dispatch in the generated codec | dispatch + lazy-branch tests (engine repo for the rules) | [ ] |
| AD-030 / FR-119 | Build-time codegen of committed artifacts; runtime exec via host | codec-regeneration check + host execution tests | [ ] |
| AD-031 / NFR-046 | Finite rule-agnostic behavior runtime; no per-rule growth | behavior-runtime size check | [ ] |
| NFR-047 | Split structural / examples metadata payload | metadata-shape test (structural catalog excludes examples/docs) | [ ] |

## Open questions

OQ-001..009 were ratified at v1.1 and OQ-010..017 at v2.0; all are folded into requirements. The
decision table and the "folded into" references are in [`ROADMAP.md`](ROADMAP.md) §"Open questions".
No editor open questions remain blocking; the projection requirements (FR-114..121, NFR-046/047,
AC-034..036, UC-016, AD-026..031) and bidirectional-editing requirements (FR-111..113, AC-033) are
tracked in the tables above.
