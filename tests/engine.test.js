// Run: npm test
// Checks the game engine rules without any AI or server.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGame, applyActions, advanceTime, resolveNation, resolveTerritory } from '../server/engine.js';
import { mockGameMaster } from '../server/mock.js';

const topo = JSON.parse(fs.readFileSync(new URL('../public/data/world-1939.json', import.meta.url)));
const names = topo.objects.territories.geometries.map(g => g.properties.name);
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };

test('new game assigns 1939 owners', () => {
  const s = createGame({ player: 'GER' }, names);
  assert.equal(s.territories['Austria'].owner, 'GER');
  assert.equal(s.territories['East Prussia'].owner, 'GER');      // includes Königsberg (today's Kaliningrad)
  assert.equal(s.territories['Eastern Poland'].owner, 'POL');    // interwar Poland reached Wilno and Lwów
  assert.equal(s.territories['Karafuto'].owner, 'JAP');
  assert.equal(s.territories['Hong Kong'].owner, 'UK');
  assert.equal(s.territories['British India'].owner, 'UK');
  assert.equal(s.territories['North China'].occupation.JAP, 70);
  assert.ok(s.nations.SWEDEN, 'unlisted shapes become minor nations');
});

test('names and aliases resolve', () => {
  const s = createGame({ player: 'GER' }, names);
  assert.equal(resolveNation(s, 'germany'), 'GER');
  assert.equal(resolveNation(s, 'Soviet Union'), 'SOV');
  assert.equal(resolveTerritory(s, 'usa'), 'United States');
  assert.equal(resolveTerritory(s, 'Kaliningrad'), 'East Prussia');
  assert.equal(resolveTerritory(s, 'Myanmar'), 'Burma');
});

test('occupation is partial and capped at 100% in total', () => {
  const s = createGame({ player: 'GER' }, names);
  applyActions(s, [{ type: 'occupy_territory', territory: 'Canada', occupier: 'GER', delta: 10 }]);
  assert.equal(s.territories['Canada'].occupation.GER, 10);
  applyActions(s, [{ type: 'occupy_territory', territory: 'Canada', occupier: 'USA', percent: 95 }]);
  const total = Object.values(s.territories['Canada'].occupation).reduce((a, b) => a + b, 0);
  assert.ok(total <= 100);
});

test('indicator changes are clamped', () => {
  const s = createGame({ player: 'GER' }, names);
  applyActions(s, [{ type: 'change_indicator', country: 'GER', indicator: 'stability', delta: -500 }]);
  assert.equal(s.nations.GER.indicators.stability, 45); // max step is 30
});

test('invalid actions are rejected, valid ones still apply', () => {
  const s = createGame({ player: 'GER' }, names);
  const r = applyActions(s, [
    { type: 'nuke', country: 'UK' },
    { type: 'change_indicator', country: 'Atlantis', indicator: 'gdp', delta: 1 },
    { type: 'declare_war', attacker: 'GER', defender: 'FRA' }
  ]);
  assert.equal(r.rejected.length, 2);
  assert.equal(r.applied.length, 1);
});

test('rival agents cannot act for the player', () => {
  const s = createGame({ player: 'GER' }, names);
  const r = applyActions(s, [{ type: 'change_indicator', country: 'GER', indicator: 'army', delta: -10 }], { source: 'rival_leaders', forbidActor: 'GER' });
  assert.equal(r.rejected.length, 1);
});

test('annexing the last territory defeats a nation', () => {
  const s = createGame({ player: 'GER' }, names);
  applyActions(s, [{ type: 'annex_territory', territory: 'Poland', new_owner: 'GER' }]);
  assert.equal(s.nations.POL.capitulated, false, 'Poland still holds its eastern provinces');
  applyActions(s, [{ type: 'annex_territory', territory: 'Eastern Poland', new_owner: 'SOV' }]);
  assert.equal(s.nations.POL.capitulated, true);
  assert.ok(!s.wars.some(w => w.includes('POL')));
});

test('time advances and stops at the end date', () => {
  const s = createGame({ player: 'GER' }, names);
  advanceTime(s, 4);
  assert.deepEqual(s.date, { year: 1940, month: 1 });
  for (let i = 0; i < 20; i++) advanceTime(s, 12);
  assert.deepEqual(s.date, { year: 1945, month: 9 });
});

test('offline game master understands "Germany takes 10% of Canada"', () => {
  const s = createGame({ player: 'GER', realism: 'sandbox' }, names);
  const gm = mockGameMaster(s, 'Germany is taking over 10% of Canada');
  const r = applyActions(s, gm.actions);
  assert.equal(r.rejected.length, 0);
  assert.equal(s.territories['Canada'].occupation.GER, 10);
});

console.log(`\n${passed} tests passed`);
