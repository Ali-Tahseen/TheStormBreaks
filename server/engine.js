// Game engine — the ONLY code allowed to change game state.
// ------------------------------------------------------------------
// The LLM never edits state directly. It returns a list of "actions"
// (see docs/ACTIONS.md). This file validates each action against the
// whitelist below, clamps numbers to safe ranges, applies what is valid and
// reports what was rejected (and why). That keeps the game stable even when
// a model returns something odd, and makes every change auditable.
//
// All scenario-specific values (nations, territories, indicators, aliases…)
// are read from the scenario registry via state.scenarioId, so this file is
// scenario-agnostic.

import { getScenario, DEFAULT_SCENARIO_ID } from './data/scenarios/index.js';

export const ACTION_TYPES = [
  'change_indicator', 'set_indicator', 'occupy_territory', 'liberate_territory', 'annex_territory',
  'declare_war', 'make_peace', 'join_faction', 'leave_faction', 'change_relation', 'set_leader', 'add_event'
];

const MAX_STEP = 30;          // biggest change to a 0–100 indicator in one action
const MAX_GDP_STEP = 0.2;     // biggest GDP change in one action (20%)
const MAX_TIME_SKIP = 12;     // months

// ---------- small helpers ----------
const clone = (x) => JSON.parse(JSON.stringify(x));
const relKey = (a, b) => [a, b].sort().join('|');
const norm = (s) => String(s ?? '').trim().toLowerCase();
const round1 = (n) => Math.round(n * 10) / 10;

export const monthIndex = (d) => d.year * 12 + (d.month - 1);
export const fromIndex = (i) => ({ year: Math.floor(i / 12), month: (i % 12) + 1 });
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const formatDate = (d) => `${MONTHS[d.month - 1]} ${d.year}`;

function slugTag(name, taken) {
  let tag = name.toUpperCase().replace(/[^A-Z]+/g, '_').replace(/^_|_$/g, '');
  let t = tag, i = 2;
  while (taken.has(t)) t = `${tag}_${i++}`;
  return t;
}

// Muted "atlas" colour for minor nations, stable per name.
function minorColor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  const sat = 22 + (h >> 9) % 16;
  const light = 60 + (h >> 13) % 12;
  return `hsl(${hue} ${sat}% ${light}%)`;
}

// ---------- game creation ----------
/**
 * @param {object} opts { scenarioId, player, studentName, realism }
 * @param {string[]} mapNames every territory name in the scenario's map file
 */
export function createGame(opts = {}, mapNames = []) {
  const scenario = getScenario(opts.scenarioId);
  const nations = {};
  for (const [tag, n] of Object.entries(scenario.nations)) {
    nations[tag] = { tag, minor: false, capitulated: false, playable: !!n.playable, ...clone(n) };
  }

  const territories = {};
  const taken = new Set(Object.keys(nations));
  for (const name of mapNames) {
    if (scenario.ignoredTerritories.includes(name)) continue;
    let owner = scenario.territoryOwners[name];
    if (!owner) {
      // Any shape not assigned to a listed nation becomes its own minor nation.
      owner = slugTag(name, taken);
      taken.add(owner);
      nations[owner] = {
        tag: owner, name, leader: 'Government', ideology: 'Independent state', faction: null,
        color: minorColor(name), home: name, minor: true, playable: false, capitulated: false,
        indicators: { ...scenario.minorIndicators }
      };
    }
    territories[name] = { owner, occupation: {} };
  }
  for (const [t, occ] of Object.entries(scenario.startOccupation)) {
    if (territories[t]) territories[t].occupation = { ...occ };
  }

  const relations = {};
  for (const [k, v] of Object.entries(scenario.startRelations)) {
    const [a, b] = k.split('|');
    relations[relKey(a, b)] = v;
  }

  // If the requested nation is missing or not playable in this scenario, fall
  // back to the first playable nation of THAT scenario (not hard-coded GER, or
  // a China campaign could silently turn into Nazi Germany).
  const player = nations[opts.player] && nations[opts.player].playable
    ? opts.player
    : Object.keys(nations).find(tag => nations[tag].playable) || 'GER';

  const state = {
    id: `game-${Date.now()}`,
    scenarioId: scenario.id,
    version: 1,
    createdAt: new Date().toISOString(),
    date: { ...scenario.startDate },
    endDate: { ...scenario.endDate },
    turn: 1,
    player,
    studentName: String(opts.studentName || '').slice(0, 60),
    realism: opts.realism === 'sandbox' ? 'sandbox' : 'historical',
    nations,
    territories,
    wars: scenario.startWars.map(([a, b]) => [a, b]),
    relations,
    events: [{
      turn: 0, date: { ...scenario.startDate }, ...clone(scenario.startEvent), source: 'scenario'
    }],
    journal: [],
    lastDeltas: {},
    lastChangedTerritories: [],
    lastTurnDebug: null,
    report: null,
    gameOver: null
  };
  state.initial = snapshotInitial(state);
  return state;
}

// A compact, serialisable record of the starting position, used by the
// end-of-campaign report to compute deterministic metrics (see server/report.js).
export function snapshotInitial(state) {
  const indicators = {};
  for (const [tag, n] of Object.entries(state.nations)) indicators[tag] = { ...n.indicators };
  const territories = {};
  for (const [name, t] of Object.entries(state.territories)) {
    territories[name] = { owner: t.owner, occupation: { ...t.occupation } };
  }
  return {
    indicators,
    territories,
    wars: state.wars.map(w => [...w]),
    relations: { ...state.relations }
  };
}

// ---------- name resolution ----------
export function resolveNation(state, ref) {
  if (!ref) return null;
  const raw = String(ref).trim();
  if (state.nations[raw]) return raw;
  const up = raw.toUpperCase();
  if (state.nations[up]) return up;
  const sc = getScenario(state.scenarioId);
  const n = norm(raw);
  if (sc.aliases[n] && state.nations[sc.aliases[n]]) return sc.aliases[n];
  for (const nat of Object.values(state.nations)) {
    if (norm(nat.name) === n) return nat.tag;
  }
  // A territory name refers to its owner ("Czechia" -> GER)
  const t = resolveTerritory(state, raw);
  if (t) return state.territories[t].owner;
  return null;
}

export function resolveTerritory(state, ref) {
  if (!ref) return null;
  const raw = String(ref).trim();
  if (state.territories[raw]) return raw;
  const n = norm(raw);
  for (const name of Object.keys(state.territories)) if (norm(name) === n) return name;
  const sc = getScenario(state.scenarioId);
  if (sc.territoryAliases[n] && state.territories[sc.territoryAliases[n]]) return sc.territoryAliases[n];
  // A nation name refers to its home territory ("Soviet Union" -> Russia)
  for (const nat of Object.values(state.nations)) {
    if (norm(nat.name) === n || nat.tag === raw.toUpperCase()) return nat.home;
  }
  return null;
}

// ---------- queries ----------
export const atWar = (state, a, b) => state.wars.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
export const warsOf = (state, tag) => state.wars.filter(w => w.includes(tag)).map(([x, y]) => (x === tag ? y : x));
export const territoriesOf = (state, tag) => Object.entries(state.territories).filter(([, t]) => t.owner === tag).map(([n]) => n);
export const relation = (state, a, b) => state.relations[relKey(a, b)] ?? 0;

function actorsOf(a) {
  switch (a.type) {
    case 'change_indicator': case 'set_indicator': case 'join_faction': case 'leave_faction': case 'set_leader':
      return [a.country];
    case 'occupy_territory': return [a.occupier];
    case 'liberate_territory': return [a.by || a.occupier];
    case 'annex_territory': return [a.new_owner];
    case 'declare_war': return [a.attacker];
    case 'make_peace': return [a.a, a.b];
    case 'change_relation': return [a.a];
    default: return [];
  }
}

// ---------- action application ----------
/**
 * Validate and apply a list of actions.
 * @param {object} state  mutated in place
 * @param {object[]} actions
 * @param {object} ctx { source: 'game_master'|'rival_leaders'|'manual', forbidActor?: tag }
 * @returns {{applied: object[], rejected: {action: object, reason: string}[]}}
 */
export function applyActions(state, actions, ctx = {}) {
  const applied = [], rejected = [];
  if (!Array.isArray(actions)) return { applied, rejected: [{ action: actions, reason: 'actions must be an array' }] };
  const scenario = getScenario(state.scenarioId);

  for (const raw of actions.slice(0, 40)) {
    try {
      const action = { ...raw };
      if (!ACTION_TYPES.includes(action.type)) throw new Error(`unknown action type "${action.type}"`);

      if (ctx.forbidActor) {
        const actors = actorsOf(action).map(r => resolveNation(state, r));
        if (actors.includes(ctx.forbidActor)) throw new Error(`${ctx.source} may not act on behalf of the player's nation`);
      }

      action.source = ctx.source || 'unknown';
      const summary = APPLY[action.type](state, action, scenario);
      applied.push({ ...action, summary });
    } catch (err) {
      rejected.push({ action: raw, reason: err.message });
    }
  }
  if (applied.length) state.version++;
  return { applied, rejected };
}

function needNation(state, ref, field) {
  const tag = resolveNation(state, ref);
  if (!tag) throw new Error(`unknown nation in "${field}": ${JSON.stringify(ref)}`);
  return tag;
}
function needTerritory(state, ref) {
  const t = resolveTerritory(state, ref);
  if (!t) throw new Error(`unknown territory: ${JSON.stringify(ref)}`);
  return t;
}
function markChanged(state, t) {
  if (!state.lastChangedTerritories.includes(t)) state.lastChangedTerritories.push(t);
}
function limitStep(scenario, key, current, target) {
  const def = scenario.indicators[key];
  let next = target;
  if (key === 'gdp') {
    const cap = Math.max(5, current * MAX_GDP_STEP);
    next = Math.min(current + cap, Math.max(current - cap, next));
  } else if (key === 'manpower') {
    next = Math.min(current + 5, Math.max(current - 5, next));
  } else {
    next = Math.min(current + MAX_STEP, Math.max(current - MAX_STEP, next));
  }
  return round1(Math.min(def.max, Math.max(def.min, next)));
}

const APPLY = {
  change_indicator(state, a, scenario) {
    const tag = needNation(state, a.country, 'country');
    if (!scenario.indicators[a.indicator]) throw new Error(`unknown indicator "${a.indicator}"`);
    const delta = Number(a.delta);
    if (!Number.isFinite(delta)) throw new Error('delta must be a number');
    const inds = state.nations[tag].indicators;
    const before = inds[a.indicator];
    inds[a.indicator] = limitStep(scenario, a.indicator, before, before + delta);
    return `${state.nations[tag].name}: ${scenario.indicators[a.indicator].label} ${before} → ${inds[a.indicator]}`;
  },

  set_indicator(state, a, scenario) {
    const tag = needNation(state, a.country, 'country');
    if (!scenario.indicators[a.indicator]) throw new Error(`unknown indicator "${a.indicator}"`);
    const value = Number(a.value);
    if (!Number.isFinite(value)) throw new Error('value must be a number');
    const inds = state.nations[tag].indicators;
    const before = inds[a.indicator];
    inds[a.indicator] = limitStep(scenario, a.indicator, before, value);
    return `${state.nations[tag].name}: ${scenario.indicators[a.indicator].label} ${before} → ${inds[a.indicator]}`;
  },

  occupy_territory(state, a) {
    const t = needTerritory(state, a.territory);
    const occ = needNation(state, a.occupier, 'occupier');
    const terr = state.territories[t];
    if (terr.owner === occ) throw new Error(`${state.nations[occ].name} already owns ${t}; use liberate_territory to remove occupiers`);
    const current = terr.occupation[occ] || 0;
    let target;
    if (a.percent !== undefined) target = Number(a.percent);
    else if (a.delta !== undefined) target = current + Number(a.delta);
    else throw new Error('occupy_territory needs "percent" (absolute) or "delta" (change)');
    if (!Number.isFinite(target)) throw new Error('percent/delta must be a number');
    target = Math.round(Math.min(100, Math.max(0, target)));
    if (target === 0) delete terr.occupation[occ]; else terr.occupation[occ] = target;
    // Occupiers together can never hold more than 100%.
    const others = Object.keys(terr.occupation).filter(k => k !== occ);
    const otherSum = others.reduce((s, k) => s + terr.occupation[k], 0);
    if (target + otherSum > 100 && otherSum > 0) {
      const room = 100 - target;
      for (const k of others) {
        const v = Math.floor(terr.occupation[k] * room / otherSum);
        if (v <= 0) delete terr.occupation[k]; else terr.occupation[k] = v;
      }
    }
    markChanged(state, t);
    return `${state.nations[occ].name} controls ${target}% of ${t} (was ${current}%)`;
  },

  liberate_territory(state, a) {
    const t = needTerritory(state, a.territory);
    const terr = state.territories[t];
    const occRef = a.occupier;
    const list = occRef ? [needNation(state, occRef, 'occupier')] : Object.keys(terr.occupation);
    if (!list.length) throw new Error(`${t} is not occupied`);
    for (const occ of list) {
      if (!terr.occupation[occ]) continue;
      if (a.percent !== undefined) {
        const v = Math.max(0, terr.occupation[occ] - Math.abs(Number(a.percent) || 0));
        if (v === 0) delete terr.occupation[occ]; else terr.occupation[occ] = v;
      } else delete terr.occupation[occ];
    }
    markChanged(state, t);
    return `Occupation of ${t} reduced`;
  },

  annex_territory(state, a) {
    const t = needTerritory(state, a.territory);
    const to = needNation(state, a.new_owner, 'new_owner');
    const terr = state.territories[t];
    const from = terr.owner;
    if (from === to) throw new Error(`${t} already belongs to ${state.nations[to].name}`);
    terr.owner = to;
    terr.occupation = {};
    markChanged(state, t);
    let note = '';
    if (territoriesOf(state, from).length === 0) {
      state.nations[from].capitulated = true;
      state.wars = state.wars.filter(w => !w.includes(from));
      note = ` — ${state.nations[from].name} has lost all its territory`;
    }
    return `${t} passes from ${state.nations[from].name} to ${state.nations[to].name}${note}`;
  },

  declare_war(state, a) {
    const x = needNation(state, a.attacker, 'attacker');
    const y = needNation(state, a.defender, 'defender');
    if (x === y) throw new Error('a nation cannot declare war on itself');
    if (atWar(state, x, y)) throw new Error(`${state.nations[x].name} and ${state.nations[y].name} are already at war`);
    state.wars.push([x, y]);
    state.relations[relKey(x, y)] = Math.min(relation(state, x, y), -60);
    return `${state.nations[x].name} declares war on ${state.nations[y].name}`;
  },

  make_peace(state, a) {
    const x = needNation(state, a.a, 'a');
    const y = needNation(state, a.b, 'b');
    if (!atWar(state, x, y)) throw new Error(`${state.nations[x].name} and ${state.nations[y].name} are not at war`);
    state.wars = state.wars.filter(([p, q]) => !((p === x && q === y) || (p === y && q === x)));
    return `Peace between ${state.nations[x].name} and ${state.nations[y].name}`;
  },

  join_faction(state, a, scenario) {
    const tag = needNation(state, a.country, 'country');
    const f = String(a.faction || '').trim().slice(0, 30);
    if (!f) throw new Error('faction name missing');
    const known = Object.keys(scenario.factions).find(k => norm(k) === norm(f));
    state.nations[tag].faction = known || f;
    return `${state.nations[tag].name} joins ${state.nations[tag].faction}`;
  },

  leave_faction(state, a) {
    const tag = needNation(state, a.country, 'country');
    const was = state.nations[tag].faction;
    if (!was) throw new Error(`${state.nations[tag].name} is not in a faction`);
    state.nations[tag].faction = null;
    return `${state.nations[tag].name} leaves ${was}`;
  },

  change_relation(state, a) {
    const x = needNation(state, a.a, 'a');
    const y = needNation(state, a.b, 'b');
    if (x === y) throw new Error('relation needs two different nations');
    const d = Math.max(-40, Math.min(40, Number(a.delta)));
    if (!Number.isFinite(d)) throw new Error('delta must be a number');
    const k = relKey(x, y);
    const before = relation(state, x, y);
    state.relations[k] = Math.max(-100, Math.min(100, Math.round(before + d)));
    return `Relations ${state.nations[x].name}–${state.nations[y].name}: ${before} → ${state.relations[k]}`;
  },

  set_leader(state, a) {
    const tag = needNation(state, a.country, 'country');
    const leader = String(a.leader || '').trim().slice(0, 60);
    if (!leader) throw new Error('leader name missing');
    const before = state.nations[tag].leader;
    state.nations[tag].leader = leader;
    return `${state.nations[tag].name}: ${before} replaced by ${leader}`;
  },

  add_event(state, a) {
    const title = String(a.title || '').trim().slice(0, 100);
    if (!title) throw new Error('event title missing');
    const cats = ['war', 'diplomacy', 'economy', 'politics', 'other'];
    const territories = (Array.isArray(a.territories) ? a.territories : [])
      .map(t => resolveTerritory(state, t)).filter(Boolean);
    territories.forEach(t => markChanged(state, t));
    state.events.push({
      turn: state.turn, date: { ...state.date }, title,
      description: String(a.description || '').slice(0, 400),
      category: cats.includes(a.category) ? a.category : 'other',
      territories, source: a.source || 'game'
    });
    return `Event: ${title}`;
  }
};

// ---------- turn helpers ----------
export function snapshotIndicators(state) {
  const snap = {};
  for (const [tag, n] of Object.entries(state.nations)) snap[tag] = { ...n.indicators };
  return snap;
}

export function computeDeltas(state, before) {
  const out = {};
  for (const [tag, n] of Object.entries(state.nations)) {
    for (const [k, v] of Object.entries(n.indicators)) {
      const d = round1(v - (before[tag]?.[k] ?? v));
      if (d !== 0) (out[tag] ||= {})[k] = d;
    }
  }
  return out;
}

export function advanceTime(state, months) {
  const m = Math.max(0, Math.min(MAX_TIME_SKIP, Math.round(Number(months) || 0)));
  const endIdx = monthIndex(state.endDate);
  const next = Math.min(endIdx, monthIndex(state.date) + m);
  state.date = fromIndex(next);
  return m;
}

export function checkGameOver(state) {
  const scenario = getScenario(state.scenarioId);
  const p = state.nations[state.player];
  if (p.capitulated) return { reason: `${p.name} has been defeated and lost all its territory.` };
  if (p.indicators.stability <= 0) return { reason: `Stability in ${p.name} collapsed. The government has fallen.` };
  if (monthIndex(state.date) >= monthIndex(state.endDate)) return { reason: scenario.endReason };
  return null;
}

// ---------- compact summary for the LLM ----------
export function summarizeForLLM(state, { full = true } = {}) {
  const nations = Object.values(state.nations)
    .filter(n => !n.minor || n.capitulated || warsOf(state, n.tag).length || n.faction)
    .map(n => ({
      tag: n.tag, name: n.name, leader: n.leader, ideology: n.ideology, faction: n.faction,
      capitulated: n.capitulated || undefined,
      at_war_with: warsOf(state, n.tag),
      indicators: n.indicators
    }));

  // Territory list: "Name: OWNER" plus any occupation. Always complete so the
  // model knows every valid territory name.
  const territories = full
    ? Object.entries(state.territories).map(([name, t]) => {
        const occ = Object.entries(t.occupation).map(([k, v]) => `${k} ${v}%`).join(', ');
        return occ ? `${name}: ${t.owner} (occupied: ${occ})` : `${name}: ${t.owner}`;
      })
    : undefined;

  const playerRelations = {};
  for (const n of Object.values(state.nations)) {
    if (n.tag === state.player || n.minor) continue;
    playerRelations[n.tag] = relation(state, state.player, n.tag);
  }

  return {
    scenario: state.scenarioId,
    date: formatDate(state.date),
    turn: state.turn,
    player: { tag: state.player, name: state.nations[state.player].name, leader: state.nations[state.player].leader },
    realism: state.realism,
    nations,
    player_relations: playerRelations,
    territories,
    recent_turns: state.journal.slice(-4).map(j => ({ date: j.dateBefore, order: j.order, outcome: j.headline || j.narrative.slice(0, 240) }))
  };
}

export { DEFAULT_SCENARIO_ID };
