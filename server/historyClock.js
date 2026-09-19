// History clock — the wider war keeps moving while the player decides.
// ------------------------------------------------------------------
// A small scheduler on top of the engine, not a new mutator and not another
// LLM. Scenario data lists scripted historical events (server/data/clocks/);
// each turn, after the Game Master, the clock walks the months that pass and
// fires the events whose real date falls in them. Events apply through
// applyActions() with source 'history_clock', so every change stays
// validated, clamped and auditable, and no new action types exist.
//
// An event is skipped (and recorded) when:
//   - the game is in sandbox mode (map events only; lessons still fire),
//   - the player's own nation is one of the event's actors (a hint is
//     returned instead, so the student sees what history expected of them),
//   - a `requires` precondition no longer matches the board (HOI4-style:
//     if the player already changed history, the script no-ops).
// Every due event is marked fired exactly once, whatever the outcome, so a
// skipped event does not nag again the following month.

import { applyActions, advanceTime, atWar, resolveNation, resolveTerritory } from './engine.js';
import { getScenario } from './data/scenarios/index.js';

// Mirrors MAX_TIME_SKIP in engine.js.
const MAX_SKIP = 12;

// ---------- preconditions ----------
// State checks against the live board. An unresolvable nation or territory
// fails the predicate, which also gates events whose actors do not exist in
// the active scenario (e.g. the CCP in the WWII campaign).
const PREDICATES = {
  owner(state, p) {
    const t = resolveTerritory(state, p.territory);
    const tag = resolveNation(state, p.tag);
    return Boolean(t && tag && state.territories[t].owner === tag);
  },
  at_war(state, p) {
    const a = resolveNation(state, p.a);
    const b = resolveNation(state, p.b);
    return Boolean(a && b && atWar(state, a, b));
  },
  not_at_war(state, p) {
    const a = resolveNation(state, p.a);
    const b = resolveNation(state, p.b);
    return Boolean(a && b && !atWar(state, a, b));
  },
  occupied_by(state, p) {
    const t = resolveTerritory(state, p.territory);
    const tag = resolveNation(state, p.tag);
    return Boolean(t && tag && (state.territories[t].occupation?.[tag] > 0));
  },
  not_capitulated(state, p) {
    const tag = resolveNation(state, p.tag);
    return Boolean(tag && !state.nations[tag].capitulated);
  },
  not_fired(state, p) {
    return !(state.firedScriptedIds || []).includes(p.id);
  }
};

// Events whose real date falls in the given {year, month} and have not fired.
export function dueEvents(state, monthDate = state.date) {
  const scenario = getScenario(state.scenarioId);
  const fired = new Set(state.firedScriptedIds || []);
  const idx = monthDate.year * 12 + (monthDate.month - 1);
  return (scenario.scriptedEvents || []).filter(e => {
    if (fired.has(e.id)) return false;
    const [y, m] = String(e.date).split('-').map(Number);
    return y * 12 + (m - 1) === idx;
  });
}

// Decide what one due event does. Returns { verdict, ... } where verdict is
// 'apply' | 'lesson' | 'hint' | 'skip' | 'fired'.
export function evaluate(state, event) {
  if ((state.firedScriptedIds || []).includes(event.id)) return { verdict: 'fired' };
  if (event.kind === 'lesson') return { verdict: 'lesson' };
  if (state.realism === 'sandbox') return { verdict: 'skip', reason: 'sandbox' };
  const actors = (event.actors || []).map(r => resolveNation(state, r)).filter(Boolean);
  if (actors.includes(state.player)) return { verdict: 'hint', hint: event.hint || event.blurb };
  for (const p of event.requires || []) {
    const check = PREDICATES[p.type];
    if (!check || !check(state, p)) return { verdict: 'skip', reason: 'precondition', predicate: p };
  }
  return { verdict: 'apply' };
}

// Fire every event due in monthDate (default: the current month), one
// applyActions call per event so no event competes for the 40-action cap.
// Returns { fired, hints, skipped, applied, rejected } for the journal, the
// other agents and the debug view.
export function runClockMonth(state, monthDate = state.date) {
  state.firedScriptedIds ||= [];
  const out = { fired: [], hints: [], skipped: [], applied: [], rejected: [] };
  for (const event of dueEvents(state, monthDate)) {
    const decision = evaluate(state, event);
    const entry = { id: event.id, date: event.date, title: event.title, blurb: event.blurb, kind: event.kind };
    if (decision.verdict === 'apply') {
      const r = applyActions(state, event.actions, { source: 'history_clock', forbidActor: state.player });
      out.fired.push(entry);
      out.applied.push(...r.applied);
      out.rejected.push(...r.rejected.map(x => ({ ...x, event: event.id })));
    } else if (decision.verdict === 'lesson') {
      out.fired.push(entry);
    } else if (decision.verdict === 'hint') {
      out.hints.push({ ...entry, hint: decision.hint, skippedReason: 'player' });
    } else if (decision.verdict !== 'fired') {
      out.skipped.push({ ...entry, skippedReason: decision.reason });
    }
    if (decision.verdict !== 'fired') state.firedScriptedIds.push(event.id);
  }
  // Chronological order for the Meanwhile list, whatever the pack order.
  const byDate = (a, b) => String(a.date).localeCompare(String(b.date));
  out.fired.sort(byDate);
  out.hints.sort(byDate);
  out.skipped.sort(byDate);
  return out;
}

// The clock's replacement for a plain advanceTime(): fire the current month's
// events, then move one month forward, repeat. Events of September 1939 are
// therefore stamped September 1939, not the month the turn ends in.
export function runClockSkip(state, months) {
  const m = Math.max(0, Math.min(MAX_SKIP, Math.round(Number(months) || 0)));
  const out = { months: m, fired: [], hints: [], skipped: [], applied: [], rejected: [] };
  for (let i = 0; i < m; i++) {
    const r = runClockMonth(state, state.date);
    out.fired.push(...r.fired);
    out.hints.push(...r.hints);
    out.skipped.push(...r.skipped);
    out.applied.push(...r.applied);
    out.rejected.push(...r.rejected);
    advanceTime(state, 1);
  }
  return out;
}
