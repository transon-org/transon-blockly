# Requirement Traceability

Tracks every requirement in [`SPEC.md`](SPEC.md) through to code and tests, per the
SPEC-first / tests-required discipline (`SPEC.md` §22.1, §22.2, §22.14).

> Milestone-level status (M0–M5) lives in [`ROADMAP.md`](ROADMAP.md); this file tracks
> per-requirement-ID coverage.

> **Status legend:** [ ] pending - [~] in progress - [x] done.
> The whole project is **pre-implementation**, so everything below is [ ] until code and
> tests land. Update the row (and add the test reference) in the same change that
> implements a requirement.

## How to keep this current

1. Cite the requirement ID in each test name or comment, e.g.
   `test('imports attr name variant', ...)  // FR-124`.
2. To find an ID's tests, grep the codebase for the ID (e.g. `FR-124`).
3. To list all IDs in the spec, grep `docs/SPEC.md` for `FR-\d+`, `AC-\d+`, etc.
4. Before a PR: every implemented FR must have a referencing test; flag any test that
   references a non-existent or `(deprecated)` ID.

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

`SPEC.md` declares the Transon engine authoritative (NFR-004, §22.4) and hand-lists the
rule/operator/function catalog (FR-042..FR-049, §15.14, §15.15). These hand-lists drift
silently when the engine changes. The following automated checks must exist and pass; they
are the primary defense against spec/engine drift:

| Check | Asserts | Source of truth | Status |
|-------|---------|-----------------|:------:|
| Rule parity | editor supported rule set == the engine rule set | `Transformer.get_rules()` (currently 20: this, parent, item, index, key, value, set, get, attr, object, map, filter, zip, file, join, chain, expr, call, format, include) | [ ] |
| Operator parity | editor operator list == engine operators | `transon/operators.py` (`Transformer.get_operators()`) | [ ] |
| Function parity | editor function list == engine functions | `transon/functions.py` (`Transformer.get_functions()`) | [ ] |
| Variant/mode parity | each rule's editor variants == engine `modes` | engine editor-metadata export (see [`metadata-contract.md`](metadata-contract.md) §3) | [ ] |
| Metadata export parity | editor-consumed metadata == engine editor-metadata export (`required_params`, `modes`, per-param `kind`) | `transon/editor_metadata.py::get_editor_metadata()` ([`metadata-contract.md`](metadata-contract.md) §3) | [ ] |

A failing parity check means either the engine changed (update the editor + spec together)
or the editor drifted (fix the editor). Never silence the check by editing the expectation
without a corresponding `SPEC.md` change and changelog entry (§22.1).

## Round-trip corpus

Round-trip is the core trust property (`SPEC.md` §7.5, AD-004, AC-011). The corpus is
defined in `SPEC.md` §16.8 and must cover: simple literals; literal arrays; literal
objects; literal marker-key objects; every built-in rule; every block variant; nested
templates; docs/example-corpus templates; custom marker configuration; and import-failure
cases.

| Corpus group | SPEC ref | Status | Test reference |
|--------------|----------|:------:|----------------|
| Literals (scalar/array/object) | §16.8 | [ ] | |
| Literal marker-key object | §16.8, §12.4 | [ ] | |
| Every built-in rule | §16.8, §15 | [ ] | |
| Every block variant | §16.8, §7.8 | [ ] | |
| Nested templates | §16.8 | [ ] | |
| Docs/example-corpus templates | §16.8 | [ ] | |
| Custom marker configuration | §16.8, FR-065 | [ ] | |
| Import-failure cases | §16.8, §18 | [ ] | |

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

## Functional requirement coverage (§7)

Tracked by SPEC subsection. Expand into per-ID rows as each is implemented; record the
implementing module and the test that cites the ID.

| Subsection | Requirement IDs | Status | Notes |
|------------|-----------------|:------:|-------|
| §7.1 Editor shell | FR-001..FR-010, FR-115..FR-118 | [ ] | sandbox/compact modes, panels, embedding callbacks |
| §7.2 Blockly workspace | FR-011..FR-019 | [ ] | blocks, literals, rule-vs-literal distinction |
| §7.3 Transon JSON generation | FR-020..FR-028 | [ ] | marker key, params, stable JSON |
| §7.4 Import from Transon JSON | FR-029..FR-036 | [ ] | supported-surface boundary (§7.4 intro) |
| §7.5 Round-trip | FR-037..FR-041 | [ ] | semantic equivalence; corpus above |
| §7.6 Rule coverage | FR-042..FR-051 | [ ] | parity checks above |
| §7.7 Rule parameter handling | FR-052..FR-060 | [ ] | required/optional/variant/kind |
| §7.8 Mutually exclusive variants | FR-119..FR-129 | [ ] | variant model + import matcher (§16.9) |
| §7.9 Literal object / marker escaping | FR-061..FR-065 | [ ] | object/fields escape |
| §7.10 Validation | FR-066..FR-073 | [ ] | engine `Transformer.validate()` via host `EngineProvider` |
| §7.11 Execution preview | FR-074..FR-081 | [ ] | engine `transform()` via host `EngineProvider` |
| §7.12 Documentation & editor metadata | FR-082..FR-088, FR-130..FR-132 | [ ] | see metadata-contract.md |
| §7.13 Custom rules/operators/functions | FR-089..FR-093 | [ ] | |
| §7.14 Metadata-driven block generation | FR-133..FR-138 | [ ] | gated on metadata-contract §3 |
| §7.15 Error mapping | FR-094..FR-098 | [ ] | canonical error taxonomy (§7.15) |
| §7.16 Import / export UX | FR-099..FR-104 | [ ] | |
| §7.17 Component embedding | FR-105..FR-114 | [ ] | component API |

## Non-functional & architecture decisions

NFRs (§8) and ADs (§9) are largely verified by integration/security tests and review
rather than 1:1 unit tests. Key ones expected to have dedicated tests:

| ID | Summary | Verified by | Status |
|----|---------|-------------|:------:|
| NFR-001..005 / AD-003/AD-004 | Correctness, semantic preservation, round-trip | round-trip corpus + engine parity | [ ] |
| NFR-027 / §22.12 | No arbitrary Python outside the engine/runtime | engine/runtime isolation tests | [ ] |
| NFR-032 / AD-011 | `file` writes captured, not written to disk | execution tests (AC-024) | [ ] |
| AD-012 | `include` resolved via configured loader; missing loader reported | execution tests (AC-025) | [ ] |
| NFR-033..036 / NFR-044 / AD-016 | Metadata schema versioning + mismatch detection | see metadata-contract.md §5 | [ ] |

## Open questions

The still-open questions and their draft decisions are tracked in [`ROADMAP.md`](ROADMAP.md).
They do not block early implementation, but each should be closed (and its decision folded
into the relevant requirement) before v1 acceptance.
