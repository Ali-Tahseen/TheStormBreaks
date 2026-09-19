# Project: "Alt-History" — A Text-Driven Grand Strategy Simulator

## 1. Elevator Pitch

A simplified HOI4/EU-style grand strategy game where the entire interface is a text box. You play as a historical leader (Stalin, Mao, etc.) inside a chosen scenario (WWII, Chinese Civil War). Instead of clicking menus and sliders, you issue **natural-language policy decisions**. A multi-agent AI orchestrator interprets your decision, decides how much game-time should pass, narrates "what really happened" as a consequence, updates your internal state parameters (economic stability, war support, etc.), and — when a decision crosses a scripted historical threshold (e.g. "annex Poland") — triggers a map event.

The hook: automation replaces the entire rules engine. There is no fixed tech tree or menu system — the LLM agents *are* the game engine, deciding plausibility, pacing, and consequences on the fly, while still being anchored to real historical events so the game stays coherent and educational.

---

## 2. Core Game Loop

1. **Player reads current state** — narrative log, parameter dashboard, map, current date/turn.
2. **Player types a decision** in the input box (e.g. "Redirect 20% of industrial output to tank production and purge suspected traitors in the officer corps").
3. **Orchestrator agent** validates plausibility for the era/context, decides *how much time this decision logically takes to play out* (a week? three months?), and routes to the right downstream agents.
4. **Consequence agent** generates the "what really happened" narrative — blending the real historical record with the deviation the player just caused.
5. **State-update agent** converts that narrative into structured deltas to your tracked parameters.
6. **Event/map agent** checks whether a scripted historical trigger condition was met (e.g., stability < threshold + specific decision text → "Munich Agreement" event fires) and updates the map/timeline accordingly.
7. **Dashboard, log, and map re-render.** Turn counter advances. Loop repeats.

This loop should feel like *reading history unfold differently because of you*, not like filling out a spreadsheet.

---

## 3. Game Experience Priorities (in order)

1. **Narrative payoff first.** Every turn must produce a satisfying "what really happened" paragraph — this is the emotional core, more important than perfect numeric balance.
2. **Legible consequences.** Player should never wonder "why did my stability drop?" — deltas need one-line justifications tied directly to the narrative.
3. **Visible time control.** Time-skipping is a novel mechanic; it should be *dramatized*, not just a number ticking up.
4. **Map as reward, not chrome.** Only show map changes on real historical-scale events (annexations, front-line shifts, regime changes) so they feel earned.
5. **Transparency of the "AI game master."** Letting players (and hackathon judges) peek at agent reasoning builds trust and is a differentiator — but keep it optional/toggleable so it doesn't clutter the core experience.

---

## 4. Screen-by-Screen Structure

### 4.1 Start Screen
- Scenario picker: cards for each scenario (e.g. "World War II — Eastern Front, 1939", "Chinese Civil War, 1945"). Each card shows a 1–2 sentence historical primer and a small period-appropriate map thumbnail.
- Leader picker (tied to scenario): portrait, name, one-line personality/context blurb (e.g. "Stalin — General Secretary, paranoid and ruthless, controls a command economy").
- "Begin Campaign" button.

### 4.2 Main Game Screen (three-column layout)

**Left column — State Dashboard**
- Leader portrait + title + current date (e.g. "Turn 7 — March 1940").
- 5–6 parameter gauges as horizontal bars or radial meters:
  - Economic Stability
  - War Support / Public Morale
  - Industrial Output
  - Military Readiness
  - Political Loyalty / Internal Security
  - Diplomatic Standing
- Each gauge shows current value, a small ▲/▼ delta badge from the last turn, and a tooltip on hover explaining *why* it moved (linked to last turn's narrative).
- A collapsible "Advisor Notes" feed below the gauges: terse bullet-point consequences per turn (e.g. "− Industrial output (steel diverted to tanks)", "+ Officer corps loyalty (purge completed)").

**Center column — Narrative Log & Input**
- Scrollable chat-like log, alternating between:
  - Player decision (right-aligned, styled as an order/decree)
  - "What Really Happened" narrative block (left-aligned, styled like a history-book excerpt — serif font, sepia card background works well thematically)
  - Time-skip banner between turns: a horizontal divider reading e.g. "— 3 months pass — June 1940 —" so pacing is visually obvious.
- Text input box pinned at the bottom, placeholder text rotates through example decisions relevant to the scenario ("Propose a non-aggression pact with Germany…", "Launch a five-year industrialization plan…").
- Small "send" button plus optional voice-to-text icon (nice-to-have, not core).

**Right column — Map & Timeline**
- Simplified SVG/GeoJSON map of the scenario region with country/territory borders.
- Territories recolor or shift ownership only when a scripted event fires (annexation, front collapse, regime change) — accompanied by a brief animated highlight/pulse so the moment reads as consequential.
- Below the map: a horizontal timeline strip of "milestone" events so far (icons for war declarations, treaties, purges, etc.), clickable to jump back and reread that turn's narrative.
- Click on any territory for a tooltip with mini-stats (control, unrest, resources) if scope allows.

### 4.3 "Under the Hood" Panel (toggleable, judge/debug mode)
- Shows which agent fired this turn (Orchestrator → Consequence → State-update → Event).
- Displays raw reasoning trace and the structured JSON state-diff for the turn.
- Purpose: proves the automation pipeline is real multi-agent orchestration, not a single prompt — valuable for hackathon demo credibility, but hidden by default for normal play.

### 4.4 End/Debrief Screen
- Triggered at scenario end-date or a failure condition (e.g. stability collapses to 0, government overthrown).
- Shows a compressed "history you made" recap: a scrollable diff between real history and your timeline, plus final parameter snapshot and a shareable summary card.

---

## 5. Agent Architecture

| Agent | Responsibility | Output |
|---|---|---|
| **Orchestrator (Game Master)** | Parses player text, checks plausibility against current date/context, decides time-skip length, routes to other agents | Time delta, validity flag, routing plan |
| **Consequence Agent** | Writes "what really happened" narrative blending real history with the player's deviation | Narrative text |
| **State-Update Agent** | Converts narrative into structured parameter deltas | JSON diff (e.g. `{"economic_stability": -5, "war_support": +3}`) |
| **Event/Map Agent** | Detects if a scripted historical trigger condition is met; emits map/timeline changes | Event ID, map delta, timeline entry |
| **(Optional) Rival/Diplomacy Agent** | Simulates opposing powers reacting to your policy for added tension | Diplomatic state changes, rival dialogue |

Keep narrative generation and state-delta generation as **separate calls** so numbers stay auditable and don't get lost inside prose — this also makes the "Under the Hood" panel possible without extra parsing work.

---

## 6. Scripted Event System

- Maintain a small library of historically pivotal trigger conditions per scenario (e.g., WWII: "Molotov-Ribbentrop Pact," "Invasion of Poland," "Operation Barbarossa"; Chinese Civil War: "Long March," "Japanese surrender," "Fall of Nanjing").
- Each event has: trigger condition (date range + parameter thresholds + optional keyword match on player decisions), a map delta, and a narrative hook the Consequence Agent must weave in.
- Events can fire **on-rails** (happens regardless, but flavored by your state) or **contingent** (only if you took a specific action) — mixing both keeps history recognizable while rewarding deviation.

---

## 7. Scope Recommendation for Hackathon

- Lock to **one scenario** and **one leader** for the demo build; design the data structures so adding a second scenario later is just new event/parameter data, not new code.
- Prioritize build order: (1) core loop with orchestrator + consequence agent, (2) parameter dashboard, (3) scripted event → map trigger, (4) "Under the Hood" panel, (5) polish/animations.
- A simplified static map (a handful of clickable regions, not full geographic detail) is enough — the *moment* of an annexation animating is what sells the demo, not cartographic fidelity.
