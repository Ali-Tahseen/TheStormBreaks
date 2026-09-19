// Direct ElevenLabs check. Does not use the game journal or /api/audio/clip.
// Run:  node tools/test-tts.mjs

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'cache', 'audio', 'demo.mp3');
const TEXT = 'This is a narration test. If you can hear this, ElevenLabs is working.';
const PLAYERS = [
  ['mpv', ['--no-terminal', '--really-quiet']],
  ['ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet']],
  ['pw-play', []],
  ['paplay', []],
  ['ffplay', ['-nodisp', '-autoexit']]
];

const apiKey = process.env.ELEVENLABS_API_KEY || '';
const voiceId = process.env.ELEVENLABS_VOICE_ID || '';
const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

if (!apiKey || !voiceId) {
  console.error('Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID in .env');
  process.exit(1);
}

console.log(`Voice ${voiceId}`);
console.log(`Model ${modelId}`);
console.log('POST /v1/text-to-speech …');

const res = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({ text: TEXT, model_id: modelId })
  }
);

const type = res.headers.get('content-type') || '';
if (!res.ok) {
  const err = await res.text();
  console.error(`FAIL HTTP ${res.status} (${type})`);
  console.error(err.slice(0, 500));
  process.exit(1);
}

const buf = Buffer.from(await res.arrayBuffer());
if (!buf.length) {
  console.error('FAIL: empty body');
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, buf);
console.log(`OK ${buf.length} bytes (${type || 'no content-type'})`);
console.log(`Wrote ${OUT}`);

let played = false;
for (const [cmd, args] of PLAYERS) {
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(cmd, [...args, OUT], { stdio: 'ignore' });
      child.on('error', reject);
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    });
    console.log(`Played with ${cmd}`);
    played = true;
    break;
  } catch {
    continue;
  }
}
if (!played) {
  console.log('Could not auto-play. Open the mp3 in any audio player.');
}
