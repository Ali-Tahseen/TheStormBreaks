# Backend API

All endpoints are served by `server/index.js` on `http://localhost:3000` (or `PORT`). Request and response bodies are JSON unless noted. Errors return `{ "error": "message" }` with a 4xx/5xx status.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/info` | | AI config, `audio` (`configured`, allowed `kinds`), scenario list + active scenario, indicator and faction definitions, action types, languages, `hasGame` |
| GET | `/api/audio/clip` | query `turn`, `kind` | streamed `audio/mpeg` clip for that journal field |
| GET | `/api/scenarios` | | Compact list of campaigns (id, title, briefing, playable nations with starting indicators, per-nation `countryBriefing`, suggestions) |
| GET | `/api/playable` | | Playable nations for the start screen; optional `?scenarioId=` |
| GET | `/api/timeline` | | Real historical events for the active scenario; optional `?scenarioId=` |
| GET | `/api/state` | | Full game state (404 if no game) |
| GET | `/api/debug` | | Last turn's agent requests/responses and applied/rejected actions |
| POST | `/api/new` | `{ scenarioId?, player, studentName?, realism?, lang? }` | New game state |
| POST | `/api/turn` | `{ order }` | `{ entry, state }` — resolves one turn with the AI agents |
| POST | `/api/finish` | `{}` | Ends the campaign (player-initiated game over) |
| POST | `/api/report` | `{ regenerate? }` | The after-action report (generates it if not cached) |
| POST | `/api/actions` | `{ actions: [...], source? }` | `{ applied, rejected, state }` — applies actions directly, no AI |
| POST | `/api/reflection` | `{ turn, text }` | Saves a student's answer to that turn's reflection question |
| POST | `/api/settings` | `{ realism?, lang? }` | Updated state |
| GET | `/api/saves` | | List of saves |
| POST | `/api/save` | `{ name }` | Saves the current game to `saves/<name>.json` |
| POST | `/api/load` | `{ name }` | Loads a save |
| GET | `/api/journal.md` | | The student's journal (and the report, if generated) as Markdown |
| GET | `/api/report.md` | | The after-action report as Markdown |
| GET | `/api/report.json` | | The after-action report as a downloadable JSON file |
| GET | `/api/events` | | Server-Sent Events stream: `{type: "state"|"busy"|"idle"|"hello", version}` |

Values: `scenarioId` is `ww2-1939` or `china-1939`; `player` is a tag (`GER`, `CHN`, `CCP`, …); `realism` is `historical` or `sandbox`; `lang` is `en`, `zh-Hant` or `zh-Hans`.

`/api/turn` returns **409** if a turn is already running and **502** if the AI call fails. A failed turn restores the state exactly as it was before.

`GET /api/info` includes `audio: { configured, kinds }`. `configured` is true only when `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` are set. `kinds` is the speakable allowlist (`turn_headline`, `turn_reason` in v1). `turn_reason` is the journal `feasibilityReason` (the short summary under the headline), not the full `narrative`.

`GET /api/audio/clip?turn=&kind=` synthesises (or returns a cached) MP3 for text taken from the current game journal. The browser never sends the spoken text and never sees the ElevenLabs key. The route streams `audio/mpeg`: a cache hit is `fs.createReadStream` with `Content-Length`; a cache miss calls ElevenLabs `POST /v1/text-to-speech/{voice_id}/stream`, waits for the first audio byte, then flushes `200` without `Content-Length` and tees chunks to `{hash}.part` and the response (rename to `{hash}.mp3` on success; discard an incomplete `.part` on failure or client abort). Errors before the first byte stay JSON (`{ "error": "..." }`). Returns **404** if there is no game or no journal entry for that turn, **400** if `kind` is not allowed or the text is empty, and **503** if TTS is not configured. Clips are generated only when this endpoint is called, not during `/api/turn`. Playback speed is not an API or `.env` setting: students use the **Speed** slider in the top bar (0.5–2, default 1.5). The browser stores `{ enabled, rate }` in `localStorage` under `storm-narration`. Speed is not part of the cache key.

## Game state shape

```jsonc
{
  "id": "game-1727...",
  "scenarioId": "ww2-1939",            // which campaign this game is playing
  "version": 12,                       // increments on every change (used for live updates)
  "date": { "year": 1940, "month": 3 },
  "endDate": { "year": 1945, "month": 9 },
  "turn": 5,
  "player": "GER",
  "studentName": "Chan Tai Man",
  "realism": "historical",
  "lang": "en",
  "nations": {
    "GER": {
      "tag": "GER", "name": "Germany", "leader": "Adolf Hitler", "ideology": "Nazi dictatorship",
      "faction": "Axis", "color": "#6e7479", "home": "Germany",
      "minor": false, "playable": true, "capitulated": false,
      "indicators": { "gdp": 412, "industry": 85, "resources": 40, "army": 85, "navy": 35,
                      "air": 80, "manpower": 10, "stability": 75, "war_support": 60,
                      "army_support": 70, "citizen_support": 70 }
    }
    // ... every nation, including auto-generated minors
  },
  "territories": {
    "Canada": { "owner": "CAN", "occupation": { "GER": 10 } }
    // ... one entry per map shape
  },
  "wars": [["GER", "POL"], ["JAP", "CHN"]],
  "relations": { "GER|SOV": 20 },      // keys are two tags sorted alphabetically
  "events": [ { "turn": 0, "date": {...}, "title": "...", "description": "...", "category": "war", "territories": ["Poland"] } ],
  "journal": [ /* one entry per turn, see below */ ],
  "lastDeltas": { "GER": { "industry": 5 } },   // indicator changes during the last turn
  "advisors": {                        // latest advisors' briefing (turn 0 = opening briefing)
    "turn": 1, "date": "October 1939", "source": "llm | offline | opening",
    "economy":   { "outlook": "good | steady | worrying | critical", "home": "...", "abroad": "...", "advice": "..." },
    "diplomacy": { "outlook": "...", "home": "...", "abroad": "...", "advice": "..." },
    "military":  { "outlook": "...", "home": "...", "abroad": "...", "advice": "..." }
  },
  "lastChangedTerritories": ["Canada"],
  "initial": { /* compact snapshot of the starting position, used by the report */ },
  "report": null,                      // the after-action report once generated
  "gameOver": null                     // or { "reason": "...", "endedByPlayer": true }
}
```

## After-action report shape

Returned by `POST /api/report` and stored on the state as `report`. The `metrics` and `overall` fields are computed deterministically by the engine; `grades`, `key_decisions`, `timeline_diff` and `lessons` come from the AI examiner (or `mockReport` offline).

```jsonc
{
  "generatedAt": "2026-09-19T...",
  "scenarioId": "china-1939",
  "player": "CHN", "playerName": "Republic of China",
  "turns": 6, "period": "September 1939 – March 1940",
  "metrics": {
    "turns": 6, "monthsPlayed": 6,
    "territoriesGained": ["Manchukuo"], "territoriesLost": [],
    "occupationGained": { "Manchukuo": 20 }, "occupationLost": {},
    "indicatorChanges": { "industry": 5, "stability": -4 },
    "warsStarted": [], "warsEnded": [], "enemiesDefeated": [],
    "feasibility": { "success": 2, "partial": 3, "failed": 1, "refused": 0 },
    "realEventsInPeriod": [ { "date": "1939-09-01", "title": "War in Europe begins…" } ]
  },
  "summary": "…",
  "grades": {
    "historical_realism": { "score": 72, "rationale": "…" },
    "strategic_effectiveness": { "score": 65, "rationale": "…" },
    "economic_management": { "score": 58, "rationale": "…" },
    "diplomacy": { "score": 60, "rationale": "…" },
    "decision_quality": { "score": 70, "rationale": "…" }
  },
  "key_decisions": [ { "turn": 3, "order": "…", "outcome": "…", "impact": "…", "rating": "wise|mixed|costly" } ],
  "timeline_diff": [ { "real_history": "…", "your_timeline": "…" } ],
  "lessons": ["…"],
  "overall": { "score": 66, "letter": "D", "label": "Fair" },
  "weights": { "historical_realism": 0.3, "…": 0.15 },
  "engine": { "deterministicMetrics": true, "weights": { "…": 0.15 }, "grader": "llm" }
}
```

## Journal entry (returned as `entry` by `/api/turn`)

```jsonc
{
  "turn": 1,
  "dateBefore": "September 1939", "dateAfter": "October 1939", "monthsPassed": 1,
  "order": "Germany is taking over 10% of Canada",
  "interpretation": "...",
  "feasibility": "success | partial | failed | refused",
  "feasibilityReason": "...",
  "headline": "...",
  "narrative": "...",
  "mapWarning": false,   // true when the story claimed a territorial change the engine could not apply
  "meanwhile": [
    {
      "id": "warsaw_falls", "date": "1939-09-27", "title": "Warsaw falls",
      "blurb": "...", "kind": "map | lesson",
      "skippedReason": "player", "hint": "..."   // only when the event's historical
                                                 // actor is the player's nation: no map
                                                 // change, just the hint line
    }
  ],
  "reactions": [ { "country": "UK", "leader": "...", "statement": "...", "intent": "..." } ],
  "advisors": { /* the briefing written after this turn, same shape as state.advisors */ },
  "lesson": {
    "title": "...", "what_really_happened": "...", "how_your_timeline_differs": "...",
    "why_it_matters": "...", "key_terms": [ { "term": "...", "definition": "..." } ],
    "reflection_question": "...", "exam_skill": "..."
  },
  "reflection": "",                    // the student's answer
  "deltas": { "army": -3 },            // player's indicator changes
  "changedTerritories": ["Canada"]
}
```
