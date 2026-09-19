// Offline demo mode
// ------------------------------------------------------------------
// Used when no LLM API key is configured, so the game runs out of the box.
// These are simple keyword rules — they only exist to let you test the UI and
// the JSON → action pipeline. They return JSON in EXACTLY the same shape as the
// real agents, so everything downstream is identical.

import { getScenario } from './data/scenarios/index.js';
import { resolveNation, atWar, warsOf, formatDate, relation, territoriesOf } from './engine.js';
import { eventsBetween, eventsNear } from './data/timeline.js';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Find nations and territories mentioned in the text, with their position.
function scanMentions(state, text) {
  const scenario = getScenario(state.scenarioId);
  const lower = ' ' + text.toLowerCase() + ' ';
  const nations = [], territories = [];
  const nationNames = new Map();
  for (const [alias, tag] of Object.entries(scenario.aliases)) nationNames.set(alias, tag);
  for (const n of Object.values(state.nations)) if (!n.minor) nationNames.set(n.name.toLowerCase(), n.tag);
  for (const [name, tag] of nationNames) {
    const m = lower.match(new RegExp(`[^a-z]${esc(name)}[^a-z]`));
    if (m) nations.push({ tag, pos: m.index, name });
  }
  const terrNames = new Map();
  for (const name of Object.keys(state.territories)) terrNames.set(name.toLowerCase(), name);
  for (const [alias, name] of Object.entries(scenario.territoryAliases)) terrNames.set(alias, name);
  for (const [lname, name] of terrNames) {
    const m = lower.match(new RegExp(`[^a-z]${esc(lname)}[^a-z]`));
    if (m) territories.push({ name, pos: m.index });
  }
  nations.sort((a, b) => a.pos - b.pos);
  territories.sort((a, b) => a.pos - b.pos);
  return { nations, territories };
}

export function mockGameMaster(state, order) {
  const text = order.toLowerCase();
  const player = state.player;
  const P = state.nations[player];
  const { nations, territories } = scanMentions(state, order);
  const actions = [], notes = [];
  let months = 1, feasibility = 'success', reason = 'Offline demo mode applies simple rules.';
  let headline = `${P.name} issues new orders`;
  const story = [];

  const verbAt = text.search(/\b(take|taking|takes|invade|invades|occupy|occupies|seize|capture|conquer|attack|attacks|push into|advance into)\b/);
  const pctMatch = text.match(/(\d{1,3})\s*(%|percent)/);

  // Who is acting? A nation named before the verb, else the player.
  let actor = player;
  if (verbAt >= 0) {
    const before = nations.filter(n => n.pos < verbAt + 1);
    if (before.length) actor = before[0].tag;
  }
  const A = state.nations[actor];

  // A nation named after the verb ("take 20% of China") means its home territory.
  if (verbAt >= 0) {
    for (const n of nations) {
      const home = state.nations[n.tag]?.home;
      if (n.pos > verbAt && n.tag !== actor && home && state.territories[home] && !territories.some(t => t.name === home)) {
        territories.push({ name: home, pos: n.pos + 0.5 });
      }
    }
    territories.sort((a, b) => a.pos - b.pos);
  }

  if (verbAt >= 0 && territories.length) {
    const target = territories.find(t => t.pos > verbAt && state.territories[t.name].owner !== actor)
      || territories.find(t => state.territories[t.name].owner !== actor);
    if (target) {
      const terr = state.territories[target.name];
      const owner = terr.owner;
      const O = state.nations[owner];
      let delta = pctMatch ? Math.min(100, Number(pctMatch[1])) : 15;
      if (!atWar(state, actor, owner)) {
        actions.push({ type: 'declare_war', attacker: actor, defender: owner });
        story.push(`${A.name} declared war on ${O.name}.`);
      }
      const ratio = (A.indicators.army + 1) / (O.indicators.army + 1);
      if (state.realism === 'historical' && ratio < 0.8) {
        delta = Math.max(3, Math.round(delta / 2));
        feasibility = 'partial';
        reason = `${O.name}'s forces were stronger than expected, so only part of the objective was taken.`;
        actions.push({ type: 'change_indicator', country: actor, indicator: 'army_support', delta: -3, reason: 'Generals blame the political leadership for the setback' });
      }
      const current = terr.occupation[actor] || 0;
      if (current + delta >= 100) {
        actions.push({ type: 'annex_territory', territory: target.name, new_owner: actor, reason: 'Complete conquest' });
        actions.push({ type: 'add_event', title: `${A.name} conquers ${target.name}`, description: `${target.name} is now fully under ${A.name}'s control.`, category: 'war', territories: [target.name] });
        story.push(`After heavy fighting, ${target.name} fell completely under ${A.name}'s control.`);
        headline = `${target.name} falls to ${A.name}`;
      } else {
        actions.push({ type: 'occupy_territory', territory: target.name, occupier: actor, delta, reason: 'Military advance' });
        actions.push({ type: 'add_event', title: `${A.name} advances into ${target.name}`, description: `${A.name} now holds about ${current + delta}% of ${target.name}.`, category: 'war', territories: [target.name] });
        story.push(`${A.name}'s forces pushed into ${target.name}, taking about ${delta}% of it.`);
        headline = `${A.name} pushes into ${target.name}`;
      }
      actions.push({ type: 'change_indicator', country: actor, indicator: 'army', delta: -3, reason: 'Losses in the offensive' });
      actions.push({ type: 'change_indicator', country: actor, indicator: 'war_support', delta: -2, reason: 'Casualty reports' });
      actions.push({ type: 'change_indicator', country: owner, indicator: 'stability', delta: -6, reason: 'Invasion' });
      actions.push({ type: 'change_relation', a: owner, b: actor, delta: -30 });
      notes.push(`- ${A.name} army: losses in the offensive`, `- ${O.name} stability: invasion`);
    }
  } else if (/declare war/.test(text) && nations.length) {
    const t = nations.find(n => n.tag !== player);
    if (t && !atWar(state, player, t.tag)) {
      actions.push({ type: 'declare_war', attacker: player, defender: t.tag });
      actions.push({ type: 'add_event', title: `${P.name} declares war on ${state.nations[t.tag].name}`, description: 'A new front opens.', category: 'war', territories: [state.nations[t.tag].home] });
      actions.push({ type: 'change_indicator', country: player, indicator: 'war_support', delta: 4, reason: 'Patriotic rallies' });
      story.push(`${P.name} formally declared war on ${state.nations[t.tag].name}.`);
      headline = `${P.name} declares war on ${state.nations[t.tag].name}`;
    }
  } else if (/(peace|ceasefire|armistice)/.test(text) && nations.length) {
    const t = nations.find(n => n.tag !== player && atWar(state, player, n.tag));
    if (t) {
      actions.push({ type: 'make_peace', a: player, b: t.tag });
      actions.push({ type: 'add_event', title: `Peace between ${P.name} and ${state.nations[t.tag].name}`, description: 'The guns fall silent on this front.', category: 'diplomacy', territories: [] });
      story.push(`Negotiators agreed to end the fighting between ${P.name} and ${state.nations[t.tag].name}.`);
      headline = 'A peace is signed';
    } else {
      feasibility = 'failed'; reason = 'You are not at war with that nation.';
      story.push('Diplomats found nothing to negotiate — there was no war to end.');
    }
  }

  if (/(industr|factor|five-year|economy|production)/.test(text)) {
    months = Math.max(months, 3);
    actions.push({ type: 'change_indicator', country: player, indicator: 'industry', delta: 5, reason: 'Industrial programme' });
    actions.push({ type: 'change_indicator', country: player, indicator: 'gdp', delta: Math.round(P.indicators.gdp * 0.03), reason: 'Growth' });
    actions.push({ type: 'change_indicator', country: player, indicator: 'stability', delta: -2, reason: 'Long working hours' });
    story.push('New factories were built and production quotas raised, though workers grumbled about longer hours.');
    notes.push('+ Industry: new factories', '- Stability: longer working hours');
  }
  const mil = [['army', /(army|tank|recruit|mobili|conscript|infantry)/], ['navy', /(navy|ship|fleet|submarine|u-boat)/], ['air', /(air force|plane|aircraft|bomber|fighter|luftwaffe|raf)/]];
  for (const [k, re] of mil) {
    if (re.test(text) && verbAt < 0) {
      months = Math.max(months, 2);
      actions.push({ type: 'change_indicator', country: player, indicator: k, delta: 6, reason: 'Rearmament' });
      actions.push({ type: 'change_indicator', country: player, indicator: 'army_support', delta: 2, reason: 'Officers welcome new equipment' });
      actions.push({ type: 'change_indicator', country: player, indicator: 'gdp', delta: -Math.round(P.indicators.gdp * 0.01), reason: 'Military spending' });
      story.push(`Resources were poured into the ${k === 'air' ? 'air force' : k}.`);
      notes.push(`+ ${k}: rearmament`, '+ Army support: officers welcome new equipment', '- GDP: military spending');
    }
  }
  if (/(propaganda|speech|rally|newspaper|radio)/.test(text)) {
    actions.push({ type: 'change_indicator', country: player, indicator: 'war_support', delta: 5, reason: 'Propaganda campaign' });
    actions.push({ type: 'change_indicator', country: player, indicator: 'citizen_support', delta: 3, reason: 'Propaganda campaign' });
    story.push('Radio broadcasts and posters worked to shape public opinion.');
    notes.push('+ War support: propaganda', '+ Citizen support: propaganda');
  }
  const faction = text.match(/\b(allies|axis|comintern|united front)\b/);
  if (faction && /(join|ally|alliance)/.test(text)) {
    const f = faction[1].replace(/\b\w/g, c => c.toUpperCase());
    actions.push({ type: 'join_faction', country: player, faction: f });
    actions.push({ type: 'add_event', title: `${P.name} joins the ${f}`, description: 'A new alignment reshapes the war.', category: 'diplomacy', territories: [P.home] });
    story.push(`${P.name} formally aligned itself with the ${f}.`);
    headline = `${P.name} joins the ${f}`;
  }

  if (!actions.length) {
    feasibility = 'partial';
    reason = 'Offline demo mode only understands simple orders (invade/take X% of a country, declare war, peace, industry, army/navy/air, propaganda, join a faction). Add a DeepSeek API key for full AI interpretation.';
    actions.push({ type: 'change_indicator', country: player, indicator: 'stability', delta: 1, reason: 'Steady government' });
    story.push(`Officials in ${P.name} studied the order carefully, but little changed on the ground this month.`);
  }

  return {
    interpretation: `The player ordered: "${order.slice(0, 160)}"`,
    feasibility, feasibility_reason: reason,
    time_advance_months: months,
    headline,
    narrative: story.join(' ') + '\n\n(Offline demo mode — connect an LLM in .env for full AI narration.)',
    actions,
    advisor_notes: notes
  };
}

export function mockRivals(state, gm) {
  const player = state.player;
  const reactions = [], actions = [];
  const aggressive = gm.actions.some(a => ['declare_war', 'occupy_territory', 'annex_territory'].includes(a.type));
  const enemies = warsOf(state, player).map(t => state.nations[t]).filter(n => n && !n.minor);
  const responder = enemies[enemies.length - 1]
    || Object.values(state.nations).find(n => !n.minor && n.tag !== player && n.tag !== 'USA');
  if (responder) {
    reactions.push({
      country: responder.tag, leader: responder.leader,
      statement: aggressive
        ? `${responder.name} will not stand by while ${state.nations[player].name} expands by force.`
        : `${responder.name} is watching ${state.nations[player].name} closely.`,
      intent: aggressive ? 'Mobilise and strengthen defences.' : 'Wait and observe.'
    });
    actions.push({ type: 'change_indicator', country: responder.tag, indicator: aggressive ? 'war_support' : 'stability', delta: aggressive ? 4 : 1, reason: 'Reaction to events' });
  }
  if (aggressive && player !== 'USA' && state.nations.USA) {
    reactions.push({ country: 'USA', leader: state.nations.USA.leader, statement: 'The United States remains neutral, but American opinion is shifting.', intent: 'Watch the war; consider aid to the embattled powers.' });
    actions.push({ type: 'change_indicator', country: 'USA', indicator: 'war_support', delta: 2, reason: 'News from abroad' });
  }
  return { reactions, actions };
}

export function mockTeacher(state, dateBefore, dateAfter, order) {
  const scenario = getScenario(state.scenarioId);
  let events = eventsBetween(scenario.timeline, dateBefore, dateAfter);
  if (!events.length) events = eventsNear(scenario.timeline, dateAfter, 0, 3);
  if (!events.length) events = [scenario.timeline[scenario.timeline.length - 1]];
  const e = events[0];
  return {
    lesson: {
      title: e.title,
      what_really_happened: events.slice(0, 3).map(x => `${x.date}: ${x.summary}`).join(' '),
      how_your_timeline_differs: `In your game, ${state.nations[state.player].name} chose a different path: “${order.slice(0, 120)}”. Compare the results with the real events above.`,
      why_it_matters: 'Historians study turning points to understand how decisions, geography, economics and ideology combined to cause events.',
      key_terms: (e.concepts || []).slice(0, 2).map(t => ({ term: t, definition: 'Look this term up in your textbook and note one example from the period.' })),
      reflection_question: `Why do you think the real leaders acted differently from you in ${formatDate(dateBefore)}? Give one reason.`,
      exam_skill: 'In an essay, compare two causes and explain which mattered more — use one real event from this period as evidence.'
    }
  };
}

// Deterministic offline after-action report. Mirrors the shape the LLM returns
// so cleanReport() and the frontend treat both identically.
export function mockReport(state, metrics) {
  const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
  const f = metrics.feasibility || {};
  const decisions = (f.success || 0) + (f.partial || 0) + (f.failed || 0) + (f.refused || 0);
  const successRate = decisions ? ((f.success || 0) + 0.5 * (f.partial || 0)) / decisions : 0.5;
  const netTerritory = (metrics.territoriesGained?.length || 0) - (metrics.territoriesLost?.length || 0);
  const econ = metrics.indicatorChanges || {};
  const econScore = 50 + (econ.gdp || 0) * 0.15 + (econ.industry || 0) * 0.6 + (econ.resources || 0) * 0.3;
  const realism = 40 + successRate * 50 - (metrics.playerCapitulated ? 20 : 0);
  const strategic = 50 + netTerritory * 6 + (metrics.enemiesDefeated?.length || 0) * 10 - (metrics.playerCapitulated ? 30 : 0);
  const diplomacy = 50 + (metrics.warsEnded?.length || 0) * 8 - (metrics.warsStarted?.length || 0) * 6;
  const quality = 35 + successRate * 55;

  const keyDecisions = [...state.journal].reverse().slice(0, 5).map(j => ({
    turn: j.turn,
    order: j.order,
    outcome: j.headline,
    impact: `${(j.changedTerritories || []).length ? `Changed ${j.changedTerritories.join(', ')}. ` : ''}${j.feasibility}.`,
    rating: j.feasibility === 'success' ? 'wise' : j.feasibility === 'partial' ? 'mixed' : 'costly'
  }));

  const timelineDiff = (metrics.realEventsInPeriod || []).slice(0, 5).map(e => ({
    real_history: e.title,
    your_timeline: state.journal.find(j => j.dateBefore && e.date)?.headline || 'Your campaign followed a different course.'
  }));

  return {
    summary: `You led ${metrics.player.name} for ${metrics.turns} turns to ${metrics.period.to}. You gained ${metrics.territoriesGained?.length || 0} territories and lost ${metrics.territoriesLost?.length || 0}. (Offline demo assessment — connect an LLM for a full examiner's report.)`,
    grades: {
      historical_realism: { score: clamp(realism), rationale: `${Math.round(successRate * 100)}% of your orders were judged plausible for the period.` },
      strategic_effectiveness: { score: clamp(strategic), rationale: `Net territorial change: ${netTerritory >= 0 ? '+' : ''}${netTerritory}.` },
      economic_management: { score: clamp(econScore), rationale: 'Based on GDP, industry and resource changes.' },
      diplomacy: { score: clamp(diplomacy), rationale: `${(metrics.warsStarted?.length || 0)} wars started, ${(metrics.warsEnded?.length || 0)} ended.` },
      decision_quality: { score: clamp(quality), rationale: 'Based on the success rate of your decisions.' }
    },
    key_decisions: keyDecisions,
    timeline_diff: timelineDiff,
    lessons: [
      'Compare your choices with the real decisions of the period — the differences are the history.',
      'Geography, industry and alliances limited what any leader could do.',
      'A well-reasoned failure can teach more than an easy success.'
    ]
  };
}

// Offline advisors' briefing. At the start of a campaign it uses the
// hand-written opening briefing from the scenario; afterwards it reads the
// game state (indicators, last turn's changes, wars, relations, occupation).
// Same shape as the Advisors agent: { economy|diplomacy|military: {outlook, home, abroad, advice} }.
export function mockAdvisors(state, { opening = false } = {}) {
  const scenario = getScenario(state.scenarioId);
  const tag = state.player;
  const P = state.nations[tag];
  if (opening && scenario.openingAdvice?.[tag]) return JSON.parse(JSON.stringify(scenario.openingAdvice[tag]));

  const I = P.indicators;
  const d = opening ? {} : (state.lastDeltas?.[tag] || {});
  const r = (v) => Math.round(v);
  const chg = (k) => d[k] ? ` (${d[k] > 0 ? '+' : ''}${d[k]} last turn)` : '';
  const outlook = (score) => score >= 65 ? 'good' : score >= 45 ? 'steady' : score >= 28 ? 'worrying' : 'critical';
  const list = (arr) => arr.length <= 1 ? (arr[0] || '') : `${arr.slice(0, -1).join(', ')} and ${arr.at(-1)}`;
  // "the United States", "the Soviet Union"… ; cap = at the start of a sentence.
  const nm = (n, cap = false) => {
    const the = /^(United |Soviet |Netherlands|Republic |Chinese Communist|Dutch )/.test(n.name);
    return the ? `${cap ? 'The' : 'the'} ${n.name}` : n.name;
  };

  const enemies = warsOf(state, tag).map(t => state.nations[t]).filter(n => n && !n.capitulated);
  const majors = Object.values(state.nations).filter(n => !n.minor && n.tag !== tag && !n.capitulated);
  const held = territoriesOf(state, tag);
  const occupiedHome = held.filter(t => Object.keys(state.territories[t].occupation || {}).some(o => o !== tag));
  const abroad = Object.entries(state.territories).filter(([, t]) => t.owner !== tag && t.occupation?.[tag]).map(([n]) => n);
  const byRel = majors.map(n => ({ n, rel: relation(state, tag, n.tag) })).sort((a, b) => b.rel - a.rel);
  const best = byRel[0], worst = byRel.at(-1);

  // ---- economy ----
  const topEnemyEcon = [...enemies].sort((a, b) => b.indicators.gdp - a.indicators.gdp)[0];
  const topEcon = [...majors].sort((a, b) => b.indicators.gdp - a.indicators.gdp)[0];
  let eAdvice;
  if (occupiedHome.length) eAdvice = `Move key factories and stocks away from ${occupiedHome[0]} and plan to rebuild output there once it is freed.`;
  else if (I.resources < 35) eAdvice = 'Secure imports of oil, rubber and metals: a trade deal or a safer supply route would ease the shortages.';
  else if (I.industry < 40) eAdvice = 'Invest in factories and machine tools before expanding the armed forces further.';
  else if (I.stability < 40 || I.citizen_support < 40) eAdvice = 'Ease shortages at home: fair rationing and wages would steady public opinion.';
  else eAdvice = 'Keep a balance between arms spending and civilian goods to protect growth.';
  const economy = {
    outlook: outlook((I.industry + I.resources) / 2 + (d.gdp > 0 ? 6 : d.gdp < 0 ? -6 : 0) - occupiedHome.length * 8),
    home: `GDP stands at ${r(I.gdp)} bn $${chg('gdp')}, with industry at ${r(I.industry)}${chg('industry')} and resources at ${r(I.resources)}${I.resources < 35 ? ', so raw materials are the bottleneck' : ''}.`,
    abroad: topEnemyEcon
      ? `${nm(topEnemyEcon, true)}'s economy (${r(topEnemyEcon.indicators.gdp)} bn $) is ${topEnemyEcon.indicators.gdp > I.gdp ? 'larger than ours, so a long war favours them' : 'smaller than ours, so a long war favours us'}.`
      : `${topEcon ? `${nm(topEcon, true)} remains the largest economy (${r(topEcon.indicators.gdp)} bn $), and ` : ''}trade with neutral countries keeps our imports flowing for now.`,
    advice: eAdvice
  };

  // ---- diplomacy ----
  const mood = I.citizen_support >= 60 ? 'the public backs the government' : I.citizen_support >= 40 ? 'the public is uneasy but loyal' : 'discontent with the government is spreading';
  let dAdvice;
  const weakest = [...enemies].sort((a, b) => a.indicators.army - b.indicators.army)[0];
  const oneBloc = enemies.length >= 2 && enemies[0].faction && enemies.every(e => e.faction === enemies[0].faction);
  const strongest = [...enemies].sort((a, b) => b.indicators.army - a.indicators.army)[0];
  if (oneBloc) dAdvice = `Concentrate on ${nm(strongest)} and avoid provoking any new enemies.`;
  else if (enemies.length >= 2) dAdvice = `Avoid fighting on too many fronts: explore a ceasefire with ${nm(weakest)}.`;
  else if (worst && worst.rel <= -50 && !enemies.includes(worst.n)) dAdvice = `Watch ${nm(worst.n)} closely: relations are hostile and could turn into war.`;
  else if (!P.faction && best) dAdvice = `Closer ties with ${nm(best.n)} would give us a partner if we are attacked.`;
  else dAdvice = `Keep ${P.faction ? `the ${P.faction}` : 'our partners'} united and keep the neutral powers friendly.`;
  const avgRel = byRel.length ? byRel.reduce((a, b) => a + b.rel, 0) / byRel.length : 0;
  const diplomacy = {
    outlook: outlook(55 + avgRel / 4 + (P.faction ? 8 : 0) - enemies.length * 8 + (I.citizen_support - 50) / 3),
    home: `Citizen support is ${r(I.citizen_support)}${chg('citizen_support')} and war support ${r(I.war_support)}${chg('war_support')}: ${mood}.`,
    abroad: enemies.length
      ? `We are at war with ${list(enemies.map(n => nm(n)))}${best && best.rel > 20 ? `; ${nm(best.n)} is our closest partner (${best.rel})` : ''}.`
      : best && worst
        ? `Our closest partner is ${nm(best.n)} (relations ${best.rel}); relations with ${nm(worst.n)} are the worst (${worst.rel}).`
        : 'No foreign power is threatening us directly at the moment.',
    advice: dAdvice
  };

  // ---- military ----
  const topEnemyArmy = [...enemies].sort((a, b) => b.indicators.army - a.indicators.army)[0];
  const topArmy = [...majors].sort((a, b) => b.indicators.army - a.indicators.army)[0];
  let mAdvice;
  if (I.army_support < 40) mAdvice = 'Restore the officers’ confidence: consult the general staff before ordering new operations.';
  else if (occupiedHome.length) mAdvice = `Concentrate our forces to push the enemy out of ${occupiedHome[0]}.`;
  else if (topEnemyArmy && topEnemyArmy.indicators.army > I.army) mAdvice = 'Stay on the defensive and build up reserves before attacking.';
  else if (abroad.length) mAdvice = `Secure supply lines to our troops in ${abroad[0]} before pushing further.`;
  else mAdvice = 'Keep reserves ready and avoid overstretching our supply lines.';
  const military = {
    outlook: outlook((I.army + Math.max(I.navy, I.air)) / 2 + (I.army_support - 50) / 4
      - (topEnemyArmy && topEnemyArmy.indicators.army > I.army ? 10 : 0) - occupiedHome.length * 6),
    home: `Army ${r(I.army)}${chg('army')}, navy ${r(I.navy)}, air force ${r(I.air)}; army support for the government is ${r(I.army_support)}${chg('army_support')}${I.army_support < 40 ? ' and some officers question orders' : ''}.`,
    abroad: topEnemyArmy
      ? `${nm(topEnemyArmy, true)}'s army (${r(topEnemyArmy.indicators.army)}) is ${topEnemyArmy.indicators.army > I.army ? 'stronger' : 'weaker'} than ours${occupiedHome.length ? `, and enemy troops hold parts of ${list(occupiedHome.slice(0, 2))}` : abroad.length ? `; our troops hold ground in ${list(abroad.slice(0, 2))}` : ''}.`
      : `No enemy is fighting us; the strongest army abroad is ${topArmy ? `${nm(topArmy)}'s (${r(topArmy.indicators.army)})` : 'unknown'}.`,
    advice: mAdvice
  };

  return { economy, diplomacy, military };
}
