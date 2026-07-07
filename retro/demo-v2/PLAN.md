# Demo video v2 — production plan

> **Meta-material** (like the rest of `retro/`): not part of the editor contract, excluded from the
> harness gates. Everything in `retro/demo-v2/` is regenerable-by-design — sources are committed,
> generated media (`out/`) is git-ignored **except the committed deliverables**: `out/video.mp4`
> (captions burned) and `out/video-nocap.mp4` (caption-free, for live presentation). End-to-end
> rebuild: `make video`.
>
> **v1 lives on** in `retro/demo/` (the 3:24 first cut). This is a **second version** built in a new
> folder so v1's committed deliverables stay intact for A/B. The pipeline is copied from v1 and
> evolved; the voice and render settings are carried forward unchanged.

**Target:** ~7:00 video · 1920×1080 @ 30 fps · macOS `say` narration (Evan Enhanced) ·
muted-playback-safe (burned-in captions + `.srt`) · fully regenerable.

## Why a v2 (what changed since the first cut)

v1 shipped before the editor grew its navigation, palette, and docs-embedding story. Everything on
the request wishlist now exists and is shipped (editor-react/element **v0.1.0**):

- **Docs-site embedding (RFC-005):** open any doc example → embedded editor (autorun, minimal
  toolbar, "← Back to docs"); back → open another; an in-editor **dropdown of all examples**. This
  is the "start from the docs site → get to the editor → navigate several examples and back" flow.
- **Canvas navigation (M6 / RFC-003):** zoom controls, wheel/pinch zoom, **zoom-to-fit**, **minimap**,
  pan/scroll, subtree **collapse**.
- **Flat always-visible palette** with category dividers (drag a block onto the canvas), fixed scale.
- **Inline +/- mutators** (grow/shrink arrays & objects on the canvas).
- **Resizable side panel** (splitter).
- **19-example curated picker** (7 worked examples + 12 recipes; 121 total corpus).

## Through-line & spine (LOCKED — idea-first)

**What we are telling the user, one sentence:**

> **Transformations should be data you can *see* and *trust* — Transon makes them exactly that.**

This is **idea-first** (v1's DNA): the thesis is the star, and every act is a **proof** of one facet of
it. The editor (in the docs, then standalone) is the proof that it's *usable* and *powerful*; the
metacompiler and the agentic harness are the proof that it *scales* and is *honest*. The docs are not
a detour — they're the editor's front door (RFC-005), which is why "start in the docs" is load-bearing,
not decorative. The close returns to the idea (rethink how you move JSON), with the embed snippet as
the supporting CTA — closing the ring back to Act II.

| Act | Its ONE job (proof of…) | Hand-off into the next act |
|---|---|---|
| **I — Why** | transformations should be *data*, not code-in-a-string | "…you don't write these by hand — you get an editor, and it lives where you'd least expect." |
| **II — Usable** | you can *see* it, with zero friction: every doc example is one click live | "…and that friendly one-click editor is the whole thing." |
| **III — Powerful** | it's a real workshop: examples, palette, zoom, round-trip, big templates | "…how does *one* editor know every rule, and never drift from the engine?" |
| **IV — Scales** | it doesn't *know* the rules — it's *generated* (a metacompiler) | "…and the code behind it is held to the same bar as the templates." |
| **V — Honest** | built by agents, gated by machines you can't sweet-talk | "…open source, MIT." |
| **Close** | rethink how you move JSON (embed snippet = CTA; callback to II) | — |

**Seam rule:** the last sentence of each act sets up the next act's first sentence. No act opens cold.
The two editor acts have **distinct jobs** — II = *frictionless first contact* (embedded, autorun,
learning), III = *serious authoring* (standalone, full power) — which is why the editor appears twice.

## The request, mapped

| Ask | Where it lands |
|---|---|
| Start from the docs site, get to the editor | **Act II** (live docs site → embedded editor) |
| Standalone editor stays too | **Act III** (live reference host, full toolbar) |
| Loading different examples · palette · scrolling · zooming | **Act III** rapid montage; some in **Act II** |
| Navigating several examples from docs and back | **Act II** (2–3 round-trips, in-editor dropdown) |
| More rapid / agile / few seconds per screen | Acts II–III paced as fast montages, cut to audio |
| Keep Acts I / III / IV (they're nice) | **Act I** (kept), **Act IV** (kept), **Act V** (kept) |
| Longer, but ≤ 10 min | ~7:00 budget below |

## Locked decisions

- **Length/structure:** 6 acts + close, ~7:00 target, 10:00 hard ceiling. *(approved)*
- **Editor coverage:** split into **two acts** — II docs→embedded-editor, III standalone deep tour.
  *(approved)*
- **Home:** new folder `retro/demo-v2/`, v1 preserved. *(approved)*
- **Voice:** **ElevenLabs, voice "George"** (`JBFqnCBsd6RMkjVDRZzb`, premade), model
  `eleven_multilingual_v2`, true text (no respellings) — chosen over `say`/Evan after an A/B. `tts.mjs`
  is a config switch: `TTS_BACKEND=say` falls back to macOS `say -v "Evan (Enhanced)"` (with the
  `JSON`→`Jaysawn` / `diff it`→`dihf it` respellings). ElevenLabs key + voice id live in the
  git-ignored `.env` (`ELEVENLABS_API_KEY`, `TTS_VOICE_ID` optional override).
  **Note:** the user's own *Voice-Library* voice needs a paid ElevenLabs plan (free API blocks library
  voices); George is a free premade voice.
- **Resolution/framerate:** 1920×1080 @ 30 fps.
- **Running example:** the key/value **swap** recipe (`RecipeSwapKeysAndValues`) remains the through-
  line for Acts I–II so the viewer never re-learns the data; Act III widens to several examples.
- **Design:** dark cards matching the editor theme; every act's key claim as on-screen text so the
  video works muted; captions + `.srt` derive from the same script source.
- **Capture surfaces (two):**
  - **Docs site** — `../transon-org.github.io` (CRA/craco), embeds editor-react **v0.1.0** (already
    includes M6 + RFC-003/004/005). Used for Act II.
  - **Standalone editor** — `examples/reference-host` (Vite, full toolbar + Pyodide). Used for
    Acts III & IV (self-hosting import). Runs from this repo's `main` = newest editor.
- **Music bed:** optional, ambient, ~−20 dB under narration; added at assembly, trivially removable.

## Structure (6 acts + close)

| Act | Time | Surface | Story | Key on-screen |
|---|---|---|---|---|
| **I — Why Transon** | ~0:55 | slides | *Keep v1.* Transformations as data | jq foil → input/template/output → benefits → "trees don't have to be written by hand" |
| **II — Usable (docs → editor)** | ~1:20 | live docs site | *Proof you can **see** it — and see several **different** transformations.* Focus = transformation semantics, not docs↔editor mechanics | docs homepage + click an example (expands to input/template/result JSON) → **Open in Visual Editor**; explain the swap; then **flip through 4 examples** via the in-editor dropdown (pluck · default · join · filter), a beat each, autorun output updating |
| **III — Powerful (standalone)** | ~2:15 | live standalone editor | *Proof it's a real workshop.* Full-toolbar tour | load examples from picker · drag a block from the palette · block↔JSON live both ways · Run → ✓ · wheel-zoom / zoom-to-fit / minimap / pan · +/- grow an array · land on a big template zoomed to fit |
| **IV — Metacompiler** | ~0:50 | slides + live | *Keep v1 Act III.* The editor is generated | metadata → generators → palette/toolbox/codec → editor; self-hosting import of `G_palette` (now **zoom-to-fit** — fixes v1 nit e) |
| **V — Built by agents** | ~1:10 | slides + terminal | *Keep v1 Act IV.* Spec-first, gated | SPEC FRs → traceability → gates green → reviewer must-fix → **refreshed** test-count ramp (now through M6 + RFC-003/004/005) |
| **Close** | ~0:15 | slide | Takeaway | three-line takeaway + **refreshed** `<transon-editor>` embed snippet (editor-react v0.1.0) + repo URL |

**Total ≈ 6:45.** Trim/stretch levers: Act III montage length (each feature clip is independent),
Act II round-trip count (2 vs 3). If long, drop one Act III feature; if short, add an example.

### Reuse vs. new build

- **Reused (edit + refresh only):** Act I slides; Act IV pipeline diagram + self-hosting flow;
  Act V slides + terminal replay (**numbers must be re-pinned** — v1's `13→…→1600+` ramp and "six
  milestones" predate M6/RFCs); Close card (embed snippet + URL); the **entire** ffmpeg / TTS /
  caption / `.srt` / Makefile pipeline; voice + respellings.
- **New build:** Act II autopilot (docs-site capture: scroll, open-in-editor, back, switch example);
  Act III autopilot (reference-host capture: ~8 short feature clips); a small number of new slides
  (Act II/III lower-thirds if any); refreshed Act V ramp data.

## Phase 0 — Script (the foundation; everything is cut to fit it)

1. Write `retro/demo-v2/script.md`: all 6 acts + close, word-counted per beat (~145 wpm), each beat
   with narration (TTS input) + short caption + visual annotation. Carry the v1 running example.
2. **☐ CHECKPOINT: user reviews and approves the script.** Changing it later invalidates downstream
   timing.

## Phase 1 — Risk burn-down (cheap tests before building the big captures)

3. **Voice** — already locked from v1 (Evan Enhanced, respellings verified by ear). Re-confirm the
   ffmpeg build still has the caption path we used (PNG-overlay per segment; this build lacks
   libass/drawtext). No new voice work expected.
4. **Docs-site capture pre-flight** — build/serve `../transon-org.github.io`, drive with Playwright:
   confirm engine `ready` after PyScript warmup, **Open in editor** mounts blocks + autorun output,
   **Back to docs** returns, the in-editor example dropdown switches examples. Record the readiness
   signal + selectors (docs-site DOM differs from the reference host).
5. **Reference-host capture pre-flight** — confirm the M6 nav affordances are drivable headless:
   zoom-to-fit button, minimap presence, wheel-zoom, palette flyout drag lands a block, +/- mutator
   click grows an array, splitter drag. Note any that don't animate cleanly in headless capture
   (v1 learned: native `<select>` never shows an open dropdown; `confirm()` blocks the page).
6. **Big-template shot** — pick the example that best shows "scale + zoom-to-fit" (a worked example
   with many blocks, or `G_palette` for Act IV). Confirm zoom-to-fit framing at 1080p.

## Phase 2 — Assets (parallelizable, after script approval)

7. **Slides** (`retro/demo-v2/slides/`): copy Act I / IV / V / close cards from v1; edit copy;
   rebuild the Act V ramp with real numbers.
8. **Act II autopilot** (`retro/demo-v2/autopilot-docs.mjs`): Playwright drives the docs site —
   land, scroll, open example in editor, autorun output, back, open a second, switch via dropdown;
   human-paced to the narration beats; PyScript pre-warmed before recording.
9. **Act III autopilot** (`retro/demo-v2/autopilot-editor.mjs`): reference host — picker loads,
   palette drag, live sync both ways, Run ✓, zoom/fit/minimap/pan, +/- grow, big-template land.
10. **Act IV live moment**: reference host imports its own `G_palette` generator → zoom-to-fit on
    the block wall (reuse v1's flow + the new fit).
11. **Act V terminal replay**: reuse v1's styled `round-trip-reviewer` finding + gates-green capture;
    rebuild the test-count ramp from the current suite totals.

## Phase 3 — Audio

12. `retro/demo-v2/tts` step: `script.md` → one clip per beat via `say` → measure durations →
    `timings.json`. (OpenAI TTS remains a config switch.)
13. Optional music bed, mixed at assembly.

## Phase 4 — Assembly & iteration

14. `assemble.sh` (ffmpeg, copied from v1): pad/cut each visual segment to its beat's audio duration
    from `timings.json`; burn PNG captions per segment; concat with crossfades; mux narration
    (+ bed) → `out/video.mp4` + `out/captions.srt`; caption-free `out/video-nocap.mp4`.
15. `Makefile`: `make video` end-to-end; per-phase targets (`make audio`, `make demo-docs`,
    `make demo-editor`, `make slides`) for cheap partial rebuilds.
16. **☐ CHECKPOINT: user watches the rough cut** → iterate on wording/pacing/visuals; each fix is a
    partial rebuild.
17. Final render.

## Rough cut #1 — DONE (2026-07-07): `out/video.mp4` + `out/video-nocap.mp4`, 5:16, all 24 beats

Pipeline built and run end-to-end (`make audio` → slides → both autopilots → `assemble.sh`). Live
captures: docs-site build served on :4173 (Act II), reference host on :5173 (Acts III + IV.3). Both
live takes paced **exactly** to the narration boundaries (act meta cumulative == timings cumulative).
TTS (`say` Evan Enhanced) runs faster than the 145-wpm estimate → 5:16 total (well under target — punchy).

Fixes applied during capture (recorded so they don't regress):
- **III.7 (+/- mutator):** the glyphs are 14×14 data-URI `<image>` pairs; the shot now finds the
  TOP-MOST `[−][+]` pair and clicks + ×2, − ×1 (verified live: block grows 351→394px). Uses the dense
  `WorkedExampleReshapeRecords` (it has an `Array` block; the first pick had none).
- **III.8 / IV.3 (zoom-to-fit):** `.zoomToFit` control click + settle; cursor parked on empty canvas
  so no block-hover tooltip lingers on the held shot.

Known rough-cut nits (candidates for a polish pass, none blocking a watch):
- (a) Total 5:16 vs the ~7:00 target — faster `say` pace. If you want ~7:00, slow the TTS rate or add
  explicit holds on the montage money-shots (III.5/III.8/IV.3/V.4).
- (b) Act II embed dropdown reads "Choose an example…" even with an example loaded (the docs embed
  doesn't reflect the opened example as the selected option) — cosmetic.
- (c) III.7 can leave a faint block tooltip for a frame after the grow; parkEmpty covers most of it.
- (d) `say` clips are a touch flat vs OpenAI TTS (config-switch alternative remains if desired).

## Rough cut #2 — DONE (2026-07-07): 5:36, 26 beats

User feedback on cut #1 addressed:
- **Act II re-paced** (was "jumped into the editor instantly, said 'click it' 30 s later"): split into
  **II.1 docs** (the catalog is scrolled — TOC/worked/recipes/rules — no editor) + **II.2 open one**
  (the recipe expands to input/template/result JSON, then "Open in Visual Editor" — the mount is
  **timed to land on the word "opens"**). Docs are shown; visual and narration synced.
- **Build-from-scratch beat added** (III.4): blank canvas → drag Map / Get-attribute / Current-value
  out of the palette (loose blocks) → the JSON fills and the blocks **assemble into a connected tree**.
  *Technical note:* block-to-block **connection-snap does NOT fire from headless synthetic drags**
  (verified extensively — blocks land pixel-adjacent but never connect, JSON stays empty). So the
  assembly uses the **reliable reverse projection** (fill the JSON → blocks snap together). Palette
  drag-*out* works; drag-to-*connect* does not.
- **Breathing pauses**: a 0.4 s freeze-frame + silence tail appended to each of the 14 parts at
  assembly (`assemble.sh` PAD), so nothing feels glued.

Act III is now 9 beats (added III.4 build), Act II is 5 beats. NBSP-safe palette finders
(` `) so multi-word blocks ("Get attribute", "Current value") resolve.

## Rough cut #3 — DONE (2026-07-07): 5:31

User feedback on cut #2 addressed:
- **Show the recipes list** when the narration names them: II.1 now scrolls to the **Worked examples**
  section (first half) then the **Recipes** section (second half), so both example-button lists are on
  screen exactly as II.1 says "worked examples and recipes."
- **"Load one, load another" now synced**: III.2 holds on the current example, then fires the two loads
  at ~45% / ~56% of the beat (on the words), instead of at the beat's start.
- **Standalone part de-awkwarded**: III.1 no longer enumerates the toolbar buttons — reworded to "that
  same editor … standalone, the full workbench, everything switched on."

## Rough cut #4 — DONE (2026-07-07): 6:04, ElevenLabs George voice

Switched the narration from `say`/Evan to **ElevenLabs George**. `tts.mjs` gained an `eleven` backend
(fetch → mp3, `voice_settings` stability 0.5/similarity 0.75); `say` kept as `TTS_BACKEND=say`. George's
clips run longer (6.0 min narration vs 5.4), so every beat extended **proportionally** — nothing else
changed, because the autopilots pace off `timings.json` and each segment is cut to its beat's audio.
Full rebuild: audio (George) → slides re-timed → both takes re-captured (re-paced) → assembled with the
per-part pauses. Final: **6:04**, video+audio verified, captions aligned.

## Critical path & user inputs

Critical path: **script → approval → captures → timings → assembly**. Two live-capture surfaces
(docs site + reference host) are the main new work vs. v1.

User-required inputs only:
- ☐ Script approval (Phase 0)
- ☐ Rough-cut feedback (Phase 4)

## Folder layout

```
retro/demo-v2/
  PLAN.md              ← this file
  script.md            narration + captions + visual annotations, per beat
  slides/              Act I / IV / V / close cards (HTML), evolved from v1
  autopilot-docs.mjs   Playwright: Act II (docs site → embedded editor → back)
  autopilot-editor.mjs Playwright: Act III (standalone editor feature tour) + Act IV self-hosting
  gen-captions.mjs     script.md → per-segment caption PNGs (copied from v1)
  gen-srt.mjs          script.md → captions.srt (copied from v1)
  assemble.sh          ffmpeg assembly → out/video.mp4 + out/video-nocap.mp4 + captions.srt
  Makefile             make video / audio / demo-docs / demo-editor / slides
  out/                 generated media (git-ignored except the two deliverables)
```

## Known risks (tracked)

| Risk | Mitigation |
|---|---|
| Two capture surfaces double the selector/timing surface | Phase-1 pre-flights (items 4–5); record readiness signals + selectors per surface |
| Docs-site (CRA) build/serve differs from Vite reference host | Build once, serve `build/`; pin the PyScript-ready signal (Act II) |
| Headless capture won't show open `<select>` dropdowns | v1 lesson; use the in-editor example dropdown only where it animates, else cut to result |
| Rapid montage feels choppy at ~25 fps headless cap | v1 verified headless motion is crisp; keep per-clip motion eased (cosine) |
| Act V numbers stale (pre-M6/RFC) | Re-pin from a full suite run before final render (item 11) |
| Pyodide/PyScript warmup = dead air | Pre-warm; record only after engine `ready` (both surfaces) |
```
