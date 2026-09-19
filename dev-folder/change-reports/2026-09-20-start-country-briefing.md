# Change report — start-screen country briefing

## Scope

When a playable nation is chosen on the start screen, the picker now shows a
country-specific briefing — leader portrait, who you lead, a situation report,
the immediate task, derived strengths/watch-outs and example first moves — in
addition to the general scenario briefing.

## Files touched

**Data**
- `server/data/scenarios/ww2-1939.js` — new `countryBriefing` object: `{ summary, task }`
  for each of the 9 playable nations.
- `server/data/scenarios/china-1939.js` — new `countryBriefing` for CHN, CCP and JAP.
- `server/data/scenarios/index.js` — `scenarioSummary()` now exposes `countryBriefing`
  and each playable nation's starting `indicators`.

**Frontend**
- `public/js/panels.js` — `countryDetailHTML(sc, tag, portrait)` pure builder: portrait +
  caption, "You will lead" identity block with facts, summary, task, strengths /
  watch-outs, possible first moves.
- `public/js/app.js` — imports the builder; `startSheetHTML()` renders `#country-detail`
  for the default nation; `wireStartSheet(saves, selectedId)` updates it when a nation
  radio changes (without re-rendering the sheet, so typed input survives).
- `public/css/style.css` — `.country-detail` card styling (oxblood left rule, portrait
  frame, task highlight, two-column strengths).

**Tests / docs**
- `tests/country.test.js` — new (4 tests); registered in `package.json` `test`.
- `docs/ARCHITECTURE.md`, `docs/AI_HANDOFF.md`, `docs/API.md` updated.

## Key decisions

1. **Briefing text is scenario data**, not code: one `{ summary, task }` per playable
   tag, so a new nation is data only. Mirrors the existing `suggestions` / `openingAdvice`
   pattern.
2. **Strengths and watch-outs are derived**, not hand-written: each starting indicator is
   ranked against the other playable nations in the same scenario. This avoids the raw
   scale problem (e.g. GDP's 0–5000 range making 412 look weak) and yields meaningful
   lines such as Britain's "Navy 95" versus "Army 35".
3. **Portraits come from `portraitFor()`**, the same matcher used in play, so the start
   screen and the country report agree (including the France head-of-state fallback).
4. **The detail updates in place** on nation change rather than rebuilding the sheet, so
   the student's name / realism / language choices are not lost.
5. **General briefing is untouched** — the country card is additive, shown under the
   nation picker.

## Verification

- `npm test` — 66 tests pass (17 engine, 6 advisors, 11 camera, 14 history clock, 14 event,
  4 country).
- `node --check` on the changed JS files.
- `/api/info` on a fresh server: `ww2-1939` 9/9 playable nations briefed with indicators,
  `china-1939` 3/3.
- Rendered `countryDetailHTML` for GER/UK/POL: strengths and watch-outs read sensibly.

## Follow-ups / known limitations

- Summaries are hand-written for the two current scenarios; a new scenario needs its own
  `countryBriefing`.
- The start screen shows exact starting indicator numbers; that is deliberate (you are
  choosing), unlike the in-game intel card which stays qualitative.
