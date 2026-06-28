# AGENTS.md — Transon Visual Editor (transon-blockly)

A Blockly-based visual editor for authoring **Transon** templates (JSON-to-JSON). It is an
embeddable, **engine-free** component: it generates, imports, and strictly round-trips canonical
Transon JSON, delegating all validation/execution to a host-provided engine.

**The contract is the docs in `docs/`** — read the relevant section before changing behavior:

- `docs/SPEC.md` — the *what*: FR/NFR/AC/UC, rule coverage, supported surface, error taxonomy,
  governance (§21).
- `docs/ARCHITECTURE.md` — the *how*: decisions `AD-001..AD-025`, packages, host boundary, IR, flows.
- `docs/metadata-contract.md` — the engine↔editor metadata *shape*.
- `docs/traceability.md` — requirement→test coverage, engine-parity checks, round-trip corpus.
- `docs/ROADMAP.md` — milestone sequencing (M0–M5), locked decisions, open questions.

## Golden rules

1. **JSON is canonical (AD-003).** Transon JSON is the source of truth; the Blockly workspace is a
   projection. Never make workspace serialization the only source of truth.
2. **Editor is engine-free (AD-008).** Ship no engine runtime. Validation, execution, `include`,
   and `file` capture cross the host `EngineProvider`. The engine is authoritative (NFR-004).
3. **Strict semantic round-trip (AD-004).** Import→export preserves meaning for in-surface templates
   (§15.7); anything else takes an explicit unsupported path — never silently change meaning.
4. **Variants over hidden modes (AD-015).** Mutually exclusive parameter groups are separate block
   variants, derived mechanically from engine `modes` (ARCH §5.7).
5. **Metadata-driven, engine-owned (AD-012).** Rules/params/operators/functions come from the engine
   `get_editor_metadata()` export. Never hand-maintain a parallel catalog.
6. **SPEC-first (§21.2).** Behavior changes update `docs/SPEC.md` first; flag conflicts before coding.
7. **Never renumber IDs (§21.1).** FR/NFR/AC/UC/AD/OQ are append-only; new items take the next free
   number; deprecate in place.
8. **Stay in scope (§4).** A visual Transon editor — not a workflow platform or no-code backend.
9. **No new transformation language (§21.8).** No DSL, path syntax, or inline expression language.

## Stack

- TypeScript monorepo: pnpm workspaces · Turborepo · Vite (library mode) · Vitest · Changesets (AD-021).
- Packages (AD-019/020): `@transon/editor-core` (pure TS, deliverable #1) → `@transon/editor-blockly`
  (Zelos) → `editor-ui` (internal React) → `@transon/editor-element` (vanilla + `<transon-editor>`) +
  `@transon/editor-react`.
- Reference host: in-browser Pyodide/PyScript (AD-025); round-trip CI: Node→Python adapter (AD-011).
- License: MIT. npm scope: `@transon`.

## Where things live

- Contract docs: `docs/`.
- AI-dev harness: `.cursor/rules/`, `.cursor/commands/`, `.cursor/skills/`, `.cursor/hooks.json`,
  `.cursor/mcp.json`.
- Deterministic gates: `scripts/check_traceability.py`, `scripts/check_engine_parity.py`.
- Engine (separate repo): `../transon` — owns `get_editor_metadata()` (see its
  `docs/proposals/editor-metadata-export.md`). **M0 work lives there.**

## Development loop (per requirement)

Write the test **first**, citing the ID (e.g. `// FR-035`) → implement → update the matching
`docs/traceability.md` row in the **same change** → keep engine-parity + round-trip corpus green →
satisfy the milestone Definition of Done. Drive a milestone with `/run-milestone`; do a single
requirement with `/implement-requirement`. Before finishing, run `scripts/check_traceability.py`
and `scripts/check_engine_parity.py`.

## Data flow (one-way, plus gated reverse)

Blockly canvas → change event → debounced `JSON⇄IR` codec → `{json, validation, execution}` in the
`EditorSession` store. Reverse (React→Blockly) only for New / Import / Load-Example and **accepted
in-surface JSON edits** (AD-024, §7.15: valid + in-surface syncs back; otherwise error, workspace
unchanged).

## Tooling notes

- **Skills** (`.cursor/skills/`): **`transon-authoring`** — general Transon JSON template authoring
  and engine verification (authority = running engine + engine SPECIFICATION, **not** generative web
  docs, LLM memory, or Context7); **`blockly-authoring`** — Blockly/Zelos/workspace layer (Context7
  OK for Blockly API only).
- MCP (`.cursor/mcp.json`): **Playwright** for UI/accessibility testing (§19.4, §19.5);
  **Context7** for current Blockly/React/Vite/Vitest API docs — **not** for Transon semantics.
- The harness is designed so a less-capable executor model can work safely: small per-ID tasks,
  test-first, and objective gates (parity + round-trip + traceability) it cannot bypass.
