// Run: npm test
// New indicators (army_support, citizen_support), save migration and the
// advisors' briefing, offline and through a fake local LLM server.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { createGame, migrateState } from '../server/engine.js';
import { SCENARIOS } from '../server/data/scenarios/index.js';
import { runTurn, openingBriefing, offlineBriefing, ADVISOR_ROLES, ADVISOR_OUTLOOKS } from '../server/agents.js';

const topo = JSON.parse(fs.readFileSync(new URL('../public/data/world-1939.json', import.meta.url)));
const names = topo.objects.territories.geometries.map(g => g.properties.name);
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  ok  ${name}`); };

function assertBriefing(b, label) {
  for (const role of ADVISOR_ROLES) {
    const a = b[role];
    assert.ok(a, `${label}: ${role} missing`);
    assert.ok(ADVISOR_OUTLOOKS.includes(a.outlook), `${label}: ${role} outlook "${a.outlook}"`);
    for (const f of ['home', 'abroad', 'advice']) {
      assert.equal(typeof a[f], 'string');
      assert.ok(a[f].length > 10 && a[f].length <= 260, `${label}: ${role}.${f} length ${a[f].length}`);
    }
  }
}

// Offline mode for the first tests.
process.env.LLM_API_KEY = '';
process.env.LLM_BASE_URL = 'https://api.deepseek.com';

await test('every nation starts with army support and citizen support', () => {
  for (const sc of Object.values(SCENARIOS)) {
    assert.ok(sc.indicators.army_support && sc.indicators.citizen_support, `${sc.id} defines both`);
    assert.equal(sc.indicators.army_support.tab, 'politics');
    assert.equal(sc.indicators.citizen_support.tab, 'politics');
    const s = createGame({ scenarioId: sc.id }, names);
    for (const n of Object.values(s.nations)) {
      for (const k of ['army_support', 'citizen_support']) {
        const v = n.indicators[k];
        assert.ok(Number.isFinite(v) && v >= 0 && v <= 100, `${sc.id} ${n.tag}.${k} = ${v}`);
      }
    }
  }
});

await test('old saves get the new indicators from the scenario', () => {
  const s = createGame({ player: 'SOV' }, names);
  for (const n of Object.values(s.nations)) { delete n.indicators.army_support; delete n.indicators.citizen_support; }
  for (const i of Object.values(s.initial.indicators)) { delete i.army_support; delete i.citizen_support; }
  delete s.advisors;
  const fixes = migrateState(s);
  assert.ok(fixes.length > 0);
  assert.equal(s.nations.SOV.indicators.army_support, SCENARIOS['ww2-1939'].nations.SOV.indicators.army_support);
  assert.equal(s.nations.SWEDEN.indicators.citizen_support, SCENARIOS['ww2-1939'].minorIndicators.citizen_support);
  assert.equal(s.initial.indicators.SOV.army_support, s.nations.SOV.indicators.army_support);
  assert.equal(s.advisors, null);
  assertBriefing(offlineBriefing(s), 'migrated save');
});

await test('every playable nation has a hand-written opening briefing', () => {
  for (const sc of Object.values(SCENARIOS)) {
    for (const [tag, n] of Object.entries(sc.nations)) {
      if (!n.playable) continue;
      assert.ok(sc.openingAdvice?.[tag], `${sc.id}: no opening advice for ${tag}`);
      const s = createGame({ scenarioId: sc.id, player: tag }, names);
      const b = openingBriefing(s);
      assert.equal(b.source, 'opening');
      assert.equal(b.turn, 0);
      assert.equal(b.economy.home, sc.openingAdvice[tag].economy.home);
      assertBriefing(b, `${sc.id}/${tag}`);
    }
  }
});

await test('offline turn produces an advisors briefing on the state and in the journal', async () => {
  const s = createGame({ player: 'UK' }, names);
  s.advisors = openingBriefing(s);
  const entry = await runTurn(s, 'Blockade German ports with the Royal Navy and build more ships');
  assert.equal(entry.advisors.turn, entry.turn);
  assert.equal(entry.advisors.source, 'offline');
  assert.equal(s.advisors, entry.advisors);
  assertBriefing(entry.advisors, 'offline turn');
  const agents = s.lastTurnDebug.agents.map(a => a.agent);
  assert.ok(agents.indexOf('Advisors (offline demo)') > agents.indexOf('Rival Leaders (offline demo)'), 'advisors run after rivals');
});

// ---- LLM path, through a fake OpenAI-compatible server on localhost ----
const replies = {
  gm: { interpretation: 'x', feasibility: 'success', feasibility_reason: 'ok', time_advance_months: 2, headline: 'Convoys sail',
        narrative: 'The Royal Navy organised convoys.', actions: [{ type: 'change_indicator', country: 'UK', indicator: 'citizen_support', delta: 4, reason: 'Confidence' }] },
  rivals: { reactions: [{ country: 'GER', leader: 'Adolf Hitler', statement: 'We will answer.', intent: 'Build U-boats.' }],
            actions: [{ type: 'change_indicator', country: 'GER', indicator: 'army_support', delta: -2, reason: 'Doubts' }] },
  teacher: { lesson: { title: 'Convoys', what_really_happened: 'Convoys began in 1939.', reflection_question: 'Why?' } },
  advisors: {
    economy: { outlook: 'steady', home: 'Gold and dollar reserves are falling as imports rise.', abroad: 'American factories could supply us if the law allows.', advice: 'Press Washington for cash-and-carry arms sales.' },
    diplomacy: { outlook: 'VERY BAD', home: 'Citizen support has risen after the convoy news.', abroad: 'Germany promises to answer the blockade at sea.', advice: 'Keep France firm and court neutral Norway.' },
    // military missing on purpose: must be filled from the offline briefing
    actions: [{ type: 'declare_war', attacker: 'UK', defender: 'ITA' }]
  }
};
const seen = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    const sys = JSON.parse(body).messages[0].content;
    const kind = /senior advisors/.test(sys) ? 'advisors' : /Game Master/.test(sys) ? 'gm' : /AI-controlled leaders/.test(sys) ? 'rivals' : 'teacher';
    seen.push(kind);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(replies[kind]) } }] }));
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
process.env.LLM_BASE_URL = `http://127.0.0.1:${server.address().port}`;
process.env.LLM_API_KEY = 'test';

await test('AI advisors run after the rivals, are cleaned, and cannot act', async () => {
  const s = createGame({ player: 'UK' }, names);
  const warsBefore = s.wars.length;
  const entry = await runTurn(s, 'Organise convoys');
  assert.ok(seen.includes('advisors'));
  assert.ok(seen.indexOf('advisors') > seen.indexOf('rivals'), 'advisors are asked after the rivals');
  assert.equal(entry.advisors.source, 'llm');
  assert.equal(entry.advisors.economy.home, replies.advisors.economy.home);
  assert.ok(ADVISOR_OUTLOOKS.includes(entry.advisors.diplomacy.outlook), 'invalid outlook is replaced');
  assert.equal(entry.advisors.diplomacy.home, replies.advisors.diplomacy.home, 'valid fields are kept');
  assert.ok(entry.advisors.military.home.length > 10, 'missing advisor is filled from the offline briefing');
  assert.equal(entry.advisors.actions, undefined);
  assert.ok(!s.wars.some(w => w.includes('UK') && w.includes('ITA')), 'advisors cannot declare war');
  assert.ok(s.wars.length <= warsBefore, 'no new war appears; the history clock may end wars (Poland capitulates in September 1939)');
  assert.equal(s.nations.UK.indicators.citizen_support, SCENARIOS['ww2-1939'].nations.UK.indicators.citizen_support + 4);
  assertBriefing(entry.advisors, 'llm turn');
});

await test('a failing advisors call falls back to the offline briefing', async () => {
  replies.advisors = 'not json at all';
  const s = createGame({ player: 'FRA' }, names);
  const entry = await runTurn(s, 'Hold the line');
  assert.equal(entry.advisors.source, 'offline');
  assertBriefing(entry.advisors, 'fallback');
  assert.ok(s.lastTurnDebug.agents.some(a => a.agent === 'Advisors' && a.error));
});

server.close();
console.log(`\n${passed} tests passed`);
