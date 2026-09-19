// Client audio engine: narration (TTS), sfx, and looping music beds.
// Cues are { kind, turn }. The engine fetches /api/audio/clip; it does not scrape the DOM.
// Clips are fully downloaded (and cached on the server) before playback. Not streamed.

const SILENCE = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export class AudioEngine {
  constructor({ onChange } = {}) {
    this.channels = {
      narration: { audio: null },
      sfx: { audio: null },
      music: { audio: null }
    };
    this.enabled = true;
    this.playingTurn = null;
    this.phase = 'idle';
    this.onChange = onChange;
    this.manifest = null;
    this.musicId = null;
    this._musicWanted = null;
    this._musicVolume = 0.22;
    this._sfxVolume = 0.55;
    this._ctrl = null;
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
    if (!this.channels.narration.audio) {
      this.channels.narration.audio = new Audio();
    }
    return this.channels.narration.audio;
  }

  async arm() {
    const el = this._el();
    el.loop = true;
    el.src = SILENCE;
    await el.play();
  }

  async playQueue(cues, { turn } = {}) {
    this._abortFetch();
    if (!this.enabled) return;
    const list = Array.isArray(cues) ? cues : [];
    const ctrl = new AbortController();
    this._ctrl = ctrl;
    this.playingTurn = turn ?? list[0]?.turn ?? null;
    this.phase = 'loading';
    this.duck(true);
    this._emit();
    try {
      const blobs = [];
      for (const cue of list) {
        if (ctrl.signal.aborted) return;
        blobs.push(await this._fetchBlob(cue, ctrl.signal));
      }
      this.phase = 'playing';
      this._emit();
      const el = this._el();
      el.loop = false;
      for (const blob of blobs) {
        if (ctrl.signal.aborted) return;
        await this._playBlob(el, blob, ctrl.signal);
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
    this._abortFetch();
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
    this.enabled = false;
    this.stop();
  }

  _abortFetch() {
    const ctrl = this._ctrl;
    this._ctrl = null;
    if (ctrl) ctrl.abort();
  }

  async _fetchBlob(cue, signal) {
    const res = await fetch(this.clipUrl(cue), { signal });
    if (!res.ok) {
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      throw new Error(data?.error || `Audio request failed (${res.status})`);
    }
    return res.blob();
  }

  _playBlob(el, blob, signal) {
    const url = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        URL.revokeObjectURL(url);
        resolve();
        return;
      }
      let settled = false;
      const finish = (err) => {
        if (settled) return;
        settled = true;
        el.removeEventListener('ended', onEnded);
        el.removeEventListener('error', onError);
        signal.removeEventListener('abort', onAbort);
        URL.revokeObjectURL(url);
        if (err) reject(err);
        else resolve();
      };
      const onEnded = () => finish();
      const onError = () => finish(new Error('The narration could not be played.'));
      const onAbort = () => {
        el.pause();
        finish();
      };
      el.addEventListener('ended', onEnded);
      el.addEventListener('error', onError);
      signal.addEventListener('abort', onAbort);
      el.src = url;
      el.play().catch((err) => {
        if (err?.name === 'AbortError' || signal.aborted) finish();
        else finish(err);
      });
    });
  }
}
