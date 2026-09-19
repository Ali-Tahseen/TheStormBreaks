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
    scenario: 'ww2-1939',
    mood: 'peace',
    music_length_ms: 32000,
    prompt: [
      'Instrumental only. Quiet 1940s documentary underscore for a strategy map of Europe.',
      'Low strings, muted brass, no choir, no drums, no vocals, no national anthem.',
      'Slow, 72 BPM, constant dynamics, no intro swell, no ending cadence.',
      'Designed to loop seamlessly forever. Classroom-safe, serious not grim, no horror drones.'
    ].join(' ')
  },
  {
    id: 'wartime_quiet',
    src: 'music/wartime_quiet.mp3',
    loop: true,
    scenario: 'ww2-1939',
    mood: 'wartime',
    music_length_ms: 40000,
    prompt: [
      'Instrumental only. Very quiet background furniture for a classroom strategy game set in 1939 Europe.',
      'Soft low string pad only, almost ambient, no melody you can hum, no drums, no snare, no trumpet, no ostinato.',
      'Unhurried, about 60 BPM or unmetered. Easy to ignore while reading. No choir, no vocals, no anthem.',
      'Constant very low dynamics, no swell, no cadence, seamless loop.'
    ].join(' ')
  },
  {
    id: 'wartime_fog',
    src: 'music/wartime_fog.mp3',
    loop: true,
    scenario: 'ww2-1939',
    mood: 'wartime',
    music_length_ms: 40000,
    prompt: [
      'Instrumental only. Soft foggy chamber strings for a map table, 1939, barely there.',
      'Two or three slow cello notes, long gaps, no percussion, no brass, no piano hook, no repeating riff.',
      'Grey and calm, not sad, not epic. No vocals, no choir, no anthem, no newsreel energy.',
      'Seamless quiet loop, even level, classroom-safe, easy to talk over.'
    ].join(' ')
  },
  {
    id: 'wartime_lamp',
    src: 'music/wartime_lamp.mp3',
    loop: true,
    scenario: 'ww2-1939',
    mood: 'wartime',
    music_length_ms: 40000,
    prompt: [
      'Instrumental only. Warm lamp-lit documentary underscore, very sparse piano fifths and muted strings.',
      'Soft, slow, 58 BPM. No drums, no snare, no trumpet, no march, no melody that repeats every four bars.',
      'Background only. No vocals, no choir, no anthem. Seamless loop, no intro, no ending.'
    ].join(' ')
  },
  {
    id: 'ww2_late',
    src: 'music/ww2_late.mp3',
    loop: true,
    scenario: 'ww2-1939',
    mood: 'late',
    music_length_ms: 32000,
    prompt: [
      'Instrumental only. Weary late-war European documentary bed for a strategy map, 1944-1945.',
      'Thinner low strings, muted horns, sparse snare, slower than a 1939 newsreel, 84 BPM.',
      'No victory parade, no anthem, no choir, no vocals, no explosions, no heroic fanfare.',
      'Constant dynamics, no intro, no ending cadence, seamless endless loop. Classroom-safe.'
    ].join(' ')
  },
  {
    id: 'china_peace',
    src: 'music/china_peace.mp3',
    loop: true,
    scenario: 'china-1939',
    mood: 'peace',
    music_length_ms: 32000,
    prompt: [
      'Instrumental only. Quiet 1939 documentary underscore for a map of China\'s interior.',
      'Pentatonic chamber strings, gentle plucked zither, soft bamboo flute far in the background.',
      'No drums, no choir, no vocals, no national anthem, no propaganda song, no military march.',
      'Slow, 70 BPM, constant level, no intro swell, no cadence, seamless endless loop. Classroom-safe.'
    ].join(' ')
  },
  {
    id: 'china_wartime_quiet',
    src: 'music/china_wartime_quiet.mp3',
    loop: true,
    scenario: 'china-1939',
    mood: 'wartime',
    music_length_ms: 40000,
    prompt: [
      'Instrumental only. Very quiet pentatonic string pad for a China map in 1939. Background furniture.',
      'No drums, no woodblock, no brass, no flute hook, no melody you can hum, no anthem, no march.',
      'Slow and even, easy to ignore while reading. No vocals, no choir. Seamless quiet loop.'
    ].join(' ')
  },
  {
    id: 'china_wartime_mist',
    src: 'music/china_wartime_mist.mp3',
    loop: true,
    scenario: 'china-1939',
    mood: 'wartime',
    music_length_ms: 40000,
    prompt: [
      'Instrumental only. Soft misty zither harmonics and low strings, sparse, long silences between notes.',
      'No percussion, no military music, no Japanese march, no Chinese anthem, no vocals, no choir.',
      'Calm documentary air, not tense. Seamless quiet loop, classroom-safe, easy to talk over.'
    ].join(' ')
  },
  {
    id: 'china_wartime_river',
    src: 'music/china_wartime_river.mp3',
    loop: true,
    scenario: 'china-1939',
    mood: 'wartime',
    music_length_ms: 40000,
    prompt: [
      'Instrumental only. Slow river-like low strings, pentatonic but almost drone, 1939 China documentary.',
      'No drums, no flute lead, no catchy motif, no anthem, no march, no vocals.',
      'Very quiet, constant level, seamless loop, easy to ignore while reading a lesson.'
    ].join(' ')
  },
  {
    id: 'china_late',
    src: 'music/china_late.mp3',
    loop: true,
    scenario: 'china-1939',
    mood: 'late',
    music_length_ms: 32000,
    prompt: [
      'Instrumental only. Late War of Resistance documentary bed, 1944-1945, weary but unresolved.',
      'Thin pentatonic strings, sparse plucked notes, very little percussion, 80 BPM.',
      'No anthem, no choir, no vocals, no victory fanfare, no military march, no gunfire.',
      'Constant dynamics, no intro, no ending cadence, seamless endless loop. Classroom-safe.'
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
    music: MUSIC.map(({ id, src, loop, scenario, mood }) => ({
      id, src: `/audio/${src}`, loop, scenario, mood
    }))
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
