// script.md → one narration clip per beat + out/audio/timings.json.
//
// Two backends (config switch):
//   TTS_BACKEND=eleven  (default) — ElevenLabs, voice George (JBFqnCBsd6RMkjVDRZzb); true text (no
//                        respellings); needs ELEVENLABS_API_KEY in the env (source .env first).
//   TTS_BACKEND=say     — macOS `say -v "Evan (Enhanced)"` with the phonetic respellings (v1 path).
//
// George's clips run a bit longer than `say`; every downstream step reads out/audio/timings.json, so
// the video extends proportionally (segments cut to audio, autopilots paced to durOf). Usage:
//   node tts.mjs           # ElevenLabs George
//   TTS_BACKEND=say node tts.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';

const BACKEND = process.env.TTS_BACKEND ?? 'eleven';
const ELEVEN_VOICE = process.env.TTS_VOICE_ID ?? 'JBFqnCBsd6RMkjVDRZzb'; // George (premade)
const ELEVEN_MODEL = process.env.TTS_MODEL ?? 'eleven_multilingual_v2';
const VOICE_SAY = 'Evan (Enhanced)';
const RESPELL = [
  ['diff it', 'dihf it'], // say-only phonetic hacks; ElevenLabs uses true text
  [/\bJSON\b/g, 'Jaysawn'],
];

const script = readFileSync(new URL('script.md', import.meta.url), 'utf8');
const AUDIO_DIR = new URL('out/audio/', import.meta.url).pathname;
mkdirSync(AUDIO_DIR, { recursive: true });

// parse beats: "## Beat <id> — title" … "- **Caption:** …" … "**Narration:**" + "> …" lines
const beats = [];
for (const sec of script.split(/^## Beat /m).slice(1)) {
  const id = sec.match(/^(\S+)/)[1];
  const caption = sec.match(/\*\*Caption:\*\*\s*(.+)/)?.[1].trim();
  const narrMatch = sec.match(/\*\*Narration:\*\*\s*\n((?:>.*\n?)+)/);
  if (!narrMatch) {
    console.error(`beat ${id}: no narration — skipped`);
    continue;
  }
  const narration = narrMatch[1]
    .split('\n')
    .map((l) => l.replace(/^>\s?/, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/[*_`]/g, '');
  beats.push({ id, caption, narration });
}

const durationOf = (mp3) =>
  parseFloat(
    execFileSync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=nw=1:nk=1',
      mp3,
    ]).toString(),
  );

async function elevenTTS(text, mp3) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: ELEVEN_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, use_speaker_boost: true },
      }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  writeFileSync(mp3, Buffer.from(await res.arrayBuffer()));
}

function sayTTS(text, mp3) {
  let spoken = text;
  for (const [from, to] of RESPELL) spoken = spoken.replaceAll(from, to);
  const aiff = mp3.replace(/\.mp3$/, '.aiff');
  execFileSync('say', ['-v', VOICE_SAY, '-o', aiff, spoken]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', aiff, '-b:a', '192k', mp3]);
  rmSync(aiff);
}

const timings = [];
let start = 0;
for (const b of beats) {
  const mp3 = `${AUDIO_DIR}${b.id}.mp3`;
  if (BACKEND === 'eleven') await elevenTTS(b.narration, mp3);
  else sayTTS(b.narration, mp3);
  const duration = durationOf(mp3);
  timings.push({ id: b.id, caption: b.caption, start: +start.toFixed(3), duration: +duration.toFixed(3) });
  start += duration;
  console.log(`${b.id}\t${duration.toFixed(1)}s\t${b.narration.split(' ').length} words`);
}

writeFileSync(`${AUDIO_DIR}timings.json`, JSON.stringify(timings, null, 2));
console.log(
  `total: ${(start / 60).toFixed(1)} min across ${timings.length} beats (backend=${BACKEND}) → ${AUDIO_DIR}timings.json`,
);
