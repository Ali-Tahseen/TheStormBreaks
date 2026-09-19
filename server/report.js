// Deterministic end-of-campaign metrics and score combination.
// ------------------------------------------------------------------
// The LLM grades the campaign, but the numbers it is graded against — and the
// way grades are combined into the overall score — are computed here from the
// game state alone. Given the same state, computeMetrics() and
// scoreFromGrades() always return the same result.

import { getScenario } from './data/scenarios/index.js';
import { snapshotInitial, monthIndex, formatDate, territoriesOf } from './engine.js';

const round1 = (n) => Math.round(n * 10) / 10;

// Rubric weights per scenario. Override with scenario.reportWeights.
export const DEFAULT_WEIGHTS = {
  historical_realism: 0.30,
  strategic_effectiveness: 0.25,
  economic_management: 0.15,
  diplomacy: 0.15,
  decision_quality: 0.15
};

export function applyWeights(scenario) {
  const raw = scenario?.reportWeights || DEFAULT_WEIGHTS;
  const total = Object.values(raw).reduce((a, b) => a + b, 0) || 1;
  const out = {};
  for (const [k, v] of Object.entries(raw)) out[k] = v / total;
  return out;
}

export function letterGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  if (score >= 50) return 'E';
  return 'F';
}

export function gradeLabel(score) {
  if (score >= 90) return 'Outstanding';
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 50) return 'Adequate';
  return 'Weak';
}

/**
 * Combine per-rubric grades into one reproducible overall score.
 * @param {object} grades { key: {score} } or { key: number }
 * @param {object} weights normalised weights
 */
export function scoreFromGrades(grades, weights = DEFAULT_WEIGHTS) {
  let sum = 0, wsum = 0;
  for (const [k, w] of Object.entries(weights)) {
    const raw = grades?.[k];
    const s = Number(raw && typeof raw === 'object' ? raw.score : raw);
    if (Number.isFinite(s)) { sum += s * w; wsum += w; }
  }
  const score = wsum ? Math.round(sum / wsum) : 50;
  return { score, letter: letterGrade(score), label: gradeLabel(score) };
}

/**
 * Compute the deterministic metrics of a finished campaign.
 * @param {object} state
 */
export function computeMetrics(state) {
  const scenario = getScenario(state.scenarioId);
  const initial = state.initial || snapshotInitial(state);
  const p = state.player;
  const playerNation = state.nations[p] || {};

  // Indicator change since the start.
  const cur = playerNation.indicators || {};
  const ini = initial.indicators?.[p] || {};
  const indicatorChanges = {};
  for (const k of Object.keys(cur)) {
    const d = round1((cur[k] ?? 0) - (ini[k] ?? 0));
    if (d !== 0) indicatorChanges[k] = d;
  }

  // Territory changes since the start.
  const gained = [], lost = [], occupationGained = {}, occupationLost = {};
  for (const [name, t] of Object.entries(state.territories)) {
    const it = initial.territories?.[name];
    if (!it) continue;
    if (t.owner === p && it.owner !== p) gained.push(name);
    if (it.owner === p && t.owner !== p) lost.push(name);
    const curOcc = t.occupation?.[p] || 0;
    const iniOcc = it.occupation?.[p] || 0;
    if (curOcc > iniOcc) occupationGained[name] = curOcc - iniOcc;
    if (iniOcc > curOcc) occupationLost[name] = iniOcc - curOcc;
  }

  // Wars started and ended since the start.
  const key = (w) => w.slice().sort().join('|');
  const initialWars = new Set((initial.wars || []).map(key));
  const currentWars = new Set(state.wars.map(key));
  const warsStarted = state.wars.filter(w => !initialWars.has(key(w)));
  const warsEnded = (initial.wars || []).filter(w => !currentWars.has(key(w)));

  // Enemies defeated while the player was at war with them.
  const enemiesDefeated = Object.values(state.nations)
    .filter(n => n.capitulated && (initial.wars || []).some(w => w.includes(n.tag) && w.includes(p)))
    .map(n => ({ tag: n.tag, name: n.name }));

  // How the player's orders were judged.
  const feasibility = { success: 0, partial: 0, failed: 0, refused: 0 };
  for (const j of state.journal) if (feasibility[j.feasibility] !== undefined) feasibility[j.feasibility]++;

  // Real events that happened during the played period, for comparison.
  const startK = monthIndex(scenario.startDate);
  const endK = monthIndex(state.date);
  const realEvents = scenario.timeline.filter(e => {
    const [y, m] = e.date.split('-').map(Number);
    const k = y * 12 + (m - 1);
    return k >= startK && k <= endK;
  });

  return {
    scenario: scenario.id,
    scenarioTitle: scenario.title,
    player: { tag: p, name: playerNation.name, leader: playerNation.leader },
    period: { from: formatDate(scenario.startDate), to: formatDate(state.date) },
    turns: state.journal.length,
    monthsPlayed: Math.max(0, endK - startK),
    gameOver: state.gameOver || null,
    playerCapitulated: Boolean(playerNation.capitulated),
    playerStability: playerNation.indicators?.stability ?? null,
    indicatorChanges,
    territoriesOwned: territoriesOf(state, p),
    territoriesGained: gained,
    territoriesLost: lost,
    occupationGained,
    occupationLost,
    warsStarted: warsStarted.map(w => ({ a: w[0], b: w[1] })),
    warsEnded: warsEnded.map(w => ({ a: w[0], b: w[1] })),
    enemiesDefeated,
    feasibility,
    realEventsInPeriod: realEvents.map(e => ({ date: e.date, title: e.title }))
  };
}
