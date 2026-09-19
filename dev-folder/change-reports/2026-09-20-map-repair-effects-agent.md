# Change report — map repair (Effects agent) so accepted orders reach the map

## Scope

Fixes the "the map stops updating after a while" bug: the Game Master accepted an
order (e.g. the USSR annexing the Baltic states and Bessarabia) and narrated it, but
emitted no territory action, so the map never changed. The Game Master now gets the
order's target names up front, and a small focused **Effects** agent repairs the
missing actions when the story and the map disagree.

## Root cause

The history-clock update told the Game Master (in its system prompt) not to occupy or
annex territory "outside your own front", leaving the wider war to the deterministic
clock. The clock only knows a fixed event list and has no event for the Baltics or
Bessarabia, so player orders about neutral/adjacent states were accepted in the story
and silently dropped from the map. The old safety net retried with the *same* full,
restrictive prompt and often failed the same way; rejected actions (collective names
like "the Baltics") were only logged.

## Files touched

**Engine**
- `server/engine.js` — `scanMentions(state, text)` moved here from `mock.js` and
  exported: it finds the nations and territories an order names, through the scenario
  aliases, deduplicated and in order.
- `server/mock.js` — imports `scanMentions` from the engine.

**Agents**
- `server/agents.js`
  - Game Master prompt: the "off-stage history" rule now says the clock owns the wider
    war's **own** campaigns, but the GM must apply the direct map consequences of the
    player's order — including annexing neutral/adjacent states and resolving collective
    names to exact territories ("the Baltic states" → Estonia, Latvia, Lithuania).
  - `gmRequest` now carries `territories_mentioned_in_the_order` /
    `nations_mentioned_in_the_order`.
  - New `effectsSystem()`, `effectsRequest()`, `cleanEffects()`, `needsRepair()`,
    `repairEffects()`: a ~700-token repair call that returns only `{ actions: [...] }`.
    It replaces the old full-prompt Game Master retry, so the worst case is *faster*
    than before.
  - `runTurn` order: GM → apply → **repair (if needed)** → history clock → rivals →
    advisors. Repair runs before the clock so its preconditions see the new board.
  - Journal entry gains `mapWarning: true` when the map still disagrees after repair.
  - `needsRepair` and `cleanEffects` are exported for tests.

**Frontend**
- `public/js/app.js` — shows a toast when `entry.mapWarning` (the toast is z-index 50,
  above the event popup).

**Tests / docs**
- `tests/effects.test.js` — new (8 tests): mention scanning, the `needsRepair` trigger,
  and a full turn through a fake LLM where the GM forgets the annexation and the Effects
  agent supplies it (map changes, no warning), plus the warning path. Registered in
  `package.json`.
- `docs/ARCHITECTURE.md`, `docs/AI_HANDOFF.md`, `docs/API.md` updated.

## Key decisions

1. **Repair is conditional.** It only runs when `needsRepair()` is true, so normal turns
   keep their latency. On a failure it is one small call instead of the old full Game
   Master retry.
2. **The Effects agent may use full territory actions** (`annex_territory`,
   `occupy_territory`, `liberate_territory`, `capitulate`) so annexations work.
3. **It is conservative**: the prompt says to add only actions the story already
   describes and to return an empty array otherwise.
4. **The clock still owns the wider war.** Repair does not start off-stage campaigns;
   it applies the player's order and its direct consequences.
5. **Failures are visible**: `mapWarning` + a toast, rather than a silent divergence.

## Verification

- `npm test` — 74 tests pass (17 engine, 6 advisors, 11 camera, 14 history clock,
  14 event, 4 country, 8 effects).
- `node --check` on the changed server/frontend files.
- `tests/effects.test.js` proves the end-to-end repair: GM narrates the annexation with
  no actions, Effects returns Estonia/Latvia/Lithuania/Bessarabia, the map updates and
  `mapWarning` is false; with an empty repair the warning fires.

## Follow-ups / known limitations

- `scanMentions` matches known names only, so a pure collective ("the Baltics") has no
  territory match; those cases rely on the narrative trigger + the Effects agent.
- The Effects prompt reuses the full `actionSpec()`, so the repair call is larger than a
  hand-trimmed spec would be. It is still small and only on the failure path.
- If the model still refuses (e.g. it insists the clock owns the change), the player now
  sees the warning and can reword the order with exact territory names.
