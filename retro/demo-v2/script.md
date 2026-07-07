# Demo video v2 — narration script

> Phase 0 artifact (see [PLAN.md](PLAN.md)). This file is the **single source** for narration audio
> (TTS input), burned-in captions, and the `.srt` — the assembly pipeline parses it. Visual segments
> are cut to each beat's *actual* audio duration; the timecodes below are targets.
>
> **Through-line (idea-first, LOCKED):** *Transformations should be data you can **see** and **trust** —
> Transon makes them exactly that.* Every act is a **proof** of one facet (usable · powerful · scales ·
> honest). Each act's last line hands off to the next — no act opens cold (see PLAN "Through-line & spine").
>
> **Format:** one `## Beat <id>` section per beat. `Narration` is the TTS input (what is spoken).
> `Caption` is the short burned-in text (the muted-playback carrier). `Visual` describes what is on
> screen — for live beats it is the autopilot's shot list. `Target` is the planned duration at ~145 wpm.
>
> **TTS:** macOS `say -v "Evan (Enhanced)"`, one clip per beat → `out/audio/<id>.mp3` (carried from
> v1; deterministic, offline). OpenAI `tts-1-hd` stays a config-switch alternative.
>
> **TTS respellings** — applied mechanically by the TTS step to narration text ONLY (captions, cards,
> and this file keep true spellings). Verified by ear on Evan (Enhanced) in v1:
>
> | written | spoken as | status |
> |---|---|---|
> | `JSON` | `Jaysawn` | ☑ v1-locked |
> | `diff it` | `dihf it` | ☑ v1-locked |
> | `Transon` | (unchanged) | ☑ verified OK |
>
> Substitution order: phrase-level first (`diff it`), then word-level (`JSON`).

---

## Running example (Acts I–II through-line)

Corpus recipe **`RecipeSwapKeysAndValues`** — *"Swap the keys and values of a dict."*

```json
// input                                   // output
{"FR": "France",                           {"France": "FR",
 "GB": "United Kingdom",                    "United Kingdom": "GB",
 "JP": "Japan"}                             "Japan": "JP"}
```

```json
// the Transon template (3 rules: map, value, key)
{"$": "map", "key": {"$": "value"}, "value": {"$": "key"}}
```

```sh
# the same transformation in jq (Act I foil, honest version)
jq 'with_entries({key: .value, value: .key})'
# the "readability cliff" jq example (group transactions by user, sum amounts)
jq 'group_by(.user) | map({key: .[0].user, value: map(.amount) | add}) | from_entries'
```

Act III widens to several corpus examples (worked examples + recipes); the big-template "scale" shot
uses one dense worked example (`WorkedExampleReshapeRecords`).

---

# Act I — Why: transformations should be data (0:00–0:55)

> **Proof of:** the thesis itself — data, not code hidden in a string.

## Beat I.1 — the problem
- **Target:** 0:00–0:12 (~30 words)
- **Visual:** dark card: three mismatched JSON snippets (an API response, a config, a webhook payload)
  that clearly don't fit each other.
- **Caption:** No two systems agree on the shape.

**Narration:**
> JSON is everywhere — but no two systems agree on its shape. So we're forever gluing them together,
> reshaping one API's output into the next one's input. Usually with code we throw away, or a
> one-liner.

## Beat I.2 — the string-DSL foil
- **Target:** 0:12–0:26 (~36 words)
- **Visual:** card 1: the honest jq swap one-liner with input/output beside it. Card 2: the
  group-and-sum jq one-liner sliding in below. Both rendered as real terminal-styled code.
- **Caption:** Your logic — hidden inside a string.

**Narration:**
> Here's jq, swapping the keys and values of a dictionary. Compact. And here's a real-world one. The
> problem isn't just readability — it's that your transformation logic is a program hidden inside a
> string. You can't see it, and you can't trust it.

## Beat I.3 — enter Transon
- **Target:** 0:26–0:46 (~48 words)
- **Visual:** the input → template → output pipeline diagram; the swap template JSON fades in as the
  "template" node; benefit words tick in: *store · send · validate · diff · generate · safe*.
- **Caption:** The transformation itself is JSON.

**Narration:**
> Transon makes a different bet: the transformation itself is JSON. You write it as a template and
> run it over your data to get the shape you want. And since the template is just data, you can store
> it, send it, validate it, even generate it — and nothing ever executes, so it's safe.

## Beat I.4 — the pivot (hand-off to Act II)
- **Target:** 0:46–0:55 (~28 words)
- **Visual:** the swap template JSON alone; on the last line it crossfades to the live Transon **docs
  homepage** — the Act II open frame.
- **Caption:** When it's data, you can see it.

**Narration:**
> By hand, a JSON tree is more verbose than a one-liner. But you rarely write it by hand — because when
> a transformation is data, you can see it, and build it visually. Let me show you.

---

# Act II — Usable: you can see it, with zero friction (0:55–2:25)

> **Proof of:** *usable / see it.* Start in the docs (shown, scrolled — not skipped), then the editor
> opens *on the word "opens"* — visual and narration synced. Then several different transformations.
> Live docs site (`transon-org.github.io`), embedded editor (autorun). Focus = transformation semantics.

## Beat II.1 — the docs
- **Target:** 0:55–1:07 (~30 words)
- **Visual:** LIVE docs site. Land on the homepage, then smooth-scroll down to the **Worked examples**
  and **Recipes** sections, holding on their example-button **lists** as the narration reaches "worked
  examples and recipes." No editor yet.
- **Caption:** The whole language, on one page.

**Narration:**
> This is the Transon docs — the whole language on one page. Every rule, every operator, and a shelf
> of worked examples and recipes.

## Beat II.2 — open one (editor mounts on "opens")
- **Target:** 1:07–1:20 (~30 words)
- **Visual:** LIVE. Scroll settles on the swap recipe; click it → it expands to input/template/result
  JSON with an **"Open in Visual Editor"** button → click, and the embedded editor mounts (blocks +
  autorun output). **Time the mount to land on the word "opens."** Toolbar = only "← Back to docs".
- **Caption:** Every example is live — one click to the editor.

**Narration:**
> And it isn't just reference. Every example here is live — click one, and it opens in a visual editor,
> right in the browser.

## Beat II.3 — the first transformation, explained
- **Target:** 1:20–1:42 (~52 words)
- **Visual:** LIVE. The swap example on the canvas; cursor briefly traces the three blocks (map ·
  value · key); the output panel shows the country dict inverted (France→FR, …), computed live.
- **Caption:** Swap keys ↔ values — three blocks, running live.

**Narration:**
> Start with this one: it swaps every key in a dictionary with its value. Three blocks — map over the
> dictionary, make the old value the new key, and the old key the new value. And it's already running:
> there's the output, computed live.

## Beat II.4 — flip through several; they're all different
- **Target:** 1:42–2:10 (~62 words)
- **Visual:** LIVE. Open the in-editor **example dropdown** and select four examples in sequence —
  pluck-field-from-each → default-for-missing-field → join-list-to-string → keep-items-matching —
  holding ~1.5 s on each so the changed block tree and updated autorun output register.
- **Caption:** Different transformations — each legible at a glance.

**Narration:**
> And it's a whole shelf of them. Here — pull one field out of every record. This one fills in a
> default when a field is missing. This joins a list into a single string. And this keeps only the
> items that match a condition. Every one a different transformation — and every one, you can read at
> a glance.

## Beat II.5 — hand-off to Act III
- **Target:** 2:10–2:25 (~26 words)
- **Visual:** LIVE. Land on the last example; brief calm hold (autorun output visible).
- **Caption:** Straight from the docs — nothing to install.

**Narration:**
> All of them lifted straight from the docs, running live, nothing to install. And this one-click
> editor is the whole thing.

---

# Act III — Powerful: a real workshop (2:25–4:55)

> **Proof of:** *powerful.* Same editor, standalone, full toolbar. Live reference host. Includes a
> **build-from-scratch** beat: drag blocks out of the palette, then they assemble into a connected
> tree as the JSON writes itself (the reliable reverse projection).

## Beat III.1 — the full editor
- **Target:** 2:25–2:38 (~26 words)
- **Visual:** LIVE reference host. Calm wide shot of the standalone editor (palette · canvas · panels).
  No enumerating the toolbar.
- **Caption:** The same editor — standalone, full power.

**Narration:**
> And that editor from the docs is the same component you can run standalone — the full workbench,
> everything switched on. Let's put it through its paces.

## Beat III.2 — load examples from the picker
- **Target:** 2:40–2:58 (~40 words)
- **Visual:** LIVE. **Time the two loads to the words:** on "Load one" the first example snaps in; on
  "load another" the canvas re-renders. (Not at the beat's start — synced to the narration.)
- **Caption:** Nineteen curated examples, one click each.

**Narration:**
> There's a whole library built in — seven worked examples, a dozen recipes. Load one, load another;
> every one is a real, round-tripping template. Pick, and you're editing.

## Beat III.3 — the palette
- **Target:** 2:58–3:10 (~28 words)
- **Visual:** LIVE. Scroll the flat palette down and back — the whole language as blocks, category
  dividers, always in reach, no menus.
- **Caption:** Every rule is a block — the whole language, in reach.

**Narration:**
> Every rule in the language is a block — the whole palette, always in reach. No menus to dig through,
> nothing to memorize.

## Beat III.4 — build from scratch
- **Target:** 3:10–3:30 (~44 words)
- **Visual:** LIVE. Blank canvas (New). Drag a **Map**, a **Get attribute**, and a **Current value**
  out of the palette — loose blocks appear. Then the JSON fills in and the blocks **assemble into one
  connected tree** (reverse projection), output following.
- **Caption:** Build from blocks — the JSON writes itself.

**Narration:**
> So you build by assembling. Start from nothing, and pull the blocks you need out of the palette — a
> map, an attribute, a value. Snap them together, and the JSON writes itself as you go. This is
> authoring, not typing.

## Beat III.5 — live, both directions
- **Target:** 3:30–3:50 (~46 words)
- **Visual:** LIVE. Load the swap. Detach a value block → the JSON panel updates **mid-drag**; drag it
  back → JSON restores. Then cursor to the JSON text, type a small edit → the blocks **re-render to match**.
- **Caption:** Blocks → JSON, and JSON → blocks. Instantly.

**Narration:**
> And it's live, both ways. Move a block, and the JSON follows instantly. Edit the JSON text directly,
> and the blocks re-render to match. Two views of one document — and the JSON is always the source of
> truth. The canvas never lies about it.

## Beat III.6 — run it
- **Target:** 3:50–4:05 (~34 words)
- **Visual:** LIVE. Click **Run** → output panel fills; gentle zoom on **"✓ Output matches expected"**.
- **Caption:** Run → ✓ matches expected. Real engine.

**Narration:**
> Hit Run, and the real engine executes the template against the sample input, then checks it against
> the expected result. That check mark means it matches. The editor ships no engine of its own — it
> asks the host's.

## Beat III.7 — navigate a big template
- **Target:** 4:05–4:28 (~50 words)
- **Visual:** LIVE. Load a dense example. Wheel-zoom in/out; **zoom-to-fit** frames the whole tree;
  the **minimap** mirrors it; drag to **pan**; **collapse** a subtree to one row and expand it back.
- **Caption:** Zoom · fit · minimap · pan · collapse.

**Narration:**
> Real templates get big. So the canvas is built for it: zoom with the wheel, fit the whole tree to
> the screen, a minimap to keep your place, drag to pan, and collapse any branch you're done with.
> Nothing gets lost off-screen.

## Beat III.8 — grow it in place
- **Target:** 4:28–4:41 (~30 words)
- **Visual:** LIVE. On an array block, click the inline **+** control twice — new slots appear; click
  **−** once — a slot removes. The JSON stays in sync throughout.
- **Caption:** Grow arrays and objects in place — JSON stays in sync.

**Narration:**
> Arrays and objects grow in place — one control adds a slot, another removes it, and the JSON stays
> in sync the whole time. No retyping brackets, no counting commas.

## Beat III.9 — the scale shot (hand-off to Act IV)
- **Target:** 4:41–4:55 (~32 words)
- **Visual:** LIVE. Zoom-to-fit on the densest worked example — a wall of connected blocks framed
  cleanly. Hold.
- **Caption:** A whole transformation — legible at a glance.

**Narration:**
> And that's the point: a whole transformation, however large, laid out as something you can read and
> trust at a glance. Which raises a question — how does one editor know every rule in the language,
> and never drift from the engine?

---

# Act IV — Scales: the editor is generated (4:55–5:45)

> **Proof of:** *scales.* It doesn't hand-code the rules — it's generated from the engine. A
> metacompiler. Animated pipeline diagram + the live self-hosting import.

## Beat IV.1 — the editor is generated
- **Target:** 4:55–5:15 (~50 words)
- **Visual:** animated pipeline diagram: `engine` node exports `metadata` → `G_palette / G_toolbox /
  G_encode / G_decode` generator nodes → `palette · toolbox · codec` artifacts → the editor. Arrows
  light up left to right.
- **Caption:** No hand-written code per rule. The editor is generated.

**Narration:**
> The answer is that it doesn't *know* them — it's generated. The engine exports its entire catalog —
> every rule, parameter, and operator — as metadata. Generators project that metadata into the block
> palette, the toolbox, and the codec that translates blocks to JSON and back. No hand-written editor
> code per rule.

## Beat IV.2 — the metacompiler
- **Target:** 5:15–5:35 (~44 words)
- **Visual:** the generator nodes flip to reveal they contain Transon markers (`"$"` / `"@"`); a
  recursion glyph draws around the whole pipeline. Then a split-flap line: *new engine rule → new
  block, zero editor code*.
- **Caption:** The generators are Transon templates. A metacompiler in its own language.

**Narration:**
> And those generators are themselves Transon templates. Transon, transforming a description of
> Transon, into the programs that edit Transon — a metacompiler, written in the language it compiles.
> When the engine gains a new rule, the editor grows a block — with zero editor code changed.

## Beat IV.3 — self-hosting proof (hand-off to Act V)
- **Target:** 5:35–5:45 (~24 words)
- **Visual:** LIVE. The editor imports its own palette generator, `G_palette`; **zoom-to-fit** frames
  the full block wall (~338 blocks). Hold; let it land.
- **Caption:** The editor, editing its own source.

**Narration:**
> And the proof: the editor can open its own generators — hundreds of blocks — and edit them. It's its
> own best example. And the code behind all of it is held to the same bar as the templates.

---

# Act V — Honest: built by agents, gated by machines (5:45–6:55)

> **Proof of:** *honest / trust.* Spec-first, test-first, maker ≠ checker, deterministic gates.
> (Numbers pinned 2026-07-07: **1,564 tests**, seven milestones — see "Pinned numbers".)

## Beat V.1 — spec-first
- **Target:** 5:45–6:02 (~40 words)
- **Visual:** SPEC.md scrolls past numbered `FR-` requirement blocks; one highlights; an annotation
  stamps: *append-only · never renumbered*.
- **Caption:** Every behavior is a numbered, append-only requirement.

**Narration:**
> Because this editor was built almost entirely by AI agents — but not by vibe-coding. The project
> runs on a spec-first harness: every behavior is a numbered requirement in a contract document.
> Requirements are append-only — never renumbered, never quietly rewritten.

## Beat V.2 — test-first, machine-checked
- **Target:** 6:02–6:16 (~35 words)
- **Visual:** a test file header citing its FR ID → the traceability table (requirement → tests) → a
  terminal runs `check_traceability.py`, exits green.
- **Caption:** Requirement → test → traceability. Checked by a script, not by trust.

**Narration:**
> Each requirement is implemented test-first, and a traceability table maps every requirement to its
> tests. And that mapping isn't kept honest by discipline — a script checks it, on every single
> commit.

## Beat V.3 — maker ≠ checker
- **Target:** 6:16–6:36 (~48 words)
- **Visual:** styled terminal replay of a real `round-trip-reviewer` finding — the surface-check
  must-fix: finding appears → verdict `MUST-FIX` → fix commit → re-verify `PASS`.
- **Caption:** The agent that writes the code never reviews it.

**Narration:**
> And the agent that writes the code never reviews it. Independent reviewer agents adversarially probe
> every risky change — this is a real finding, catching a real round-trip bug before merge. Maker
> never equals checker.

## Beat V.4 — the gates (hand-off to Close)
- **Target:** 6:36–6:55 (~48 words)
- **Visual:** gate names cascade with green checks (round-trip corpus · engine parity · byte-equal
  regen · traceability); then the animated test-count ramp across milestones **M0 → M6** ending at
  **1,564**, milestone labels beneath.
- **Caption:** Seven milestones · 1,564 tests · gates a model can't sweet-talk.

**Narration:**
> Deterministic gates hold the line: round-trip fidelity over the engine's entire example corpus,
> engine parity, byte-equal regeneration of every generated artifact. Seven milestones, from empty
> repository to an embeddable component — more than fifteen hundred tests — every one signed off by
> gates a model can't sweet-talk.

---

# Close (6:55–7:10)

> **Idea-first CTA:** return to the thesis (rethink how you move JSON); embed snippet = the supporting
> call to action; callback to Act II (the editor lives in your docs, too).

## Beat C.1 — takeaway
- **Target:** 6:55–7:10 (~34 words)
- **Visual:** close card: the three-line takeaway stacked; beneath it a `<transon-editor>` embed
  snippet (editor-react / editor-element **v0.1.0**); repo URL + QR. Hold to end.
- **Caption:** Transformations as data. An editor that never lies about your JSON. Built by agents, gated by machines.

**Narration:**
> Transformations as data — data you can see, and trust. So the next time you reach for a one-liner to
> reshape JSON, remember there's a version you can see, diff, and hand to a machine to check. Transon
> is open source, MIT licensed. Drop it into your own docs in three lines. Come build with it.

---

## Word-count budget

| Act | Beats | Proof of |
|---|---|---|
| I | 4 | the thesis (data not code) |
| II | 5 | usable / docs shown + several transformations |
| III | 9 | powerful (incl. build-from-scratch) |
| IV | 3 | scales |
| V | 4 | honest |
| Close | 1 | rethink how you move JSON |
| **Total** | **26** | — |

Segment length is set by each beat's actual TTS duration (say Evan Enhanced runs faster than 145 wpm),
plus a ~0.4 s freeze+silence tail per part for breathing room (assembly). Expect ~6:00.

## Pinned numbers (V.4)

- **1,564 tests** total (2026-07-07, full `pnpm test`, all green): core 25 · blockly 37 · reference-host 8
  · react 5 · element 12 · editor-ui 190 · engine-node-adapter 1,287. Narration says "more than
  fifteen hundred"; caption shows the exact 1,564.
- **Seven milestones** = M0…M6.
- **Ramp bars (V.4 slide):** 13 · 133 · 763 · 1387 · 1477 · 1551 · 1564.
