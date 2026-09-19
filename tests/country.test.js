// Run: node tests/country.test.js
// The start-screen country briefing: every playable nation has a summary and a
// task, and the pure builder renders the portrait, facts and derived strengths.

import assert from 'node:assert/strict';
import { listScenarios, getScenario, scenarioSummary } from '../server/data/scenarios/index.js';
import { countryDetailHTML } from '../public/js/panels.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };

test('every playable nation has a country briefing and starting indicators', () => {
  for (const sc of listScenarios()) {
    for (const n of sc.playable) {
      const b = sc.countryBriefing[n.tag];
      assert.ok(b, `${sc.id}/${n.tag}: briefing missing`);
      assert.ok(b.summary && b.summary.length > 60, `${sc.id}/${n.tag}: summary too short`);
      assert.ok(b.task && b.task.length > 20, `${sc.id}/${n.tag}: task too short`);
      assert.ok(n.indicators && Object.keys(n.indicators).length, `${sc.id}/${n.tag}: no indicators`);
    }
  }
});

test('country detail renders the portrait, facts, task and strengths', () => {
  const sc = scenarioSummary(getScenario('ww2-1939'));
  const html = countryDetailHTML(sc, 'GER', { src: '/img/hitler.jpg', name: 'Adolf Hitler', role: 'Dictator of Nazi Germany' });
  assert.ok(html.includes('src="/img/hitler.jpg"'));
  assert.ok(html.includes('Adolf Hitler'));
  assert.ok(html.includes('Germany'));
  assert.ok(html.includes('Your first task:'));
  assert.ok(html.includes('Strengths'));
  assert.ok(html.includes('Watch out for'));
  assert.ok(html.includes('Possible first moves'));
});

test('country detail falls back to a flag when there is no portrait', () => {
  const sc = scenarioSummary(getScenario('china-1939'));
  const html = countryDetailHTML(sc, 'CCP', null);
  assert.ok(html.includes('Chinese Communist Party'));
  assert.ok(html.includes('portrait-frame empty'));
  assert.ok(!html.includes('<img'));
});

test('an unknown tag renders nothing', () => {
  const sc = scenarioSummary(getScenario('ww2-1939'));
  assert.equal(countryDetailHTML(sc, 'NOPE', null), '');
});

console.log(`\n${passed} tests passed`);
