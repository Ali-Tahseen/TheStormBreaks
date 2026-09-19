// Offline demo mode
// ------------------------------------------------------------------
// Used when no LLM API key is configured, so the game runs out of the box.
// These are simple keyword rules — they only exist to let you test the UI and
// the JSON → action pipeline. They return JSON in EXACTLY the same shape as the
// real agents, so everything downstream is identical.

import { ALIASES, TERRITORY_ALIASES } from './data/scenario1939.js';
import { resolveNation, atWar, warsOf, formatDate } from './engine.js';
import { eventsBetween, eventsNear, TIMELINE } from './data/timeline.js';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Find nations and territories mentioned in the text, with their position.
function scanMentions(state, text) {
  const lower = ' ' + text.toLowerCase() + ' ';
  const nations = [], territories = [];
  const nationNames = new Map();
  for (const [alias, tag] of Object.entries(ALIASES)) nationNames.set(alias, tag);
  for (const n of Object.values(state.nations)) if (!n.minor) nationNames.set(n.name.toLowerCase(), n.tag);
  for (const [name, tag] of nationNames) {
    const m = lower.match(new RegExp(`[^a-z]${esc(name)}[^a-z]`));
    if (m) nations.push({ tag, pos: m.index, name });
  }
  const terrNames = new Map();
  for (const name of Object.keys(state.territories)) terrNames.set(name.toLowerCase(), name);
  for (const [alias, name] of Object.entries(TERRITORY_ALIASES)) terrNames.set(alias, name);
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
      actions.push({ type: 'change_indicator', country: player, indicator: 'gdp', delta: -Math.round(P.indicators.gdp * 0.01), reason: 'Military spending' });
      story.push(`Resources were poured into the ${k === 'air' ? 'air force' : k}.`);
      notes.push(`+ ${k}: rearmament`, '- GDP: military spending');
    }
  }
  if (/(propaganda|speech|rally|newspaper|radio)/.test(text)) {
    actions.push({ type: 'change_indicator', country: player, indicator: 'war_support', delta: 5, reason: 'Propaganda campaign' });
    story.push('Radio broadcasts and posters worked to shape public opinion.');
    notes.push('+ War support: propaganda');
  }
  const faction = text.match(/\b(allies|axis|comintern)\b/);
  if (faction && /(join|ally|alliance)/.test(text)) {
    const f = faction[1][0].toUpperCase() + faction[1].slice(1);
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
  if (aggressive && player !== 'USA') {
    reactions.push({ country: 'USA', leader: state.nations.USA.leader, statement: 'The United States remains neutral, but American opinion is shifting.', intent: 'Watch Europe and Asia; consider aid to democracies.' });
    actions.push({ type: 'change_indicator', country: 'USA', indicator: 'war_support', delta: 2, reason: 'News from abroad' });
  }
  return { reactions, actions };
}

export function mockTeacher(state, dateBefore, dateAfter, order) {
  let events = eventsBetween(dateBefore, dateAfter);
  if (!events.length) events = eventsNear(dateAfter, 0, 3);
  if (!events.length) events = [TIMELINE[TIMELINE.length - 1]];
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
