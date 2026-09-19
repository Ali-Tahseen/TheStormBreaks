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
      music: { a: null, b: null, active: 'a', fading: false }
    };
    this.enabled = true;
    this.rate = DEFAULT_RATE;
    this.playingTurn = null;
    this.phase = 'idle';
    this.onChange = onChange;
    this.manifest = null;
    this.musicId = null;
    this._musicVolume = 0.16;
    this._musicFade = 8;
    this._sfxVolume = 0.55;
    this._pool = [];
    this._poolKey = '';
    this._poolIndex = 0;
    this._variantTimer = null;
    this._fadeTimer = null;
    this._ducked = false;
    this._onMusicTime = null;
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
    this.setMusicPool(id ? [id] : []);
  }

  setMusicPool(ids) {
    const next = [...new Set((ids || []).filter(Boolean))];
    const key = next.slice().sort().join('|');
    if (key === this._poolKey) return;
    this._poolKey = key;
    this._pool = this._shuffle(next);
    this._poolIndex = 0;
    if (!this._pool.length) {
      this._stopMusic();
      return;
    }
    this._playPoolTrack();
  }

  _shuffle(list) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  duck(on) {
    this._ducked = Boolean(on);
    const vol = this._ducked ? 0.04 : this._musicVolume;
    const el = this._activeMusic();
    if (el && !this.channels.music.fading) el.volume = vol;
  }

  _musicPair() {
    const m = this.channels.music;
    if (!m.a) {
      m.a = new Audio();
      m.b = new Audio();
      m.a.preload = 'auto';
      m.b.preload = 'auto';
      m.active = 'a';
      m.fading = false;
    }
    return m;
  }

  _activeMusic() {
    const m = this._musicPair();
    return m[m.active];
  }

  _idleMusic() {
    const m = this._musicPair();
    return m.active === 'a' ? m.b : m.a;
  }

  _musicTargetVolume() {
    return this._ducked ? 0.04 : this._musicVolume;
  }

  _playPoolTrack({ crossfade = false } = {}) {
    const id = this._pool[this._poolIndex];
    const clip = this._clip('music', id);
    if (!clip) return;
    const m = this._musicPair();
    this._unbindMusicLoop();
    const el = this._activeMusic();
    const other = this._idleMusic();
    el.loop = false;
    other.loop = false;
    this.musicId = id;
    if (crossfade && el.src && !el.paused && !m.fading) {
      other.src = clip.src;
      other.volume = 0;
      m.fading = true;
      other.play().then(() => this._crossfade(el, other, 6)).catch(() => {
        m.fading = false;
        this._startMusic(el, other, clip.src);
      });
      this._scheduleVariantChange();
      return;
    }
    this._startMusic(el, other, clip.src);
    this._scheduleVariantChange();
  }

  _startMusic(el, other, src) {
    const m = this.channels.music;
    clearTimeout(this._fadeTimer);
    m.fading = false;
    el.src = src;
    other.src = src;
    other.pause();
    other.volume = 0;
    el.volume = this._musicTargetVolume();
    el.play().catch(() => {});
    this._bindMusicLoop();
  }

  _loopFadeSeconds(duration) {
    if (!duration || !Number.isFinite(duration)) return this._musicFade;
    return Math.min(this._musicFade, Math.max(1.5, duration / 8));
  }

  _bindMusicLoop() {
    this._unbindMusicLoop();
    const el = this._activeMusic();
    this._onMusicTime = () => {
      const m = this.channels.music;
      const fade = this._loopFadeSeconds(el.duration);
      if (!el.duration || !Number.isFinite(el.duration) || el.duration <= fade * 2) return;
      if (m.fading) return;
      if (el.currentTime < el.duration - fade) return;
      m.fading = true;
      const next = this._idleMusic();
      next.currentTime = 0;
      next.volume = 0;
      next.play().then(() => this._crossfade(el, next, fade)).catch(() => {
        m.fading = false;
      });
    };
    el.addEventListener('timeupdate', this._onMusicTime);
  }

  _unbindMusicLoop() {
    const m = this.channels.music;
    if (this._onMusicTime && m.a) m.a.removeEventListener('timeupdate', this._onMusicTime);
    if (this._onMusicTime && m.b) m.b.removeEventListener('timeupdate', this._onMusicTime);
    this._onMusicTime = null;
  }

  _crossfade(from, to, seconds) {
    this._unbindMusicLoop();
    const steps = Math.max(20, Math.round(seconds * 4));
    const stepMs = (seconds * 1000) / steps;
    const target = this._musicTargetVolume();
    let i = 0;
    const tick = () => {
      i += 1;
      const t = Math.min(1, i / steps);
      const a = t * Math.PI / 2;
      from.volume = target * Math.cos(a);
      to.volume = target * Math.sin(a);
      if (t < 1) {
        this._fadeTimer = setTimeout(tick, stepMs);
        return;
      }
      from.pause();
      if (from.src !== to.src) from.src = to.src;
      from.currentTime = 0;
      from.volume = 0;
      to.volume = target;
      this.channels.music.active = this.channels.music.active === 'a' ? 'b' : 'a';
      this.channels.music.fading = false;
      this._bindMusicLoop();
    };
    tick();
  }

  _scheduleVariantChange() {
    clearTimeout(this._variantTimer);
    this._variantTimer = null;
    if (this._pool.length < 2) return;
    const ms = 270000 + Math.floor(Math.random() * 60000);
    this._variantTimer = setTimeout(() => this._nextVariant(), ms);
  }

  _nextVariant() {
    if (this._pool.length < 2) return;
    let next = this._poolIndex;
    while (next === this._poolIndex) next = Math.floor(Math.random() * this._pool.length);
    this._poolIndex = next;
    this._playPoolTrack({ crossfade: true });
  }

  _stopMusic() {
    clearTimeout(this._variantTimer);
    clearTimeout(this._fadeTimer);
    this._variantTimer = null;
    this._fadeTimer = null;
    this._unbindMusicLoop();
    this.musicId = null;
    this._pool = [];
    this._poolKey = '';
    const m = this.channels.music;
    m.fading = false;
    for (const el of [m.a, m.b]) {
      if (!el) continue;
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
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
