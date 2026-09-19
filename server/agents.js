// Agents — the AI "game engine".
// ------------------------------------------------------------------
// One turn = three agents:
//   1. Game Master     reads the player's order, judges plausibility, decides how
//                      much time passes, writes the narrative and emits ACTIONS.
//   2. Rival Leaders   the AI-controlled leaders of the other powers react.
//   3. History Teacher compares the student's timeline with real history and
//                      writes a short lesson + reflection question.
// Agents 2 and 3 run in parallel after agent 1.
// Every agent returns JSON. Only server/engine.js changes the game state.

import {
  applyActions, advanceTime, snapshotIndicators, computeDeltas, checkGameOver,
  summarizeForLLM, formatDate, monthIndex, fromIndex, INDICATORS, ACTION_TYPES
} from './engine.js';
import { eventsNear, eventsBetween } from './data/timeline.js';
import { chatJSON, llmConfigured } from './llm.js';
import { mockGameMaster, mockRivals, mockTeacher } from './mock.js';

const LANGS = {
  en: 'English',
  'zh-Hant': 'Traditional Chinese (as used in Hong Kong)',
  'zh-Hans': 'Simplified Chinese'
};

// ---------------- shared prompt fragments ----------------
const ACTION_SPEC = `
ACTIONS you may emit (JSON objects in an "actions" array). Use nation TAGS (e.g. "GER") and the exact territory names from the world data.
- {"type":"change_indicator","country":TAG,"indicator":NAME,"delta":NUMBER,"reason":TEXT}
- {"type":"set_indicator","country":TAG,"indicator":NAME,"value":NUMBER,"reason":TEXT}
- {"type":"occupy_territory","territory":NAME,"occupier":TAG,"delta":PERCENT_CHANGE,"reason":TEXT}   (or "percent" for an absolute value 0-100; partial control of a territory)
- {"type":"liberate_territory","territory":NAME,"occupier":TAG_OPTIONAL,"percent":OPTIONAL,"by":TAG,"reason":TEXT}
- {"type":"annex_territory","territory":NAME,"new_owner":TAG,"reason":TEXT}   (full, formal transfer — only after a territory is fully conquered or ceded by treaty)
- {"type":"declare_war","attacker":TAG,"defender":TAG}
- {"type":"make_peace","a":TAG,"b":TAG}
- {"type":"join_faction","country":TAG,"faction":"Allies"|"Axis"|"Comintern"|NEW_NAME}
- {"type":"leave_faction","country":TAG}
- {"type":"change_relation","a":TAG,"b":TAG,"delta":-40..40}
- {"type":"set_leader","country":TAG,"leader":TEXT}
- {"type":"add_event","title":TEXT,"description":TEXT,"category":"war"|"diplomacy"|"economy"|"politics"|"other","territories":[NAMES]}
Indicators: ${Object.entries(INDICATORS).map(([k, v]) => `${k} (${v.min}-${v.max}${v.unit ? ' ' + v.unit : ''})`).join(', ')}.
Typical changes per turn are small: 1-10 points. GDP changes are a few percent. Big swings only for dramatic events.
Use add_event only for milestones worth a place on the timeline (wars, treaties, conquests, regime change).`;

const SAFETY = `
AUDIENCE AND SAFETY: players are school students aged about 12-18 using this in history lessons.
- Write clearly and accurately, without graphic violence or gore. Casualties may be stated factually.
- The Holocaust and other atrocities are real history: when relevant, mention them soberly and accurately; never deny, minimise or glorify them.
- Never let the player carry out genocide, massacres of civilians, ethnic cleansing or similar atrocities as gameplay. If an order asks for that, set feasibility to "refused", emit no actions for it, and use the narrative to explain calmly why the game will not simulate it and what the real historical consequences of such crimes were.
- Leaders' words you write are in-game dialogue. Never present invented sentences as real historical quotations.
- Do not produce hateful stereotypes of any people.`;

// ---------------- 1. Game Master ----------------
function gameMasterSystem(state, lang) {
  const realism = state.realism === 'sandbox'
    ? 'REALISM MODE: sandbox. The student is exploring "what if" ideas. Let bold orders mostly succeed, but still show realistic costs and reactions.'
    : 'REALISM MODE: historical. Judge each order against the real capabilities of the time (distance, logistics, navies, industry, public opinion, politics). Impossible orders fail or partly succeed, and the narrative explains why — that explanation is the lesson.';
  return `You are the Game Master of an educational grand-strategy game set in the Second World War (starting 1 September 1939). You are the game's rules engine.
The student plays ${state.nations[state.player].name}. Each turn they type an order in plain language. You:
1. Interpret the order (it may name several actions, or speak on behalf of other nations — e.g. "Germany takes 10% of Canada" — treat it as the player's intention for the story).
2. Judge feasibility: "success", "partial", "failed" or "refused".
3. Decide how many months pass (1-6; small tactical orders 1 month, economic plans or long campaigns 3-6).
4. Write what happened as a short, vivid history-book narrative (2-3 paragraphs, under 220 words total) that blends real history with the student's changes.
5. Emit ACTIONS that make the game state match the narrative — every number you change must be explained by the story.
${realism}
${ACTION_SPEC}
${SAFETY}
Write all text fields in ${LANGS[lang] || 'English'}. Keep JSON keys, action types and tags in English.
Respond with JSON only, in exactly this shape:
{
  "interpretation": "one sentence: what the student ordered",
  "feasibility": "success|partial|failed|refused",
  "feasibility_reason": "one or two sentences",
  "time_advance_months": 1,
  "headline": "newspaper-style headline, max 12 words",
  "narrative": "the story of what happened",
  "actions": [ ... ],
  "advisor_notes": ["+ Industry: factories converted to tanks", "- Stability: strikes in the Ruhr"]
}`;
}

// ---------------- 2. Rival Leaders ----------------
function rivalsSystem(state, lang) {
  return `You play the AI-controlled leaders of every nation EXCEPT ${state.nations[state.player].name} (the student's nation, tag ${state.player}) in an educational Second World War strategy game.
Each leader acts in character and in line with their nation's real interests, ideology and historical strategy at this date (e.g. Britain and France honour guarantees; the USA stays officially neutral until attacked or provoked; Stalin is opportunistic and suspicious), but they REACT to what the student just did.
Choose the 1-3 most relevant leaders to respond this turn. Give each a short in-game statement and emit actions ONLY for their own nations (never for ${state.player}). Keep effects modest unless the situation is dramatic.
${ACTION_SPEC}
${SAFETY}
Write text fields in ${LANGS[lang] || 'English'}. Keep JSON keys, action types and tags in English.
Respond with JSON only:
{
  "reactions": [ { "country": "TAG", "leader": "name", "statement": "1-2 sentences of in-game dialogue", "intent": "what they will do next, one sentence" } ],
  "actions": [ ... ]
}`;
}

// ---------------- 3. History Teacher ----------------
function teacherSystem(lang) {
  return `You are a friendly, precise history teacher for students aged 12-18 (e.g. preparing for HKDSE, IGCSE or AP history). After each turn of a Second World War simulation you write a short lesson comparing the student's alternate timeline with what REALLY happened in the same period.
Rules: only state real history you are confident about; use the "real_events" list as your anchor. Explain cause and consequence. Be encouraging, never preachy. Keep every field brief (the whole lesson under 200 words).
${SAFETY}
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
    actions: Array.isArray(j.actions) ? j.actions : [],
    advisor_notes: (Array.isArray(j.advisor_notes) ? j.advisor_notes : []).map(String).slice(0, 10)
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
/**
 * Resolve one player order. Mutates `state`.
 * @returns {Promise<object>} the journal entry for this turn
 */
export async function runTurn(state, order, { lang = 'en' } = {}) {
  const useLLM = llmConfigured();
  const debug = { mode: useLLM ? 'llm' : 'offline-demo', agents: [] };
  const before = snapshotIndicators(state);
  const dateBefore = { ...state.date };
  state.lastChangedTerritories = [];

  // ---- 1. Game Master ----
  const gmRequest = {
    task: 'resolve_player_order',
    player_order: order,
    world: summarizeForLLM(state),
    real_history_nearby: eventsNear(state.date, 1, 4).map(e => ({ date: e.date, title: e.title, summary: e.summary }))
  };
  let gm;
  if (useLLM) {
    const r = await chatJSON(gameMasterSystem(state, lang), gmRequest, { temperature: 0.8, maxTokens: 2500 });
    gm = cleanGM(r.json);
    debug.agents.push({ agent: 'Game Master', ms: r.ms, request: gmRequest, response: r.json });
  } else {
    gm = cleanGM(mockGameMaster(state, order));
    debug.agents.push({ agent: 'Game Master (offline demo)', ms: 0, request: gmRequest, response: gm });
  }

  const gmResult = applyActions(state, gm.actions, { source: 'game_master' });
  const months = advanceTime(state, gm.time_advance_months);
  const dateAfter = { ...state.date };

  // ---- 2 + 3. Rival Leaders and History Teacher (parallel) ----
  const rivalsRequest = {
    task: 'react_as_ai_leaders',
    what_just_happened: { order, headline: gm.headline, narrative: gm.narrative, feasibility: gm.feasibility },
    world: summarizeForLLM(state, { full: false })
  };
  const teacherRequest = {
    task: 'write_lesson',
    period: `${formatDate(dateBefore)} to ${formatDate(dateAfter)}`,
    student_nation: state.nations[state.player].name,
    student_order: order,
    game_outcome: { headline: gm.headline, narrative: gm.narrative, feasibility: gm.feasibility, reason: gm.feasibility_reason },
    real_events: eventsBetween(dateBefore, dateAfter).concat(eventsNear(dateAfter, 0, 2))
      .filter((e, i, arr) => arr.findIndex(x => x.date === e.date) === i)
      .map(e => ({ date: e.date, title: e.title, summary: e.summary, concepts: e.concepts }))
  };

  let rivals = { reactions: [], actions: [] };
  let lesson;
  if (useLLM) {
    const [rr, tr] = await Promise.allSettled([
      chatJSON(rivalsSystem(state, lang), rivalsRequest, { temperature: 0.8, maxTokens: 1500 }),
      chatJSON(teacherSystem(lang), teacherRequest, { temperature: 0.4, maxTokens: 1200 })
    ]);
    if (rr.status === 'fulfilled') {
      rivals = cleanRivals(rr.value.json);
      debug.agents.push({ agent: 'Rival Leaders', ms: rr.value.ms, request: rivalsRequest, response: rr.value.json });
    } else {
      debug.agents.push({ agent: 'Rival Leaders', error: rr.reason.message, request: rivalsRequest });
    }
    if (tr.status === 'fulfilled') {
      lesson = cleanLesson(tr.value.json);
      debug.agents.push({ agent: 'History Teacher', ms: tr.value.ms, request: teacherRequest, response: tr.value.json });
    } else {
      lesson = cleanLesson(mockTeacher(state, dateBefore, dateAfter, order));
      debug.agents.push({ agent: 'History Teacher', error: tr.reason.message, request: teacherRequest, fallback: 'offline lesson used' });
    }
  } else {
    rivals = cleanRivals(mockRivals(state, gm));
    lesson = cleanLesson(mockTeacher(state, dateBefore, dateAfter, order));
    debug.agents.push({ agent: 'Rival Leaders (offline demo)', ms: 0, request: rivalsRequest, response: rivals });
    debug.agents.push({ agent: 'History Teacher (offline demo)', ms: 0, request: teacherRequest, response: { lesson } });
  }

  const rivalResult = applyActions(state, rivals.actions, { source: 'rival_leaders', forbidActor: state.player });

  // ---- bookkeeping ----
  state.lastDeltas = computeDeltas(state, before);
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
    advisorNotes: gm.advisor_notes,
    reactions: rivals.reactions,
    lesson,
    reflection: '',
    deltas: state.lastDeltas[state.player] || {},
    changedTerritories: [...state.lastChangedTerritories]
  };
  state.journal.push(entry);
  state.turn++;
  state.version++;
  state.gameOver = checkGameOver(state);

  debug.applied = [...gmResult.applied, ...rivalResult.applied];
  debug.rejected = [...gmResult.rejected, ...rivalResult.rejected];
  state.lastTurnDebug = debug;
  return entry;
}

export { monthIndex, fromIndex, ACTION_TYPES };
