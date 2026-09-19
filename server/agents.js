// Agents — the AI "game engine".
// ------------------------------------------------------------------
// One turn = four agents:
//   1. Game Master     reads the player's order, judges plausibility, decides how
//                      much time passes, writes the narrative and emits ACTIONS.
//   2. Rival Leaders   the AI-controlled leaders of the other powers react.
//   3. History Teacher compares the student's timeline with real history and
//                      writes a short lesson + reflection question.
//   4. Advisors        the player's economic advisor, diplomat and military
//                      advisor brief the leader on the new situation (no actions).
// After agent 1, the teacher runs in parallel with the chain 2 -> 4.
// Every agent returns JSON. Only server/engine.js changes the game state.
//
// All prompts are built from the active scenario (see server/data/scenarios/),
// so the same pipeline drives any era.

import {
  applyActions, snapshotIndicators, computeDeltas, checkGameOver,
  summarizeForLLM, formatDate, monthIndex, fromIndex, ACTION_TYPES,
  warsOf, relation, territoriesOf, scanMentions
} from './engine.js';
import { runClockSkip } from './historyClock.js';
import { getScenario } from './data/scenarios/index.js';
import { eventsNear, eventsBetween } from './data/timeline.js';
import { chatJSON, llmConfigured } from './llm.js';
import { mockGameMaster, mockRivals, mockTeacher, mockReport, mockAdvisors } from './mock.js';
import { computeMetrics, scoreFromGrades, applyWeights, DEFAULT_WEIGHTS } from './report.js';

const LANGS = {
  en: 'English',
  'zh-Hant': 'Traditional Chinese (as used in Hong Kong)',
  'zh-Hans': 'Simplified Chinese'
};

// ---------------- shared prompt fragments ----------------
const actionSpec = (scenario) => `
ACTIONS you may emit (JSON objects in an "actions" array). Use nation TAGS (e.g. "GER") and the exact territory names from the world data.
- {"type":"change_indicator","country":TAG,"indicator":NAME,"delta":NUMBER,"reason":TEXT}
- {"type":"set_indicator","country":TAG,"indicator":NAME,"value":NUMBER,"reason":TEXT}
- {"type":"occupy_territory","territory":NAME,"occupier":TAG,"delta":PERCENT_CHANGE,"reason":TEXT}   (or "percent" for an absolute value 0-100; partial control of a territory)
- {"type":"liberate_territory","territory":NAME,"occupier":TAG_OPTIONAL,"percent":OPTIONAL,"by":TAG,"reason":TEXT}
- {"type":"annex_territory","territory":NAME,"new_owner":TAG,"reason":TEXT}   (full, formal transfer — only after a territory is fully conquered or ceded by treaty)
- {"type":"capitulate","country":TAG,"occupier":TAG_OPTIONAL,"percent":OPTIONAL,"territories":[NAMES_OPTIONAL],"reason":TEXT}   (a nation surrenders, signs an armistice or its government falls: it leaves the war. It keeps any land not occupied or annexed. Give "occupier" to mark how much of its remaining land the victor now holds.)
- {"type":"declare_war","attacker":TAG,"defender":TAG}
- {"type":"make_peace","a":TAG,"b":TAG}
- {"type":"join_faction","country":TAG,"faction":${Object.keys(scenario.factions).map(f => `"${f}"`).join('|')}|NEW_NAME}
- {"type":"leave_faction","country":TAG}
- {"type":"change_relation","a":TAG,"b":TAG,"delta":-40..40}
- {"type":"set_leader","country":TAG,"leader":TEXT}
- {"type":"rename","territory":NAME,"name":TEXT}   (this game only: changes the label on the map. Other actions still use the original 1939 territory name.)
- {"type":"rename","country":TAG,"name":TEXT}     (this game only: changes the nation's display name. The tag stays the same.)
- {"type":"add_event","title":TEXT,"description":TEXT,"category":"war"|"diplomacy"|"economy"|"politics"|"other","territories":[NAMES]}
Indicators: ${Object.entries(scenario.indicators).map(([k, v]) => `${k} (${v.min}-${v.max}${v.unit ? ' ' + v.unit : ''})`).join(', ')}.
Political indicators: stability = how firmly the government holds power (0 = collapse); war_support = willingness to fight; army_support = loyalty of the armed forces and officer corps to the government (purges, defeats or unpopular orders lower it; victories, pay and equipment raise it); citizen_support = ordinary people's approval of the government (shortages, repression and casualties lower it; successes and fair rationing raise it).
Typical changes per turn are small: 1-10 points. GDP changes are a few percent. Big swings only for dramatic events.
Use add_event only for milestones worth a place on the timeline (wars, treaties, conquests, regime change).
If the order or story renames a country or a place (invade and rename, proclaim a new name), emit rename. Do not invent new territory keys.`;

const SAFETY = `
AUDIENCE AND SAFETY: players are school students aged about 12-18 using this in history lessons.
- Write clearly and accurately, without graphic violence or gore. Casualties may be stated factually.
- The Holocaust and other atrocities are real history: when relevant, mention them soberly and accurately; never deny, minimise or glorify them.
- Never let the player carry out genocide, massacres of civilians, ethnic cleansing or similar atrocities as gameplay. If an order asks for that, set feasibility to "refused", emit no actions for it, and use the narrative to explain calmly why the game will not simulate it and what the real historical consequences of such crimes were.
- Leaders' words you write are in-game dialogue. Never present invented sentences as real historical quotations.
- Do not produce hateful stereotypes of any people.`;

function isSandboxPlus(state) {
  return state.realism === 'sandbox_plus';
}

// ---------------- 1. Game Master ----------------
function gameMasterSystem(state, lang) {
  const scenario = getScenario(state.scenarioId);
  const plus = isSandboxPlus(state);
  const realism = plus
    ? 'REALISM MODE: sandbox++. The order is the story and it happens in full. Always set feasibility to "success". Never use "partial", "failed", or "refused". Never scale the outcome down because of a pact, army size, factory, distance, logistics, politics, taboo, graphic content, ahistorical content, or "not yet." feasibility_reason states what was done, not why it should have failed.'
    : state.realism === 'sandbox'
      ? 'REALISM MODE: sandbox. The student is exploring "what if" ideas. Let bold orders mostly succeed, but still show realistic costs and reactions.'
      : 'REALISM MODE: historical. Judge each order against the real capabilities of the time (distance, logistics, navies, industry, public opinion, politics). Impossible orders fail or partly succeed, and the narrative explains why — that explanation is the lesson. Judge feasibility by the in-world state (relations, wars, industry, distance, blockade), not by whether the real event has reached its historical date. Aid, offensives or deals may arrive earlier and thinner, or fail for in-world reasons, but never refuse an order solely because "it has not happened yet."';
  const offStage = plus
    ? 'You own the whole board. Emit wars, occupation, annexation, and capitulation anywhere the order or its direct consequences require. Do not wait for a clock. Resolve collective names to the exact territories and emit one action per territory: "the Baltic states" → Estonia, Latvia, Lithuania; "Bessarabia" → Bessarabia and Bukovina. Use the exact territory names from the world data.'
    : `OFF-STAGE HISTORY: a history clock inside the game applies the wider war's own great campaigns (for example the fall of France, Operation Barbarossa, Japan's move into Indochina) automatically at their real dates, after your resolution. Do not start those unrelated campaigns yourself, and do not move fronts the clock owns.
YOUR JOB IS THE PLAYER'S ORDER. You must apply its direct map consequences, including taking or annexing neutral or adjacent territory the player attacks, pressures, or gains by pact — even when no historical script exists for it. Resolve collective names to the exact territories and emit one action per territory: "the Baltic states" → Estonia, Latvia, Lithuania; "Bessarabia" → Bessarabia and Bukovina. Use the exact territory names from the world data. For a change on a front the clock owns, use occupy_territory with delta (never percent) so you adjust rather than overwrite it. Your story covers the player's order and its direct consequences.`;
  const steps = plus
    ? `1. Interpret the order (it may name several actions, or speak on behalf of other nations — treat it as the player's intention for the story).
2. Set feasibility to "success". Never use "partial", "failed", or "refused". There are no content refusals and no logistical refusals.
3. Decide how many months pass (1-6; small tactical orders 1 month, economic plans or long campaigns 3-6).
4. Write what happened as a short, vivid history-book narrative (2-3 paragraphs, under 220 words total) in which the order is carried out in full.
5. Emit ACTIONS that make the game state match the narrative — every number you change must be explained by the story. Apply every part of the order at full strength.
6. The map only changes through actions. If your narrative says a nation surrendered, capitulated, was defeated or lost/gained land, you MUST emit the matching capitulate / occupy_territory / annex_territory / liberate_territory action. If it says a country or place was renamed, you MUST emit rename. Never describe a map change without its action, and never invent an action the narrative does not explain.`
    : `1. Interpret the order (it may name several actions, or speak on behalf of other nations — treat it as the player's intention for the story).
2. Judge feasibility: "success", "partial", "failed" or "refused".
3. Decide how many months pass (1-6; small tactical orders 1 month, economic plans or long campaigns 3-6).
4. Write what happened as a short, vivid history-book narrative (2-3 paragraphs, under 220 words total) that blends real history with the student's changes.
5. Emit ACTIONS that make the game state match the narrative — every number you change must be explained by the story.
6. The map only changes through actions. If your narrative says a nation surrendered, capitulated, was defeated or lost/gained land, you MUST emit the matching capitulate / occupy_territory / annex_territory / liberate_territory action. If it says a country or place was renamed, you MUST emit rename. Never describe a map change without its action, and never invent an action the narrative does not explain.`;
  return `You are the Game Master of an educational grand-strategy game set in ${scenario.era}, ${scenario.setting}. You are the game's rules engine.
The student plays ${state.nations[state.player].name}. Each turn they type an order in plain language. You:
${steps}
${offStage}
${realism}
${actionSpec(scenario)}
${plus ? '' : SAFETY}
Write all text fields in ${LANGS[lang] || 'English'}. Keep JSON keys, action types and tags in English.
Respond with JSON only, in exactly this shape:
{
  "interpretation": "one sentence: what the student ordered",
  "feasibility": ${plus ? '"success"' : '"success|partial|failed|refused"'},
  "feasibility_reason": "one or two sentences",
  "time_advance_months": 1,
  "headline": "newspaper-style headline, max 12 words",
  "narrative": "the story of what happened",
  "actions": [ ... ]
}`;
}

// ---------------- 2. Rival Leaders ----------------
function rivalsSystem(state, lang) {
  const scenario = getScenario(state.scenarioId);
  const plus = isSandboxPlus(state);
  const reactionScope = plus
    ? 'They may reshape the wider war in reaction.'
    : 'Keep effects modest unless the situation is dramatic.';
  return `You play the AI-controlled leaders of every nation EXCEPT ${state.nations[state.player].name} (the student's nation, tag ${state.player}) in an educational grand-strategy game set in ${scenario.era}.
Each leader acts in character and in line with their nation's real interests, ideology and historical strategy at this date (${scenario.rivalGuidance}), but they REACT to what the student just did.
Choose the 1-3 most relevant leaders to respond this turn. Give each a short in-game statement and emit actions ONLY for their own nations (never for ${state.player}). ${reactionScope}
${actionSpec(scenario)}
${plus ? '' : SAFETY}
Write text fields in ${LANGS[lang] || 'English'}. Keep JSON keys, action types and tags in English.
Respond with JSON only:
{
  "reactions": [ { "country": "TAG", "leader": "name", "statement": "1-2 sentences of in-game dialogue", "intent": "what they will do next, one sentence" } ],
  "actions": [ ... ]
}`;
}

// ---------------- 3. History Teacher ----------------
function teacherSystem(state, lang) {
  const scenario = getScenario(state.scenarioId);
  const plus = isSandboxPlus(state);
  const clockNote = plus
    ? 'Compare the student\'s new timeline with the "real_events" list as contrast, not as a scolding that they were wrong.'
    : 'Some turns include "history_clock" and a "board_snapshot": the game itself applies the wider war\'s real events at their real dates (for example the partition of Poland or the fall of France). Treat those fired events as the historical baseline inside the game, not as the student\'s own choices, and use them with the board snapshot when writing "how_your_timeline_differs".';
  return `You are a friendly, precise history teacher for students aged 12-18 (e.g. ${scenario.teacherContext}). After each turn of a simulation of ${scenario.era} you write a short lesson comparing the student's alternate timeline with what REALLY happened in the same period.
Rules: only state real history you are confident about; use the "real_events" list as your anchor. Explain cause and consequence. Be encouraging, never preachy. Keep every field brief (the whole lesson under 200 words).
${clockNote}
${plus ? '' : SAFETY}
Write text fields in ${LANGS[lang] || 'English'}. Keep JSON keys in English.
Respond with JSON only:
{
  "lesson": {
    "title": "short title",
    "what_really_happened": "2-4 sentences about the real events of this period",
    "how_your_timeline_differs": "1-3 sentences",
    "why_it_matters": "1-2 sentences linking to a big historical idea (causation, consequence, continuity and change, significance)",
    "key_terms": [ { "term": "Appeasement", "definition": "one sentence" } ],
    "reflection_question": "one open question the student can answer in 2-3 sentences",
    "exam_skill": "one sentence tip linking this turn to an exam skill (source analysis or essay argument)"
  }
}`;
}

// ---------------- 4. Advisors ----------------
// After every turn the player's three advisors (economy, diplomacy, military)
// write a short private briefing: one line on the situation at home, one on
// the situation abroad, and one suggestion. They only advise — they never emit
// actions, so they cannot change the game.
export const ADVISOR_ROLES = ['economy', 'diplomacy', 'military'];
export const ADVISOR_OUTLOOKS = ['good', 'steady', 'worrying', 'critical'];

function advisorsSystem(state, lang) {
  const scenario = getScenario(state.scenarioId);
  const plus = isSandboxPlus(state);
  const p = state.nations[state.player];
  return `You write the private briefing that the three senior advisors of ${p.name} give their leader (${p.leader}) in an educational grand-strategy game set in ${scenario.era}.
The advisors:
- "economy": the economic advisor. GDP, industry, resources, trade, blockades, labour, finance, rationing, inflation.
- "diplomacy": the diplomat (foreign minister). Allies, rivals, neutrals, factions, relations, public opinion about foreign policy, and what foreign governments are likely to do next.
- "military": the military advisor (chief of staff). Armed forces, fronts, occupation, readiness, manpower, threats, and how loyal the officer corps is (army support).
Each advisor gives:
- "outlook": "good", "steady", "worrying" or "critical" for their own field;
- "home": ONE sentence on the situation INSIDE the country in their field;
- "abroad": ONE sentence on the situation OUTSIDE the country that matters for their field;
- "advice": ONE short suggestion the leader could consider (an option, not an order).
Each field is at most 28 words. Be concrete: name countries, places and numbers from the game data.
Do not recommend an action the current game state makes infeasible. If a hint or a historical option is blocked by a war, pact, or blockade in the current state, name the blocker and suggest a feasible alternative instead.
Ground the briefing in the game state you are given (it may already differ from real history) AND in the real historical context of this date (real_history_so_far): the pressures, shortages, alliances and fears that real officials of this nation faced. Advisors know only what a well-informed official could know at this date, never the future.
Stay in character as professional advisors of this nation at this date, but state facts, not propaganda. ${plus ? 'You may suggest bold rewrites of the war.' : 'Never recommend or praise atrocities, persecution, deportations, forced labour or attacks on civilians; if such policies are happening, an advisor may note their real consequences soberly.'}
${plus ? '' : SAFETY}
Write text fields in ${LANGS[lang] || 'English'}. Keep JSON keys and outlook values in English.
Respond with JSON only:
{
  "economy":   { "outlook": "steady", "home": "...", "abroad": "...", "advice": "..." },
  "diplomacy": { "outlook": "worrying", "home": "...", "abroad": "...", "advice": "..." },
  "military":  { "outlook": "good", "home": "...", "abroad": "...", "advice": "..." }
}`;
}

// Everything the advisors need, as compact JSON.
function advisorsRequest(state, lastTurn) {
  const scenario = getScenario(state.scenarioId);
  const tag = state.player;
  const p = state.nations[tag];
  const name = (t) => state.nations[t]?.name || t;
  const held = territoriesOf(state, tag);
  const occupiedAtHome = held
    .filter(t => Object.keys(state.territories[t].occupation || {}).length)
    .map(t => `${t}: ${Object.entries(state.territories[t].occupation).map(([o, v]) => `${name(o)} ${v}%`).join(', ')}`);
  const occupyingAbroad = Object.entries(state.territories)
    .filter(([, t]) => t.owner !== tag && t.occupation?.[tag])
    .map(([n, t]) => `${n} (${name(t.owner)}): ${t.occupation[tag]}%`);
  const relations = Object.values(state.nations)
    .filter(n => !n.minor && n.tag !== tag && !n.capitulated)
    .map(n => ({ nation: n.name, faction: n.faction, relation: relation(state, tag, n.tag), at_war_with_us: warsOf(state, tag).includes(n.tag) }))
    .sort((a, b) => b.relation - a.relation);
  const idx = monthIndex(state.date);
  const realSoFar = eventsNear(scenario.timeline, state.date, 3, 0)
    .concat(scenario.timeline.filter(e => {
      const [y, m] = e.date.split('-').map(Number);
      const k = y * 12 + m - 1;
      return k <= idx && k > idx - 8 && (e.nations || []).includes(tag);
    }))
    .filter((e, i, arr) => arr.findIndex(x => x.date === e.date && x.title === e.title) === i)
    .map(e => ({ date: e.date, title: e.title, summary: e.summary }));
  return {
    task: 'brief_the_leader',
    date: formatDate(state.date),
    nation: {
      tag, name: p.name, leader: p.leader, ideology: p.ideology, faction: p.faction,
      indicators: p.indicators,
      change_last_turn: state.lastDeltas?.[tag] || {},
      at_war_with: warsOf(state, tag).map(name),
      provinces_held: held.length,
      occupied_at_home: occupiedAtHome,
      occupying_abroad: occupyingAbroad
    },
    relations,
    last_turn: lastTurn || null,
    world: summarizeForLLM(state, { full: false }),
    real_history_so_far: realSoFar
  };
}

function cleanAdvisors(j, fallback) {
  const out = {};
  for (const role of ADVISOR_ROLES) {
    const r = (j && typeof j === 'object' && j[role]) || {};
    const f = fallback?.[role] || {};
    const text = (v, d) => (String(v ?? '').trim() || String(d ?? '')).slice(0, 260);
    const outlook = String(r.outlook || '').toLowerCase();
    out[role] = {
      outlook: ADVISOR_OUTLOOKS.includes(outlook) ? outlook : (f.outlook || 'steady'),
      home: text(r.home, f.home),
      abroad: text(r.abroad, f.abroad),
      advice: text(r.advice, f.advice)
    };
  }
  return out;
}

// The briefing shown when a campaign starts (hand-written per nation in the
// scenario file, or generated from the game data if there is none).
export function openingBriefing(state) {
  return {
    turn: 0, date: formatDate(state.date), source: 'opening',
    ...cleanAdvisors(mockAdvisors(state, { opening: true }))
  };
}

// An offline briefing for the current state (used for old saves that have none).
export function offlineBriefing(state) {
  if (!state.journal?.length) return openingBriefing(state);
  return {
    turn: state.journal.at(-1).turn, date: formatDate(state.date), source: 'offline',
    ...cleanAdvisors(mockAdvisors(state))
  };
}

/**
 * Ask the three advisors for their briefing on the current state.
 * Falls back to the offline generator if the model fails.
 */
export async function briefAdvisors(state, { lang = 'en', lastTurn = null, turn = state.turn, debug = null, useLLM = llmConfigured() } = {}) {
  const offline = cleanAdvisors(mockAdvisors(state));
  const meta = { turn, date: formatDate(state.date) };
  if (!useLLM) {
    debug?.agents.push({ agent: 'Advisors (offline demo)', ms: 0, request: { task: 'brief_the_leader' }, response: offline });
    return { ...meta, source: 'offline', ...offline };
  }
  const request = advisorsRequest(state, lastTurn);
  try {
    const r = await chatJSON(advisorsSystem(state, lang), request, { temperature: 0.5, maxTokens: 900 });
    if (!r.json || typeof r.json !== 'object' || !ADVISOR_ROLES.some(k => r.json[k] && typeof r.json[k] === 'object')) {
      throw new Error('the advisors returned no briefing');
    }
    debug?.agents.push({ agent: 'Advisors', ms: r.ms, request, response: r.json });
    return { ...meta, source: 'llm', ...cleanAdvisors(r.json, offline) };
  } catch (err) {
    debug?.agents.push({ agent: 'Advisors', error: err.message, request, fallback: 'offline briefing used' });
    return { ...meta, source: 'offline', ...offline };
  }
}

// ---------------- validation of agent output ----------------
function cleanGM(j) {
  const feas = ['success', 'partial', 'failed', 'refused'];
  return {
    interpretation: String(j.interpretation || '').slice(0, 400),
    feasibility: feas.includes(j.feasibility) ? j.feasibility : 'partial',
    feasibility_reason: String(j.feasibility_reason || '').slice(0, 600),
    time_advance_months: Math.max(1, Math.min(6, Math.round(Number(j.time_advance_months) || 1))),
    headline: String(j.headline || 'Events unfold').slice(0, 140),
    narrative: String(j.narrative || '').slice(0, 4000),
    actions: Array.isArray(j.actions) ? j.actions : []
  };
}
function cleanRivals(j) {
  return {
    reactions: (Array.isArray(j.reactions) ? j.reactions : []).slice(0, 4).map(r => ({
      country: String(r.country || ''), leader: String(r.leader || '').slice(0, 80),
      statement: String(r.statement || '').slice(0, 500), intent: String(r.intent || '').slice(0, 300)
    })),
    actions: Array.isArray(j.actions) ? j.actions : []
  };
}
function cleanLesson(j) {
  const l = j.lesson || j || {};
  return {
    title: String(l.title || 'Meanwhile, in real history').slice(0, 120),
    what_really_happened: String(l.what_really_happened || '').slice(0, 1500),
    how_your_timeline_differs: String(l.how_your_timeline_differs || '').slice(0, 1000),
    why_it_matters: String(l.why_it_matters || '').slice(0, 800),
    key_terms: (Array.isArray(l.key_terms) ? l.key_terms : []).slice(0, 4).map(k => ({
      term: String(k.term || '').slice(0, 60), definition: String(k.definition || '').slice(0, 300)
    })),
    reflection_question: String(l.reflection_question || '').slice(0, 400),
    exam_skill: String(l.exam_skill || '').slice(0, 400)
  };
}

// ---------------- the turn pipeline ----------------
const TERRITORY_ACTIONS = ['occupy_territory', 'liberate_territory', 'annex_territory', 'capitulate'];

// A compact snapshot of the flashpoint territories, so the teacher can tell
// clock-driven history (the wider war's script) from the student's own
// deviations when writing how_your_timeline_differs.
function boardSnapshot(state) {
  const watch = ['Poland', 'Eastern Poland', 'France', 'North China', 'Southwest China', 'Hong Kong'];
  const territories = {};
  for (const name of watch) {
    const t = state.territories[name];
    if (!t) continue;
    const occ = Object.entries(t.occupation).map(([k, v]) => `${k} ${v}%`).join(', ');
    territories[name] = occ ? `${t.owner} (occupied: ${occ})` : t.owner;
  }
  return { wars: state.wars.map(([a, b]) => `${a} vs ${b}`), territories };
}

// Does the Game Master's prose claim a territorial or surrender change?
function claimsMapChange(gm) {
  if (!['success', 'partial'].includes(gm.feasibility)) return false;
  return /capitulat|surrend|armistice|annex|conquer|falls?\b|fell\b|occupi|seiz|liberat/i.test(`${gm.headline} ${gm.narrative}`);
}

function gmDiverges(gm) {
  return claimsMapChange(gm) && !gm.actions.some(a => TERRITORY_ACTIONS.includes(a.type));
}

// The narrative claims a map change but the actions do not make one. Catches
// the failure mode where the model narrates a map change but forgets the
// action, leaving the map out of date (e.g. the player annexes the Baltic
// states, the story says so, but no territory action arrives).
const ORDER_CHANGE_RE = /\b(annex|absorb|incorporate|cede|occupy|seize|capture|conquer|invade|liberate|take over|press for|demand)\b/i;

function needsRepair(state, order, gm, gmResult, mentions) {
  if (!['success', 'partial'].includes(gm.feasibility)) return false;
  const appliedTerritory = gmResult.applied.some(a => TERRITORY_ACTIONS.includes(a.type));
  // A territory action was emitted but the engine refused it (usually a
  // collective or misspelled name) — repair can fix the names.
  if (gmResult.rejected.some(r => TERRITORY_ACTIONS.includes(r.action?.type))) return true;
  if (claimsMapChange(gm) && !appliedTerritory) return true;
  // The order clearly means to change a foreign territory but the turn was a
  // complete no-op (no actions at all were applied).
  const foreign = (mentions?.territories || []).filter(t => state.territories[t.name]?.owner !== state.player);
  if (foreign.length && ORDER_CHANGE_RE.test(order) && gmResult.applied.length === 0) return true;
  return false;
}

// A small, focused agent that turns the Game Master's story into the engine
// actions it forgot. It only ever runs when needsRepair() is true, so normal
// turns pay nothing for it, and its prompt is tiny compared with the full
// Game Master prompt it replaces.
function effectsSystem(state, lang) {
  const scenario = getScenario(state.scenarioId);
  const plus = isSandboxPlus(state);
  const clockRule = plus
    ? '- There is no history clock in this mode. Emit every territorial, war, occupation, annexation or capitulation action the story describes, anywhere on the board.'
    : '- Do not start campaigns the history clock owns; apply only the player\'s order and its direct consequences.';
  return `You are the action writer for the engine of an educational grand-strategy game set in ${scenario.era}. The Game Master has already written what happened; your only job is to return the engine ACTIONS that make the board match that story. The Game Master sometimes describes a territorial change but forgets the action — supply it.
Rules:
- Output JSON only, exactly this shape: {"actions": [ ... ]}
- Add ONLY actions the story already describes. If the story changes no land, ownership, war, faction, relation or name, return an empty "actions" array.
- The map changes only through actions. A nation that is annexed, occupied, liberated or surrenders needs the matching action. A country or place that is renamed needs a rename action (this game only; keep using the original 1939 territory names in every other action).
- Use nation TAGS (e.g. "SOV") and the EXACT territory names from the world data. Never use collective names: emit one action per territory ("the Baltic states" is three actions: Estonia, Latvia, Lithuania).
${clockRule}
${actionSpec(scenario)}
Write any text fields in ${LANGS[lang] || 'English'}. Keep JSON keys and action types in English.`;
}

function effectsRequest(state, order, gm, rejected, mentions) {
  return {
    task: 'write_actions',
    player: state.player,
    player_nation: state.nations[state.player].name,
    player_order: order,
    game_master_story: {
      feasibility: gm.feasibility,
      headline: gm.headline,
      narrative: gm.narrative.slice(0, 1400),
      reason: gm.feasibility_reason
    },
    actions_the_engine_rejected: (rejected || []).map(r => ({ action: r.action, reason: r.reason })),
    territories_mentioned_in_the_order: (mentions?.territories || []).map(t => t.name),
    nations_mentioned_in_the_order: (mentions?.nations || []).map(n => n.tag),
    territories: Object.entries(state.territories).map(([name, t]) => {
      const occ = Object.entries(t.occupation).map(([k, v]) => `${k} ${v}%`).join(', ');
      return occ ? `${name}: ${t.owner} (occupied: ${occ})` : `${name}: ${t.owner}`;
    }),
    nations: Object.values(state.nations).filter(n => !n.minor)
      .map(n => ({ tag: n.tag, name: n.name, capitulated: n.capitulated || undefined })),
    wars: state.wars.map(([a, b]) => `${a} vs ${b}`)
  };
}

function cleanEffects(j) {
  return { actions: Array.isArray(j?.actions) ? j.actions : [] };
}

async function repairEffects(state, order, gm, rejected, mentions, lang, debug) {
  const request = effectsRequest(state, order, gm, rejected, mentions);
  const r = await chatJSON(effectsSystem(state, lang), request, { temperature: 0.2, maxTokens: 700 });
  const actions = cleanEffects(r.json).actions;
  const result = applyActions(state, actions, { source: 'game_master' });
  debug?.agents.push({
    agent: 'Effects (repair)', ms: r.ms, request, response: r.json,
    applied: result.applied, rejected: result.rejected
  });
  return result;
}

/**
 * Resolve one player order. Mutates `state`.
 * @returns {Promise<object>} the journal entry for this turn
 */
export async function runTurn(state, order, { lang = 'en' } = {}) {
  const scenario = getScenario(state.scenarioId);
  const useLLM = llmConfigured();
  const debug = { mode: useLLM ? 'llm' : 'offline-demo', agents: [] };
  const before = snapshotIndicators(state);
  const dateBefore = { ...state.date };
  state.lastChangedTerritories = [];

  // ---- 1. Game Master ----
  // Tell the model exactly which territories/nations the order names, so it
  // uses the real names instead of guessing (or writing "the Baltics").
  const mentions = scanMentions(state, order);
  const gmRequest = {
    task: 'resolve_player_order',
    player_order: order,
    ...(mentions.territories.length ? { territories_mentioned_in_the_order: mentions.territories.map(t => t.name) } : {}),
    ...(mentions.nations.length ? { nations_mentioned_in_the_order: mentions.nations.map(n => n.tag) } : {}),
    world: summarizeForLLM(state),
    real_history_nearby: eventsNear(scenario.timeline, state.date, 1, 4).map(e => ({ date: e.date, title: e.title, summary: e.summary }))
  };
  if (isSandboxPlus(state)) {
    gmRequest.sandbox_plus = 'Carry out the order in full. Set feasibility to success. Do not refuse, fail, or partly succeed.';
  }
  let gm;
  if (useLLM) {
    const gmSystem = gameMasterSystem(state, lang);
    const gmCall = (request, temperature) => chatJSON(gmSystem, request, { temperature, maxTokens: 3500 });
    let r = await gmCall(gmRequest, 0.8);
    gm = cleanGM(r.json);
    // If the narrative claims a map change but no territory action was emitted,
    // ask once more for the matching actions. Remaining gaps are then filled
    // by the Effects repair agent after applyActions.
    if (gmDiverges(gm)) {
      const retryRequest = {
        ...gmRequest,
        correction: isSandboxPlus(state)
          ? 'Your previous answer described a territorial or surrender change but emitted no matching territory action. Carry the order out in full, set feasibility to success, and add the correct actions (capitulate / occupy_territory / annex_territory / liberate_territory).'
          : 'Your previous answer described a territorial or surrender change but emitted no matching territory action. Keep the same outcome and add the correct actions (capitulate / occupy_territory / annex_territory / liberate_territory).'
      };
      r = await gmCall(retryRequest, 0.6);
      const gm2 = cleanGM(r.json);
      debug.agents.push({ agent: 'Game Master', note: 'corrective retry after narrative/action divergence', ms: r.ms, request: retryRequest, response: r.json });
      gm = gm2;
    }
    debug.agents.push({ agent: 'Game Master', ms: r.ms, request: gmRequest, response: r.json });
  } else {
    gm = cleanGM(mockGameMaster(state, order));
    debug.agents.push({ agent: 'Game Master (offline demo)', ms: 0, request: gmRequest, response: gm });
  }
  if (isSandboxPlus(state)) {
    if (gm.feasibility !== 'success') {
      gm.feasibility_reason = gm.interpretation || 'The order was carried out.';
    }
    gm.feasibility = 'success';
  }

  let gmResult = applyActions(state, gm.actions, { source: 'game_master' });

  // The Game Master sometimes narrates a map change without emitting the
  // action. A small, focused call repairs just the missing actions. It runs
  // before the history clock so the clock's preconditions see the new board.
  if (useLLM && needsRepair(state, order, gm, gmResult, mentions)) {
    try {
      const repair = await repairEffects(state, order, gm, gmResult.rejected, mentions, lang, debug);
      gmResult = {
        applied: [...gmResult.applied, ...repair.applied],
        rejected: [...gmResult.rejected, ...repair.rejected]
      };
    } catch (err) {
      debug.agents.push({ agent: 'Effects (repair)', error: err.message });
    }
  }

  const mapWarning = claimsMapChange(gm) && !gmResult.applied.some(a => TERRITORY_ACTIONS.includes(a.type));
  if (mapWarning) {
    debug.agents.push({ agent: 'Game Master', warning: 'Narrative describes a territorial or surrender change but no such action was applied; the map may not match the story.' });
  }

  // ---- the history clock: the wider war advances month by month ----
  // Replaces a single advanceTime(): each elapsed month first fires the
  // scripted events due in it (so September 1939 events stamp September),
  // then moves one month forward.
  const clock = runClockSkip(state, gm.time_advance_months);
  const months = clock.months;
  debug.agents.push({
    agent: 'History Clock', ms: 0,
    request: { months: gm.time_advance_months },
    response: { fired: clock.fired, hints: clock.hints, skipped: clock.skipped }
  });
  const dateAfter = { ...state.date };

  // ---- 2 + 3. Rival Leaders and History Teacher (parallel) ----
  const rivalsRequest = {
    task: 'react_as_ai_leaders',
    what_just_happened: {
      order, headline: gm.headline, narrative: gm.narrative, feasibility: gm.feasibility,
      meanwhile: clock.fired.map(e => ({ date: e.date, title: e.title, blurb: e.blurb }))
    },
    world: summarizeForLLM(state, { full: false })
  };
  const teacherRequest = {
    task: 'write_lesson',
    period: `${formatDate(dateBefore)} to ${formatDate(dateAfter)}`,
    student_nation: state.nations[state.player].name,
    student_order: order,
    game_outcome: { headline: gm.headline, narrative: gm.narrative, feasibility: gm.feasibility, reason: gm.feasibility_reason },
    history_clock: {
      fired: clock.fired.map(e => ({ date: e.date, title: e.title, blurb: e.blurb })),
      hints: clock.hints.map(e => ({ date: e.date, title: e.title, hint: e.hint }))
    },
    board_snapshot: boardSnapshot(state),
    real_events: eventsBetween(scenario.timeline, dateBefore, dateAfter).concat(eventsNear(scenario.timeline, dateAfter, 0, 2))
      .filter((e, i, arr) => arr.findIndex(x => x.date === e.date) === i)
      .map(e => ({ date: e.date, title: e.title, summary: e.summary, concepts: e.concepts }))
  };

  // The teacher only needs the Game Master's outcome, so it starts at once.
  // Meanwhile the rival leaders react, their actions are applied, and then the
  // advisors brief the player on the resulting situation.
  let rivals = { reactions: [], actions: [] };
  let lesson;
  const teacherTask = useLLM
    ? chatJSON(teacherSystem(state, lang), teacherRequest, { temperature: 0.4, maxTokens: 1200 })
        .then(r => ({ ok: true, r }), err => ({ ok: false, err }))
    : null;

  if (useLLM) {
    try {
      const rr = await chatJSON(rivalsSystem(state, lang), rivalsRequest, { temperature: 0.8, maxTokens: 1500 });
      rivals = cleanRivals(rr.json);
      debug.agents.push({ agent: 'Rival Leaders', ms: rr.ms, request: rivalsRequest, response: rr.json });
    } catch (err) {
      debug.agents.push({ agent: 'Rival Leaders', error: err.message, request: rivalsRequest });
    }
  } else {
    rivals = cleanRivals(mockRivals(state, gm));
    debug.agents.push({ agent: 'Rival Leaders (offline demo)', ms: 0, request: rivalsRequest, response: rivals });
  }

  const rivalResult = applyActions(state, rivals.actions, { source: 'rival_leaders', forbidActor: state.player });
  state.lastDeltas = computeDeltas(state, before);

  // ---- 4. Advisors (after the rivals, so they see the whole turn) ----
  const advisors = await briefAdvisors(state, {
    lang, turn: state.turn, debug, useLLM,
    lastTurn: {
      order, headline: gm.headline, feasibility: gm.feasibility, feasibility_reason: gm.feasibility_reason,
      narrative: gm.narrative.slice(0, 900),
      meanwhile: clock.fired.map(e => ({ date: e.date, title: e.title })),
      reactions: rivals.reactions.map(r => ({ country: r.country, statement: r.statement, intent: r.intent }))
    }
  });

  if (useLLM) {
    const tr = await teacherTask;
    if (tr.ok) {
      lesson = cleanLesson(tr.r.json);
      debug.agents.push({ agent: 'History Teacher', ms: tr.r.ms, request: teacherRequest, response: tr.r.json });
    } else {
      lesson = cleanLesson(mockTeacher(state, dateBefore, dateAfter, order));
      debug.agents.push({ agent: 'History Teacher', error: tr.err.message, request: teacherRequest, fallback: 'offline lesson used' });
    }
  } else {
    lesson = cleanLesson(mockTeacher(state, dateBefore, dateAfter, order));
    debug.agents.push({ agent: 'History Teacher (offline demo)', ms: 0, request: teacherRequest, response: { lesson } });
  }

  // ---- bookkeeping ----
  const entry = {
    turn: state.turn,
    dateBefore: formatDate(dateBefore),
    dateAfter: formatDate(dateAfter),
    monthsPassed: months,
    order,
    interpretation: gm.interpretation,
    feasibility: gm.feasibility,
    feasibilityReason: gm.feasibility_reason,
    headline: gm.headline,
    narrative: gm.narrative,
    mapWarning,
    meanwhile: [...clock.fired, ...clock.hints],
    reactions: rivals.reactions,
    advisors,
    lesson,
    reflection: '',
    deltas: state.lastDeltas[state.player] || {},
    changedTerritories: [...state.lastChangedTerritories]
  };
  state.journal.push(entry);
  state.advisors = advisors;
  state.turn++;
  state.version++;
  state.gameOver = checkGameOver(state);

  debug.applied = [...gmResult.applied, ...clock.applied, ...rivalResult.applied];
  debug.rejected = [...gmResult.rejected, ...clock.rejected, ...rivalResult.rejected];
  state.lastTurnDebug = debug;
  return entry;
}

// ---------------- 4. End-of-campaign report ----------------
function reportSystem(state, lang) {
  const scenario = getScenario(state.scenarioId);
  const plus = isSandboxPlus(state);
  const realismRubric = plus
    ? '- historical_realism: how thoroughly the student remade the timeline compared with 1939-45. Reward wide-ranging changes; do not penalise ahistorical success.'
    : '- historical_realism: how closely the student\'s decisions and their timeline match what was actually possible and what really happened in this period. Reward plausible choices consistent with the era; penalise ahistorical leaps.';
  const examinerVoice = plus
    ? 'Use the metrics as evidence. Do not invent numbers that are not in the data. Be fair and encouraging.'
    : 'Use the metrics as evidence. Do not invent numbers that are not in the data. Be fair and encouraging, and remember the audience is students aged 12-18.';
  return `You are the examiner writing the final after-action report for a student who has just finished an educational grand-strategy campaign set in ${scenario.era}, ${scenario.setting}. The student has now chosen to end the campaign.
You are given deterministic metrics computed by the game engine (territory changes, indicator changes, wars, feasibility of decisions, alignment signals) and a summary of every turn. Grade the student on each rubric below from 0 to 100, where 50 is an average outcome, 70 is strong, 85+ is exceptional and below 30 is poor.
Rubrics:
${realismRubric}
- strategic_effectiveness: whether the student achieved their goals, held or expanded territory, and managed wars and alliances well.
- economic_management: how well GDP, industry, resources and manpower were handled.
- diplomacy: alliances, relations, treaties and the handling of other powers.
- decision_quality: clarity, consistency and judgment across the whole campaign, including learning from setbacks.
Then identify the 3-6 MOST IMPORTANT decisions the student made, and for each explain its consequence. Finally, compare the student's timeline with real history and give 3-5 short lessons.
${examinerVoice}
${plus ? '' : SAFETY}
Write all text fields in ${LANGS[lang] || 'English'}. Keep JSON keys in English.
Respond with JSON only:
{
  "summary": "3-5 sentence overall assessment",
  "grades": {
    "historical_realism": { "score": 0-100, "rationale": "1-2 sentences" },
    "strategic_effectiveness": { "score": 0-100, "rationale": "1-2 sentences" },
    "economic_management": { "score": 0-100, "rationale": "1-2 sentences" },
    "diplomacy": { "score": 0-100, "rationale": "1-2 sentences" },
    "decision_quality": { "score": 0-100, "rationale": "1-2 sentences" }
  },
  "key_decisions": [ { "turn": NUMBER, "order": "the order given", "outcome": "what happened", "impact": "why it mattered", "rating": "wise|mixed|costly" } ],
  "timeline_diff": [ { "real_history": "what really happened", "your_timeline": "what happened in the game" } ],
  "lessons": [ "one-sentence takeaway" ]
}`;
}

function clampScore(v, fallback = 50) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback;
}

function cleanReport(j, scenario) {
  const g = j.grades || {};
  const grade = (key) => {
    const raw = g[key] || {};
    return { score: clampScore(raw.score), rationale: String(raw.rationale || '').slice(0, 500) };
  };
  const keys = Object.keys(DEFAULT_WEIGHTS);
  const grades = {};
  for (const k of keys) grades[k] = grade(k);
  return {
    summary: String(j.summary || '').slice(0, 2000),
    grades,
    key_decisions: (Array.isArray(j.key_decisions) ? j.key_decisions : []).slice(0, 8).map(d => ({
      turn: Math.max(0, Math.round(Number(d.turn) || 0)),
      order: String(d.order || '').slice(0, 300),
      outcome: String(d.outcome || '').slice(0, 400),
      impact: String(d.impact || '').slice(0, 400),
      rating: ['wise', 'mixed', 'costly'].includes(d.rating) ? d.rating : 'mixed'
    })),
    timeline_diff: (Array.isArray(j.timeline_diff) ? j.timeline_diff : []).slice(0, 10).map(t => ({
      real_history: String(t.real_history || '').slice(0, 400),
      your_timeline: String(t.your_timeline || '').slice(0, 400)
    })),
    lessons: (Array.isArray(j.lessons) ? j.lessons : []).map(String).slice(0, 8)
  };
}

/**
 * Generate (and cache) the end-of-campaign report. Deterministic metrics come
 * from the engine; the grades come from the LLM and are combined by the engine
 * with fixed weights, so the overall score is reproducible.
 * @returns {Promise<object>} the stored report
 */
export async function generateReport(state, { lang = 'en', regenerate = false } = {}) {
  if (state.report && !regenerate) return state.report;
  const scenario = getScenario(state.scenarioId);
  const metrics = computeMetrics(state);
  const useLLM = llmConfigured();
  const debug = { mode: useLLM ? 'llm' : 'offline-demo', agents: [] };

  const request = {
    task: 'write_after_action_report',
    scenario: { id: scenario.id, title: scenario.title, era: scenario.era, start: scenario.startDate, end: scenario.endDate },
    player: { tag: state.player, name: state.nations[state.player].name, leader: state.nations[state.player].leader },
    metrics,
    turns: state.journal.map(j => ({
      turn: j.turn, date: j.dateBefore, order: j.order, feasibility: j.feasibility,
      headline: j.headline, narrative: String(j.narrative || '').slice(0, 400),
      deltas: j.deltas, changedTerritories: j.changedTerritories
    })),
    real_history: scenario.timeline
      .filter(e => { const [y, m] = e.date.split('-').map(Number); const k = y * 12 + m - 1; return k >= monthIndex(scenario.startDate) && k <= monthIndex(state.date); })
      .map(e => ({ date: e.date, title: e.title, summary: e.summary }))
  };

  let cleaned;
  if (useLLM) {
    try {
      const r = await chatJSON(reportSystem(state, lang), request, { temperature: 0.2, maxTokens: 2200 });
      cleaned = cleanReport(r.json, scenario);
      debug.agents.push({ agent: 'Campaign Examiner', ms: r.ms, request, response: r.json });
    } catch (err) {
      cleaned = cleanReport(mockReport(state, metrics), scenario);
      debug.agents.push({ agent: 'Campaign Examiner', error: err.message, request, fallback: 'offline report used' });
    }
  } else {
    cleaned = cleanReport(mockReport(state, metrics), scenario);
    debug.agents.push({ agent: 'Campaign Examiner (offline demo)', ms: 0, request, response: cleaned });
  }

  const overall = scoreFromGrades(cleaned.grades, applyWeights(scenario));
  state.report = {
    generatedAt: new Date().toISOString(),
    scenarioId: scenario.id,
    player: state.player,
    playerName: state.nations[state.player].name,
    turns: state.journal.length,
    period: `${formatDate(scenario.startDate)} – ${formatDate(state.date)}`,
    metrics,
    ...cleaned,
    overall,
    weights: applyWeights(scenario),
    engine: { deterministicMetrics: true, weights: applyWeights(scenario), grader: useLLM ? 'llm' : 'offline' }
  };
  state.lastReportDebug = debug;
  return state.report;
}

export { monthIndex, fromIndex, ACTION_TYPES, needsRepair, cleanEffects, isSandboxPlus, gameMasterSystem, rivalsSystem, teacherSystem, advisorsSystem, reportSystem };
