// ElevenLabs TTS client for turn narration.
// Clips are synthesised on demand (never inside runTurn) and stored under cache/audio/.
// Without ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID the game runs as usual; audio is off.

import { createHash } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const CACHE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'cache', 'audio');
const DEFAULT_MODEL = 'eleven_multilingual_v2';
const TTS_TIMEOUT_MS = 60000;

export const NARRATABLE_KINDS = {
  turn_headline: true,
  turn_reason: true
};

const KIND_FIELDS = {
  turn_headline: 'headline',
  turn_reason: 'feasibilityReason'
};

const cfg = () => ({
  apiKey: process.env.ELEVENLABS_API_KEY || '',
  voiceId: process.env.ELEVENLABS_VOICE_ID || '',
  modelId: process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL
});

export function audioConfigured() {
  const c = cfg();
  return Boolean(c.apiKey && c.voiceId);
}

export function audioInfo() {
  return {
    configured: audioConfigured(),
    kinds: Object.keys(NARRATABLE_KINDS)
  };
}

function lowercaseAfterFirstWord(text) {
  const words = text.split(/\s+/);
  if (words.length < 2) return text;
  return [words[0], ...words.slice(1).map((word) => word.toLowerCase())].join(' ');
}

function withSentenceEnd(text) {
  if (/[.!?…。！？]$/.test(text)) return text;
  return `${text}.`;
}

function spokenHeadline(text) {
  return withSentenceEnd(lowercaseAfterFirstWord(text));
}

export function textForKind(entry, kind) {
  if (!entry || !NARRATABLE_KINDS[kind]) return null;
  const field = KIND_FIELDS[kind];
  const text = String(entry[field] || '').trim();
  if (!text) return null;
  if (kind === 'turn_headline') {
    const title = spokenHeadline(text);
    const reason = String(entry.feasibilityReason || '').trim();
    return reason ? `${title} ${reason}` : title;
  }
  return text;
}

export class AudioClipError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AudioClipError';
    this.status = status;
  }
}

export async function streamClip(game, { turn, kind } = {}, req, res) {
  if (!audioConfigured()) {
    throw new AudioClipError(503, 'Text-to-speech is not configured.');
  }
  if (!game) {
    throw new AudioClipError(404, 'No game in progress. Start a new game.');
  }
  const kindId = String(kind || '');
  if (!NARRATABLE_KINDS[kindId]) {
    throw new AudioClipError(400, 'That audio kind is not allowed.');
  }
  const entry = game.journal?.find(j => j.turn === Number(turn));
  if (!entry) {
    throw new AudioClipError(404, 'Turn not found.');
  }
  const text = textForKind(entry, kindId);
  if (!text) {
    throw new AudioClipError(400, 'Nothing to narrate for that clip.');
  }

  const c = cfg();
  const lang = game.lang || 'en';
  const hash = createHash('sha256')
    .update(`${c.voiceId}\0${c.modelId}\0${lang}\0${kindId}\0${text}`)
    .digest('hex');
  const file = path.join(CACHE_DIR, `${hash}.mp3`);
  const part = path.join(CACHE_DIR, `${hash}.part`);

  if (fs.existsSync(file) && fs.statSync(file).size > 0) {
    const size = fs.statSync(file).size;
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': size,
      'Cache-Control': 'private, max-age=120'
    });
    try {
      await pipeline(fs.createReadStream(file), res);
    } catch {
      if (!res.writableEnded && !res.destroyed) res.end();
    }
    return;
  }

  await synthesizeStream(text, lang, { req, res, file, part });
}

function languageCode(lang, modelId) {
  if (!lang || /multilingual_v2/i.test(modelId)) return null;
  if (lang === 'en') return 'en';
  if (lang.startsWith('zh')) return 'zh';
  return null;
}

function clientGone(req, res) {
  return Boolean(req.destroyed || res.destroyed || res.writableEnded);
}

function discardPart(partStream, partPath) {
  if (partStream && !partStream.destroyed) {
    try { partStream.destroy(); } catch { /* ignore */ }
  }
  try {
    if (partPath && fs.existsSync(partPath)) fs.unlinkSync(partPath);
  } catch { /* ignore */ }
}

async function writeBoth(partStream, res, chunk) {
  const buf = Buffer.from(chunk);
  const partOk = partStream.write(buf);
  const resOk = res.write(buf);
  const waits = [];
  if (!partOk) waits.push(once(partStream, 'drain'));
  if (!resOk) waits.push(once(res, 'drain'));
  if (waits.length) await Promise.all(waits);
}

async function readFirstChunk(reader) {
  while (true) {
    const { done, value } = await reader.read();
    if (done) return null;
    if (value && value.byteLength) return value;
  }
}

async function synthesizeStream(text, lang, { req, res, file, part }) {
  const c = cfg();
  const body = {
    text,
    model_id: c.modelId
  };
  const languageCodeValue = languageCode(lang, c.modelId);
  if (languageCodeValue) body.language_code = languageCodeValue;

  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, TTS_TIMEOUT_MS);
  const onClose = () => {
    if (!res.writableEnded) ctrl.abort();
  };
  res.on('close', onClose);

  let partStream = null;
  let renamed = false;
  let reader = null;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(c.voiceId)}/stream?optimize_streaming_latency=3`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
          'xi-api-key': c.apiKey
        },
        body: JSON.stringify(body),
        signal: ctrl.signal
      }
    );
    if (!elRes.ok) {
      const errText = await elRes.text();
      throw new AudioClipError(502, `ElevenLabs API ${elRes.status}: ${errText.slice(0, 300)}`);
    }
    if (!elRes.body) {
      throw new AudioClipError(502, 'ElevenLabs returned empty audio.');
    }

    reader = elRes.body.getReader();
    const first = await readFirstChunk(reader);
    if (!first) throw new AudioClipError(502, 'ElevenLabs returned empty audio.');
    if (clientGone(req, res)) return;

    partStream = fs.createWriteStream(part);
    res.status(200);
    res.set({
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=120'
    });
    res.flushHeaders();

    await writeBoth(partStream, res, first);
    while (true) {
      if (ctrl.signal.aborted || clientGone(req, res)) {
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      }
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength) await writeBoth(partStream, res, value);
    }

    await new Promise((resolve, reject) => {
      partStream.end((err) => (err ? reject(err) : resolve()));
    });
    fs.renameSync(part, file);
    renamed = true;
    if (!res.writableEnded) res.end();
  } catch (err) {
    if (reader) {
      try { await reader.cancel(); } catch { /* ignore */ }
    }
    discardPart(partStream, part);
    partStream = null;
    if (res.headersSent) {
      if (!res.writableEnded && !res.destroyed) res.end();
      return;
    }
    if (clientGone(req, res)) return;
    if (err instanceof AudioClipError) throw err;
    if (err.name === 'AbortError') {
      if (!timedOut) return;
      throw new AudioClipError(502, `ElevenLabs request timed out after ${TTS_TIMEOUT_MS} ms`);
    }
    throw new AudioClipError(502, `ElevenLabs request failed: ${err.message}`);
  } finally {
    clearTimeout(timer);
    res.off('close', onClose);
    if (!renamed) discardPart(partStream, part);
  }
}
