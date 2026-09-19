// Run: npm test
// Checks the history clock (scripted events) without any AI or server.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGame, applyActions, atWar } from '../server/engine.js';
import { dueEvents, runClockMonth, runClockSkip } from '../server/historyClock.js';

const topo = JSON.parse(fs.readFileSync(new URL('../public/data/world-1939.json', import.meta.url)));
const names = topo.objects.territories.geometries.map(g => g.properties.name);
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };

test('USA historical: two months from 1 Sep 1939 partition Poland', () => {
  const s = createGame({ player: 'USA' }, names);
  const clock = runClockSkip(s, 2);
  assert.deepEqual(s.date, { year: 1939, month: 11 });
  assert.ok(atWar(s, 'UK', 'GER'), 'Britain honours the guarantee to Poland');
  assert.ok(atWar(s, 'FRA', 'GER'), 'France honours the guarantee to Poland');
  assert.equal(s.territories['Eastern Poland'].occupation.SOV, 100);
  assert.equal(s.territories['Eastern Poland'].owner, 'POL', 'eastern Poland is occupied, not annexed');
  assert.equal(s.territories['Poland'].occupation.GER, 100);
  assert.equal(s.territories['Poland'].owner, 'POL', 'Poland keeps its land under occupation (government-in-exile)');
  assert.equal(s.nations.POL.capitulated, true, 'full home occupation auto-capitulates Poland');
  const ids = clock.fired.map(e => e.id);
  assert.ok(ids.includes('uk_fra_declare_war'));
  assert.ok(ids.includes('soviet_eastern_poland'));
  assert.ok(ids.includes('warsaw_falls'));
  const stamped = s.events.filter(e => e.source === 'history_clock');
  assert.ok(stamped.length >= 3, 'clock events reach the timeline strip');
  assert.ok(stamped.every(e => e.date.year === 1939 && e.date.month === 9), 'September events stamp September, not the end of the skip');
});

test('SOV player: the eastern Poland event becomes a hint, not an occupation', () => {
  const s = createGame({ player: 'SOV' }, names);
  const clock = runClockSkip(s, 2);
  assert.equal(s.territories['Eastern Poland'].occupation.SOV, undefined, 'the clock does not play the student’s nation');
  assert.ok(clock.hints.some(h => h.id === 'soviet_eastern_poland' && h.skippedReason === 'player' && h.hint));
  assert.ok(s.firedScriptedIds.includes('soviet_eastern_poland'), 'a hinted event is still marked fired');
  assert.equal(s.territories['Poland'].occupation.GER, 100, 'Warsaw still falls');
});

test('sandbox mode applies no map events but records the skips', () => {
  const s = createGame({ player: 'USA', realism: 'sandbox' }, names);
  const clock = runClockSkip(s, 2);
  assert.equal(s.territories['Eastern Poland'].occupation.SOV, undefined);
  assert.equal(s.territories['Poland'].occupation.GER, undefined);
  assert.ok(!atWar(s, 'UK', 'GER'));
  assert.ok(clock.skipped.some(e => e.id === 'soviet_eastern_poland' && e.skippedReason === 'sandbox'));
  assert.ok(s.firedScriptedIds.includes('soviet_eastern_poland'), 'sandbox skips are marked fired once');
  assert.ok(clock.fired.some(e => e.id === 'first_changsha' && e.kind === 'lesson'), 'lessons still fire in sandbox');
});

test('USA: ten months bring Denmark, Norway and the fall of France', () => {
  const s = createGame({ player: 'USA' }, names);
  runClockSkip(s, 10);
  assert.deepEqual(s.date, { year: 1940, month: 7 });
  assert.equal(s.territories['Denmark'].occupation.GER, 100);
  assert.equal(s.nations.DEN.capitulated, true);
  assert.equal(s.territories['Norway'].occupation.GER, 100);
  assert.equal(s.territories['Netherlands'].occupation.GER, 100);
  assert.equal(s.territories['Belgium'].occupation.GER, 100);
  assert.equal(s.territories['France'].occupation.GER, 100);
  assert.equal(s.nations.FRA.capitulated, true);
  assert.equal(s.territories['Algeria'].owner, 'FRA', 'colonies stay French (Vichy-style)');
  assert.equal(s.nations.UK.leader, 'Winston Churchill');
  assert.ok(atWar(s, 'ITA', 'UK'), 'Italy joins the war');
  assert.ok(!atWar(s, 'ITA', 'FRA'), 'France’s wars end with the armistice');
});

test('China campaign: Europe still turns, First Changsha is a lesson', () => {
  const s = createGame({ scenarioId: 'china-1939', player: 'CHN' }, names);
  const clock = runClockSkip(s, 1);
  assert.deepEqual(s.date, { year: 1939, month: 10 });
  assert.ok(atWar(s, 'UK', 'GER'), 'Europe is not frozen in a China game');
  assert.ok(atWar(s, 'FRA', 'GER'));
  assert.equal(s.territories['Eastern Poland'].occupation.SOV, 100);
  assert.equal(s.territories['Poland'].occupation.GER, 100);
  const lesson = clock.fired.find(e => e.id === 'first_changsha');
  assert.equal(lesson?.kind, 'lesson');
  assert.equal(s.territories['South China'].occupation.JAP, 25, 'a lesson never moves the map');
});

test('JAP player: Indochina and Hong Kong wait for the player’s order', () => {
  const s = createGame({ scenarioId: 'china-1939', player: 'JAP' }, names);
  s.date = { year: 1940, month: 9 };
  const sep = runClockMonth(s);
  assert.ok(sep.hints.some(h => h.id === 'japan_indochina' && h.hint));
  assert.equal(s.territories['French Indochina'].occupation.JAP, undefined);
  s.date = { year: 1941, month: 12 };
  const dec = runClockMonth(s);
  assert.ok(dec.hints.some(h => h.id === 'fall_of_hong_kong' && h.hint));
  assert.equal(s.territories['Hong Kong'].occupation.JAP, undefined);
  assert.ok(s.firedScriptedIds.includes('japan_indochina'));
  assert.ok(s.firedScriptedIds.includes('fall_of_hong_kong'));
});

test('the clock is idempotent within a month', () => {
  const s = createGame({ player: 'USA' }, names);
  runClockMonth(s);
  const afterFirst = JSON.stringify(s.territories);
  runClockMonth(s);
  assert.equal(JSON.stringify(s.territories), afterFirst, 'running the same month twice does not double-occupy');
  assert.equal(s.territories['Eastern Poland'].occupation.SOV, 100);
  const once = s.firedScriptedIds.length;
  runClockMonth(s, { year: 1939, month: 9 });
  assert.equal(s.firedScriptedIds.length, once, 'ids are not marked twice');
  assert.deepEqual(dueEvents(s, { year: 1939, month: 9 }), []);
});

test('preconditions no-op an event the player already changed', () => {
  const s = createGame({ player: 'USA' }, names);
  applyActions(s, [{ type: 'annex_territory', territory: 'Eastern Poland', new_owner: 'SOV' }]);
  const clock = runClockSkip(s, 2);
  assert.ok(clock.skipped.some(e => e.id === 'soviet_eastern_poland' && e.skippedReason === 'precondition'));
  assert.equal(s.territories['Eastern Poland'].owner, 'SOV', 'the earlier change stands');
  assert.equal(s.territories['Eastern Poland'].occupation.SOV, undefined, 'the event does not occupy on top');
  assert.ok(s.firedScriptedIds.includes('soviet_eastern_poland'), 'a precondition skip is still marked fired');
});

test('USA: a long skip reaches Barbarossa (GER–SOV war, western USSR occupied)', () => {
  const s = createGame({ player: 'USA' }, names);
  runClockSkip(s, 12);   // Sep 1939 -> Sep 1940
  runClockSkip(s, 10);   // Sep 1940 -> Jul 1941, fires June 1941 Barbarossa
  assert.ok(atWar(s, 'GER', 'SOV'), 'Germany declares war on the Soviet Union');
  assert.ok((s.territories['Soviet Ukraine'].occupation.GER || 0) > 0, 'Soviet Ukraine is occupied');
  assert.ok((s.territories['Soviet Belarus'].occupation.GER || 0) > 0, 'Soviet Belarus is occupied');
  assert.ok((s.territories['European Russia'].occupation.GER || 0) > 0, 'the front reaches the Moscow region');
  assert.equal(s.nations.SOV.capitulated, false, 'the USSR survives the first blow');
  assert.ok(s.firedScriptedIds.includes('barbarossa'));
});

test('USA: a 28-month skip reaches Pearl Harbor and the USA–Germany war', () => {
  const s = createGame({ player: 'USA' }, names);
  runClockSkip(s, 12);   // Sep 1939 -> Sep 1940
  runClockSkip(s, 12);   // Sep 1940 -> Sep 1941
  runClockSkip(s, 4);    // Sep 1941 -> Jan 1942, fires Dec 1941
  assert.ok(atWar(s, 'JAP', 'USA'), 'Japan attacks the United States');
  assert.ok(atWar(s, 'GER', 'USA'), 'Germany declares war on the United States');
  assert.equal(s.territories['Philippines'].occupation.JAP, 100, 'Japan occupies the Philippines');
  assert.ok(s.firedScriptedIds.includes('pearl_harbor'));
  assert.ok(s.firedScriptedIds.includes('usa_ger_war'));
});

test('JAP player: Pearl Harbor is a hint, not a declaration', () => {
  const s = createGame({ scenarioId: 'china-1939', player: 'JAP' }, names);
  s.date = { year: 1941, month: 12 };
  const dec = runClockMonth(s);
  assert.ok(dec.hints.some(h => h.id === 'pearl_harbor' && h.hint && h.skippedReason === 'player'));
  assert.equal(s.territories['Philippines'].occupation.JAP, undefined, 'the clock does not play the student’s nation');
  assert.ok(!atWar(s, 'JAP', 'USA'), 'Japan does not auto-declare war on the USA');
  assert.ok(s.firedScriptedIds.includes('pearl_harbor'));
});

test('CHN player: a game_master own-front delta lowers JAP occupation of North China', () => {
  const s = createGame({ scenarioId: 'china-1939', player: 'CHN' }, names);
  const before = s.territories['North China'].occupation.JAP;
  assert.ok(before > 0, 'Japan starts occupying North China');
  applyActions(s, [{ type: 'occupy_territory', territory: 'North China', occupier: 'JAP', delta: -10, reason: 'Chinese counter-attack' }], { source: 'game_master' });
  const after = s.territories['North China'].occupation.JAP;
  assert.equal(after, before - 10, 'a negative delta lowers the occupier’s share rather than overwriting it');
  assert.equal(s.territories['North China'].owner, 'CHN', 'ownership is unchanged; only the occupation share moves');
});

test('VE Day fires only if the Soviet Union has not capitulated', () => {
  const s = createGame({ player: 'JAP' }, names);
  applyActions(s, [{ type: 'capitulate', country: 'SOV', reason: 'alternate-timeline collapse' }]);
  assert.equal(s.nations.SOV.capitulated, true);
  for (let i = 0; i < 5; i++) runClockSkip(s, 12);  // Sep 1939 -> Sep 1944
  const clock = runClockSkip(s, 9);                  // Sep 1944 -> Jun 1945, fires May 1945
  assert.ok(s.firedScriptedIds.includes('ve_day'), 'VE Day is marked fired once so it does not nag again');
  assert.ok(clock.skipped.some(e => e.id === 've_day' && e.skippedReason === 'precondition'), 'with SOV capitulated, VE Day is skipped on a precondition');
  assert.equal(s.nations.GER.capitulated, false, 'with SOV out of the war, VE Day does not capitulate Germany');
});

test('VE Day capitulates Germany when the Soviet Union is still in the war', () => {
  const s = createGame({ player: 'JAP' }, names);
  for (let i = 0; i < 5; i++) runClockSkip(s, 12);  // Sep 1939 -> Sep 1944
  runClockSkip(s, 9);                                // Sep 1944 -> Jun 1945, fires May 1945
  assert.ok(s.firedScriptedIds.includes('ve_day'));
  assert.equal(s.nations.GER.capitulated, true, 'Germany capitulates on VE Day');
  assert.equal(s.nations.SOV.capitulated, false, 'the Soviet Union is still in the fight');
});

console.log(`\n${passed} tests passed`);
