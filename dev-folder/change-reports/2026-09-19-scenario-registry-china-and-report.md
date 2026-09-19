# Change report — scenario registry, China campaign, after-action report, glass panels

Date: 2026-09-19

## Scope

Turned the single hard-coded 1939 scenario into a scenario registry, added a second
campaign ("China's War of Resistance", 1939–1945) playable as CHN, CCP or JAP, added a
**Finish Game** button that produces a deterministic end-of-campaign report graded by the
LLM, and made the left/right panels semi-transparent (glass). This supersedes the earlier
"Chinese Civil War" idea: the second campaign is the Chinese resistance against Japan.

## Files touched

**Scenario registry (new)**
- `server/data/scenarios/index.js` — `SCENARIOS`, `getScenario`, `listScenarios`, `scenarioSummary`.
- `server/data/scenarios/ww2-1939.js` — the old `scenario1939.js`, now one `SCENARIO` object with prompts metadata, suggestions, start event, end reason.
- `server/data/scenarios/china-1939.js` — spreads the WWII data and overrides China/CCP; disables great-power playables.
- `server/data/timelines/ww2-1939.js`, `server/data/timelines/china-1939.js` — per-campaign real events.
- `server/data/timeline.js` — now generic helpers `eventsBetween(timeline, …)` / `eventsNear(timeline, …)`.
- Deleted `server/data/scenario1939.js`.

**Engine / agents / report**
- `server/engine.js` — scenario-agnostic; resolves via `state.scenarioId`; stores `state.initial`; `checkGameOver` uses the scenario end reason; removed the old scenario exports.
- `server/agents.js` — all prompts built from the scenario; `generateReport()` + report prompt/cleaner.
- `server/report.js` (new) — `computeMetrics`, `scoreFromGrades`, `applyWeights`, `DEFAULT_WEIGHTS`.
- `server/mock.js` — scenario-aware mentions/timeline; added `mockReport`.
- `server/index.js` — scenario list in `/api/info`, `?scenarioId` on playable/timeline, `POST /api/finish`, `POST /api/report`, `/api/report.json`, `/api/report.md`, report appended to journal, strips `lastReportDebug`.
- `server/data/scenarios/*` carry `mapFile` and `defaultView`.

**Frontend**
- `public/index.html` — **Finish Game** button and a **China** map view chip.
- `public/js/app.js` — scenario picker, per-scenario suggestions/default view, map file from the active scenario, async report screen, report regenerate.
- `public/js/panels.js` — removed the hard-coded `SUGGESTIONS`; added `reportHTML`.
- `public/js/api.js` — `scenarios`, `finish`, `report`.
- `public/js/map.js` — `china` view.
- `public/css/style.css` — glass `--paper-glass` panels + `backdrop-filter`, translucent inner rows/forms, scenario-card and report styles.

**Tests / docs / MCP**
- `tests/engine.test.js` — registry, China scenario, deterministic metrics, reproducible score, offline report (14 tests).
- `README.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/ACTIONS.md`, `docs/AI_HANDOFF.md`, `docs/CLASSROOM.md`.
- `mcp/server.js` — `list_scenarios`, `finish_game`, `get_report`; scenario-aware `new_game`.

## Key decisions (do not undo)

1. **Only `engine.js` changes state**, and it is now scenario-agnostic. Never import a scenario file into engine/agents/mock; use `getScenario(state.scenarioId)`.
2. **Report determinism**: metrics and the weighted overall score live in `server/report.js`; the LLM only returns per-rubric scores and prose, which the engine clamps and combines. Do not let the model set the overall score.
3. **`state.initial`** is the baseline for metrics. Saves without it fall back to a current-state snapshot (so gained/lost reads as zero) — new games always have it.
4. **China scenario map**: reuses `world-1939.json` per the user's choice. The CCP owns no province; it appears as occupation stripes in `Northwest China` / `North China`. The registry supports a per-scenario `mapFile`, and the frontend reloads if it changes.
5. **Glass panels**: side panels only. Top bar, tooltips, legend and overlays stay solid for legibility.

## Verification

- `npm test` → 14 tests passed.
- `node --check` on all changed server/frontend/mcp JS → ok.
- Offline smoke script (`createGame` → `runTurn` → `finish` → `generateReport`) for `ww2-1939/GER`, `china-1939/CHN`, `china-1939/CCP` → metrics and overall score reproducible, grader `offline`.
- HTTP smoke test (server forced offline): `/api/info`, `/api/scenarios`, `/api/new`, `/api/turn`, `/api/finish`, `/api/report`, `/api/report.md`, `/api/journal.md`, `/api/playable?scenarioId=…` all correct.

## Follow-ups / known limitations

- No province-level China map; fronts are regional and the CCP has no owned territory.
- `state.initial` slightly enlarges saves.
- Live report generation is cached on `state.report`; use `regenerate` to redo.
- Scripted on-rails events, a teacher dashboard and a second map remain future work (see `docs/ARCHITECTURE.md` → Ideas for later).
