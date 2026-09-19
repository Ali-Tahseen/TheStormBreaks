// Run: node tests/camera.test.js
// Opening-camera rules: the map should frame the player's country, not a
// hardcoded Europe view.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGame, applyActions } from '../server/engine.js';
import { applyInitialCamera, initialCamera, initialFocusTerritories } from '../public/js/camera.js';

const topo = JSON.parse(fs.readFileSync(new URL('../public/data/world-1939.json', import.meta.url)));
const names = topo.objects.territories.geometries.map(g => g.properties.name);
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };

test('USA opening camera focuses the United States, not Europe', () => {
  const s = createGame({ player: 'USA' }, names);
  const cam = initialCamera(s, { defaultView: 'europe' });
  assert.equal(cam.type, 'focus');
  assert.deepEqual(cam.territories, ['United States']);
});

test('Japan opening camera focuses Japan, not Europe', () => {
  const s = createGame({ player: 'JAP' }, names);
  const cam = initialCamera(s, { defaultView: 'europe' });
  assert.equal(cam.type, 'focus');
  assert.deepEqual(cam.territories, ['Japan']);
});

test('Germany opening camera focuses Germany', () => {
  const s = createGame({ player: 'GER' }, names);
  assert.deepEqual(initialFocusTerritories(s), ['Germany']);
});

test('colonial homelands do not pull the camera out to the empire', () => {
  const s = createGame({ player: 'UK' }, names);
  const cam = initialCamera(s, { defaultView: 'europe' });
  assert.deepEqual(cam.territories, ['United Kingdom']);
  assert.ok(!cam.territories.includes('British India'));
  assert.ok(!cam.territories.includes('Hong Kong'));
});

test('China campaign as CCP focuses the northwestern base area', () => {
  const s = createGame({ scenarioId: 'china-1939', player: 'CCP' }, names);
  const cam = initialCamera(s, { defaultView: 'china' });
  assert.deepEqual(cam.territories, ['Northwest China']);
});

test('China campaign as the Nationalists focuses the wartime capital region', () => {
  const s = createGame({ scenarioId: 'china-1939', player: 'CHN' }, names);
  const cam = initialCamera(s, { defaultView: 'china' });
  assert.deepEqual(cam.territories, ['Southwest China']);
});

test('if the homeland is lost, the camera frames remaining owned land', () => {
  const s = createGame({ player: 'GER' }, names);
  applyActions(s, [{ type: 'annex_territory', territory: 'Germany', new_owner: 'FRA' }]);
  const cam = initialCamera(s, { defaultView: 'europe' });
  assert.equal(cam.type, 'focus');
  assert.ok(!cam.territories.includes('Germany'));
  assert.ok(cam.territories.includes('East Prussia'));
  assert.ok(cam.territories.includes('Austria'));
});

test('scenario defaultView is only a fallback when the player has no land', () => {
  const cam = initialCamera(
    { player: 'GER', nations: { GER: { home: 'Germany' } }, territories: {} },
    { defaultView: 'europe' }
  );
  assert.equal(cam.type, 'view');
  assert.equal(cam.name, 'europe');
});

test('boot can request a non-animated opening camera', () => {
  const s = createGame({ player: 'JAP' }, names);
  const cam = initialCamera(s, { defaultView: 'europe', animate: false });
  assert.equal(cam.animate, false);
  assert.deepEqual(cam.territories, ['Japan']);
});

test('applyInitialCamera calls map.focus for a playable homeland', () => {
  const s = createGame({ player: 'JAP' }, names);
  const calls = [];
  const map = {
    focus: (territories, animate) => { calls.push({ op: 'focus', territories, animate }); return true; },
    view: (name, animate) => { calls.push({ op: 'view', name, animate }); }
  };
  applyInitialCamera(map, s, { defaultView: 'europe', animate: false });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].op, 'focus');
  assert.deepEqual(calls[0].territories, ['Japan']);
  assert.equal(calls[0].animate, false);
});

test('applyInitialCamera falls back to the scenario view if focus cannot apply', () => {
  const s = createGame({ player: 'USA' }, names);
  const calls = [];
  const map = {
    focus: () => false,
    view: (name, animate) => { calls.push({ name, animate }); }
  };
  applyInitialCamera(map, s, { defaultView: 'europe', animate: true });
  assert.deepEqual(calls, [{ name: 'europe', animate: true }]);
});

console.log(`\n${passed} tests passed`);
