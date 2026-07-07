#!/usr/bin/env bash
# Per-beat segments → concat → two committed deliverables:
#   out/video.mp4       — captions burned in (muted-playback / distribution cut)
#   out/video-nocap.mp4 — caption-free (live-presentation cut)
# Inputs: out/audio (tts.mjs), out/slides (capture.mjs), out/video (autopilot-*.mjs).
# No libass/drawtext in this ffmpeg build → captions are Playwright-rendered PNGs (gen-captions.mjs)
# applied as timed per-segment overlays.
set -euo pipefail
cd "$(dirname "$0")"

AUD=out/audio SL=out/slides VID=out/video CAP=out/captions SEG=out/segments
mkdir -p "$SEG"
ENC=(-c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -ar 44100)

dur() { node -p "JSON.parse(require('fs').readFileSync('$AUD/timings.json','utf8')).find(t=>t.id==='$1').duration"; }

node gen-srt.mjs
node gen-captions.mjs

echo "— still segments"
for id in I.1 I.2 I.3 I.4 IV.1 IV.2 C.1; do
  D=$(dur "$id")
  ffmpeg -v error -y -loop 1 -framerate 30 -t "$D" -i "$SL/$id.png" -i "$AUD/$id.mp3" \
    "${ENC[@]}" -t "$D" "$SEG/nocap-$id.mp4"
  ffmpeg -v error -y -loop 1 -framerate 30 -t "$D" -i "$SL/$id.png" \
    -loop 1 -framerate 30 -t "$D" -i "$CAP/$id.png" -i "$AUD/$id.mp3" \
    -filter_complex "[0:v][1:v]overlay[v]" -map '[v]' -map 2:a \
    "${ENC[@]}" -t "$D" "$SEG/$id.mp4"
done

echo "— animated segments (Act V)"
for id in V.1 V.2 V.3 V.4; do
  D=$(dur "$id")
  ffmpeg -v error -y -i "$SL/$id.webm" -i "$AUD/$id.mp3" -map 0:v -map 1:a \
    "${ENC[@]}" -t "$D" "$SEG/nocap-$id.mp4"
  ffmpeg -v error -y -i "$SL/$id.webm" \
    -loop 1 -framerate 30 -t "$D" -i "$CAP/$id.png" -i "$AUD/$id.mp3" \
    -filter_complex "[0:v][1:v]overlay[v]" -map '[v]' -map 2:a \
    "${ENC[@]}" -t "$D" "$SEG/$id.mp4"
done

# live_take <segname> <webm> <meta.json> <beat ids…>
# One continuous webm (paced to the beat audio durations) → segment with timed caption overlays and a
# concatenated per-beat audio track. Head warmup trimmed via meta.offset.
live_take() {
  local name="$1" webm="$2" meta="$3"; shift 3; local ids=("$@")
  local idsjs="[$(printf "'%s'," "${ids[@]}")]"
  local OFF DUR filter
  OFF=$(node -p "JSON.parse(require('fs').readFileSync('$meta','utf8')).offset")
  DUR=$(node -p "const t=JSON.parse(require('fs').readFileSync('$AUD/timings.json','utf8'));$idsjs.reduce((a,id)=>a+t.find(x=>x.id===id).duration,0)")
  # concat the beat mp3s → one narration track for the take
  : > "$SEG/$name-audio.txt"
  for id in "${ids[@]}"; do echo "file '../audio/$id.mp3'" >> "$SEG/$name-audio.txt"; done
  ffmpeg -v error -y -f concat -safe 0 -i "$SEG/$name-audio.txt" -c:a aac -b:a 192k "$SEG/$name-audio.m4a"
  # caption-free cut
  ffmpeg -v error -y -ss "$OFF" -i "$webm" -i "$SEG/$name-audio.m4a" \
    -map 0:v -map 1:a "${ENC[@]}" -t "$DUR" "$SEG/nocap-$name.mp4"
  # timed overlay chain: caption i shown only during beat i's window
  filter=$(node -p "const t=JSON.parse(require('fs').readFileSync('$AUD/timings.json','utf8'));const ids=$idsjs;let cum=0,prev='0:v',g=[];ids.forEach((id,i)=>{const d=t.find(x=>x.id===id).duration;const out=i===ids.length-1?'v':'v'+i;g.push(\`[\${prev}][\${i+1}:v]overlay=enable='between(t,\${(cum+0.12).toFixed(2)},\${(cum+d-0.12).toFixed(2)})'[\${out}]\`);prev=out;cum+=d;});g.join(';')")
  local capargs=()
  for id in "${ids[@]}"; do capargs+=(-loop 1 -framerate 30 -t "$DUR" -i "$CAP/$id.png"); done
  local aidx=$(( ${#ids[@]} + 1 )) # inputs: 0=webm, 1..N=captions, N+1=audio
  ffmpeg -v error -y -ss "$OFF" -i "$webm" "${capargs[@]}" -i "$SEG/$name-audio.m4a" \
    -filter_complex "$filter" -map '[v]' -map "$aidx:a" "${ENC[@]}" -t "$DUR" "$SEG/$name.mp4"
}

echo "— Act II (docs, live take)"
live_take II "$VID/act2.webm" "$VID/act2-meta.json" II.1 II.2 II.3 II.4 II.5

echo "— Act III (editor, live take)"
live_take III "$VID/act3.webm" "$VID/act3-meta.json" III.1 III.2 III.3 III.4 III.5 III.6 III.7 III.8 III.9

echo "— Act IV.3 (self-hosting, live take)"
OFF43=$(node -p "JSON.parse(require('fs').readFileSync('$VID/act4-meta.json','utf8')).offset")
D43=$(dur IV.3)
ffmpeg -v error -y -ss "$OFF43" -i "$VID/act4.webm" -i "$AUD/IV.3.mp3" \
  -map 0:v -map 1:a "${ENC[@]}" -t "$D43" "$SEG/nocap-IV.3.mp4"
ffmpeg -v error -y -ss "$OFF43" -i "$VID/act4.webm" \
  -loop 1 -framerate 30 -t "$D43" -i "$CAP/IV.3.png" -i "$AUD/IV.3.mp3" \
  -filter_complex "[0:v][1:v]overlay[v]" -map '[v]' -map 2:a \
  "${ENC[@]}" -t "$D43" "$SEG/IV.3.mp4"

echo "— breathing pauses (freeze+silence tail per part) + concat"
PAD=0.4 # seconds of frozen last-frame + silence appended to each part, so nothing feels glued
ORDER=(I.1 I.2 I.3 I.4 II III IV.1 IV.2 IV.3 V.1 V.2 V.3 V.4 C.1)
: > "$SEG/list.txt"; : > "$SEG/list-nocap.txt"
for id in "${ORDER[@]}"; do
  for pre in "" "nocap-"; do
    ffmpeg -v error -y -i "$SEG/${pre}${id}.mp4" \
      -vf "tpad=stop_mode=clone:stop_duration=$PAD" -af "apad=pad_dur=$PAD" \
      "${ENC[@]}" "$SEG/pad-${pre}${id}.mp4"
  done
  echo "file 'pad-$id.mp4'" >> "$SEG/list.txt"
  echo "file 'pad-nocap-$id.mp4'" >> "$SEG/list-nocap.txt"
done
ffmpeg -v error -y -f concat -safe 0 -i "$SEG/list.txt" -c copy out/video.mp4
ffmpeg -v error -y -f concat -safe 0 -i "$SEG/list-nocap.txt" -c copy out/video-nocap.mp4

for f in out/video.mp4 out/video-nocap.mp4; do
  ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$f" |
    xargs printf "DONE → %s (%ss)\n" "$f"
done
