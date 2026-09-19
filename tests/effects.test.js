// Run: node tests/effects.test.js
// The map-repair path: mention scanning, the needsRepair trigger, and a full
// turn through a fake OpenAI-compatible server where the Game Master narrates
// an annexation but forgets the action and the Effects agent supplies it.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { createGame, scanMentions } from '../server/engine.js';
import { runTurn, needsRepair, cleanEffects } from '../server/agents.js';

const topo = JSON.parse(fs.readFileSync(new URL('../public/data/world-1939.json', import.meta.url)));
const names = topo.objects.territories.geometries.map(g => g.properties.name);
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  ok  ${name}`); };

// ---- pure helpers ----
await test('scanMentions finds the territories and nations an order names', () => {
  const s = createGame({ player: 'SOV' }, names);
  const m = scanMentions(s, 'The Soviet Union will annex Bessarabia and the Baltic republics of Estonia and Latvia');
  const terr = m.territories.map(t => t.name);
  assert.ok(terr.includes('Bessarabia and Bukovina'), 'Bessarabia resolves through its alias');
  assert.ok(terr.includes('Estonia'));
  assert.ok(terr.includes('Latvia'));
  assert.ok(!terr.includes('Lithuania'), 'Lithuania was not named');
  assert.ok(m.nations.some(n => n.tag === 'SOV'));
});

await test('scanMentions deduplicates repeated names', () => {
  const s = createGame({ player: 'GER' }, names);
  const m = scanMentions(s, 'France, France and France');
  assert.equal(m.territories.filter(t => t.name === 'France').length, 1);
});

await test('needsRepair fires when the story claims a change the actions omit', () => {
  const s = createGame({ player: 'SOV' }, names);
  const gm = { feasibility: 'success', headline: 'The Baltic states join the USSR', narrative: 'Moscow annexed Estonia and Latvia.' };
  const result = { applied: [], rejected: [] };
  assert.equal(needsRepair(s, 'Annex the Baltic states', gm, result, scanMentions(s, 'Annex the Baltic states')), true);
});

await test('needsRepair stays quiet on a normal turn', () => {
  const s = createGame({ player: 'GER' }, names);
  const gm = { feasibility: 'success', headline: 'Factories open', narrative: 'New plants are built.' };
  const result = { applied: [{ type: 'change_indicator' }], rejected: [] };
  assert.equal(needsRepair(s, 'Build factories', gm, result, scanMentions(s, 'Build factories')), false);
});

await test('a demand that produced a non-map action is not treated as a missing map change', () => {
  const s = createGame({ player: 'SOV' }, names);
  const gm = { feasibility: 'partial', headline: 'Talks with Helsinki', narrative: 'Moscow pressed Finland for bases; the talks drag on.' };
  const result = { applied: [{ type: 'change_relation' }], rejected: [] };
  assert.equal(needsRepair(s, 'Demand bases from Finland', gm, result, scanMentions(s, 'Demand bases from Finland')), false);
});

await test('cleanEffects keeps only the actions array', () => {
  assert.deepEqual(cleanEffects({ actions: [{ type: 'annex_territory' }], junk: 1 }).actions.length, 1);
  assert.deepEqual(cleanEffects(null).actions, []);
});

// ---- full turn through a fake LLM ----
const replies = {
  gm: {
    interpretation: 'Annex the Baltic states and Bessarabia', feasibility: 'success', feasibility_reason: 'The Red Army moves in.',
    time_advance_months: 1, headline: 'The Baltic states join the Soviet Union',
    narrative: 'Moscow annexed Estonia, Latvia, Lithuania and Bessarabia without a fight.', actions: []
  },
  effects: {
    actions: [
      { type: 'annex_territory', territory: 'Estonia', new_owner: 'SOV', reason: 'Ultimatum accepted' },
      { type: 'annex_territory', territory: 'Latvia', new_owner: 'SOV', reason: 'Ultimatum accepted' },
      { type: 'annex_territory', territory: 'Lithuania', new_owner: 'SOV', reason: 'Ultimatum accepted' },
      { type: 'annex_territory', territory: 'Bessarabia and Bukovina', new_owner: 'SOV', reason: 'Romanian cession' }
    ]
  },
  rivals: { reactions: [], actions: [] },
  teacher: { lesson: { title: 'The Baltic question', what_really_happened: 'The USSR occupied the Baltics in June 1940.', reflection_question: 'Why?' } },
  advisors: {
    economy: { outlook: 'steady', home: 'New ports and industry join the Soviet economy.', abroad: 'Berlin watches warily.', advice: 'Integrate the new territories.' },
    diplomacy: { outlook: 'worrying', home: 'The annexations alarm the neutrals.', abroad: 'Britain and the USA condemn the move.', advice: 'Reassure Finland.' },
    military: { outlook: 'good', home: 'The Red Army gains the Baltic coast.', abroad: 'Germany is busy in the west.', advice: 'Fortify the new border.' }
  }
};
const seen = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    const sys = JSON.parse(body).messages[0].content;
    const kind = /action writer/.test(sys) ? 'effects'
      : /You are the Game Master/.test(sys) ? 'gm'
      : /AI-controlled leaders/.test(sys) ? 'rivals'
      : /senior advisors/.test(sys) ? 'advisors'
      : 'teacher';
    seen.push(kind);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(replies[kind]) } }] }));
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
process.env.LLM_BASE_URL = `http://127.0.0.1:${server.address().port}`;
process.env.LLM_API_KEY = 'test';

await test('the Effects agent repairs the map when the Game Master forgets', async () => {
  const s = createGame({ player: 'SOV' }, names);
  const entry = await runTurn(s, 'Annex the Baltic states and Bessarabia');
  assert.ok(seen.includes('effects'), 'the repair agent ran');
  assert.equal(s.territories['Estonia'].owner, 'SOV');
  assert.equal(s.territories['Latvia'].owner, 'SOV');
  assert.equal(s.territories['Lithuania'].owner, 'SOV');
  assert.equal(s.territories['Bessarabia and Bukovina'].owner, 'SOV');
  assert.ok(entry.changedTerritories.includes('Estonia'));
  assert.ok(!entry.mapWarning, 'the map matches the story after repair');
  assert.ok(s.lastTurnDebug.agents.some(a => a.agent === 'Effects (repair)' && a.applied?.length === 4));
});

await test('a repair that still changes nothing warns the player', async () => {
  const prev = replies.effects;
  replies.effects = { actions: [] };
  const s = createGame({ player: 'SOV' }, names);
  const entry = await runTurn(s, 'Annex the Baltic states and Bessarabia');
  assert.equal(entry.mapWarning, true);
  assert.equal(s.territories['Estonia'].owner, 'ESTONIA', 'no annexation happened');
  replies.effects = prev;
});

server.close();
console.log(`\n${passed} tests passed`);
