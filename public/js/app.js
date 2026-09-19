// App controller: loads data, wires events, keeps panels and map in sync.

import { api, listen } from './api.js';
import { WorldMap } from './map.js';
import { applyInitialCamera } from './camera.js';
import { swatchStyle } from './flags.js';
import { AudioEngine } from './audio.js';
import { portraitFor } from './portraits.js';
import {
  esc, fmtDate, nationCard, statsTab, diplomacyMini, journalMini, intelCard, dossierHTML,
  advisorBarHTML, advisorsHTML, warsOf, logHTML, lessonHTML, hoodHTML, reportHTML, eventPopupHTML,
  countryDetailHTML
} from './panels.js';
import { pickEventImage, summaryFromNarrative } from './event-images.js';

const $ = (sel) => document.querySelector(sel);
const app = {
  info: null, state: null, selected: null, tab: 'economy', busy: false, map: null, lessonTurn: null,
  dossierOpen: false, advisorsOpen: false, advisorsSeen: null, advisorRole: 'economy',
  eventImages: null, eventClose: null
};
const audio = new AudioEngine({
  onChange: () => {
    syncNarrationButtons();
    syncNarrationControls();
  }
});

function audioReady() {
  return Boolean(app.info?.audio?.configured);
}

function musicMood(state) {
  if (!state) return 'peace';
  const atWar = warsOf(state, state.player).length > 0;
  if (atWar && state.date?.year >= 1944) return 'late';
  return atWar ? 'wartime' : 'peace';
}

function pickMusicPool(scenarioId, mood) {
  const list = audio.manifest?.music || [];
  let tagged = list.filter(c => c.scenario === scenarioId && c.mood === mood);
  if (!tagged.length && mood === 'late') {
    tagged = list.filter(c => c.scenario === scenarioId && c.mood === 'wartime');
  }
  if (!tagged.length) {
    tagged = list.filter(c => c.mood === mood);
  }
  return tagged.map(c => c.id);
}

function syncMusic() {
  if (!app.state) {
    audio.setMusicPool([]);
    return;
  }
  audio.setMusicPool(pickMusicPool(app.state.scenarioId, musicMood(app.state)));
}

function previewScenarioMusic(scenarioId) {
  audio.setMusicPool(pickMusicPool(scenarioId, 'peace'));
}

function eventSfx(events) {
  const cats = new Set((events || []).map(e => e.category));
  if (cats.has('war')) return 'event_war';
  if (cats.has('diplomacy')) return 'event_diplomacy';
  if (cats.has('economy')) return 'event_economy';
  if (cats.has('politics')) return 'event_politics';
  if ((events || []).length) return 'event_other';
  return null;
}

// The scenario description for the game currently loaded (from /api/info).
function activeScenario() {
  const id = app.state?.scenarioId;
  return (app.info?.scenarios || []).find(s => s.id === id) || app.info?.scenario || {};
}

// Pre-recorded event images (public/img/events/manifest.json). Missing file or
// empty list just means text-only event popups.
async function loadEventImages() {
  try {
    const res = await fetch('/img/events/manifest.json');
    if (res.ok) app.eventImages = await res.json();
  } catch { app.eventImages = null; }
}

// ---------------- boot ----------------
async function boot() {
  const info = await api.info();
  const mapFile = info.scenario?.mapFile || 'world-1939.json';
  const topo = await fetch(`/data/${mapFile}`).then(r => r.json());
  app.info = info;
  app.mapFile = mapFile;
  $('#ai-mode').textContent = info.llm.configured ? `AI: ${info.llm.model}` : 'Offline demo mode';
  syncNarrationControls();

  app.map = new WorldMap($('#map'), topo, {
    onSelect: (tag) => select(tag),
    onHover: showTooltip,
    visibleArea
  });

  await audio.loadBank();
  await loadEventImages();
  wireUI();
  renderLegend();

  if (info.hasGame) {
    try { app.state = await api.state(); } catch { app.state = null; }
  }
  if (app.state) {
    app.selected = app.state.player;
    renderAll();
    applyInitialCamera(app.map, app.state, {
      defaultView: activeScenario().defaultView || 'world', animate: false
    });
    if (app.state.gameOver) showEnding();
  } else {
    app.map.view('world', false);
    openStart();
  }

  listen(async (msg) => {
    if (msg.type !== 'state' || app.busy) return;
    if (app.state && msg.version === app.state.version) return;
    try {
      const prev = app.state;
      app.state = await api.state();
      if (!prev || prev.id !== app.state.id) app.selected = app.state.player;
      renderAll({ changed: app.state.lastChangedTerritories });
      syncMusic();
    } catch { /* no game */ }
  });
}

// Screen area not covered by panels — used to frame the map.
function visibleArea() {
  const wide = innerWidth > 900;
  const rail = $('.rail').getBoundingClientRect();
  const drawer = $('#drawer');
  const open = drawer.classList.contains('open');
  return {
    x0: wide ? rail.right + 12 : 0,
    y0: 64,
    x1: open && wide ? drawer.getBoundingClientRect().left - 12 : innerWidth,
    y1: wide ? innerHeight - 60 : rail.top
  };
}

// ---------------- rendering ----------------
function renderAll({ changed = [] } = {}) {
  const s = app.state;
  if (!s) return;
  $('#date').textContent = fmtDate(s.date);
  $('#turn').textContent = `Turn ${s.turn}`;
  $('#order-label').textContent = `Orders for ${s.nations[s.player].name}`;
  renderLedger();
  renderLog();
  renderAdvisors();
  renderIntel();
  if (app.dossierOpen) renderDossier();
  renderSuggestions();
  renderMilestones();
  app.map.render(s, { selected: app.selected, changed });
  $('#send').disabled = app.busy || !!s.gameOver;
  $('#btn-finish').disabled = !s || !!s.gameOver;
}

function indicatorDefs() {
  const sc = activeScenario();
  return (sc.indicators ? sc : app.info).indicators || {};
}

// The compact panel always shows YOUR nation. Other nations appear in the
// intel card (renderIntel) when selected.
function renderLedger() {
  const s = app.state;
  $('#nation-card').innerHTML = nationCard(s, { dossierOpen: app.dossierOpen });
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === app.tab)));
  let html;
  if (app.tab === 'diplomacy') html = diplomacyMini(s);
  else if (app.tab === 'journal') html = journalMini(s);
  else html = statsTab(s, indicatorDefs(), app.tab);
  $('#tab-body').innerHTML = html;
}

// ---------------- intel card (another nation, limited information) ----------------
function renderIntel() {
  const s = app.state;
  const box = $('#intel');
  const tag = app.selected;
  if (!s || !tag || tag === s.player || !s.nations[tag]) { box.hidden = true; box.innerHTML = ''; return; }
  box.innerHTML = intelCard(s, tag, portraitFor(s.nations[tag]));
  box.hidden = false;
}

// ---------------- country report (drop-down over the log) ----------------
function renderDossier() {
  const s = app.state;
  $('#dossier').innerHTML = dossierHTML(s, indicatorDefs(), portraitFor(s.nations[s.player]));
}
function setDossier(open) {
  app.dossierOpen = Boolean(open) && Boolean(app.state);
  if (app.dossierOpen) { setAdvisors(false); renderDossier(); }
  const box = $('#dossier');
  box.hidden = !app.dossierOpen;
  box.classList.toggle('open', app.dossierOpen);
  $('#nation-card').innerHTML = app.state ? nationCard(app.state, { dossierOpen: app.dossierOpen }) : '';
  if (app.dossierOpen) {
    box.scrollTop = 0;
    // On phones the rail is a scrolling bottom sheet: bring the report into view.
    if (innerWidth <= 900) $('.log-wrap').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}

// ---------------- advisors (drop-up from the bar above the orders box) ----------------
const advisorsKey = (s) => s?.advisors ? `${s.id}:${s.advisors.turn}:${s.advisors.date}` : null;
function renderAdvisors() {
  const s = app.state;
  const unseen = Boolean(s?.advisors) && advisorsKey(s) !== app.advisorsSeen && !app.advisorsOpen;
  $('#advisor-bar').innerHTML = s ? advisorBarHTML(s, { open: app.advisorsOpen, role: app.advisorRole, unseen }) : '';
  if (app.advisorsOpen) $('#advisors').innerHTML = advisorsHTML(s, app.advisorRole);
}
function setAdvisors(open, role) {
  if (role) app.advisorRole = role;
  app.advisorsOpen = Boolean(open) && Boolean(app.state?.advisors);
  if (app.advisorsOpen) {
    if (app.dossierOpen) setDossier(false);
    app.advisorsSeen = advisorsKey(app.state);
  }
  const box = $('#advisors');
  box.hidden = !app.advisorsOpen;
  box.classList.toggle('open', app.advisorsOpen);
  renderAdvisors();
}

function renderLog() {
  const log = $('#log');
  log.innerHTML = logHTML(app.state, { audio: audioReady() && audio.enabled }) + (app.busy ? '<div class="working" id="working">The game master is deciding what happens…</div>' : '');
  syncNarrationButtons();
  log.scrollTop = log.scrollHeight;
}

function syncNarrationButtons() {
  const turn = audio.playingTurn;
  document.querySelectorAll('[data-narrate]').forEach(btn => {
    const on = Number(btn.dataset.narrate) === turn && audio.phase !== 'idle';
    const loading = on && audio.phase === 'loading';
    btn.textContent = loading ? 'Loading' : on ? 'Stop' : 'Play';
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', loading ? 'Loading narration' : on ? 'Stop narration' : 'Play headline and summary');
  });
}

function formatRate(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return '1×';
  const shown = Number.isInteger(n) ? String(n) : String(n);
  return `${shown}×`;
}

function syncNarrationControls() {
  const box = $('#narration-controls');
  const btn = $('#narration-toggle');
  const slider = $('#narration-rate');
  const label = $('#narration-rate-label');
  if (!box || !btn) return;
  const ready = audioReady();
  box.hidden = !ready;
  if (!ready) return;
  btn.setAttribute('aria-pressed', String(audio.enabled));
  btn.textContent = audio.enabled ? 'Narration on' : 'Narration off';
  if (slider) slider.value = String(audio.rate);
  if (label) label.textContent = formatRate(audio.rate);
}

function refreshLogAudioButtons() {
  if (!app.state) return;
  if (app.busy) {
    if (!audio.enabled) {
      document.querySelectorAll('[data-narrate]').forEach(btn => btn.remove());
    }
    return;
  }
  renderLog();
}

function toggleNarrationPref() {
  if (!audioReady()) return;
  const next = !audio.enabled;
  audio.setEnabled(next);
  if (next) audio.arm().catch(() => {});
  refreshLogAudioButtons();
  syncNarrationControls();
  toast(next ? 'Narration on' : 'Narration off');
}

async function toggleNarration(turn) {
  if (!audioReady() || !audio.enabled) return;
  if (audio.playingTurn === turn && audio.phase !== 'idle') {
    audio.stop();
    return;
  }
  audio.stop();
  audio.playingTurn = turn;
  audio.phase = 'loading';
  syncNarrationButtons();
  try {
    await audio.arm();
  } catch (err) {
    audio.stop();
    toast(err.message, true);
    return;
  }
  await playNarration(turn);
}

async function playNarration(turn) {
  const cues = [{ kind: 'turn_headline', turn }];
  const pending = audio.playQueue(cues, { turn });
  syncNarrationButtons();
  try {
    await pending;
  } catch (err) {
    toast(err.message, true);
  } finally {
    syncNarrationButtons();
  }
}

function renderSuggestions() {
  const list = (activeScenario().suggestions || {})[app.state.player] || [];
  $('#suggestions').innerHTML = app.state.journal.length > 2 ? '' :
    list.map(t => `<button type="button" data-suggest="${esc(t)}">${esc(t)}</button>`).join('');
}

function renderMilestones() {
  const ev = app.state.events.slice(-12);
  $('#milestones').innerHTML = ev.map((e, i) => `
    <li class="${esc(e.category)}"><button type="button" data-ev="${app.state.events.length - ev.length + i}">
      <span>${esc(fmtDate(e.date))}</span>${esc(e.title)}</button></li>`).join('');
  const ol = $('#milestones');
  ol.scrollLeft = ol.scrollWidth;
}

function renderLegend() {
  const stripes = `<svg width="22" height="14"><defs><pattern id="lg" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.2" height="5" fill="#333"/></pattern></defs><rect width="22" height="14" fill="#cfd4c8" stroke="#555" stroke-width=".5"/><rect width="22" height="14" fill="url(#lg)"/></svg>`;
  $('#legend').innerHTML = `
    <div>${stripes} Occupied: stripe colour is the occupier</div>
    <div><svg width="22" height="14"><rect x="1" y="1" width="20" height="12" fill="none" stroke="#1d2324" stroke-width="2"/></svg> Selected nation</div>
    <div><svg width="22" height="14"><rect x="1.5" y="1.5" width="19" height="11" fill="none" stroke="#7a1f1a" stroke-width="3"/></svg> Changed last turn</div>`;
}

function showTooltip(name, e) {
  const tip = $('#tooltip');
  if (!name || !app.state?.territories[name]) { tip.hidden = true; return; }
  const s = app.state;
  const t = s.territories[name];
  const owner = s.nations[t.owner];
  const occ = Object.entries(t.occupation || {}).map(([k, v]) => `${esc(s.nations[k]?.name || k)} ${v}%`).join(', ');
  const war = owner.tag !== s.player && s.wars.some(w => w.includes(owner.tag) && w.includes(s.player));
  tip.innerHTML = `<strong>${esc(name)}</strong><br>
    <span class="swatch" style="${swatchStyle(owner)}"></span> ${esc(owner.name)}${owner.tag === s.player ? ' (you)' : ''}
    ${occ ? `<br>Occupied by ${occ}` : ''}${war ? '<br><span style="color:var(--loss)">At war with you</span>' : ''}`;
  tip.hidden = false;
  const x = Math.min(innerWidth - 270, e.clientX + 14), y = Math.min(innerHeight - 90, e.clientY + 14);
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}

function select(tag) {
  app.selected = tag && app.state.nations[tag] ? tag : app.state.player;
  renderIntel();
  app.map.render(app.state, { selected: app.selected });
}

// ---------------- turn ----------------
async function sendOrder(order) {
  if (!order.trim() || app.busy) return;
  if (audioReady() && audio.enabled) {
    try {
      await audio.arm();
    } catch { /* ignore */ }
  } else {
    audio.stop();
  }
  audio.playSfx('ui_send');
  syncNarrationButtons();
  app.busy = true;
  $('#send').disabled = true;
  $('#order').value = '';
  // Show the order immediately while the agents work.
  renderLog();
  const log = $('#log');
  log.insertAdjacentHTML('beforeend', `<div class="decree"><span class="who">Sent</span>${esc(order)}</div>`);
  const started = Date.now();
  const working = $('#working');
  if (working) log.appendChild(working);
  const timer = setInterval(() => {
    const w = $('#working');
    if (w) w.textContent = `The game master is deciding what happens… ${Math.round((Date.now() - started) / 1000)}s`;
  }, 1000);
  log.scrollTop = log.scrollHeight;

  const fromDate = { ...app.state.date };
  const prevEvents = app.state.events.length;
  try {
    const { entry, state } = await api.turn(order);
    app.state = state;
    app.busy = false;
    clearInterval(timer);
    await rollDate(fromDate, state.date);
    renderAll({ changed: entry.changedTerritories });
    syncMusic();
    const turnEvents = state.events.slice(prevEvents);
    const sting = eventSfx(turnEvents);
    if (sting) audio.playSfx(sting);
    else if (entry.changedTerritories.length) audio.playSfx('map_pulse');
    // The popup is the beat: narration plays with it, and the lesson and map
    // focus wait until the student acknowledges it with OK.
    openEventPopup(entry, turnEvents, () => {
      openLesson(entry.turn);
      if (entry.changedTerritories.length) app.map.focus(entry.changedTerritories);
      if (state.gameOver) showEnding();
    });
    if (audioReady() && audio.enabled) playNarration(entry.turn);
    if (entry.mapWarning) {
      toast('The story described a change the map could not apply — try naming the exact territory.', true);
    }
  } catch (err) {
    app.busy = false;
    clearInterval(timer);
    audio.stop();
    $('#order').value = order;
    renderAll();
    toast(err.message, true);
  }
}

// The one deliberate animation: the calendar rolls month by month.
async function rollDate(from, to) {
  const el = $('.datestamp');
  let i = from.year * 12 + from.month - 1;
  const end = to.year * 12 + to.month - 1;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || end - i < 1) return;
  while (i < end) {
    i++;
    $('#date').textContent = fmtDate({ year: Math.floor(i / 12), month: (i % 12) + 1 });
    el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip');
    audio.playSfx('time_tick');
    await new Promise(r => setTimeout(r, 260));
  }
}

// ---------------- event popup ----------------
// The centred "what happened" window shown after every order. The map focus
// and the history lesson wait until the student acknowledges it with OK.
function openEventPopup(entry, turnEvents, onClose) {
  const image = pickEventImage(app.eventImages, entry, turnEvents);
  $('#event .sheet').innerHTML = eventPopupHTML(entry, app.state, {
    image, summary: summaryFromNarrative(entry)
  });
  const box = $('#event');
  app.eventClose = typeof onClose === 'function' ? onClose : null;
  box.hidden = false;
  box.querySelector('.event-continue')?.focus();
}
function closeEventPopup() {
  const box = $('#event');
  if (box.hidden) return;
  box.hidden = true;
  const cb = app.eventClose;
  app.eventClose = null;
  if (cb) cb();
  $('#order')?.focus();
}

// ---------------- lesson drawer ----------------
function openLesson(turn) {
  const entry = app.state.journal.find(j => j.turn === turn) || app.state.journal.at(-1);
  if (!entry) { toast('Lessons appear after your first turn.'); return; }
  app.lessonTurn = entry.turn;
  $('#drawer-body').innerHTML = lessonHTML(entry);
  $('#drawer').classList.add('open');
  $('#drawer').setAttribute('aria-hidden', 'false');
}
function closeLesson() {
  $('#drawer').classList.remove('open');
  $('#drawer').setAttribute('aria-hidden', 'true');
}

// ---------------- start screen ----------------
function nationOptionsHTML(sc) {
  return (sc.playable || []).map((n, i) => `
    <label><input type="radio" name="player" value="${esc(n.tag)}" ${i === 0 ? 'checked' : ''}>
      <span class="n"><span class="swatch" style="${swatchStyle(n)}"></span>${esc(n.name)}</span>
      <span class="l">${esc(n.leader)}</span></label>`).join('');
}

function startSheetHTML(selectedId, saves, keep = {}) {
  const scenarios = app.info.scenarios || [];
  const sc = scenarios.find(s => s.id === selectedId) || scenarios[0] || { playable: [], briefing: [] };
  const cur = app.state;
  const lang = keep.lang || app.info.languages[0].id;
  const realism = keep.realism || 'historical';
  const first = (sc.playable || [])[0];
  return `
    ${cur ? '<button class="close" data-close type="button" aria-label="Close">×</button>' : ''}
    <div>
      <h1 id="start-title">${esc(sc.title || app.info.scenario?.title || 'The Storm Breaks')}</h1>
      <p class="dateline">${esc(sc.subtitle || '')}</p>
      <div class="scenario-cards">
        ${scenarios.map(s => `
          <label class="scenario-card${s.id === selectedId ? ' selected' : ''}">
            <input type="radio" name="scenario" value="${esc(s.id)}" ${s.id === selectedId ? 'checked' : ''}>
            <span class="sc-title">${esc(s.title)}</span>
            <span class="sc-sub">${esc(s.subtitle || '')}</span>
          </label>`).join('')}
      </div>
      <div class="briefing">
        ${(sc.briefing || []).map(b => `<h3>${esc(b.heading)}</h3><p>${esc(b.text)}</p>`).join('')}
      </div>
    </div>
    <form class="picker" id="start-form">
      <h2>Choose your nation</h2>
      <div class="nations">${nationOptionsHTML(sc)}</div>
      <div id="country-detail">${first ? countryDetailHTML(sc, first.tag, portraitFor(first)) : ''}</div>
      <label class="field"><span>Your name (for the journal)</span><input type="text" name="studentName" maxlength="60" placeholder="Optional" value="${esc(keep.studentName || '')}"></label>
      <div class="field"><span>How strict is history?</span>
        <div class="radio-row">
          <label><input type="radio" name="realism" value="historical" ${realism === 'historical' ? 'checked' : ''}><b>Historical</b>Orders must be possible with the armies, money and politics of the time.</label>
          <label><input type="radio" name="realism" value="sandbox" ${realism === 'sandbox' ? 'checked' : ''}><b>Sandbox</b>Bold “what if” orders usually succeed, with realistic costs.</label>
        </div>
      </div>
      <label class="field"><span>Story language</span>
        <select name="lang">${app.info.languages.map(l => `<option value="${esc(l.id)}" ${l.id === lang ? 'selected' : ''}>${esc(l.label)}</option>`).join('')}</select>
      </label>
      <div class="start-actions">
        <button class="btn primary" type="submit">Begin campaign</button>
        ${cur ? `<button class="btn" type="button" data-close>Continue ${esc(cur.nations[cur.player].name)}, ${esc(fmtDate(cur.date))}</button>` : ''}
      </div>
      ${saves.length ? `<div class="saves">Load a saved game: ${saves.slice(0, 6).map(s => `<button type="button" data-load="${esc(s.name)}">${esc(s.name)}</button>`).join('')}</div>` : ''}
    </form>`;
}

async function openStart() {
  const saves = await api.saves().catch(() => []);
  const scenarios = app.info.scenarios || [];
  const selected = app.state?.scenarioId && scenarios.some(s => s.id === app.state.scenarioId)
    ? app.state.scenarioId : scenarios[0]?.id;
  const sheet = $('#start .sheet');
  sheet.innerHTML = startSheetHTML(selected, saves);
  $('#start').hidden = false;
  wireStartSheet(saves, selected);
  previewScenarioMusic(selected);
  sheet.querySelector('input[name=player]')?.focus();
}

function wireStartSheet(saves, selectedId) {
  const sheet = $('#start .sheet');
  const scenarios = app.info.scenarios || [];
  const sc = scenarios.find(s => s.id === selectedId) || scenarios[0] || { playable: [] };
  const detail = sheet.querySelector('#country-detail');
  sheet.querySelectorAll('input[name=player]').forEach(r => r.addEventListener('change', () => {
    const n = (sc.playable || []).find(p => p.tag === r.value);
    if (detail && n) detail.innerHTML = countryDetailHTML(sc, r.value, portraitFor(n));
  }));
  sheet.querySelectorAll('input[name=scenario]').forEach(r => r.addEventListener('change', () => {
    const form = sheet.querySelector('#start-form');
    const fd = new FormData(form);
    sheet.innerHTML = startSheetHTML(r.value, saves, {
      studentName: fd.get('studentName'), realism: fd.get('realism'), lang: fd.get('lang')
    });
    wireStartSheet(saves, r.value);
    previewScenarioMusic(r.value);
  }));
}

async function startGame(form) {
  const fd = new FormData(form);
  // The scenario radios sit outside the form (in the briefing column), so they
  // are not part of FormData — read the checked one from the sheet directly.
  const scenarioId = document.querySelector('#start input[name="scenario"]:checked')?.value
    || app.info.scenarios?.[0]?.id;
  try {
    app.state = await api.newGame({
      scenarioId, player: fd.get('player'), studentName: fd.get('studentName'),
      realism: fd.get('realism'), lang: fd.get('lang')
    });
    const sc = activeScenario();
    // A scenario may use a different map file; reload so the map geometry matches.
    if (sc.mapFile && app.mapFile && sc.mapFile !== app.mapFile) { location.reload(); return; }
    app.selected = app.state.player;
    audio.stop();
    $('#start').hidden = true;
    $('#ending').hidden = true;
    $('#event').hidden = true;
    app.eventClose = null;
    closeLesson();
    setDossier(false);
    setAdvisors(false);
    renderAll();
    syncMusic();
    applyInitialCamera(app.map, app.state, { defaultView: sc.defaultView || 'world' });
    $('#order').focus();
  } catch (err) { toast(err.message, true); }
}

// ---------------- other modals ----------------
async function openHood() {
  const debug = await api.debug().catch(() => null);
  $('#hood .sheet').innerHTML = hoodHTML(debug, app.info);
  $('#hood').hidden = false;
}

async function showEnding() {
  const s = app.state;
  const p = s.nations[s.player];
  audio.playSfx('campaign_end');
  const sheet = $('#ending .sheet');
  sheet.innerHTML = `
    <button class="close" data-close type="button" aria-label="Close">×</button>
    <h2>The campaign is over</h2>
    <p>${esc(s.gameOver?.reason || 'The campaign has ended.')}</p>
    <p>You led ${esc(p.name)} for ${s.journal.length} turns, reaching ${esc(fmtDate(s.date))}.</p>
    <div id="report-box"><p class="empty">The examiner is writing your after-action report…</p></div>`;
  $('#ending').hidden = false;
  if (s.report) {
    $('#report-box').innerHTML = reportHTML(s.report, s);
    return;
  }
  try {
    const report = await api.report();
    s.report = report;
    $('#report-box').innerHTML = reportHTML(report, s);
  } catch (err) {
    $('#report-box').innerHTML = `<p class="error">The report could not be generated: ${esc(err.message)}</p>`;
  }
}

let toastTimer;
function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('error', isError);
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, isError ? 7000 : 3500);
}

// ---------------- events ----------------
function wireUI() {
  $('#log').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-narrate]');
    if (btn) toggleNarration(Number(btn.dataset.narrate));
  });
  $('#narration-toggle').addEventListener('click', () => toggleNarrationPref());
  $('#narration-rate').addEventListener('input', (e) => {
    audio.setRate(e.target.value);
    syncNarrationControls();
  });
  $('#order-form').addEventListener('submit', (e) => { e.preventDefault(); sendOrder($('#order').value); });
  $('#order').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendOrder($('#order').value); }
  });
  $('#suggestions').addEventListener('click', (e) => {
    const b = e.target.closest('[data-suggest]');
    if (b) { $('#order').value = b.dataset.suggest; $('#order').focus(); }
  });

  document.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) { app.tab = b.dataset.tab; renderLedger(); }
  });
  $('.ledger').addEventListener('click', (e) => {
    if (e.target.closest('#btn-dossier')) return setDossier(!app.dossierOpen);
    const sel = e.target.closest('[data-select]');
    if (sel) return select(sel.dataset.select);
    const j = e.target.closest('li[data-turn]');
    if (j) openLesson(Number(j.dataset.turn));
  });
  $('#dossier').addEventListener('click', (e) => {
    if (e.target.closest('[data-close-dossier]')) return setDossier(false);
    const row = e.target.closest('[data-select]');
    if (row) select(row.dataset.select);
  });
  $('#dossier').addEventListener('keydown', (e) => {
    const row = e.target.closest('[data-select]');
    if (row && e.key === 'Enter') select(row.dataset.select);
  });
  $('#advisor-bar').addEventListener('click', (e) => {
    const r = e.target.closest('[data-adv-role]');
    if (r) return setAdvisors(!(app.advisorsOpen && app.advisorRole === r.dataset.advRole), r.dataset.advRole);
    if (e.target.closest('#btn-advisors')) setAdvisors(!app.advisorsOpen);
  });
  $('#advisors').addEventListener('click', (e) => {
    if (e.target.closest('[data-close-advisors]')) return setAdvisors(false);
    const r = e.target.closest('[data-adv-role]');
    if (r) return setAdvisors(true, r.dataset.advRole);
    const use = e.target.closest('[data-advice]');
    if (use) {
      const ta = $('#order');
      ta.value = use.dataset.advice;
      setAdvisors(false);
      ta.focus();
    }
  });
  $('#intel').addEventListener('click', (e) => {
    if (e.target.closest('[data-close-intel]')) select(app.state.player);
  });
  $('.ledger').addEventListener('keydown', (e) => {
    const j = e.target.closest('li[data-turn]');
    if (j && e.key === 'Enter') openLesson(Number(j.dataset.turn));
  });

  document.querySelector('.views').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (b) app.map.view(b.dataset.view);
  });
  $('#milestones').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ev]');
    if (!b) return;
    const ev = app.state.events[Number(b.dataset.ev)];
    if (ev.territories?.length) { app.map.focus(ev.territories); app.map.pulse(ev.territories); }
    toast(`${fmtDate(ev.date)}: ${ev.title}. ${ev.description || ''}`);
  });

  $('#btn-lesson').addEventListener('click', () => $('#drawer').classList.contains('open') ? closeLesson() : openLesson(app.lessonTurn));
  $('#drawer-close').addEventListener('click', closeLesson);
  $('#drawer').addEventListener('click', async (e) => {
    if (e.target.id !== 'save-reflection') return;
    const ta = $('#reflection');
    try {
      await api.reflection(Number(ta.dataset.turn), ta.value);
      const entry = app.state.journal.find(j => j.turn === Number(ta.dataset.turn));
      if (entry) entry.reflection = ta.value;
      $('#saved-note').hidden = false;
      if (app.tab === 'journal') renderLedger();
    } catch (err) { toast(err.message, true); }
  });

  $('#btn-hood').addEventListener('click', openHood);
  $('#btn-menu').addEventListener('click', openStart);
  $('#btn-finish').addEventListener('click', async () => {
    if (!app.state || app.state.gameOver) return;
    if (!confirm('End the campaign now and generate your after-action report?')) return;
    try {
      app.state = await api.finish();
      renderAll();
      showEnding();
    } catch (err) { toast(err.message, true); }
  });
  $('#btn-save').addEventListener('click', async () => {
    if (!app.state) return;
    const name = prompt('Name this save', `${app.state.nations[app.state.player].name}-${fmtDate(app.state.date)}`.replace(/\s+/g, '-'));
    if (!name) return;
    try { const r = await api.save(name); toast(`Saved as “${r.name}”.`); } catch (err) { toast(err.message, true); }
  });

  // Modals: close buttons, start form, loading saves, manual actions
  document.addEventListener('click', async (e) => {
    if (e.target.closest('[data-close-event]')) return closeEventPopup();
    const overlay = e.target.closest('.overlay');
    if (e.target.closest('[data-close]') && overlay && app.state) {
      overlay.hidden = true;
      if (overlay.id === 'start') syncMusic();
    }
    if (e.target.classList.contains('overlay') && e.target.id !== 'event' && app.state) {
      e.target.hidden = true;
      if (e.target.id === 'start') syncMusic();
    }
    if (e.target.closest('[data-newgame]')) { $('#ending').hidden = true; openStart(); }
    const load = e.target.closest('[data-load]');
    if (load) {
      try {
        app.state = await api.load(load.dataset.load);
        app.selected = app.state.player;
        setDossier(false);
        setAdvisors(false);
        audio.stop();
        $('#start').hidden = true;
        $('#event').hidden = true;
        app.eventClose = null;
        renderAll();
        syncMusic();
        applyInitialCamera(app.map, app.state, {
          defaultView: activeScenario().defaultView || 'world'
        });
        toast(`Loaded “${load.dataset.load}”.`);
      } catch (err) { toast(err.message, true); }
    }
    if (e.target.id === 'apply-manual') {
      let actions;
      try { actions = JSON.parse($('#manual-actions').value); } catch { return toast('That is not valid JSON. Check brackets and quotes.', true); }
      try {
        const r = await api.actions(Array.isArray(actions) ? actions : [actions]);
        app.state = r.state;
        $('#manual-result').innerHTML =
          r.applied.map(a => `<li>${esc(a.summary)}</li>`).join('') +
          r.rejected.map(x => `<li class="rej">Rejected: ${esc(x.reason)}</li>`).join('');
        renderAll({ changed: r.state.lastChangedTerritories });
      } catch (err) { toast(err.message, true); }
    }
    if (e.target.id === 'report-regen') {
      const btn = e.target;
      btn.disabled = true; btn.textContent = 'Regenerating…';
      try {
        const report = await api.report(true);
        app.state.report = report;
        $('#report-box').innerHTML = reportHTML(report, app.state);
      } catch (err) { toast(err.message, true); btn.disabled = false; btn.textContent = 'Regenerate with AI'; }
    }
  });
  $('#start').addEventListener('submit', (e) => { e.preventDefault(); startGame(e.target); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('#event').hidden) closeEventPopup();
      else if (!$('#hood').hidden) $('#hood').hidden = true;
      else if (!$('#start').hidden && app.state) $('#start').hidden = true;
      else if (app.advisorsOpen) setAdvisors(false);
      else if (app.dossierOpen) setDossier(false);
      else if (app.state && app.selected && app.selected !== app.state.player) select(app.state.player);
      else if ($('#drawer').classList.contains('open')) closeLesson();
      return;
    }
    if (e.key === 'l' || e.key === 'L') {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!audioReady()) return;
      e.preventDefault();
      toggleNarrationPref();
    }
  });
}

boot().catch(err => {
  console.error(err);
  toast(`The game could not start: ${err.message}. Is the server running (npm start)?`, true);
});
