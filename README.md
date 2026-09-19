# The Storm Breaks pedicts

A text-driven Second World War strategy game for history classrooms. Students lead a nation by typing orders in plain language. AI agents decide what happens, the world map changes, and after every turn a short lesson compares the student's alternate timeline with what really happened. When the campaign ends, a **Finish Game** button produces a graded after-action report.

Two campaigns ship with the game:

- **The Storm Breaks** — World War II from 1 September 1939.
- **China's War of Resistance** — China against Japan, 1939–1945, playable as the Nationalists (CHN), the Communists (CCP) or Japan.

Inspired by Hearts of Iron, but built for a 40-minute lesson: no menus or tech trees, just a map, indicators, and a text box.

## Quick start

You need [Node.js](https://nodejs.org) 18.17 or newer.

```bash
git clone <your-repo-url> storm-breaks
cd storm-breaks
npm install
cp .env.example .env      # Windows: copy .env.example .env
# open .env and paste your DeepSeek API key into LLM_API_KEY
npm start
```

Open **http://localhost:3000**.

No API key yet? Skip the `.env` step. The game runs in **offline demo mode**, which understands simple orders ("Germany takes 10% of Canada", "declare war on France", "build more tanks") so you can test the interface and the map. Get a DeepSeek key at https://platform.deepseek.com.

Other commands:

| Command | What it does |
|---|---|
| `npm run dev` | Start and restart automatically when you edit server files |
| `npm test` | Run the game-engine tests (no AI needed) |
| `npm run mcp` | Start the optional MCP server (see below) |
| `npm run build-map` | Rebuild the 1939 map from Natural Earth data (only needed if you change borders) |

## How it works

```
Student types an order
        │  POST /api/turn  {"order": "..."}
        ▼
Backend packages it as JSON: order + world state + real events near this date
        │
        ▼
1. Game Master agent  ──► narrative, time skip, ACTIONS (JSON)
        │                    ▼
        │              Game engine validates + applies actions
        ▼
2. Rival Leaders agent  ┐  run in parallel
3. History Teacher agent┘  ──► reactions + more actions, lesson (JSON)
        │
        ▼
Updated state ──► frontend re-renders map, indicators, log, lesson
```

Every scenario is a data file in `server/data/scenarios/` (nations, map, timeline, briefing, suggestions). The engine, agents and offline demo resolve everything through a scenario registry, so adding a campaign is new data, not new code.

The key idea: **the AI never changes the game directly.** It returns a list of actions such as

```json
{ "type": "occupy_territory", "territory": "Canada", "occupier": "GER", "delta": 10 }
```

and `server/engine.js` checks each one against a whitelist, limits how big a change can be, applies what is valid, and reports what was rejected. That keeps the game stable when a model returns something odd. Open **Under the hood** in the game to see every request, response, applied action and rejection for the last turn. You can also paste actions there by hand to test the map without AI.

Full list of actions: [docs/ACTIONS.md](docs/ACTIONS.md).

## Project layout

```
server/
  index.js            Express server: REST API, saves, live updates (SSE), journal + report export
  engine.js           Game state + the ONLY code that changes it (action whitelist, validation)
  agents.js           The AI agents: prompts, JSON cleaning, turn pipeline, after-action report
  report.js           Deterministic campaign metrics + score combination
  llm.js              OpenAI-compatible client (DeepSeek default), JSON parsing + retry
  mock.js             Offline demo mode: keyword rules returning the same JSON shape
  data/scenarios/       One data file per campaign + the registry (index.js)
  data/timelines/       Real historical events per campaign, used to anchor the lessons
  data/timeline.js      Generic helpers for querying a scenario's timeline
public/
  index.html          Page shell
  css/style.css       All styling
  js/app.js           Controller: boot, events, turn flow, modals
  js/map.js           D3 world map (colours, occupation stripes, zoom, labels)
  js/panels.js        HTML builders for tabs, log, lesson drawer, "Under the hood"
  js/api.js           Fetch wrapper + live-update listener
  vendor/             d3 and topojson-client (bundled, no CDN needed)
  data/world-1939.json  1939 territory map (built by tools/build-map.mjs)
tools/build-map.mjs   Builds the 1939 map from Natural Earth provinces
mcp/server.js         Optional MCP server exposing the game as tools
tests/engine.test.js  Engine tests
docs/                 Architecture, actions, API, classroom guide, AI handoff notes
saves/                Autosave and named saves (JSON)
```

## Changing the AI model

Only `.env` changes. Any OpenAI-compatible chat API works:

```ini
# Ollama on your own computer (free, offline, no key)
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=qwen2.5:14b
```

Small local models may produce weaker history or invalid actions. Invalid actions are rejected safely, so the game keeps working.

## Narration

With `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in `.env`, each turn's headline and short summary (`feasibilityReason`) are read aloud after **Send order**. The full story is not spoken. You do not need to press **Play**; that button is only for replay or if the browser blocks sound.

Speed is the **Speed** slider in the top bar (next to **Narration on / off**), from 0.5× to 2×. Default is 1.5×. The choice is stored in the browser (`localStorage` key `storm-narration`). It is not set in `.env` and is not sent to ElevenLabs.

**L** toggles narration on and off. Off means no speech request is made.

## Campaigns and the after-action report

Choose a campaign and a nation on the start screen. Both campaigns share the 1939 world map; the China campaign adds a **China** map view and the Chinese Communist Party as an AI ally (it owns its northwestern base area, with other base areas shown as occupation stripes).

At any time, **Finish Game** ends the campaign and opens the **after-action report**. The engine first computes deterministic metrics from your saved game (territories gained and lost, indicator changes, wars started and ended, how plausible your orders were). An AI examiner then grades you on *historical realism*, *strategic effectiveness*, *economic management*, *diplomacy* and *decision quality*, names your most important decisions, and compares your timeline with real history. The engine clamps and combines the grades with fixed weights, so the overall score is reproducible. Without an API key, a fully deterministic offline report is produced instead. The report can be downloaded as Markdown or JSON, and is appended to the journal export.

## Optional: MCP

You do **not** need MCP for the game. The backend already turns the model's JSON into game changes.

The MCP server is an extra that exposes the running game as tools (`get_game_state`, `take_turn`, `apply_actions`, `new_game`, `get_journal`). With it, an MCP client such as Claude Desktop, Claude Code, Cursor or VS Code can play turns or edit the scenario while you watch the map update live in the browser.

1. Start the game: `npm start`
2. Add this to your MCP client's config (use your real absolute path):

```json
{
  "mcpServers": {
    "wwii-game": {
      "command": "node",
      "args": ["/absolute/path/to/storm-breaks/mcp/server.js"],
      "env": { "GAME_URL": "http://localhost:3000" }
    }
  }
}
```

## Using it in class

See [docs/CLASSROOM.md](docs/CLASSROOM.md) for a lesson flow, assessment ideas and HKDSE links. In short: 10-minute briefing, 25 minutes of play, then students download their journal (orders, outcomes, lessons and their own reflection answers) as evidence for discussion or written work.

## Known limits

- The map is built from modern provinces grouped into 1939 territories, with approximate cuts where a 1939 border crossed a modern province (the Polish–Soviet line, Danzig, southern Slovakia, Finnish Karelia and Petsamo, southern Sakhalin, Istria, Spanish Morocco). Expect errors of roughly 10–30 km. Smaller 1939 details are not drawn: German Upper Silesia is shown as Polish, Zaolzie as German, and the Pskov border districts as Soviet. See "The map" below.
- Numbers are simplified game values. GDP figures are rough historical estimates (billions of 1990 international dollars).
- One game runs per server. For a class, each student runs it on their own computer, or you host one copy per student.
- AI narratives can contain mistakes. The lessons are anchored to the real-events list in `server/data/timelines/`, but teachers should still check them.
- Both campaigns currently use the same 1939 world map. The China campaign is played at the regional scale of that map; the CCP owns the northwestern base area and its other base areas appear as occupation stripes. The registry supports a different map per scenario if a province-level China map is built later.
- The after-action report's written grades come from the AI; its metrics, weights and overall score are computed by the engine and are reproducible. In offline mode a fully deterministic report is produced.

## The map

`public/data/world-1939.json` shows the world on 1 September 1939: East Prussia (including Königsberg, today's Kaliningrad) and Danzig are German; Poland has its interwar borders reaching Wilno and Lwów; Romania holds Bessarabia; Hungary holds Carpatho-Ukraine; Japan holds Korea, Taiwan, southern Sakhalin and the Pacific mandate, with the puppet state of Manchukuo; eastern China is partly occupied; colonies carry their period names (British India, French Indochina, Belgian Congo…).

It is generated by `tools/build-map.mjs`, which downloads Natural Earth's province map, groups provinces into territories and cuts along approximate historical border lines. To change a border, edit the tables or the `CLIPS` polygons in that file and run `npm run build-map`. If you add or rename a territory, also update `TERRITORY_OWNERS` in `server/data/scenario1939.js`.

## Continuing development

[docs/AI_HANDOFF.md](docs/AI_HANDOFF.md) is written so you can paste it into any AI coding assistant and continue the project with full context.

## Licences

Code: MIT. Map data: made with Natural Earth (public domain), grouped and cut into 1939 territories by this project. D3 and topojson-client: ISC.
