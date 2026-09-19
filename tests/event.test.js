// Run: node tests/event.test.js
// The event popup's pure parts: summary extraction, category matching and the
// image picker (public/js/event-images.js), plus the HTML builder.

import assert from 'node:assert/strict';
import { pickEventImage, eventCategory, summaryFromNarrative } from '../public/js/event-images.js';
import { eventPopupHTML } from '../public/js/panels.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };

test('summary uses the first paragraph of the narrative', () => {
  assert.equal(summaryFromNarrative({ narrative: 'First para.\n\nSecond para.' }), 'First para.');
});

test('summary falls back to the feasibility reason', () => {
  assert.equal(summaryFromNarrative({ feasibilityReason: 'It was impossible.' }), 'It was impossible.');
});

test('summary truncates a long paragraph', () => {
  const s = summaryFromNarrative({ narrative: 'x'.repeat(400) }, 100);
  assert.ok(s.length <= 101 && s.endsWith('…'), s);
});

test('a surrender reads as the capitulation category', () => {
  assert.equal(eventCategory({ headline: 'France signs armistice', narrative: 'The guns fall silent.' }), 'capitulation');
});

test('bombing reads as destruction, an invasion as war', () => {
  assert.equal(eventCategory({ headline: 'London bombed', narrative: 'The city burns.' }), 'destruction');
  assert.equal(eventCategory({ headline: 'Germany invades Poland', narrative: 'Tanks cross the border.' }), 'war');
});

test('industry, hardship and diplomacy read as their own categories', () => {
  assert.equal(eventCategory({ headline: 'New factories open', narrative: 'Production rises.' }), 'economic_growth');
  assert.equal(eventCategory({ headline: 'Bread shortages', narrative: 'Rationing begins.' }), 'low_economy');
  assert.equal(eventCategory({ headline: 'Leaders sign a pact', narrative: 'A summit in Berlin.' }), 'diplomatic_negotiations');
});

test('ordinary words do not trigger a category by accident', () => {
  assert.equal(eventCategory({ headline: 'The administration warns', narrative: 'According to reports, nothing changed.' }), null);
});

test('category falls back to a war or diplomacy event, else null', () => {
  assert.equal(eventCategory({ headline: 'A quiet month' }, [{ category: 'war' }]), 'war');
  assert.equal(eventCategory({ headline: 'A quiet month' }, [{ category: 'diplomacy' }]), 'diplomatic_negotiations');
  assert.equal(eventCategory({ headline: 'A quiet month' }, [{ category: 'economy' }]), null);
  assert.equal(eventCategory({ headline: 'A quiet month' }), null);
});

const manifest = {
  images: [
    { category: 'war', src: '/war.jpg' },
    { category: 'war', src: '/war-2.jpg' },
    { category: 'capitulation', src: '/cap.jpg' },
    { category: 'destruction', src: '/dest.jpg' },
    { category: 'economic_growth', src: '/growth.jpg' },
    { category: 'low_economy', src: '/low.jpg' },
    { category: 'diplomatic_negotiations', src: '/dip.jpg' },
    { default: true, src: '/default.jpg' }
  ]
};

test('an empty manifest means a text-only popup', () => {
  assert.equal(pickEventImage({ images: [] }, {}, []), null);
  assert.equal(pickEventImage(null, {}, []), null);
});

test('the image matches the turn category', () => {
  assert.equal(pickEventImage(manifest, { headline: 'France capitulates' }, []).src, '/cap.jpg');
  assert.equal(pickEventImage(manifest, { headline: 'The city is bombed' }, []).src, '/dest.jpg');
  assert.equal(pickEventImage(manifest, { headline: 'New factories open' }, []).src, '/growth.jpg');
  assert.equal(pickEventImage(manifest, { headline: 'Bread shortages bite' }, []).src, '/low.jpg');
  assert.equal(pickEventImage(manifest, { headline: 'Leaders sign a pact' }, []).src, '/dip.jpg');
});

test('war images are chosen at random from the category', () => {
  const entry = { headline: 'Germany invades Poland' };
  assert.equal(pickEventImage(manifest, entry, [], { random: () => 0 }).src, '/war.jpg');
  assert.equal(pickEventImage(manifest, entry, [], { random: () => 0.99 }).src, '/war-2.jpg');
});

test('an unmatched turn uses the default image, or none', () => {
  assert.equal(pickEventImage(manifest, { headline: 'A quiet month' }, []).src, '/default.jpg');
  const noDefault = { images: manifest.images.filter(i => !i.default) };
  assert.equal(pickEventImage(noDefault, { headline: 'A quiet month' }, []), null);
});

test('popup HTML escapes the headline and offers Continue and a close icon', () => {
  const html = eventPopupHTML({ headline: '<b>Hi</b>', narrative: 'x', feasibility: 'success', dateAfter: 'June 1940' }, {}, {});
  assert.ok(html.includes('&lt;b&gt;Hi&lt;/b&gt;'));
  assert.ok(html.includes('A major event unfolds'));
  assert.ok(html.includes('June 1940'));
  assert.ok(html.includes('data-close-event'));
  assert.ok(html.includes('Continue'));
  assert.ok(!html.includes('<img'));
});

test('popup HTML shows the image and its credit when provided', () => {
  const html = eventPopupHTML({ headline: 'Fall of France', feasibility: 'success' }, {}, {
    image: { src: '/img/events/capitulation.jpg', alt: 'Surrender signed', credit: 'Archival photograph' },
    summary: 'Paris fell.'
  });
  assert.ok(html.includes('src="/img/events/capitulation.jpg"'));
  assert.ok(html.includes('Archival photograph'));
  assert.ok(html.includes('Paris fell.'));
});

console.log(`\n${passed} tests passed`);
