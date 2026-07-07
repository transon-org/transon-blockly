# Demo video v2 pipeline (see PLAN.md). Full rebuild: make video
# Live captures need dev servers up:
#   Act III + IV.3: reference host on :5173  (pnpm --filter @transon/reference-host dev)
#   Act II:         docs site   on :4173  (served build/ of ../../../transon-org.github.io)
# See `make serve-*` helpers below (run them in separate shells before `make demo-*`).

audio:
	node tts.mjs

slides: audio
	node capture.mjs

demo-docs: audio
	node autopilot-docs.mjs

demo-editor: audio
	node autopilot-editor.mjs

demo: demo-docs demo-editor

assemble:
	bash assemble.sh

video: audio slides demo-docs demo-editor assemble

# --- dev-server helpers (foreground; run each in its own shell) ---------------
serve-editor:
	pnpm --dir ../.. --filter @transon/reference-host dev

serve-docs:
	npx --yes serve -s ../../../transon-org.github.io/build -l 4173

clean:
	rm -rf out/segments out/captions out/captions.srt

.PHONY: audio slides demo-docs demo-editor demo assemble video serve-editor serve-docs clean
