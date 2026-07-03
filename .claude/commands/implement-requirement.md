---
description: Implement exactly one Transon-editor requirement by ID, test-first.
argument-hint: [requirement id e.g. FR-035]
---

Implement requirement **$ARGUMENTS** (if empty, take the first unchecked row for the active milestone
in `docs/traceability.md`).

The procedure is tool-neutral and lives in `harness/commands/implement-requirement.md` — follow it
exactly, under `AGENTS.md`. Prefer delegating to the `requirement-implementer` subagent so the work
runs test-first with the maker ≠ checker boundary intact.
