# AI handoff: context for continuing this project

Paste this file (and any files you want changed) into an AI coding assistant. It describes what exists, the rules the code follows, and how to make common changes safely.

## What this project is

"The Storm Breaks": a single-player, text-driven WWII grand-strategy game for secondary-school history classes (ages 12–18, with an HKDSE focus). The player leads one nation from September 1939 by typing natural-language orders. LLM agents resolve each order into a narrative plus JSON **actions**; a deterministic engine validates and applies those actions; a D3 world map and indicator panels show the result; a "history teacher" agent compares the player's timeline with real history.

Stack: Node.js ≥ 18.17 (ES modules), Express 5, dotenv, vanilla JS frontend with D3 v7 + topojson-client (bundled in `public/vendor/`), and a 1939 territory map built from Natural Earth provinces by `tools/build-map.mjs` (mapshaper). Default LLM: DeepSeek `deepseek-chat` via any OpenAI-compatible `/chat/completions` API. Optional MCP server uses `@modelcontextprotocol/sdk` + zod.

## Hard rules (keep these)

1. **Only `server/engine.js` changes game state.** Agents, MCP and the frontend go through `applyActions()` or the REST API. Never let model output write into `state` directly.
2. **Every new capability is an action type** with validation in `APPLY`, a line in `ACTION_SPEC` (`server/agents.js`), docs in `docs/ACTIONS.md`, and a test.
3. **Agents return JSON only**, cleaned by `cleanGM` / `cleanRivals` / `cleanLesson`. Add new fields there with defaults and length limits.
4. **Offline mode must keep working.** If you change an agent's output shape, update `server/mock.js` to match.
5. **Student safety** (`SAFETY` in `agents.js`): no graphic content, atrocities never playable, Holocaust taught accurately, invented dialogue never presented as real quotes. Don't weaken this.
6. **The frontend renders; it doesn't simulate.** Game logic belongs on the server.
7. **Escape all text** inserted into HTML with `esc()` from `public/js/panels.js`.
8. **Keep the engine scenario-agnostic.** Never import a scenario file directly into `engine.js`, `agents.js` or `mock.js`; resolve values through `getScenario(state.scenarioId)` from `server/data/scenarios/index.js`.
9. **Report scores must stay reproducible.** The LLM may only return per-rubric scores and prose; `server/report.js` owns the metrics and the weighted overall score. Do not let the model set the overall score directly.

## File map

| File | Responsibility |
|---|---|
| `server/index.js` | Express routes, autosave to `saves/autosave.json`, SSE broadcast, Markdown journal/report export, turn + report lock, rollback on failure |
| `server/engine.js` | `createGame`, `applyActions` + `APPLY` handlers, name resolution, `advanceTime`, `checkGameOver`, `summarizeForLLM`, deltas, `snapshotInitial`. Scenario-agnostic |
| `server/agents.js` | Scenario-parameterised prompts (`actionSpec`, `SAFETY`, three turn agents, report agent), JSON cleaners, `runTurn`, `generateReport` |
| `server/report.js` | `computeMetrics` (deterministic) and `scoreFromGrades` (fixed weights, reproducible overall score) |
| `server/llm.js` | `chatJSON(system, user)`: OpenAI-compatible call, JSON mode, loose parsing, one retry, timeout. Config from env |
| `server/mock.js` | Keyword-based stand-ins for the turn agents + `mockReport` |
| `server/data/scenarios/index.js` | Scenario registry: `SCENARIOS`, `getScenario`, `listScenarios`, `scenarioSummary` |
| `server/data/scenarios/ww2-1939.js` | WWII campaign data: dates, briefing, `indicators`, `factions`, `nations`, `territoryOwners`, `start*`, aliases, suggestions, timeline |
| `server/data/scenarios/china-1939.js` | China's War of Resistance campaign (spreads the WWII data and overrides China/CCP) |
| `server/data/timelines/*.js` | `TIMELINE` of real events per campaign |
| `server/data/timeline.js` | Generic `eventsBetween(timeline, …)` / `eventsNear(timeline, …)` |
| `public/js/app.js` | Boot, event wiring, scenario picker, `sendOrder` turn flow, date roll animation, start/hood/ending modals, report screen, lesson drawer |
| `public/js/map.js` | `WorldMap`: projection, fills, occupation patterns, borders mesh, labels, zoom/views (incl. China)/focus, pulse |
| `public/js/panels.js` | Pure HTML builders: nation card, indicator/diplomacy/journal tabs, log, lesson, hood, after-action report |
| `public/js/api.js` | Fetch wrapper; `listen()` for SSE |
| `tools/build-map.mjs` | Builds `public/data/world-1939.json`: groups Natural Earth provinces into 1939 territories and cuts along historical border lines (`CLIPS`) |
| `mcp/server.js` | MCP tools that call the REST API on `GAME_URL` |
| `tests/engine.test.js` | Engine tests (`npm test`) |

Data contracts are in `docs/API.md` (state and journal shapes) and `docs/ACTIONS.md` (actions).

## How to do common tasks

**Add an indicator** (e.g. `inflation`): add it to `INDICATORS` in `scenario1939.js` with a `tab`; add a starting value to every nation in `NATIONS` and to the minor-nation default in `createGame()`. It appears in the tab, the prompts and validation automatically.

**Add a tab**: add a button in `index.html` (`data-tab`), give indicators that `tab` value, or add a custom builder in `panels.js` and a branch in `renderLedger()`.

**Add a nation**: add an entry to `NATIONS`, map its territories in `TERRITORY_OWNERS`, optionally set `playable: true` and add `SUGGESTIONS`.

**Fix or change a border**: edit `tools/build-map.mjs` (grouping tables or a `CLIPS` polygon), run `npm run build-map`, then make sure every territory name used in `server/data/scenario1939.js` (owners, aliases, `home`, `START_OCCUPATION`) still exists. `npm test` catches the most common mistakes.

**Add a new agent** (e.g. an "Economist"): write a system prompt and cleaner in `agents.js`, call it inside `runTurn` (in parallel with the others if it only needs the GM result), apply its actions with a distinct `source`, push debug info into `debug.agents`, and add a mock in `mock.js`.

**Add a scenario**: add `server/data/timelines/<id>.js`, add `server/data/scenarios/<id>.js` (spread an existing scenario and override the fields you need — see `china-1939.js`), then register it in `server/data/scenarios/index.js`. It appears on the start screen and in the API automatically. If the scenario uses a new map, set `mapFile` and key `territoryOwners` by that map's `properties.name` values.

**Change the report rubrics or weights**: edit `DEFAULT_WEIGHTS` in `server/report.js`, or set `reportWeights` on a scenario. The overall score is always recomputed by the engine.

**Change the LLM**: `.env` only (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_JSON_MODE`).

**Test without an LLM**: run with no key, or use Under the hood → Apply actions by hand, or `curl -X POST localhost:3000/api/actions -H 'content-type: application/json' -d '{"actions":[...]}'`.

## Known limitations / good next steps

- 1939 borders are approximations (10–30 km). Not modelled: German Upper Silesia (shown Polish), Zaolzie (shown German), Estonian/Latvian districts now in Pskov oblast (shown Soviet), Aden (shown as Yemen), British Cameroons (shown French).
- One game per server process (`let game` in `index.js`). For multi-student hosting, key games by a session id.
- No scripted historical events fire automatically yet; the real timeline only informs prompts and lessons.
- No teacher dashboard; journals and reports are exported per student as Markdown/JSON.
- The UI chrome is English only; AI-generated text can be English or Chinese.
- Two scenarios share `world-1939.json`. The registry and frontend support a different `mapFile` per scenario (the page reloads when it changes), but no second map has been built yet.
- The CCP owns its northwestern base area (`Northwest China`) in the China scenario; its other base areas are represented by occupation stripes. A province-level China map would make the civil-war-era fronts sharper.
