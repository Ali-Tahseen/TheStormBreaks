// Bake SFX (sound-generation) and music beds (music_v2_5) via ElevenLabs.
// Run:  node tools/generate-audio.mjs
//        node tools/generate-audio.mjs --force          overwrite existing files
//        node tools/generate-audio.mjs --force --music  music beds only

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'audio');
const FORCE = process.argv.includes('--force');
const MUSIC_ONLY = process.argv.includes('--music');
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

const AVOID = 'Instrumental only. No vocals, no choir, no lyrics, no drums, no snare, no march, no anthem, no fanfare, no gunfire, no drone, no ambient pad, no noise wash, no distortion.';

const MUSIC = [
  {
    id: 'peace',
    src: 'music/beds/peace.mp3',
    loop: true,
    scenario: 'ww2-1939',
    mood: 'peace',
    music_length_ms: 90000,
    prompt: `A beautiful lyrical instrumental film score for a 1939 history documentary. A piano melody you can hum, answered by warm violins and cellos. Major key, hopeful, elegant chamber orchestra, 72 BPM, soft dynamics, polished analog recording. ${AVOID}`
  },
  {
    id: 'wartime_quiet',
    src: 'music/beds/wartime_quiet.mp3',
    loop: true,
    scenario: 'ww2-1939',
    mood: 'wartime',
    music_length_ms: 90000,
    prompt: `A beautiful somber instrumental. A singing cello melody with gentle piano and a small string ensemble. 1940s film score, D minor, 60 BPM, tender and listenable, never loud, never noisy. ${AVOID}`
  },
  {
    id: 'wartime_fog',
    src: 'music/beds/wartime_fog.mp3',
    loop: true,
    scenario: 'ww2-1939',
    mood: 'wartime',
    music_length_ms: 90000,
    prompt: `A beautiful impressionist instrumental. Soft harp and piano phrases over warm strings, misty but clearly melodic, 66 BPM, cinematic documentary, delicate and pretty. ${AVOID}`
  },
  {
    id: 'wartime_lamp',
    src: 'music/beds/wartime_lamp.mp3',
    loop: true,
    scenario: 'ww2-1939',
    mood: 'wartime',
    music_length_ms: 90000,
    prompt: `A beautiful lamplit piano piece with muted strings. A clear lyrical melody, late-evening 1940s radio drama underscore, intimate, 64 BPM, warm analog tone, soft dynamics. ${AVOID}`
  },
  {
    id: 'ww2_late',
    src: 'music/beds/ww2_late.mp3',
    loop: true,
    scenario: 'ww2-1939',
    mood: 'late',
    music_length_ms: 90000,
    prompt: `A beautiful weary string quartet with a thin piano melody. 1944 documentary score, A minor, 58 BPM, tender, unresolved, still lyrical and easy on the ear. ${AVOID}`
  },
  {
    id: 'china_peace',
    src: 'music/beds/china_peace.mp3',
    loop: true,
    scenario: 'china-1939',
    mood: 'peace',
    music_length_ms: 90000,
    prompt: `A beautiful 1930s Shanghai cinema instrumental. A clear pentatonic piano melody you can hum, warm strings, gentle plucked zither, elegant salon, 68 BPM, hopeful, polished. ${AVOID}`
  },
  {
    id: 'china_wartime_quiet',
    src: 'music/beds/china_wartime_quiet.mp3',
    loop: true,
    scenario: 'china-1939',
    mood: 'wartime',
    music_length_ms: 90000,
    prompt: `A beautiful melancholic instrumental in a pentatonic mode. A singing erhu-like melody over soft piano and strings. 1930s Chinese film score, 62 BPM, tender and dignified. ${AVOID}`
  },
  {
    id: 'china_wartime_mist',
    src: 'music/beds/china_wartime_mist.mp3',
    loop: true,
    scenario: 'china-1939',
    mood: 'wartime',
    music_length_ms: 90000,
    prompt: `A beautiful misty instrumental. Pentatonic piano and harp phrases, a distant bamboo flute answering the melody, soft strings, 64 BPM, airy and pretty. ${AVOID}`
  },
  {
    id: 'china_wartime_river',
    src: 'music/beds/china_wartime_river.mp3',
    loop: true,
    scenario: 'china-1939',
    mood: 'wartime',
    music_length_ms: 90000,
    prompt: `A beautiful flowing instrumental. Pentatonic piano arpeggios and a lyrical cello melody, like a river, 1930s Chinese cinema, 66 BPM, warm chamber orchestra. ${AVOID}`
  },
  {
    id: 'china_late',
    src: 'music/beds/china_late.mp3',
    loop: true,
    scenario: 'china-1939',
    mood: 'late',
    music_length_ms: 90000,
    prompt: `A beautiful sparse pentatonic piano melody with thin strings. Late-war Chinese film score, 56 BPM, tender, intimate, still clearly a melody. ${AVOID}`
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

async function postMusic(body, timeoutMs = MUSIC_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API}/v1/music?output_format=mp3_44100_192`, {
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
    const songId = res.headers.get('song-id') || res.headers.get('song_id') || '';
    return { buf, songId };
  } finally {
    clearTimeout(timer);
  }
}

async function composeOnce(body) {
  try {
    return await postMusic(body);
  } catch (err) {
    if (body.model_id === 'music_v2_5' && /model|not found|unsupported/i.test(err.message)) {
      console.warn('model music_v2_5 unavailable, using music_v2');
      return postMusic({ ...body, model_id: 'music_v2' });
    }
    throw err;
  }
}

async function generateMusic(clip) {
  const file = dest(clip.src);
  if (fs.existsSync(file) && !FORCE) {
    console.log(`skip  ${clip.src}`);
    return;
  }
  console.log(`bed   ${clip.id} (music ${clip.music_length_ms / 1000}s) …`);
  const { buf } = await composeOnce({
    model_id: 'music_v2_5',
    prompt: clip.prompt,
    music_length_ms: clip.music_length_ms,
    force_instrumental: true
  });
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
    music: MUSIC.map(({ id, src, loop, scenario, mood }) => ({
      id, src: `/audio/${src}`, loop, scenario, mood
    }))
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('wrote manifest.json');
}

async function mapLimit(items, n, fn) {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i;
      i += 1;
      await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

let failed = 0;
let lastError = '';
if (!MUSIC_ONLY) {
  for (const clip of SFX) {
    try {
      await generateSfx(clip);
    } catch (err) {
      failed += 1;
      console.error(`FAIL  ${clip.id}: ${err.message}`);
    }
  }
}
await mapLimit(MUSIC, 2, async (clip) => {
  if (failed && lastError && /quota_exceeded/.test(lastError)) return;
  try {
    await generateMusic(clip);
  } catch (err) {
    failed += 1;
    lastError = err.message;
    console.error(`FAIL  ${clip.id}: ${err.message}`);
  }
});
writeManifest();
if (failed) {
  console.error(`${failed} clip(s) failed`);
  process.exit(1);
}
console.log('done');
