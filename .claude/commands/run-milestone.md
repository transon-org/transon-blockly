---
description: Drive a ROADMAP milestone (e.g. M2) end-to-end for the Transon editor.
argument-hint: [milestone e.g. M2]
---

Run roadmap milestone **$ARGUMENTS** for the Transon Visual Editor.

The procedure is tool-neutral and lives in `harness/commands/run-milestone.md` — follow it exactly,
under the rules in `AGENTS.md`. Delegate planning to the `milestone-planner` subagent and per-FR
implementation to `requirement-implementer`; use `round-trip-reviewer` for codec/round-trip/safety
slices.
