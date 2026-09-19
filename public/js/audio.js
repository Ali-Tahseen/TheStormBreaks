// Client audio engine: narration (TTS), sfx, and looping music beds.
// Narration cues are { kind, turn }. The engine plays /api/audio/clip on one HTML Audio element.
// Progressive MP3: the element loads the HTTP stream; clips are not fully buffered first.

const SILENCE = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
const STORAGE_KEY = 'storm-narration';
const PREFS_V = 2;
const RATE_MIN = 0.5;
const RATE_MAX = 2;
const RATE_STEP = 0.25;
const DEFAULT_RATE = 1.5;

export function clampRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_RATE;
  const stepped = Math.round(n / RATE_STEP) * RATE_STEP;
  return Math.min(RATE_MAX, Math.max(RATE_MIN, stepped));
}

export class AudioEngine {
  constructor({ onChange } = {}) {
    this.channels = {
      narration: { audio: null },
      sfx: { audio: null },
      music: { audio: null }
    };
    this.enabled = true;
    this.rate = DEFAULT_RATE;
    this.playingTurn = null;
    this.phase = 'idle';
    this.onChange = onChange;
    this.manifest = null;
    this.musicId = null;
    this._musicWanted = null;
    this._musicVolume = 0.22;
    this._sfxVolume = 0.55;
    this._ctrl = null;
    this._loadPrefs();
    this._savePrefs();
  }

  async loadBank() {
    try {
      const res = await fetch('/audio/manifest.json');
      if (!res.ok) return;
      this.manifest = await res.json();
    } catch {
      this.manifest = null;
    }
  }

  _clip(kind, id) {
    return (this.manifest?.[kind] || []).find(c => c.id === id) || null;
  }

  _channel(name) {
    if (!this.channels[name].audio) this.channels[name].audio = new Audio();
    return this.channels[name].audio;
  }

  playSfx(id) {
    const clip = this._clip('sfx', id);
    if (!clip) return;
    const el = this._channel('sfx');
    el.loop = false;
    el.volume = this._sfxVolume;
    el.src = clip.src;
    el.play().catch(() => {});
  }

  setMusic(id) {
    this._musicWanted = id || null;
    this._applyMusic();
  }

  duck(on) {
    const el = this.channels.music.audio;
    if (el) el.volume = on ? 0.06 : this._musicVolume;
  }

  _applyMusic() {
    const id = this._musicWanted;
    if (!id) {
      this._stopMusic();
      return;
    }
    if (this.musicId === id) return;
    const clip = this._clip('music', id);
    if (!clip) return;
    const el = this._channel('music');
    el.loop = true;
    el.volume = this._musicVolume;
    el.src = clip.src;
    this.musicId = id;
    el.play().catch(() => {});
  }

  _stopMusic() {
    const el = this.channels.music.audio;
    this.musicId = null;
    if (!el) return;
    el.pause();
    el.removeAttribute('src');
    el.load();
  }

  clipUrl({ turn, kind }) {
    const q = new URLSearchParams({ turn: String(turn), kind: String(kind) });
    return `/api/audio/clip?${q}`;
  }

  _emit() {
    if (this.onChange) this.onChange();
  }

  _el() {
    return this._channel('narration');
  }

  _loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.enabled === 'boolean') this.enabled = data.enabled;
      this.rate = data.v === PREFS_V && data.rate != null ? clampRate(data.rate) : DEFAULT_RATE;
    } catch {
      this.enabled = true;
      this.rate = DEFAULT_RATE;
    }
  }

  _savePrefs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        enabled: this.enabled,
        rate: this.rate,
        v: PREFS_V
      }));
    } catch { /* quota / private mode */ }
  }

  setEnabled(on) {
    this.enabled = Boolean(on);
    if (!this.enabled) this.stop();
    this._savePrefs();
    this._emit();
  }

  setRate(value) {
    this.rate = clampRate(value);
    const el = this.channels.narration.audio;
    if (el) el.playbackRate = this.rate;
    this._savePrefs();
    this._emit();
  }

  async arm() {
    this._abortPlay();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      if (!this._ctx) this._ctx = new AC();
      if (this._ctx.state === 'suspended') await this._ctx.resume();
    }
    const el = this._el();
    el.loop = true;
    el.muted = false;
    el.playbackRate = 1;
    el.src = SILENCE;
    await el.play();
  }

  async playQueue(cues, { turn } = {}) {
    this._abortPlay();
    if (!this.enabled) return;
    const list = Array.isArray(cues) ? cues : [];
    const ctrl = new AbortController();
    this._ctrl = ctrl;
    this.playingTurn = turn ?? list[0]?.turn ?? null;
    this.duck(true);
    try {
      const el = this._el();
      for (const cue of list) {
        if (ctrl.signal.aborted) return;
        this.phase = 'loading';
        this._emit();
        await this._playSrc(el, this.clipUrl(cue), ctrl.signal);
      }
    } catch (err) {
      if (err?.name === 'AbortError' || ctrl.signal.aborted) return;
      throw err;
    } finally {
      if (this._ctrl === ctrl) {
        this._ctrl = null;
        this.playingTurn = null;
        this.phase = 'idle';
        this.duck(false);
        this._emit();
      }
    }
  }

  stop() {
    this._abortPlay();
    this.playingTurn = null;
    this.phase = 'idle';
    this.duck(false);
    const el = this.channels.narration.audio;
    if (el) {
      el.loop = false;
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    this._emit();
  }

  off() {
    this.setEnabled(false);
  }

  _abortPlay() {
    const ctrl = this._ctrl;
    this._ctrl = null;
    if (ctrl) ctrl.abort();
  }

  _playSrc(el, url, signal) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        resolve();
        return;
      }
      let settled = false;
      const finish = (err) => {
        if (settled) return;
        settled = true;
        el.removeEventListener('ended', onEnded);
        el.removeEventListener('error', onError);
        el.removeEventListener('playing', onPlaying);
        signal.removeEventListener('abort', onAbort);
        if (err) reject(err);
        else resolve();
      };
      const onEnded = () => finish();
      const onError = () => {
        if (signal.aborted) finish();
        else finish(new Error('The narration could not be played.'));
      };
      const onPlaying = () => {
        el.playbackRate = this.rate;
        if (this.phase !== 'playing') {
          this.phase = 'playing';
          this._emit();
        }
      };
      const onAbort = () => {
        el.pause();
        finish();
      };
      el.addEventListener('ended', onEnded);
      el.addEventListener('error', onError);
      el.addEventListener('playing', onPlaying);
      signal.addEventListener('abort', onAbort);
      el.loop = false;
      el.src = url;
      el.playbackRate = this.rate;
      const started = () => {
        el.muted = false;
        el.playbackRate = this.rate;
        this.phase = 'playing';
        this._emit();
      };
      el.play().then(started).catch((err) => {
        if (err?.name === 'AbortError' || signal.aborted) {
          finish();
          return;
        }
        if (err?.name !== 'NotAllowedError') {
          finish(err);
          return;
        }
        el.muted = true;
        el.play().then(started).catch((err2) => {
          el.muted = false;
          if (err2?.name === 'AbortError' || signal.aborted) finish();
          else finish(err2);
        });
      });
    });
  }
}
