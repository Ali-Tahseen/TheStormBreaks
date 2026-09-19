// Pure functions that turn game state into HTML for the panels.
// No fetching and no side effects here — app.js wires events.

import { swatchStyle } from './flags.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const fmtDate = (d) => `${MONTHS[d.month - 1]} ${d.year}`;

export const warsOf = (state, tag) => state.wars.filter(w => w.includes(tag)).map(([a, b]) => (a === tag ? b : a));
const relKey = (a, b) => [a, b].sort().join('|');
export const relation = (state, a, b) => state.relations[relKey(a, b)] ?? 0;

// ---------- shared helpers ----------
const ROLE_LABELS = { economy: 'Economic advisor', diplomacy: 'Diplomat', military: 'Military advisor' };
const OUTLOOK_LABELS = { good: 'Good', steady: 'Steady', worrying: 'Worrying', critical: 'Critical' };

const fmtVal = (key, v) => key === 'gdp' ? Math.round(v) : key === 'manpower' ? Number(v).toFixed(1) : Math.round(v);
const signed = (d) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(Math.round(d * 10) / 10)}`;
const deltaHTML = (d, title = 'Change last turn') => d
  ? `<span class="d ${d > 0 ? 'up' : 'down'}" title="${esc(title)}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</span>` : '';
const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

export function relationWord(r) {
  if (r >= 60) return 'Allied';
  if (r >= 25) return 'Friendly';
  if (r > -25) return 'Neutral';
  if (r > -60) return 'Unfriendly';
  return 'Hostile';
}

function relBar(r) {
  const w = Math.abs(r) / 2;
  const fill = r >= 0
    ? `<i style="left:50%;width:${w}%;background:var(--gain)"></i>`
    : `<i style="right:50%;width:${w}%;background:var(--loss)"></i>`;
  return `<span class="rel" title="${r}">${fill}</span>`;
}

// Nations worth listing in diplomacy views: majors, plus minors that matter.
function notableNations(state) {
  return Object.values(state.nations).filter(n => n.tag !== state.player &&
    (!n.minor || n.faction || warsOf(state, n.tag).length));
}

function rankOf(state, key, tag) {
  const vals = Object.values(state.nations).filter(n => !n.capitulated).map(n => ({ tag: n.tag, v: n.indicators[key] }))
    .sort((a, b) => b.v - a.v);
  return vals.findIndex(x => x.tag === tag) + 1;
}

const territoriesOf = (state, tag) => Object.keys(state.territories).filter(t => state.territories[t].owner === tag);

// ---------- compact panel: your nation ----------
export function nationCard(state, { dossierOpen = false } = {}) {
  const n = state.nations[state.player];
  if (!n) return '';
  const wars = warsOf(state, n.tag).map(t => state.nations[t]?.name).filter(Boolean);
  return `
    <span class="flag" style="${swatchStyle(n)}" aria-hidden="true"></span>
    <div class="nc-main">
      <h2>${esc(n.name)} <span class="you">(you)</span></h2>
      <div class="sub">${esc(n.leader)} · ${esc(n.ideology)}${n.faction ? ` · ${esc(n.faction)}` : ''}</div>
      <div class="wars">${n.capitulated ? 'Defeated' : wars.length ? `At war with ${esc(wars.join(', '))}` : '<span class="muted">At peace</span>'}</div>
    </div>
    <button class="btn details-btn" id="btn-dossier" type="button" aria-expanded="${dossierOpen}" aria-controls="dossier"
      title="Open the full country report">Details <span aria-hidden="true">${dossierOpen ? '▴' : '▾'}</span></button>`;
}

function statTile(state, key, def) {
  const n = state.nations[state.player];
  const v = n.indicators[key] ?? 0;
  const d = state.lastDeltas?.[n.tag]?.[key];
  const pct = def.max === 100;
  const note = !pct ? `<span class="stat-note">${ordinal(rankOf(state, key, n.tag))} in the world</span>` : '';
  return `<div class="stat${pct && v < 30 ? ' low' : ''}" title="${esc(def.help)}">
      <span class="stat-label">${esc(def.label)}</span>
      <span class="stat-value">${fmtVal(key, v)}${def.unit ? `<small> ${esc(def.unit)}</small>` : ''}${deltaHTML(d)}</span>
      <span class="stat-foot">${pct ? `<span class="bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></span>` : note}</span>
    </div>`;
}

export function statsTab(state, indicators, tab) {
  const defs = Object.entries(indicators).filter(([, d]) => d.tab === tab);
  return `<div class="stats" style="--cols:${defs.length}">${defs.map(([k, d]) => statTile(state, k, d)).join('')}</div>`;
}

export function diplomacyMini(state) {
  const me = state.player;
  const n = state.nations[me];
  const wars = warsOf(state, me).map(t => state.nations[t]).filter(Boolean);
  const others = notableNations(state).filter(o => !o.capitulated)
    .map(o => ({ o, r: relation(state, me, o.tag) }));
  const best = others.filter(x => x.r > 0).sort((a, b) => b.r - a.r).slice(0, 2);
  const worst = others.filter(x => x.r < 0 && !wars.includes(x.o)).sort((a, b) => a.r - b.r).slice(0, 2);
  const chip = ({ o, r }) => `<button type="button" class="nchip" data-select="${esc(o.tag)}" title="${esc(o.name)}: ${esc(relationWord(r))} (${r})">
      <span class="swatch" style="${swatchStyle(o)}"></span>${esc(o.name)} <b class="${r >= 0 ? 'pos' : 'neg'}">${signed(r)}</b></button>`;
  const warChips = wars.map(w => `<button type="button" class="nchip war" data-select="${esc(w.tag)}" title="At war with ${esc(w.name)}"><span class="swatch" style="${swatchStyle(w)}"></span>${esc(w.name)}</button>`).join('');
  return `<dl class="dip-mini">
      <dt>Status</dt><dd>${n.faction ? `<span class="badge faction">${esc(n.faction)}</span>` : '<span class="muted">No faction</span>'}${wars.length ? `<span class="muted">at war with</span>${warChips}` : '<span class="muted">· at peace</span>'}</dd>
      <dt>Best</dt><dd>${best.map(chip).join('') || '<span class="muted">No friendly powers yet</span>'}</dd>
      <dt>Worst</dt><dd>${worst.map(chip).join('') || '<span class="muted">No hostile powers</span>'}</dd>
    </dl>`;
}

export function journalMini(state) {
  if (!state.journal.length) {
    return `<p class="empty">Your decisions and lessons are collected here, turn by turn.</p>`;
  }
  const items = [...state.journal].reverse().map(j => `
    <li data-turn="${j.turn}" tabindex="0" title="Open the lesson for this turn">
      <span class="when">T${j.turn} · ${esc(j.dateBefore)}${j.reflection ? ' · ✎' : ''}</span>
      <span class="what">${esc(j.headline)}</span>
    </li>`).join('');
  return `<ul class="journal-mini">${items}</ul>
    <a class="journal-dl" href="/api/journal.md" download="leaders-journal.md">Download journal</a>`;
}

// ---------- intel card: limited information about another nation ----------
function estimate(key, v) {
  if (key === 'gdp') return v >= 600 ? 'Huge' : v >= 250 ? 'Very large' : v >= 100 ? 'Large' : v >= 30 ? 'Medium' : 'Small';
  if (key === 'stability') return v >= 70 ? 'Stable' : v >= 45 ? 'Steady' : v >= 25 ? 'Shaky' : 'In crisis';
  return v >= 80 ? 'Formidable' : v >= 60 ? 'Strong' : v >= 40 ? 'Moderate' : v >= 20 ? 'Weak' : 'Negligible';
}

export function intelCard(state, tag, portrait) {
  const n = state.nations[tag];
  if (!n || tag === state.player) return '';
  const me = state.player;
  const r = relation(state, me, tag);
  const atWarWithMe = warsOf(state, tag).includes(me);
  const held = territoriesOf(state, tag).length;
  const theirWars = warsOf(state, tag).filter(t => t !== me).map(t => state.nations[t]?.name).filter(Boolean);
  const I = n.indicators;
  const est = [['Economy', 'gdp'], ['Army', 'army'], ['Navy', 'navy'], ['Air force', 'air'], ['Government', 'stability']]
    .map(([label, k]) => `<dt>${label}</dt><dd>${estimate(k, I[k] ?? 0)}</dd>`).join('');
  return `
    <button class="close" type="button" data-close-intel aria-label="Close">×</button>
    <div class="intel-head">
      ${portrait ? `<img class="intel-portrait" src="${esc(portrait.src)}" alt="Portrait of ${esc(portrait.name)}" loading="lazy">` : ''}
      <div>
        <h3><span class="swatch" style="${swatchStyle(n)}"></span>${esc(n.name)}</h3>
        <div class="sub">${esc(n.leader)} · ${esc(n.ideology)}</div>
        ${n.faction ? `<span class="badge faction">${esc(n.faction)}</span>` : ''}
        ${n.capitulated ? '<span class="badge">defeated</span>' : ''}
      </div>
    </div>
    <div class="intel-rel">
      ${atWarWithMe ? '<b class="war-note">At war with you</b>' : `Relations with you: ${relBar(r)} <b>${signed(r)}</b> <span class="muted">${relationWord(r)}</span>`}
    </div>
    <p class="intel-line">${held} ${held === 1 ? 'province' : 'provinces'}${theirWars.length ? ` · at war with ${esc(theirWars.slice(0, 3).join(', '))}${theirWars.length > 3 ? '…' : ''}` : ''}</p>
    <div class="intel-est-title">Intelligence estimate</div>
    <dl class="intel-est">${est}</dl>
    <p class="intel-foot">Exact figures are only known for your own country.</p>`;
}

// ---------- dossier: the detailed country report (your nation only) ----------
function indicatorRows(state, indicators, tab, since) {
  const n = state.nations[state.player];
  const ini = state.initial?.indicators?.[n.tag] || {};
  return Object.entries(indicators).filter(([, d]) => d.tab === tab).map(([k, def]) => {
    const v = n.indicators[k] ?? 0;
    const ch = typeof ini[k] === 'number' ? Math.round((v - ini[k]) * 10) / 10 : 0;
    const pct = def.max === 100;
    const last = state.lastDeltas?.[n.tag]?.[k];
    return `<li class="${pct && v < 30 ? 'low' : ''}">
      <div class="ir-top">
        <b>${esc(def.label)}</b>
        <span class="ir-val">${fmtVal(k, v)}${def.unit ? `<small> ${esc(def.unit)}</small>` : ''}</span>
      </div>
      ${pct ? `<span class="bar wide${v < 30 ? ' low' : ''}" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></span>` : ''}
      <div class="ir-meta">
        ${pct ? '' : `<span>${ordinal(rankOf(state, k, n.tag))} in the world</span>`}
        <span>Last turn: ${last ? `<b class="${last > 0 ? 'pos' : 'neg'}">${signed(last)}</b>` : 'no change'}</span>
        <span>Since ${esc(since)}: ${ch ? `<b class="${ch > 0 ? 'pos' : 'neg'}">${signed(ch)}</b>` : 'no change'}</span>
      </div>
      <p class="ir-help">${esc(def.help)}</p>
    </li>`;
  }).join('');
}

export function dossierHTML(state, indicators, portrait) {
  const me = state.player;
  const n = state.nations[me];
  const name = (t) => state.nations[t]?.name || t;
  const wars = warsOf(state, me).map(name);
  const held = territoriesOf(state, me);
  const occupiedHome = held.filter(t => Object.keys(state.territories[t].occupation || {}).length)
    .map(t => `${esc(t)} <span class="muted">(${Object.entries(state.territories[t].occupation).map(([o, v]) => `${esc(name(o))} ${v}%`).join(', ')})</span>`);
  const abroad = Object.entries(state.territories).filter(([, t]) => t.owner !== me && t.occupation?.[me])
    .map(([t, x]) => `${esc(t)} <span class="muted">(${x.occupation[me]}%)</span>`);
  const rels = notableNations(state).filter(o => !o.capitulated)
    .map(o => ({ o, r: relation(state, me, o.tag), war: warsOf(state, me).includes(o.tag) }))
    .sort((a, b) => b.r - a.r);
  const since = state.events?.[0]?.date ? fmtDate(state.events[0].date) : 'the start';
  const section = (title, tab) => `
    <h3>${title}</h3>
    <ul class="ind-list">${indicatorRows(state, indicators, tab, since)}</ul>`;
  const portraitBlock = portrait
    ? `<figure class="portrait">
        <div class="portrait-frame"><img src="${esc(portrait.src)}" alt="Portrait of ${esc(portrait.name)}"></div>
        <figcaption><b>${esc(portrait.name)}</b>${esc(portrait.role)}${portrait.headOfState ? `<em>Head of state. Head of government: ${esc(n.leader)}</em>` : ''}</figcaption>
      </figure>`
    : `<figure class="portrait">
        <div class="portrait-frame empty"><span class="flag-big" style="${swatchStyle(n)}"></span></div>
        <figcaption><b>${esc(n.leader)}</b>No portrait available</figcaption>
      </figure>`;
  return `
    <div class="dossier-inner">
      <button class="close" type="button" data-close-dossier aria-label="Close the country report">×</button>
      <header class="dossier-head">
        ${portraitBlock}
        <div class="dossier-id">
          <div class="kicker">Country report · ${esc(fmtDate(state.date))}</div>
          <h2><span class="swatch" style="${swatchStyle(n)}"></span>${esc(n.name)}</h2>
          <dl class="facts">
            <dt>Leader</dt><dd>${esc(n.leader)}</dd>
            <dt>Government</dt><dd>${esc(n.ideology)}</dd>
            <dt>Faction</dt><dd>${n.faction ? esc(n.faction) : '<span class="muted">None</span>'}</dd>
            <dt>Status</dt><dd class="${wars.length ? 'neg' : ''}">${n.capitulated ? 'Defeated' : wars.length ? `At war with ${esc(wars.join(', '))}` : 'At peace'}</dd>
            <dt>Territory</dt><dd>${held.length} ${held.length === 1 ? 'province' : 'provinces'}</dd>
          </dl>
        </div>
      </header>
      ${section('Economy', 'economy')}
      ${section('Military', 'military')}
      ${section('Politics', 'politics')}
      <h3>Territory</h3>
      <dl class="terr">
        <dt>Provinces held</dt><dd>${held.map(esc).join(', ') || '<span class="muted">None</span>'}</dd>
        <dt>Enemy forces inside your borders</dt><dd>${occupiedHome.join('; ') || '<span class="muted">None</span>'}</dd>
        <dt>Your forces abroad</dt><dd>${abroad.join('; ') || '<span class="muted">None</span>'}</dd>
      </dl>
      <h3>Diplomacy</h3>
      <table class="dossier-rel">
        <thead><tr><th>Nation</th><th>Faction</th><th>Relations with you</th></tr></thead>
        <tbody>${rels.map(({ o, r, war }) => `
          <tr data-select="${esc(o.tag)}" tabindex="0">
            <td><span class="nm"><span class="swatch" style="${swatchStyle(o)}"></span>${esc(o.name)}</span></td>
            <td>${o.faction ? `<span class="badge faction">${esc(o.faction)}</span>` : '<span class="muted">–</span>'}</td>
            <td>${war ? '<span class="badge">at war</span>' : `${relBar(r)} <b class="${r >= 0 ? 'pos' : 'neg'}">${signed(r)}</b> <span class="muted">${relationWord(r)}</span>`}</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

// ---------- advisors ----------
// The bar under the log: one button per advisor (with an outlook dot) that
// opens that advisor's note, plus a toggle for the whole briefing.
export function advisorBarHTML(state, { open = false, role = null, unseen = false } = {}) {
  const a = state.advisors;
  const roles = Object.keys(ROLE_LABELS).map(r => {
    const o = a?.[r]?.outlook || 'steady';
    const on = open && role === r;
    return `<button type="button" class="adv-dot ${esc(o)}" data-adv-role="${r}" aria-pressed="${on}" ${a ? '' : 'disabled'}
      title="${esc(ROLE_LABELS[r])}: outlook ${esc((OUTLOOK_LABELS[o] || o).toLowerCase())}"><i></i>${esc(ROLE_LABELS[r].split(' ')[0])}</button>`;
  }).join('');
  return `<div class="advisor-toggle${open ? ' open' : ''}">
      <button type="button" id="btn-advisors" class="adv-title" aria-expanded="${open}" aria-controls="advisors" ${a ? '' : 'disabled'}>
        Advisors${unseen ? '<span class="new-badge">new</span>' : ''} <span class="caret" aria-hidden="true">${open ? '▾' : '▴'}</span>
      </button>
      <span class="adv-dots">${roles}</span>
    </div>`;
}

export function advisorsHTML(state, role = 'economy') {
  const a = state.advisors;
  if (!a) return '<p class="empty">Your advisors will brief you after your next order.</p>';
  const when = a.turn ? `after turn ${a.turn}` : 'before your first order';
  const x = a[role] || a.economy;
  const tabs = Object.keys(ROLE_LABELS).map(r => `
    <button type="button" role="tab" data-adv-role="${r}" aria-selected="${r === role}" class="${esc(a[r]?.outlook || 'steady')}"><i></i>${esc(ROLE_LABELS[r])}</button>`).join('');
  return `<div class="adv-inner">
      <div class="adv-head">
        <div><b>Advisors’ briefing</b> <span class="muted">${esc(a.date)} · ${esc(when)}</span></div>
        <button class="close" type="button" data-close-advisors aria-label="Close the briefing">×</button>
      </div>
      <div class="adv-tabs" role="tablist">${tabs}</div>
      <article class="adv-card ${esc(x.outlook)}" role="tabpanel">
        <header><b>${esc(ROLE_LABELS[role])}</b><span class="outlook ${esc(x.outlook)}">${esc(OUTLOOK_LABELS[x.outlook] || x.outlook)}</span></header>
        <p><span class="lbl">At home</span>${esc(x.home)}</p>
        <p><span class="lbl">Abroad</span>${esc(x.abroad)}</p>
        <p class="advice"><span class="lbl">Suggests</span>${esc(x.advice)}
          <button type="button" class="use-advice" data-advice="${esc(x.advice)}" title="Copy this suggestion into your orders">Use as order</button></p>
      </article>
      <p class="adv-foot">Advisors only advise: their suggestions are not orders, and they can be wrong.${a.source === 'offline' ? ' (Offline demo briefing.)' : ''}</p>
    </div>`;
}

// ---------- orders log ----------
// The history clock's events for one turn. Events whose historical actor is
// the player's own nation were left for the player to decide; they render as
// a hint line instead of a map change.
function meanwhileHTML(j) {
  const list = j.meanwhile || [];
  if (!list.length) return '';
  const items = list.map(m => m.skippedReason
    ? `<p class="meanwhile-hint">Historically this month, ${esc(m.hint || m.blurb)} Your staff waits for your order.</p>`
    : `<p class="meanwhile-item"><span class="when">${esc(m.date)}</span> ${esc(m.blurb)}</p>`).join('');
  return `<div class="meanwhile"><h4>Meanwhile</h4>${items}</div>`;
}

export function logHTML(state, { audio = false } = {}) {
  const n = state.nations[state.player];
  const intro = `<p class="intro">You lead ${esc(n.name)} in ${esc(fmtDate(state.events[0]?.date || state.date))}. ${
    state.journal.length ? '' : 'Type an order in plain words: a policy, a treaty, a military plan, a speech. The AI game master decides what happens and how much time passes.'}</p>`;
  const turns = state.journal.slice(-15).map(j => `
    <div class="decree"><span class="who">${esc(n.leader)} orders, ${esc(j.dateBefore)}</span>${esc(j.order)}</div>
    <div class="skip">${j.monthsPassed} ${j.monthsPassed === 1 ? 'month passes' : 'months pass'}, to ${esc(j.dateAfter)}</div>
    <div class="outcome" data-turn="${j.turn}">
      <h3>${audio ? `<button type="button" class="narrate" data-narrate="${j.turn}" aria-pressed="false" aria-label="Play headline and summary">Play</button>` : ''}${esc(j.headline)}<span class="feas ${esc(j.feasibility)}">${esc(j.feasibility)}</span></h3>
      ${j.feasibilityReason ? `<p class="reason">${esc(j.feasibilityReason)}</p>` : ''}
      ${String(j.narrative).split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join('')}
      ${meanwhileHTML(j)}
      ${(j.reactions || []).map(r => `
        <div class="reaction"><b>${esc(r.leader || r.country)}</b> <span class="tag">(${esc(state.nations[r.country]?.name || r.country)}, in-game dialogue)</span><br>${esc(r.statement)}</div>`).join('')}
    </div>`).join('');
  return intro + turns;
}

// ---------- event popup (centred, HOI4-style) ----------
const FEAS_LABEL = { success: 'Success', partial: 'Partial', failed: 'Failed', refused: 'Refused' };

// The headline and short summary of the turn, shown in a wide centred window
// after every order: an archival photo on the left, the story on the right.
// `image` is an entry from public/img/events/manifest.json (or null).
export function eventPopupHTML(entry, state, { image = null, summary = '' } = {}) {
  const feas = FEAS_LABEL[entry?.feasibility] ? entry.feasibility : 'partial';
  const date = entry?.dateAfter || (state?.date ? fmtDate(state.date) : '');
  const figure = image ? `
        <figure class="event-figure">
          <img src="${esc(image.src)}" alt="${esc(image.alt || entry?.headline || 'Event')}" loading="lazy">
          ${image.credit ? `<figcaption>${esc(image.credit)}</figcaption>` : ''}
        </figure>` : '';
  return `
    <button class="event-close" type="button" data-close-event aria-label="Close">×</button>
    <div class="event-grid${image ? '' : ' no-image'}">${figure}
      <div class="event-body">
        <p class="event-eyebrow">A major event unfolds</p>
        <p class="event-date">${esc(date)}<span class="feas ${esc(feas)}">${esc(FEAS_LABEL[feas])}</span></p>
        <h2 id="event-title">${esc(entry?.headline || 'Events unfold')}</h2>
        ${summary ? `<p class="event-summary">${esc(summary)}</p>` : ''}
        <div class="event-actions">
          <button class="btn primary event-continue" type="button" data-close-event>Continue</button>
        </div>
      </div>
    </div>`;
}

// ---------- lesson drawer ----------
export function lessonHTML(entry) {
  const l = entry.lesson || {};
  return `
    <div class="kicker">Turn ${entry.turn}: ${esc(entry.dateBefore)} to ${esc(entry.dateAfter)}</div>
    <h2>${esc(l.title)}</h2>
    <h3>What really happened</h3><p>${esc(l.what_really_happened)}</p>
    ${l.how_your_timeline_differs ? `<h3>How your timeline differs</h3><p>${esc(l.how_your_timeline_differs)}</p>` : ''}
    ${l.why_it_matters ? `<h3>Why it matters</h3><p>${esc(l.why_it_matters)}</p>` : ''}
    ${l.key_terms?.length ? `<h3>Key terms</h3><dl>${l.key_terms.map(k => `<dt>${esc(k.term)}</dt><dd>${esc(k.definition)}</dd>`).join('')}</dl>` : ''}
    ${l.exam_skill ? `<h3>Exam skill</h3><p>${esc(l.exam_skill)}</p>` : ''}
    <div class="question">
      <p>${esc(l.reflection_question)}</p>
      <label for="reflection" class="muted" style="font-size:13px">Your answer (saved to your journal)</label>
      <textarea id="reflection" data-turn="${entry.turn}">${esc(entry.reflection || '')}</textarea>
      <button class="btn" id="save-reflection" type="button">Save answer</button><span class="saved" id="saved-note" hidden>Saved</span>
    </div>`;
}

// ---------- under the hood ----------
export function hoodHTML(debug, info) {
  const pretty = (o) => esc(JSON.stringify(o, null, 2));
  const example = JSON.stringify([
    { type: 'occupy_territory', territory: 'Canada', occupier: 'GER', delta: 10, reason: 'Test' },
    { type: 'change_indicator', country: 'GER', indicator: 'stability', delta: -5, reason: 'Test' }
  ], null, 2);
  const agents = debug?.agents || [];
  return `
    <button class="close" data-close type="button" aria-label="Close">×</button>
    <h2 id="hood-title">Under the hood</h2>
    <p class="muted">What the AI agents received and returned for the last turn. Only the game engine changes the game; the agents can only propose actions.</p>
    <p>AI: <b>${info.llm.configured ? esc(`${info.llm.model} (${info.llm.baseUrl})`) : 'offline demo mode (no API key)'}</b></p>
    ${debug ? `
      <div class="pipeline">${['Your order', ...agents.map(a => a.agent), 'Game engine', 'Map'].map(s => {
        const a = agents.find(x => x.agent === s);
        return `<span class="${a?.error ? 'err' : ''}">${esc(s)}${a?.ms ? ` ${(a.ms / 1000).toFixed(1)}s` : ''}</span>`;
      }).join('<span aria-hidden="true" style="border:0;background:none">›</span>')}</div>
      ${agents.map(a => `
        <details><summary>${esc(a.agent)}${a.error ? ` failed: ${esc(a.error)}` : ''}</summary>
          <pre>REQUEST (user message, JSON)\n${pretty(a.request)}</pre>
          ${a.response ? `<pre>RESPONSE (JSON)\n${pretty(a.response)}</pre>` : ''}
        </details>`).join('')}
      <details open><summary>Actions applied by the engine (${debug.applied.length})</summary>
        <ul>${debug.applied.map(a => `<li><code>${esc(a.type)}</code> ${esc(a.summary)} <span class="muted">from ${esc(a.source)}</span></li>`).join('') || '<li>none</li>'}</ul>
      </details>
      <details ${debug.rejected.length ? 'open' : ''}><summary>Actions rejected (${debug.rejected.length})</summary>
        <ul>${debug.rejected.map(r => `<li class="rej"><code>${esc(r.action?.type)}</code> ${esc(r.reason)}</li>`).join('') || '<li>none</li>'}</ul>
      </details>` : '<p>No turn has been played yet.</p>'}
    <h3 style="margin-top:18px">Apply actions by hand</h3>
    <p class="muted">Paste a JSON array of actions to test the map without the AI. Allowed types: ${info.actionTypes.map(t => `<code>${esc(t)}</code>`).join(', ')}.</p>
    <textarea id="manual-actions">${esc(example)}</textarea>
    <div style="margin-top:8px"><button class="btn primary" id="apply-manual" type="button">Apply actions</button></div>
    <ul id="manual-result"></ul>`;
}

// ---------- end-of-campaign report ----------
const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export function reportHTML(report, state) {
  if (!report) {
    return `<p class="empty">The examiner is preparing your report…</p>`;
  }
  const o = report.overall || { score: 0, letter: '—', label: '' };
  const grades = Object.entries(report.grades || {}).map(([k, g]) => `
    <li class="grade">
      <div class="g-head"><span>${esc(titleCase(k))}</span><b>${esc(g.score)}</b></div>
      <span class="g-bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, g.score))}%"></i></span>
      <p class="muted">${esc(g.rationale)}</p>
    </li>`).join('');
  const decisions = (report.key_decisions || []).map(d => `
    <li class="decision ${esc(d.rating)}">
      <div class="when">Turn ${esc(d.turn)} · ${esc(d.rating)}</div>
      <div class="what">${esc(d.order)}</div>
      <div>${esc(d.outcome)}</div>
      <p class="muted">${esc(d.impact)}</p>
    </li>`).join('') || '<li class="muted">No decisions recorded.</li>';
  const diff = (report.timeline_diff || []).map(t => `
    <tr><td>${esc(t.real_history)}</td><td>${esc(t.your_timeline)}</td></tr>`).join('');
  const lessons = (report.lessons || []).map(l => `<li>${esc(l)}</li>`).join('');
  const m = report.metrics || {};
  const metrics = [
    ['Turns played', m.turns ?? '—'],
    ['Territories gained', (m.territoriesGained || []).length],
    ['Territories lost', (m.territoriesLost || []).length],
    ['Wars started', (m.warsStarted || []).length],
    ['Wars ended', (m.warsEnded || []).length],
    ['Enemies defeated', (m.enemiesDefeated || []).length]
  ].map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');

  return `
    <div class="report">
      <div class="report-head">
        <div>
          <div class="kicker">After-action report · ${esc(state.nations[state.player]?.name || '')}</div>
          <h2>${esc(report.period || '')}</h2>
          <p class="muted">${esc(report.summary || '')}</p>
        </div>
        <div class="overall">
          <div class="score">${esc(o.score)}<span>/100</span></div>
          <div class="letter">${esc(o.letter)} — ${esc(o.label)}</div>
        </div>
      </div>
      <h3>Grades</h3>
      <ul class="grades">${grades}</ul>
      <h3>Most important decisions</h3>
      <ul class="report-decisions">${decisions}</ul>
      ${diff ? `<h3>Real history vs your timeline</h3>
        <table class="diff"><thead><tr><th>Real history</th><th>Your timeline</th></tr></thead><tbody>${diff}</tbody></table>` : ''}
      ${lessons ? `<h3>Lessons</h3><ul class="report-lessons">${lessons}</ul>` : ''}
      <h3>Campaign metrics</h3>
      <table class="metrics">${metrics}</table>
      <div class="start-actions">
        <a class="btn" href="/api/report.md" download="campaign-report.md">Download report (Markdown)</a>
        <a class="btn" href="/api/report.json" download="campaign-report.json">Download report (JSON)</a>
        <a class="btn" href="/api/journal.md" download="leaders-journal.md">Download journal</a>
        <button class="btn" type="button" id="report-regen">Regenerate with AI</button>
      </div>
      <p class="muted small">Scores are combined by the game engine with fixed weights; the written grades come from the AI examiner. Metrics are computed deterministically from your saved game.</p>
    </div>`;
}
