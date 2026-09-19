# Backend API

All endpoints are served by `server/index.js` on `http://localhost:3000` (or `PORT`). Request and response bodies are JSON unless noted. Errors return `{ "error": "message" }` with a 4xx/5xx status.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/info` | | AI config, scenario briefing, indicator and faction definitions, action types, languages, `hasGame` |
| GET | `/api/playable` | | Playable nations for the start screen |
| GET | `/api/timeline` | | Real historical events list |
| GET | `/api/state` | | Full game state (404 if no game) |
| GET | `/api/debug` | | Last turn's agent requests/responses and applied/rejected actions |
| POST | `/api/new` | `{ player, studentName?, realism?, lang? }` | New game state |
| POST | `/api/turn` | `{ order }` | `{ entry, state }` — resolves one turn with the AI agents |
| POST | `/api/actions` | `{ actions: [...], source? }` | `{ applied, rejected, state }` — applies actions directly, no AI |
| POST | `/api/reflection` | `{ turn, text }` | Saves a student's answer to that turn's reflection question |
| POST | `/api/settings` | `{ realism?, lang? }` | Updated state |
| GET | `/api/saves` | | List of saves |
| POST | `/api/save` | `{ name }` | Saves the current game to `saves/<name>.json` |
| POST | `/api/load` | `{ name }` | Loads a save |
| GET | `/api/journal.md` | | The student's journal as Markdown |
| GET | `/api/events` | | Server-Sent Events stream: `{type: "state"|"busy"|"idle"|"hello", version}` |

Values: `player` is a tag (`GER`, `UK`, …); `realism` is `historical` or `sandbox`; `lang` is `en`, `zh-Hant` or `zh-Hans`.

`/api/turn` returns **409** if a turn is already running and **502** if the AI call fails. A failed turn restores the state exactly as it was before.

## Game state shape

```jsonc
{
  "id": "game-1727...",
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
                      "air": 80, "manpower": 10, "stability": 75, "war_support": 60 }
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
  "lastChangedTerritories": ["Canada"],
  "gameOver": null                     // or { "reason": "..." }
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
  "advisorNotes": ["+ Industry: ...", "- Stability: ..."],
  "reactions": [ { "country": "UK", "leader": "...", "statement": "...", "intent": "..." } ],
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
