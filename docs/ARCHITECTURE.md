# Architecture

## Design principles

1. **The AI proposes, the engine decides.** Agents return JSON actions; only `server/engine.js` mutates state, after validation and clamping. A model can't break the game, and every change is auditable.
2. **Narrative and numbers stay linked.** The Game Master writes the story *and* the actions in one response, so every number that changes is explained by the text.
3. **The server owns the state.** The browser only renders what `/api/state` returns. This is why the MCP server and the browser can share one game.
4. **Scenarios are data.** Everything specific to a campaign lives in one object in `server/data/scenarios/`. The engine, agents, mock and API resolve values through `getScenario(state.scenarioId)`, so a new scenario is new data plus one registry line, not new code.
5. **Works without a key.** `server/mock.js` returns the same JSON shapes as the real agents, so the whole pipeline can be tested offline.

## A turn, step by step (`runTurn` in `server/agents.js`)

1. Snapshot every nation's indicators (to compute ▲/▼ changes later).
2. Build the Game Master request:
   ```json
   { "task": "resolve_player_order", "player_order": "...", "world": { ... }, "real_history_nearby": [ ... ] }
   ```
   `world` comes from `summarizeForLLM()`: date, player, relevant nations with indicators and wars, the player's relations, **every territory with its owner** (so the model knows valid names), and the last 4 turns.
3. Call the model with the Game Master system prompt → `cleanGM()` normalises the JSON (defaults, length limits, time skip clamped to 1–6 months).
4. `applyActions(..., {source: 'game_master'})`, then `advanceTime()`.
5. In parallel:
   - **Rival Leaders** get what just happened plus a shorter world summary → reactions and actions. Applied with `forbidActor: player`.
   - **History Teacher** gets the period, the order, the outcome and the real events in that period → the lesson.
   If either fails, the turn still completes (the offline lesson is used as a fallback).
6. Compute deltas, append the journal entry, increment turn and version, check for game over (player stability 0, player defeated, or September 1945).
7. `server/index.js` autosaves and broadcasts a live-update event.

If step 3 fails (network, bad key, invalid JSON twice), the server restores the pre-turn state and returns a 502 with the reason.

## Prompts

All prompts are in `server/agents.js` and are built from the active scenario:

- `actionSpec(scenario)`: the action list the models see. Built from `scenario.indicators` and `scenario.factions`, so new indicators or factions appear automatically.
- `SAFETY`: audience rules for students aged 12–18. Atrocities are never playable; the Holocaust is taught accurately; leader dialogue is labelled in-game and never passed off as real quotations.
- `gameMasterSystem()`, `rivalsSystem()`, `teacherSystem()`: one per agent. Each takes scenario text (era, setting, rival guidance, teacher context, timeline). Each ends with the exact JSON shape expected.
- `reportSystem(scenario)`: the end-of-campaign examiner.

## The after-action report

`server/report.js` holds the deterministic half:

- `computeMetrics(state)` diffs `state.initial` (a snapshot taken by `createGame`) against the current state: territories gained/lost, occupation changes, indicator changes, wars started/ended, enemies defeated, and how each order was judged. Given the same state it always returns the same object.
- `scoreFromGrades(grades, weights)` clamps each rubric to 0–100 and combines it with fixed weights (`DEFAULT_WEIGHTS`, overridable per scenario) into one reproducible overall score and letter grade.

`generateReport()` in `server/agents.js` builds the metrics, asks the LLM to grade the campaign and pick the most important decisions (temperature 0.2), cleans the JSON, and stores the combined report on `state.report` (cached; pass `regenerate` to redo). Without an API key, `mockReport()` in `server/mock.js` produces a deterministic report. The report is exposed through `POST /api/report`, `GET /api/report.json`, `GET /api/report.md`, and appended to the journal export.

Language: the `lang` setting tells agents which language to use for text fields. JSON keys, action types and tags always stay in English.

DeepSeek JSON mode requires the word "json" in the prompt and `response_format: {type: "json_object"}`; `llm.js` sends both. `parseJSONLoose()` also accepts JSON wrapped in ``` fences or surrounded by text, for models without JSON mode. Empty or invalid responses are retried once.

## Frontend

- `app.js` holds the app state (`info`, `state`, `selected`, `tab`, `busy`) and calls render functions after each change. There is no framework; rendering is `innerHTML` from the pure builders in `panels.js`, with all text escaped by `esc()`.
- `map.js` (`WorldMap`) draws once on load and on resize, then `render(state)` restyles fills, redraws occupation stripes (SVG patterns per occupier and 25% band), nation borders (a TopoJSON mesh between shapes with different owners), the selected nation's outline, and labels. Labels hide or show depending on zoom level.
- Live updates: `api.listen()` opens `/api/events`. When the server's version differs from the local one, the app refetches state. Changes from MCP or another tab show up immediately.
- The one deliberate animation: after a turn the date rolls month by month, then the changed territories pulse. `prefers-reduced-motion` turns both off.

## Adding a scenario

1. Add a timeline in `server/data/timelines/<id>.js` (export a `TIMELINE` array).
2. Add `server/data/scenarios/<id>.js` exporting a single `SCENARIO` object. The easiest start is to spread an existing scenario (`...WW2`) and override `id`, `title`, `startDate`/`endDate`, `mapFile`, `defaultView`, `briefing`, `timeline`, `nations`, `startWars`, `startRelations`, `startOccupation`, `aliases`, `territoryAliases`, `suggestions` and (optionally) `reportWeights`. See `china-1939.js`.
3. Register it in `server/data/scenarios/index.js` (import + one line in `SCENARIOS`). It now appears on the start screen, in `/api/scenarios` and in `/api/info` automatically.
4. For a different map, build a TopoJSON whose `objects.territories` geometries have `properties.name`, set `scenario.mapFile`, and key `territoryOwners` by those names. The frontend reloads when a scenario's `mapFile` differs from the loaded one.

## How the map is built (`tools/build-map.mjs`)

1. Download Natural Earth 1:10m admin-1 (every province/state in the world, public domain) into `tools/cache/`.
2. Give each province a 1939 territory name, in this order: `BY_PROVINCE` (single provinces, e.g. `RUS:Kaliningrad` → East Prussia), then `byRegion()` (splits of Russia, China and overseas France), then `BY_COUNTRY` (whole countries, e.g. `IND`, `PAK`, `BGD` → British India), otherwise the modern country name.
3. For each entry in `CLIPS`, cut the listed provinces with a polygon drawn along the historical border; the inside becomes a different territory.
4. Mapshaper dissolves provinces into territories, simplifies to about 4% of the vertices (keeping small islands), removes slivers and writes TopoJSON (~220 KB).

The engine and map read territory names from this file at start-up, so a rebuilt map is picked up automatically. `npm test` checks that key territories (East Prussia, Eastern Poland, Karafuto, Hong Kong) have the right owners.

## Ideas for later

- Scripted "on-rails" events that fire at real dates unless the player has changed the preconditions.
- Teacher dashboard: several students' saves side by side.
- DBQ generator: an agent that turns a finished run into a source-based exam paper.
- A second map layer for front lines inside a territory instead of percentage stripes.
