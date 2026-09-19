// Pure functions that turn game state into HTML for the panels.
// No fetching and no side effects here — app.js wires events.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const fmtDate = (d) => `${MONTHS[d.month - 1]} ${d.year}`;

export const warsOf = (state, tag) => state.wars.filter(w => w.includes(tag)).map(([a, b]) => (a === tag ? b : a));
const relKey = (a, b) => [a, b].sort().join('|');
export const relation = (state, a, b) => state.relations[relKey(a, b)] ?? 0;

// Example orders per nation, shown as clickable suggestions.
export const SUGGESTIONS = {
  GER: ['Sign a trade deal with the Soviet Union for oil and grain', 'Build more U-boats to cut Britain’s supply lines', 'Offer Britain and France peace if they accept the conquest of Poland'],
  UK: ['Blockade German ports with the Royal Navy', 'Ask the United States for loans and weapons', 'Send an army to help defend France'],
  FRA: ['Launch an offensive into the Saar while Germany is busy in Poland', 'Extend the Maginot Line along the Belgian border', 'Ask Britain to send more divisions'],
  USA: ['Change the Neutrality Acts so Britain and France can buy weapons', 'Build a two-ocean navy', 'Stay neutral and expand factories'],
  SOV: ['Occupy eastern Poland as the secret pact allows', 'Demand military bases from the Baltic states', 'Speed up the Five-Year Plan in the Urals'],
  JAP: ['Offer China a ceasefire', 'Sign a neutrality pact with the Soviet Union', 'Seize oil fields in the Dutch East Indies'],
  ITA: ['Stay out of the war and trade with both sides', 'Modernise the army’s tanks', 'Invade Greece'],
  CHN: ['Ask the Soviet Union and the USA for aid', 'Keep the united front with the Communists against Japan', 'Move factories inland to Chongqing'],
  POL: ['Order a fighting retreat to the Romanian bridgehead', 'Urge Britain and France to attack in the west', 'Evacuate the gold reserves abroad']
};

// ---------- nation card ----------
export function nationCard(state, tag) {
  const n = state.nations[tag];
  if (!n) return '';
  const wars = warsOf(state, tag).map(t => state.nations[t]?.name).filter(Boolean);
  const isPlayer = tag === state.player;
  return `
    <div class="flag" style="background:${esc(n.color)}"></div>
    <h2>${esc(n.name)}${isPlayer ? ' <span class="muted" style="font:600 13px var(--ui)">(you)</span>' : ''}</h2>
    <div class="sub">${esc(n.leader)}, ${esc(n.ideology)}${n.faction ? `, ${esc(n.faction)}` : ''}</div>
    <div class="wars">${n.capitulated ? 'Defeated' : wars.length ? `At war with ${esc(wars.join(', '))}` : '<span class="muted">At peace</span>'}</div>
    ${isPlayer ? '' : '<button class="back" data-select="player" type="button">Back to your nation</button>'}`;
}

// ---------- indicator tables ----------
function tableNations(state, selected) {
  const list = Object.values(state.nations).filter(n =>
    !n.minor || n.tag === selected || n.faction || warsOf(state, n.tag).length);
  list.sort((a, b) => (b.tag === state.player) - (a.tag === state.player) || b.indicators.gdp - a.indicators.gdp);
  return list;
}

function cell(state, n, key, def) {
  const v = n.indicators[key];
  const d = state.lastDeltas?.[n.tag]?.[key];
  const shown = key === 'gdp' ? Math.round(v) : key === 'manpower' ? v.toFixed(1) : Math.round(v);
  const bar = def.max === 100 ? `<span class="bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></span>` : '';
  const delta = d ? `<span class="d ${d > 0 ? 'up' : 'down'}" title="Change last turn">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</span>` : '';
  return `<td>${shown}${def.unit && def.unit !== '' ? `<span class="muted"> ${esc(def.unit)}</span>` : ''}${delta}${bar}</td>`;
}

export function indicatorTab(state, info, tab, selected) {
  const defs = Object.entries(info.indicators).filter(([, d]) => d.tab === tab);
  const rows = tableNations(state, selected).map(n => `
    <tr data-tag="${esc(n.tag)}" class="${n.tag === state.player ? 'is-player' : ''} ${n.tag === selected ? 'is-selected' : ''} ${n.capitulated ? 'is-out' : ''}">
      <td><span class="nm"><span class="swatch" style="background:${esc(n.color)}"></span>${esc(n.name)}</span>${warsOf(state, n.tag).includes(state.player) ? '<span class="badge" title="At war with you">war</span>' : ''}</td>
      ${defs.map(([k, d]) => cell(state, n, k, d)).join('')}
    </tr>`).join('');
  return `<table class="ind">
    <thead><tr><th>Nation</th>${defs.map(([, d]) => `<th title="${esc(d.help)}">${esc(d.label)}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody></table>`;
}

export function diplomacyTab(state, selected) {
  const me = state.player;
  const rows = tableNations(state, selected).filter(n => n.tag !== me).map(n => {
    const r = relation(state, me, n.tag);
    const w = Math.abs(r) / 2;
    const fill = r >= 0
      ? `<i style="left:50%;width:${w}%;background:var(--gain)"></i>`
      : `<i style="right:50%;width:${w}%;background:var(--loss)"></i>`;
    const war = warsOf(state, n.tag).includes(me);
    return `<tr data-tag="${esc(n.tag)}" class="${n.tag === selected ? 'is-selected' : ''} ${n.capitulated ? 'is-out' : ''}">
      <td><span class="nm"><span class="swatch" style="background:${esc(n.color)}"></span>${esc(n.name)}</span></td>
      <td>${n.faction ? `<span class="badge faction">${esc(n.faction)}</span>` : '<span class="muted">none</span>'}</td>
      <td><span class="rel" title="${r}">${fill}</span> ${r}</td>
      <td>${war ? '<span class="badge">at war</span>' : ''}</td></tr>`;
  }).join('');
  return `<table class="ind">
    <thead><tr><th>Nation</th><th title="Alliance bloc">Faction</th><th title="Relations with your nation, from −100 (hostile) to +100 (allied)">Relations with you</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

export function journalTab(state) {
  if (!state.journal.length) {
    return `<p class="empty">Your decisions and lessons will be collected here, turn by turn. Send your first order below.</p>`;
  }
  const items = [...state.journal].reverse().map(j => `
    <li data-turn="${j.turn}" tabindex="0">
      <div class="when">Turn ${j.turn}, ${esc(j.dateBefore)}${j.reflection ? ', reflection written' : ''}</div>
      <div class="what">${esc(j.headline)}</div>
      <div class="muted" style="font-size:13px">${esc(j.order.slice(0, 110))}${j.order.length > 110 ? '…' : ''}</div>
    </li>`).join('');
  return `<div class="journal-actions">
      <a class="btn" href="/api/journal.md" download="leaders-journal.md">Download journal</a>
    </div>
    <ul class="journal-list">${items}</ul>`;
}

// ---------- orders log ----------
export function logHTML(state) {
  const n = state.nations[state.player];
  const intro = `<p class="intro">You lead ${esc(n.name)} in ${esc(fmtDate(state.events[0]?.date || state.date))}. ${
    state.journal.length ? '' : 'Type an order in plain words: a policy, a treaty, a military plan, a speech. The AI game master decides what happens and how much time passes.'}</p>`;
  const turns = state.journal.slice(-15).map(j => `
    <div class="decree"><span class="who">${esc(n.leader)} orders, ${esc(j.dateBefore)}</span>${esc(j.order)}</div>
    <div class="skip">${j.monthsPassed} ${j.monthsPassed === 1 ? 'month passes' : 'months pass'}, to ${esc(j.dateAfter)}</div>
    <div class="outcome">
      <h3>${esc(j.headline)}<span class="feas ${esc(j.feasibility)}">${esc(j.feasibility)}</span></h3>
      ${j.feasibilityReason ? `<p class="reason">${esc(j.feasibilityReason)}</p>` : ''}
      ${String(j.narrative).split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join('')}
      ${j.advisorNotes?.length ? `<ul class="notes">${j.advisorNotes.map(a => {
        const s = String(a).trim();
        const cls = s.startsWith('+') ? 'up' : /^[-−–]/.test(s) ? 'down' : '';
        return `<li class="${cls}">${esc(s)}</li>`;
      }).join('')}</ul>` : ''}
      ${(j.reactions || []).map(r => `
        <div class="reaction"><b>${esc(r.leader || r.country)}</b> <span class="tag">(${esc(state.nations[r.country]?.name || r.country)}, in-game dialogue)</span><br>${esc(r.statement)}</div>`).join('')}
    </div>`).join('');
  return intro + turns;
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
