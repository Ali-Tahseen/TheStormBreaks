// Run: npm test
// Checks the game engine rules without any AI or server.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGame, applyActions, advanceTime, resolveNation, resolveTerritory } from '../server/engine.js';
import { mockGameMaster } from '../server/mock.js';
import { getScenario, listScenarios } from '../server/data/scenarios/index.js';
import { computeMetrics, scoreFromGrades, applyWeights, letterGrade } from '../server/report.js';
import { generateReport } from '../server/agents.js';

const topo = JSON.parse(fs.readFileSync(new URL('../public/data/world-1939.json', import.meta.url)));
const names = topo.objects.territories.geometries.map(g => g.properties.name);
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };
const asyncTest = async (name, fn) => { await fn(); passed++; console.log(`  ok  ${name}`); };

test('new game assigns 1939 owners', () => {
  const s = createGame({ player: 'GER' }, names);
  assert.equal(s.scenarioId, 'ww2-1939');
  assert.equal(s.territories['Austria'].owner, 'GER');
  assert.equal(s.territories['East Prussia'].owner, 'GER');      // includes Königsberg (today's Kaliningrad)
  assert.equal(s.territories['Eastern Poland'].owner, 'POL');    // interwar Poland reached Wilno and Lwów
  assert.equal(s.territories['Karafuto'].owner, 'JAP');
  assert.equal(s.territories['Hong Kong'].owner, 'UK');
  assert.equal(s.territories['British India'].owner, 'UK');
  assert.equal(s.territories['North China'].occupation.JAP, 70);
  assert.ok(s.nations.SWEDEN, 'unlisted shapes become minor nations');
});

test('scenario registry lists scenarios and resolves them', () => {
  const ids = listScenarios().map(s => s.id);
  assert.ok(ids.includes('ww2-1939'));
  assert.ok(ids.includes('china-1939'));
  assert.equal(getScenario('nope').id, 'ww2-1939', 'unknown ids fall back to the default');
});

test('China scenario is playable as the Nationalists or the Communists', () => {
  const s = createGame({ scenarioId: 'china-1939', player: 'CHN' }, names);
  assert.equal(s.scenarioId, 'china-1939');
  assert.equal(s.player, 'CHN');
  assert.ok(s.nations.CCP, 'the CCP is present');
  assert.equal(s.territories['Northwest China'].owner, 'CCP', 'the CCP holds its northwestern base area');
  assert.equal(s.territories['North China'].occupation.CCP, 20, 'CCP base areas behind the lines are occupation stripes');
  assert.ok(s.wars.some(w => w.includes('JAP') && w.includes('CCP')));
  const ccp = createGame({ scenarioId: 'china-1939', player: 'CCP' }, names);
  assert.equal(ccp.player, 'CCP');
});

test('names and aliases resolve per scenario', () => {
  const s = createGame({ player: 'GER' }, names);
  assert.equal(resolveNation(s, 'germany'), 'GER');
  assert.equal(resolveNation(s, 'Soviet Union'), 'SOV');
  assert.equal(resolveTerritory(s, 'usa'), 'United States');
  assert.equal(resolveTerritory(s, 'Kaliningrad'), 'East Prussia');
  assert.equal(resolveTerritory(s, 'Myanmar'), 'Burma');
  const c = createGame({ scenarioId: 'china-1939', player: 'CHN' }, names);
  assert.equal(resolveNation(c, 'kmt'), 'CHN');
  assert.equal(resolveNation(c, 'communists'), 'CCP');
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

test('capitulate ends a nation\'s wars and keeps its remaining land', () => {
  const s = createGame({ player: 'GER' }, names);
  const r = applyActions(s, [{ type: 'capitulate', country: 'FRA', occupier: 'GER', percent: 100 }]);
  assert.equal(r.rejected.length, 0);
  assert.equal(s.nations.FRA.capitulated, true);
  assert.ok(!s.wars.some(w => w.includes('FRA')));
  assert.equal(s.territories['France'].owner, 'FRA', 'France keeps its land unless it is annexed');
  assert.equal(s.territories['France'].occupation.GER, 100, 'the victor may occupy the land it holds');
  assert.equal(s.territories['Algeria'].owner, 'FRA', 'colonies remain French (Vichy-style)');
});

test('fully occupying a nation\'s home territory makes it capitulate', () => {
  const s = createGame({ player: 'GER' }, names);
  applyActions(s, [{ type: 'declare_war', attacker: 'GER', defender: 'FRA' }]);
  applyActions(s, [{ type: 'occupy_territory', territory: 'France', occupier: 'GER', percent: 100 }]);
  assert.equal(s.nations.FRA.capitulated, true);
  assert.ok(!s.wars.some(w => w.includes('FRA')));
});

test('a rejected capitulate changes nothing', () => {
  const s = createGame({ player: 'GER' }, names);
  const r = applyActions(s, [{ type: 'capitulate', country: 'FRA', occupier: 'GER', territories: ['Atlantis'] }]);
  assert.equal(r.rejected.length, 1);
  assert.equal(s.nations.FRA.capitulated, false);
  assert.equal(s.territories['France'].occupation.GER, undefined);
});

test('time advances and stops at the scenario end date', () => {
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

test('report metrics are deterministic', () => {
  const s = createGame({ scenarioId: 'china-1939', player: 'CHN' }, names);
  applyActions(s, [{ type: 'occupy_territory', territory: 'Manchukuo', occupier: 'CHN', delta: 20 }]);
  applyActions(s, [{ type: 'change_indicator', country: 'CHN', indicator: 'industry', delta: 5 }]);
  const a = computeMetrics(s);
  const b = computeMetrics(s);
  assert.deepEqual(a, b);
  assert.equal(a.occupationGained['Manchukuo'], 20);
  assert.equal(a.indicatorChanges.industry, 5);
});

test('overall score is a reproducible weighted combination', () => {
  const scenario = getScenario('china-1939');
  const weights = applyWeights(scenario);
  assert.ok(Math.abs(Object.values(weights).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  const grades = {
    historical_realism: { score: 80 }, strategic_effectiveness: { score: 60 },
    economic_management: { score: 70 }, diplomacy: { score: 50 }, decision_quality: { score: 90 }
  };
  const one = scoreFromGrades(grades, weights);
  const two = scoreFromGrades(grades, weights);
  assert.deepEqual(one, two);
  assert.equal(letterGrade(95), 'A');
  assert.equal(letterGrade(10), 'F');
});

await asyncTest('offline after-action report is complete and reproducible', async () => {
  const s = createGame({ scenarioId: 'china-1939', player: 'CHN' }, names);
  s.gameOver = { reason: 'test' };
  const r1 = await generateReport(s, { regenerate: true });
  assert.ok(r1.grades.historical_realism.score >= 0 && r1.grades.historical_realism.score <= 100);
  assert.ok(r1.overall.score >= 0 && r1.overall.letter);
  assert.equal(r1.metrics.player.tag, 'CHN');
  const r2 = await generateReport(s, { regenerate: true });
  assert.deepEqual(r1.metrics, r2.metrics, 'metrics are deterministic');
  assert.equal(r1.overall.score, r2.overall.score, 'overall score is reproducible');
});

console.log(`\n${passed} tests passed`);
