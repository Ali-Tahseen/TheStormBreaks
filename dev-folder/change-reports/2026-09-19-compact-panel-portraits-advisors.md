# Change report: compact nation panel, country report with portraits, new political indicators, advisors

Date: 2026-09-19

## Scope

Four changes to the interface and mechanics:

1. Two new political indicators, **army support** and **citizen support**.
2. The big multi-nation ledger is now a **small panel for the player's nation only**. Other nations get a limited **intel card**.
3. A **country report** drops down over the story log from **Details**. It includes the leader's portrait.
4. An **advisors** mechanic: after every turn the economic advisor, diplomat and military advisor each write a short briefing. It opens from a bar above the order box.

## Files touched

**Indicators**
- `server/data/scenarios/ww2-1939.js`: `army_support` and `citizen_support` (tab `politics`) in `indicators`, starting values for all 26 listed nations and for `minorIndicators` (60 / 55).
- `server/data/scenarios/china-1939.js`: values for the overridden CHN (50 / 55) and CCP (90 / 70).
- `server/engine.js`: new `migrateState(state)` fills missing indicators (from the scenario's starting value, else the minor default) in nations and `state.initial`, and adds `advisors: null`. `createGame` sets `advisors: null`.
- `server/agents.js`: `actionSpec` now explains the four political indicators to every agent.
- `server/mock.js`: offline demo moves the new indicators (rearmament → army support +2, propaganda → citizen support +3, a partial offensive → army support −3).

**Advisors**
- `server/agents.js`: section "4. Advisors". `ADVISOR_ROLES`, `ADVISOR_OUTLOOKS`, `advisorsSystem()`, `advisorsRequest()`, `cleanAdvisors()`, `briefAdvisors()`, `openingBriefing()`, `offlineBriefing()`. `runTurn` was restructured: the teacher starts right after the Game Master, while rivals → apply rival actions → deltas → advisors run in sequence. The entry gets `advisors` and `state.advisors` is set.
- `server/data/advisors/ww2-1939.js`, `server/data/advisors/china-1939.js` (new): hand-written opening briefings for every playable nation (WWII: GER ITA JAP UK FRA USA SOV CHN POL; China: CHN CCP JAP). They are wired into the scenarios as `openingAdvice`.
- `server/mock.js`: `mockAdvisors(state, {opening})` returns the opening briefing, or a briefing computed from the game data.
- `server/index.js`:
  - `POST /api/new` sets the opening briefing.
  - `loadFile` runs `migrateState` and adds an offline briefing to old saves.
  - The journal Markdown shows "Effects this turn" (the Game Master's notes) and "Advisors' briefing".
- `mcp/server.js`: `take_turn` returns `advisors`, and the state summary includes `advisors`.

**Frontend**
- `public/index.html`: new rail structure.
  - `.ledger`: the compact panel.
  - `.log-wrap` holds `#log`, `#dossier` and `#advisors`.
  - `#advisor-bar` sits above the order form.
  - `#intel` is a new aside.
- `public/js/panels.js`: the old `indicatorTab` / `diplomacyTab` / `journalTab` were replaced by:
  - `nationCard`, `statsTab`, `diplomacyMini` and `journalMini` for the compact panel
  - `intelCard` for other nations (qualitative estimates, no exact numbers)
  - `dossierHTML` for the country report
  - `advisorBarHTML` and `advisorsHTML` for the advisors
- `public/js/portraits.js` (new): `portraitFor(nation)` matches the photos by the current leader's name, so a `set_leader` change also changes the photo. If the game's leader has no photo but the head of state of the time does, that photo is shown and labelled: France under Daladier/Reynaud shows Albert Lebrun, and Bulgaria shows Tsar Boris III.
- `public/js/app.js`:
  - New functions: `renderIntel`, `renderDossier`/`setDossier`, `renderAdvisors`/`setAdvisors`.
  - `select()` now drives the intel card instead of the ledger.
  - Escape closes, in order: advisors, then the report, then the intel card, then the lesson.
  - **Use as order** copies a suggestion into the order box.
  - A "new" badge shows until the latest briefing has been opened.
  - On phones, opening the report scrolls it into view.
- `public/css/style.css`:
  - Compact panel with a fixed tab-body height and stat tiles (values under 30 turn red).
  - Intel card, drop-down report, advisors bar and pop-up.
  - Mobile bottom sheet is now scrollable: orders first, then the nation panel.
  - Removed the `table.ind` and `.journal-list` rules.

**Tests and docs**
- `tests/advisors.test.js` (new, 6 tests) and `package.json` (added to `npm test`).
- `README.md`, `docs/ARCHITECTURE.md`, `docs/ACTIONS.md`, `docs/API.md`, `docs/AI_HANDOFF.md`.

## Key decisions (do not undo)

1. **Advisors only advise.** They return `{outlook, home, abroad, advice}` per role and nothing else. `cleanAdvisors()` drops any other keys, so they can never emit actions. The advisors agent runs **after** the rival leaders so it sees the whole turn.
2. **No hindsight in briefings.** The advisors get real events from the last months up to the current date (`real_history_so_far`), never future ones. The opening briefings were written the same way.
3. **Fallbacks keep turns working.** Any advisors error, or a reply with no role objects, falls back to the offline briefing (`source: 'offline'`). If one role is missing or has an invalid outlook, that part is filled from the offline briefing.
4. **The compact panel shows the player only.** Other nations never show exact figures in the UI. The intel card uses word estimates (Formidable / Strong / Moderate / Weak…). The full numbers still exist in `/api/state` and "Under the hood" for teachers.
5. **Portraits use a fixed 3:4 frame** (`object-fit: cover`, `object-position: 50% 22%`), so any vertical ratio fits without breaking the layout. The source images range from 1.22 to 1.64 height/width.
6. **The new indicators have no automatic game-over rule.** Only stability 0 ends the game, as before. The Game Master is told what the new indicators mean and can narrate consequences such as a coup via `set_leader`.

## Verification

- `npm test`: engine 14 passed, advisors 6 passed, camera 11 passed.
- The advisors tests include an LLM-path test against a fake OpenAI-compatible server on localhost. It covers: the call order (advisors after rivals), cleaning, filling a missing role, ignoring an `actions` key, and falling back when the reply is not a briefing.
- The server was run offline (`LLM_API_KEY=` `PORT=3066 node server/index.js`) and checked in Chromium with Playwright:
  - Screen sizes: 1400×900, 1280×720 and 400×850.
  - The old autosave (SOV, turn 2, without the new indicators) loaded and was migrated.
  - New games checked: FRA (Lebrun as head of state), UK and CCP (Mao).
  - Offline turns updated the advisors and showed the "new" badge.
  - All report, advisors, intel-card and tab states render.
  - "Under the hood" shows Game Master → Rival Leaders → Advisors → History Teacher.
- `GET /api/journal.md` includes the advisors' briefing.

## Follow-ups / known limitations

- The opening briefings are in English only. For zh-Hant / zh-Hans games, briefings are translated from turn 1 on, because the advisors prompt follows `game.lang`.
- A turn with an LLM now makes one extra call, the advisors (up to 900 tokens, run after the rivals). The teacher runs alongside, so the extra wait is roughly the advisors call.
- Portraits only exist for 16 leaders. Other leaders show the flag in the report and nothing in the intel card. Candidates to add: Daladier, Reynaud, Pétain, Tojo, Konoe, Yonai, Prince Paul, Franco, Horthy.
- Several supplied portraits carry Getty Images watermarks (Churchill, Hitler, Stalin, Mościcki, Roosevelt). Check the licence before any public release.
- Offline briefings after turn 0 are built from the game data only. They do not cite real history; the LLM briefings do.
