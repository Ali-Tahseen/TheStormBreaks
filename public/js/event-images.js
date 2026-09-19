// Event images — simple, deterministic category matching.
// ------------------------------------------------------------------
// Images live under public/img/events/ and are grouped by "category" in
// public/img/events/manifest.json (e.g. war, capitulation, destruction).
// The AI never chooses an image: the turn's own words pick a category, then a
// random image from that category is shown. Adding an image is a file plus one
// manifest entry, no code change. See docs/ARCHITECTURE.md.

// The first paragraph of the narrative is the popup's short summary.
export function summaryFromNarrative(entry, max = 280) {
  const first = String(entry?.narrative || '').split(/\n{2,}/).map(s => s.trim()).filter(Boolean)[0];
  const text = first || String(entry?.feasibilityReason || '').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return stop > 40 ? cut.slice(0, stop + 1) : cut.trimEnd() + '…';
}

// Most specific first: a surrender is not just another battle.
const CATEGORY_RULES = [
  ['capitulation', /capitulat|surrend|armistice|ceasefire|sue for peace|signs? (a |the )?(peace|surrender|armistice)/i],
  ['diplomatic_negotiations', /diploma|negotiat|treaty|agreement|\bpact|alliance|summit|conference|\baccords?\b|entente|non-?aggression|signs? (a |the )?(treaty|agreement|pact)|align|joins? the (allies|axis|comintern|united front)/i],
  ['destruction', /destroy|destruct|bomb|blitz|ruin|rubble|devastat|\braz|burn|shelled|siege|wreck|air raid|flatten/i],
  ['low_economy', /shortage|\brations?\b|rationing|famine|hunger|unemploy|depress|poverty|inflation|scarcit|starv|relief|economic crisis|recession|austerity|malnutrition|economy (collapses|shrinks|falters)/i],
  ['economic_growth', /industr|factor(?:y|ies)|production|five-year|gdp|output|rearm|infrastructure|prosper|economic growth|economy grows|\binvest(?:ment|s|ed|ing)?\b|construc/i],
  ['war', /\bwar\b|\bwars\b|\bwarfare\b|\bwartime\b|invad|attack|offensive|battle|\bfront|occupy|occup|seiz|capture|conquer|advance|mobilis|mobiliz|assault|push into|blockade/i]
];

// Turn events carry a coarse category (war, diplomacy, economy, politics, other).
// Use it only as a fallback when the words give nothing.
const EVENT_CATEGORY_MAP = { war: 'war', diplomacy: 'diplomatic_negotiations' };

/**
 * Which image category fits this turn? Reads the headline and narrative, then
 * falls back to the category of any event the turn added.
 * @returns {string|null} e.g. 'capitulation' | 'destruction' | 'war' | null
 */
export function eventCategory(entry, turnEvents = []) {
  const text = `${entry?.headline || ''} ${entry?.narrative || ''}`;
  for (const [category, re] of CATEGORY_RULES) if (re.test(text)) return category;
  return (turnEvents || []).map(e => EVENT_CATEGORY_MAP[e.category]).find(Boolean) || null;
}

/**
 * Pick an image for a resolved turn. Images of the matching category are
 * chosen at random (so war.jpg / war-2.jpg alternate); if nothing matches, a
 * `default` image is used, otherwise the popup is text-only.
 * @param {object} manifest  parsed public/img/events/manifest.json
 * @param {object} entry     the journal entry for the turn
 * @param {object[]} turnEvents  events added by this turn
 * @param {object} opts      { random } injectable for tests
 * @returns {object|null} a manifest image entry, or null
 */
export function pickEventImage(manifest, entry, turnEvents = [], { random = Math.random } = {}) {
  const images = (Array.isArray(manifest?.images) ? manifest.images : []).filter(i => i?.src);
  if (!images.length) return null;
  const category = eventCategory(entry, turnEvents);
  if (category) {
    const pool = images.filter(i => i.category === category);
    if (pool.length) return pool[Math.floor(random() * pool.length)] || pool[0];
  }
  return images.find(i => i.default) || null;
}
