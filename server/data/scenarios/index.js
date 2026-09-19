// Scenario registry — the single place that knows every scenario.
// ------------------------------------------------------------------
// A scenario is a data file that exports a `SCENARIO` object (and a default).
// The engine, agents, mock and REST API all resolve scenario-specific values
// through getScenario(), so adding a scenario means adding a file here and one
// import line below — no engine changes.

import ww21939 from './ww2-1939.js';
import china1939 from './china-1939.js';

export const SCENARIOS = {
  [ww21939.id]: ww21939,
  [china1939.id]: china1939
};

export const DEFAULT_SCENARIO_ID = ww21939.id;

export function getScenario(id) {
  return SCENARIOS[id] || SCENARIOS[DEFAULT_SCENARIO_ID];
}

export function scenarioExists(id) {
  return Boolean(id && SCENARIOS[id]);
}

// Compact, public description of a scenario for the start screen and /api/info.
export function scenarioSummary(s) {
  return {
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    era: s.era,
    startDate: { ...s.startDate },
    endDate: { ...s.endDate },
    mapFile: s.mapFile,
    defaultView: s.defaultView,
    briefing: s.briefing,
    indicators: s.indicators,
    factions: s.factions,
    playable: Object.entries(s.nations).filter(([, n]) => n.playable)
      .map(([tag, n]) => ({
        tag, name: n.name, leader: n.leader, ideology: n.ideology, faction: n.faction,
        color: n.color, indicators: n.indicators
      })),
    countryBriefing: s.countryBriefing || {},
    suggestions: s.suggestions || {}
  };
}

export function listScenarios() {
  return Object.values(SCENARIOS).map(scenarioSummary);
}
