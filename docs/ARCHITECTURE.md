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
   { "task": "resolve_player_order", "player_order": "...", "territories_mentioned_in_the_order": [ ... ], "nations_mentioned_in_the_order": [ ... ], "world": { ... }, "real_history_nearby": [ ... ] }
   ```
   `world` comes from `summarizeForLLM()`: date, player, relevant nations with indicators and wars, the player's relations, **every territory with its owner** (so the model knows valid names), and the last 4 turns. `scanMentions()` (in `server/engine.js`) extracts the territories and nations the order names — through the scenario aliases — so the model uses the real names instead of guessing (or writing "the Baltics").
3. Call the model with the Game Master system prompt → `cleanGM()` normalises the JSON (defaults, length limits, time skip clamped to 1–6 months).
4. `applyActions(..., {source: 'game_master'})`. If the story claims a territorial change the actions never made (`needsRepair()`: a territory action was rejected, or the narrative claims a map change with none applied, or the order has a change verb and names a foreign territory but nothing moved), a small focused **Effects** agent (`effectsSystem()` / `repairEffects()`, ~700 output tokens) returns just the missing `{ actions: [...] }` and they are applied. It runs before the clock so the clock's preconditions see the new board. Then the **history clock** (`runClockSkip()` in `server/historyClock.js`) walks the elapsed months one by one: for each month it fires the scenario's due `scriptedEvents` through `applyActions(..., {source: 'history_clock', forbidActor: player})`, then advances one month — so September 1939 events stamp September 1939, not the month the turn ends in. Fully occupying a nation's home territory automatically makes it capitulate (engine rule), so the map cannot silently disagree with the story.
   - A scripted event is skipped and recorded when the game is in sandbox mode (map events only), when the player's nation is one of its `actors` (a `hint` is returned instead, so the student sees what history expected of them), or when a `requires` precondition (`owner`, `at_war`/`not_at_war`, `occupied_by`, `not_capitulated`, `not_fired`) no longer matches the board. Every due event is marked in `state.firedScriptedIds` exactly once, whatever the outcome.
   - The fired events and hints go to the journal entry (`meanwhile`), to the Rival Leaders (`what_just_happened.meanwhile`), to the History Teacher (`history_clock` plus a `board_snapshot` of the flashpoint territories, so clock-driven history is not mistaken for a student deviation) and to the Advisors (`lastTurn.meanwhile`). The Game Master prompt tells the model the clock owns the wider war's **own** campaigns, but that it must still apply the direct map consequences of the player's order — including seizing or annexing neutral or adjacent territory (the Baltic states, Bessarabia) and resolving collective names to exact territories. For a change on a front the clock owns it uses `occupy_territory` with `delta` (a counter-attack lowers the occupier's percent, a failed defense raises it) so the clock is adjusted rather than overwritten.
   - If the map still disagrees with the story after repair, the journal entry gets `mapWarning: true` and the frontend shows a toast.
5. The **History Teacher** starts at once (it only needs the outcome: the period, the order and the real events in that period → the lesson). Meanwhile, in sequence:
   - **Rival Leaders** get what just happened plus a shorter world summary → reactions and actions. Applied with `forbidActor: player`, then deltas are computed.
   - **Advisors** (`briefAdvisors`) get the player's indicators and last-turn changes, wars, occupation at home and abroad, relations, the last turn (order, outcome, rival reactions) and the real events of the last few months → a briefing from the economic advisor, the diplomat and the military advisor. Each gives an `outlook` (`good|steady|worrying|critical`) plus one line on the situation at home, one abroad and one suggestion. Advisors emit **no actions**; `cleanAdvisors()` keeps only those four fields per advisor.
   If the rivals, the teacher or the advisors fail, the turn still completes (offline lesson / offline briefing as fallbacks).
6. Append the journal entry (with `advisors`), set `state.advisors`, increment turn and version, check for game over (player stability 0, player defeated, or September 1945).
7. `server/index.js` autosaves and broadcasts a live-update event.

If step 3 fails (network, bad key, invalid JSON twice), the server restores the pre-turn state and returns a 502 with the reason.

## Prompts

All prompts are in `server/agents.js` and are built from the active scenario:

- `actionSpec(scenario)`: the action list the models see. Built from `scenario.indicators` and `scenario.factions`, so new indicators or factions appear automatically. Includes `capitulate`, the single action for a surrender or armistice (a nation leaves the war but keeps any land not occupied or annexed — Vichy France, 1940).
- `SAFETY`: audience rules for students aged 12–18. Atrocities are never playable; the Holocaust is taught accurately; leader dialogue is labelled in-game and never passed off as real quotations.
- `gameMasterSystem()`, `rivalsSystem()`, `teacherSystem()`, `advisorsSystem()`: one per agent. Each takes scenario text (era, setting, rival guidance, teacher context, timeline). Each ends with the exact JSON shape expected.
- `effectsSystem()`: the small repair agent. It turns a Game Master story into the actions the story implies, returning only `{ "actions": [...] }`. It runs only when `needsRepair()` is true, so normal turns never pay for it.
- `reportSystem(scenario)`: the end-of-campaign examiner.

## The after-action report

`server/report.js` holds the deterministic half:

- `computeMetrics(state)` diffs `state.initial` (a snapshot taken by `createGame`) against the current state: territories gained/lost, occupation changes, indicator changes, wars started/ended, enemies defeated, and how each order was judged. Given the same state it always returns the same object.
- `scoreFromGrades(grades, weights)` clamps each rubric to 0–100 and combines it with fixed weights (`DEFAULT_WEIGHTS`, overridable per scenario) into one reproducible overall score and letter grade.

`generateReport()` in `server/agents.js` builds the metrics, asks the LLM to grade the campaign and pick the most important decisions (temperature 0.2), cleans the JSON, and stores the combined report on `state.report` (cached; pass `regenerate` to redo). Without an API key, `mockReport()` in `server/mock.js` produces a deterministic report. The report is exposed through `POST /api/report`, `GET /api/report.json`, `GET /api/report.md`, and appended to the journal export.

Language: the `lang` setting tells agents which language to use for text fields. JSON keys, action types and tags always stay in English.

DeepSeek JSON mode requires the word "json" in the prompt and `response_format: {type: "json_object"}`; `llm.js` sends both. `parseJSONLoose()` also accepts JSON wrapped in ``` fences or surrounded by text, for models without JSON mode. Empty or invalid responses are retried once.

## Frontend

- `app.js` holds the app state (`info`, `state`, `selected`, `tab`, `busy`, `dossierOpen`, `advisorsOpen`, `advisorRole`) and calls render functions after each change.
- **Start screen:** the scenario picker and general briefing sit on the left; choosing a playable nation on the right shows a **country briefing** (`countryDetailHTML()` in `panels.js`, `#country-detail`): the leader's portrait (via `portraits.js`), who you lead, the nation's `countryBriefing.summary` and `.task` from the scenario, strengths and watch-outs derived from its starting indicators (ranked against the other playable nations), and the scenario's example first moves. The detail updates without re-rendering the sheet, so form input is kept.
- The left rail: a **compact panel** (your nation only: header, Economy/Military/Politics/Diplomacy/Journal tabs with stat tiles), the orders log with two overlays inside `.log-wrap` (the **country report** that drops down from *Details*, and the **advisors' briefing** that rises from the advisor bar), then the order box. Clicking another nation (map or chips) opens the **intel card** with limited, qualitative information. Leader portraits are matched in `portraits.js` by the nation's current leader. There is no framework; rendering is `innerHTML` from the pure builders in `panels.js`, with all text escaped by `esc()`.
- **Event popup:** after every order a wide, centred window (`#event`, `eventPopupHTML()` in `panels.js`) shows the Game Master's `headline` plus a short summary (the first paragraph of the narrative, `summaryFromNarrative()`). It is laid out like a museum caption: an archival photo on the left, and on the right an uppercase eyebrow ("A major event unfolds"), the date, the serif headline and a red **Continue** button, with a small × to close. The map behind is blurred and dimmed. The map focus and the history-lesson drawer run only after the student clicks **Continue** (`openEventPopup`/`closeEventPopup` in `app.js`), so the popup is the beat. Escape also dismisses it; clicking the backdrop does not.
- **Event images (pre-recorded):** a finite library under `public/img/events/`, grouped by `category` in `public/img/events/manifest.json` (`war`, `capitulation`, `destruction`, `economic_growth`, `low_economy`, `diplomatic_negotiations`). `public/js/event-images.js` (`eventCategory()` + `pickEventImage()`) reads the turn's headline and narrative, picks the most specific matching category, then chooses a **random** image from that category (so `war.jpg` / `war-2.jpg` alternate). A `default: true` entry is the fallback; otherwise the popup is text-only. The AI never chooses an image, so the GM is not given extra work. Large images are Git LFS objects.
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

- Teacher dashboard: several students' saves side by side.
- DBQ generator: an agent that turns a finished run into a source-based exam paper.
- A second map layer for front lines inside a territory instead of percentage stripes.
