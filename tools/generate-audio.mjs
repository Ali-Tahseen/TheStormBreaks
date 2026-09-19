// Bake SFX and looping music beds via ElevenLabs. Writes public/audio/.
// Run:  node tools/generate-audio.mjs
//        node tools/generate-audio.mjs --force   (overwrite existing files)

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'audio');
const FORCE = process.argv.includes('--force');
const API = 'https://api.elevenlabs.io';
const SFX_TIMEOUT_MS = 90000;
const MUSIC_TIMEOUT_MS = 300000;

const apiKey = process.env.ELEVENLABS_API_KEY || '';
if (!apiKey) {
  console.error('Missing ELEVENLABS_API_KEY in .env');
  process.exit(1);
}

const SFX = [
  {
    id: 'ui_send',
    src: 'sfx/ui_send.mp3',
    loop: false,
    duration_seconds: 0.7,
    prompt_influence: 0.8,
    text: 'Single dry mechanical switch click on a 1930s radio set, very short, no reverb, no melody, no voices.'
  },
  {
    id: 'time_tick',
    src: 'sfx/time_tick.mp3',
    loop: false,
    duration_seconds: 0.5,
    prompt_influence: 0.8,
    text: 'One teletype letter clack, paper newsroom, mono, no bell, no space, no melody.'
  },
  {
    id: 'map_pulse',
    src: 'sfx/map_pulse.mp3',
    loop: false,
    duration_seconds: 0.9,
    prompt_influence: 0.75,
    text: 'Soft wooden map-table thump, distant, no explosion, no whoosh, no gunfire.'
  },
  {
    id: 'event_war',
    src: 'sfx/event_war.mp3',
    loop: false,
    duration_seconds: 1.6,
    prompt_influence: 0.7,
    text: 'Short low orchestral sting, 1940 newsreel, muted brass and timpani, one and a half seconds, no gunfire loop, no scream, no choir.'
  },
  {
    id: 'event_diplomacy',
    src: 'sfx/event_diplomacy.mp3',
    loop: false,
    duration_seconds: 1.4,
    prompt_influence: 0.7,
    text: 'Soft paper wax-seal stamp and a brief major-key piano cadence, documentary, no choir, no fanfare.'
  },
  {
    id: 'event_economy',
    src: 'sfx/event_economy.mp3',
    loop: false,
    duration_seconds: 1.1,
    prompt_influence: 0.75,
    text: 'Quiet adding-machine crank, office 1940, one shot, no melody, no voices.'
  },
  {
    id: 'event_politics',
    src: 'sfx/event_politics.mp3',
    loop: false,
    duration_seconds: 1.3,
    prompt_influence: 0.7,
    text: 'Distant assembly-hall gavel tap, wood on wood, short, documentary, no crowd roar, no anthem.'
  },
  {
    id: 'event_other',
    src: 'sfx/event_other.mp3',
    loop: false,
    duration_seconds: 1.0,
    prompt_influence: 0.7,
    text: 'Soft radio-set click and a faint paper shuffle, newsroom 1940, one shot, no voices.'
  },
  {
    id: 'campaign_end',
    src: 'sfx/campaign_end.mp3',
    loop: false,
    duration_seconds: 2.4,
    prompt_influence: 0.65,
    text: 'Quiet documentary close-out sting, low strings resolving, 1940s newsreel, no choir, no anthem, no drums, no gunfire.'
  }
];

const MUSIC = [
  {
    id: 'peace',
    src: 'music/peace.mp3',
    loop: true,
    music_length_ms: 32000,
    prompt: [
      'Instrumental only. Quiet 1940s documentary underscore for a strategy map.',
      'Low strings, muted brass, no choir, no drums, no vocals, no national anthem.',
      'Slow, 72 BPM, constant dynamics, no intro swell, no ending cadence.',
      'Designed to loop seamlessly forever. Classroom-safe, serious not grim, no horror drones.'
    ].join(' ')
  },
  {
    id: 'wartime',
    src: 'music/wartime.mp3',
    loop: true,
    music_length_ms: 32000,
    prompt: [
      'Instrumental only. Tense but quiet wartime newsreel bed for a strategy map.',
      'Snare on brushes, low strings, spare muted trumpet, 96 BPM.',
      'Not a battle track: no explosions, no choir, no heroic fanfare, no anthem, no vocals.',
      'Constant energy, no fade in or out, last bar must join the first for an endless loop.'
    ].join(' ')
  }
];

function dest(rel) {
  return path.join(OUT, rel);
}

async function postAudio(url, body, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
        'xi-api-key': apiKey
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    const type = res.headers.get('content-type') || '';
    const buf = Buffer.from(await res.arrayBuffer());
    if (!res.ok) {
      const errText = buf.toString('utf8').slice(0, 800);
      throw new Error(`HTTP ${res.status} (${type}): ${errText}`);
    }
    if (!buf.length) throw new Error('Empty audio body');
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

async function generateSfx(clip) {
  const file = dest(clip.src);
  if (fs.existsSync(file) && !FORCE) {
    console.log(`skip  ${clip.src}`);
    return;
  }
  console.log(`sfx   ${clip.id} …`);
  const buf = await postAudio(
    `${API}/v1/sound-generation?output_format=mp3_44100_128`,
    {
      text: clip.text,
      model_id: 'eleven_text_to_sound_v2',
      duration_seconds: clip.duration_seconds,
      loop: clip.loop,
      prompt_influence: clip.prompt_influence
    },
    SFX_TIMEOUT_MS
  );
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  console.log(`wrote ${clip.src} (${buf.length} bytes)`);
}

async function generateMusic(clip) {
  const file = dest(clip.src);
  if (fs.existsSync(file) && !FORCE) {
    console.log(`skip  ${clip.src}`);
    return;
  }
  console.log(`music ${clip.id} (${clip.music_length_ms} ms) …`);
  const buf = await postAudio(
    `${API}/v1/music?output_format=mp3_44100_128`,
    {
      model_id: 'music_v2_5',
      prompt: clip.prompt,
      music_length_ms: clip.music_length_ms,
      force_instrumental: true
    },
    MUSIC_TIMEOUT_MS
  );
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  console.log(`wrote ${clip.src} (${buf.length} bytes)`);
}

function writeManifest() {
  const manifest = {
    provider: 'ElevenLabs',
    generated: new Date().toISOString().slice(0, 10),
    note: 'Baked assets. Do not generate these at runtime. Music and SFX are Git LFS objects.',
    sfx: SFX.map(({ id, src, loop }) => ({ id, src: `/audio/${src}`, loop })),
    music: MUSIC.map(({ id, src, loop }) => ({ id, src: `/audio/${src}`, loop }))
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('wrote manifest.json');
}

let failed = 0;
for (const clip of SFX) {
  try {
    await generateSfx(clip);
  } catch (err) {
    failed += 1;
    console.error(`FAIL  ${clip.id}: ${err.message}`);
  }
}
for (const clip of MUSIC) {
  try {
    await generateMusic(clip);
  } catch (err) {
    failed += 1;
    console.error(`FAIL  ${clip.id}: ${err.message}`);
  }
}
writeManifest();
if (failed) {
  console.error(`${failed} clip(s) failed`);
  process.exit(1);
}
console.log('done');
