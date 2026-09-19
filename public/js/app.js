// App controller: loads data, wires events, keeps panels and map in sync.

import { api, listen } from './api.js';
import { WorldMap } from './map.js';
import {
  esc, fmtDate, SUGGESTIONS, nationCard, indicatorTab, diplomacyTab, journalTab,
  logHTML, lessonHTML, hoodHTML
} from './panels.js';

const $ = (sel) => document.querySelector(sel);
const app = { info: null, state: null, selected: null, tab: 'economy', busy: false, map: null, lessonTurn: null };

// ---------------- boot ----------------
async function boot() {
  const [info, topo] = await Promise.all([api.info(), fetch('/data/world-1939.json').then(r => r.json())]);
  app.info = info;
  $('#ai-mode').textContent = info.llm.configured ? `AI: ${info.llm.model}` : 'Offline demo mode';

  app.map = new WorldMap($('#map'), topo, {
    onSelect: (tag) => select(tag),
    onHover: showTooltip,
    visibleArea
  });

  wireUI();
  renderLegend();

  if (info.hasGame) {
    try { app.state = await api.state(); } catch { app.state = null; }
  }
  if (app.state) {
    app.selected = app.state.player;
    renderAll();
    app.map.view('world', false);
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
  renderSuggestions();
  renderMilestones();
  app.map.render(s, { selected: app.selected, changed });
  $('#send').disabled = app.busy || !!s.gameOver;
}

function renderLedger() {
  const s = app.state;
  $('#nation-card').innerHTML = nationCard(s, app.selected || s.player);
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === app.tab)));
  let html;
  if (app.tab === 'diplomacy') html = diplomacyTab(s, app.selected);
  else if (app.tab === 'journal') html = journalTab(s);
  else html = indicatorTab(s, app.info, app.tab, app.selected);
  $('#tab-body').innerHTML = html;
}

function renderLog() {
  const log = $('#log');
  log.innerHTML = logHTML(app.state) + (app.busy ? '<div class="working" id="working">The game master is deciding what happens…</div>' : '');
  log.scrollTop = log.scrollHeight;
}

function renderSuggestions() {
  const list = SUGGESTIONS[app.state.player] || [];
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
    <span class="swatch" style="background:${esc(owner.color)}"></span> ${esc(owner.name)}${owner.tag === s.player ? ' (you)' : ''}
    ${occ ? `<br>Occupied by ${occ}` : ''}${war ? '<br><span style="color:var(--loss)">At war with you</span>' : ''}`;
  tip.hidden = false;
  const x = Math.min(innerWidth - 270, e.clientX + 14), y = Math.min(innerHeight - 90, e.clientY + 14);
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}

function select(tag) {
  app.selected = tag || app.state.player;
  renderLedger();
  app.map.render(app.state, { selected: app.selected });
}

// ---------------- turn ----------------
async function sendOrder(order) {
  if (!order.trim() || app.busy) return;
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
  try {
    const { entry, state } = await api.turn(order);
    app.state = state;
    app.busy = false;
    clearInterval(timer);
    await rollDate(fromDate, state.date);
    renderAll({ changed: entry.changedTerritories });
    openLesson(entry.turn);
    if (entry.changedTerritories.length) setTimeout(() => app.map.focus(entry.changedTerritories), 350);
    if (state.gameOver) setTimeout(showEnding, 1500);
  } catch (err) {
    app.busy = false;
    clearInterval(timer);
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
    await new Promise(r => setTimeout(r, 260));
  }
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
async function openStart() {
  const [nations, saves] = await Promise.all([api.playable(), api.saves().catch(() => [])]);
  const info = app.info;
  const cur = app.state;
  const sheet = $('#start .sheet');
  sheet.innerHTML = `
    ${cur ? '<button class="close" data-close type="button" aria-label="Close">×</button>' : ''}
    <div>
      <h1 id="start-title">${esc(info.scenario.title)}</h1>
      <p class="dateline">${esc(info.scenario.startDate)}. Lead a nation through the Second World War.</p>
      <div class="briefing">
        ${info.scenario.briefing.map(b => `<h3>${esc(b.heading)}</h3><p>${esc(b.text)}</p>`).join('')}
      </div>
    </div>
    <form class="picker" id="start-form">
      <h2>Choose your nation</h2>
      <div class="nations">
        ${nations.map((n, i) => `
          <label><input type="radio" name="player" value="${esc(n.tag)}" ${i === 0 ? 'checked' : ''}>
            <span class="n"><span class="swatch" style="background:${esc(n.color)}"></span>${esc(n.name)}</span>
            <span class="l">${esc(n.leader)}</span></label>`).join('')}
      </div>
      <label class="field"><span>Your name (for the journal)</span><input type="text" name="studentName" maxlength="60" placeholder="Optional"></label>
      <div class="field"><span>How strict is history?</span>
        <div class="radio-row">
          <label><input type="radio" name="realism" value="historical" checked><b>Historical</b>Orders must be possible with the armies, money and politics of the time.</label>
          <label><input type="radio" name="realism" value="sandbox"><b>Sandbox</b>Bold “what if” orders usually succeed, with realistic costs.</label>
        </div>
      </div>
      <label class="field"><span>Story language</span>
        <select name="lang">${info.languages.map(l => `<option value="${esc(l.id)}">${esc(l.label)}</option>`).join('')}</select>
      </label>
      <div class="start-actions">
        <button class="btn primary" type="submit">Begin campaign</button>
        ${cur ? `<button class="btn" type="button" data-close>Continue ${esc(cur.nations[cur.player].name)}, ${esc(fmtDate(cur.date))}</button>` : ''}
      </div>
      ${saves.length ? `<div class="saves">Load a saved game: ${saves.slice(0, 6).map(s => `<button type="button" data-load="${esc(s.name)}">${esc(s.name)}</button>`).join('')}</div>` : ''}
    </form>`;
  $('#start').hidden = false;
  sheet.querySelector('input[name=player]')?.focus();
}

async function startGame(form) {
  const fd = new FormData(form);
  try {
    app.state = await api.newGame({
      player: fd.get('player'), studentName: fd.get('studentName'),
      realism: fd.get('realism'), lang: fd.get('lang')
    });
    app.selected = app.state.player;
    $('#start').hidden = true;
    $('#ending').hidden = true;
    closeLesson();
    renderAll();
    app.map.view(['JAP', 'CHN'].includes(app.state.player) ? 'asia' : app.state.player === 'USA' ? 'world' : 'europe');
    $('#order').focus();
  } catch (err) { toast(err.message, true); }
}

// ---------------- other modals ----------------
async function openHood() {
  const debug = await api.debug().catch(() => null);
  $('#hood .sheet').innerHTML = hoodHTML(debug, app.info);
  $('#hood').hidden = false;
}

function showEnding() {
  const s = app.state;
  const p = s.nations[s.player];
  $('#ending .sheet').innerHTML = `
    <button class="close" data-close type="button" aria-label="Close">×</button>
    <h2>The campaign is over</h2>
    <p>${esc(s.gameOver.reason)}</p>
    <p>You led ${esc(p.name)} for ${s.journal.length} turns, reaching ${esc(fmtDate(s.date))}. Compare your path with real history in your journal, then answer the reflection questions you skipped.</p>
    <p><b>Debrief question:</b> which of your decisions mattered most, and was the outcome caused more by your choices or by things you could not control (geography, economy, other leaders)?</p>
    <div class="start-actions">
      <a class="btn primary" href="/api/journal.md" download="leaders-journal.md">Download journal</a>
      <button class="btn" type="button" data-newgame>New game</button>
    </div>`;
  $('#ending').hidden = false;
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
    const row = e.target.closest('tr[data-tag]');
    if (row) return select(row.dataset.tag);
    if (e.target.closest('[data-select="player"]')) return select(app.state.player);
    const j = e.target.closest('li[data-turn]');
    if (j) openLesson(Number(j.dataset.turn));
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
  $('#btn-save').addEventListener('click', async () => {
    if (!app.state) return;
    const name = prompt('Name this save', `${app.state.nations[app.state.player].name}-${fmtDate(app.state.date)}`.replace(/\s+/g, '-'));
    if (!name) return;
    try { const r = await api.save(name); toast(`Saved as “${r.name}”.`); } catch (err) { toast(err.message, true); }
  });

  // Modals: close buttons, start form, loading saves, manual actions
  document.addEventListener('click', async (e) => {
    const overlay = e.target.closest('.overlay');
    if (e.target.closest('[data-close]') && overlay && app.state) overlay.hidden = true;
    if (e.target.classList.contains('overlay') && app.state) e.target.hidden = true;
    if (e.target.closest('[data-newgame]')) { $('#ending').hidden = true; openStart(); }
    const load = e.target.closest('[data-load]');
    if (load) {
      try {
        app.state = await api.load(load.dataset.load);
        app.selected = app.state.player;
        $('#start').hidden = true;
        renderAll();
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
  });
  $('#start').addEventListener('submit', (e) => { e.preventDefault(); startGame(e.target); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#hood').hidden) $('#hood').hidden = true;
    else if (!$('#start').hidden && app.state) $('#start').hidden = true;
    else if ($('#drawer').classList.contains('open')) closeLesson();
  });
}

boot().catch(err => {
  console.error(err);
  toast(`The game could not start: ${err.message}. Is the server running (npm start)?`, true);
});
