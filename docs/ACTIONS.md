# Actions reference

Actions are the only way anything changes the game. The AI agents return them in an `"actions"` array; the engine (`server/engine.js`) validates and applies them. You can also send them yourself through **Under the hood → Apply actions by hand**, `POST /api/actions`, or the MCP tool `apply_actions`.

## General rules

- **Nations** can be given as a tag (`"GER"`), a name (`"Germany"`), an alias (`"USSR"`, `"Britain"`), or a territory name (`"Czechia"` means its owner).
- **Territories** use the 1939 names on the map (`"East Prussia"`, `"Eastern Poland"`, `"British India"`, `"North China"`). Modern names and cities work as aliases (`"Kaliningrad"` → East Prussia, `"Myanmar"` → Burma, `"Shanghai"` → East China, `"Moscow"` → European Russia). Hover over the map to see any territory's name.
- Invalid actions are **rejected with a reason**; the rest of the list still applies.
- At most 40 actions per call.
- Every action may include a `"reason"` string. It is shown in "Under the hood".

## Nation tags

| Tag | Nation | Tag | Nation |
|---|---|---|---|
| GER | Germany | CAN | Canada |
| ITA | Italy | AUS | Australia |
| JAP | Japan | NZL | New Zealand |
| UK | United Kingdom | SAF | South Africa |
| FRA | France | NED | Netherlands |
| USA | United States | BEL | Belgium |
| SOV | Soviet Union | POR | Portugal |
| CHN | China | SPA | Spain |
| POL | Poland | ROM, YUG, SVK, HUN, DEN, FIN | Romania, Yugoslavia, Slovakia, Hungary, Denmark, Finland |
| MAN | Manchukuo (Japanese puppet) | EGY, MON | Egypt, Mongolia |

Every other territory becomes its own minor nation with a tag made from its name, e.g. `SWEDEN`, `TURKEY`, `SAUDI_ARABIA`, `TIBET`.

In the **China's War of Resistance** scenario, `CCP` is the Chinese Communist Party (leader Mao Zedong). It owns its northwestern base area (`Northwest China`); its other base areas are occupation stripes inside Nationalist territory (`North China`). The scenario also defines the `United Front` faction and disables the great powers as playable options.

Some large nations are split into several territories so partial conquests show clearly: the USSR (European Russia, Urals and Siberia, Soviet Far East, Soviet Ukraine, Soviet Belarus, Transcaucasia, Soviet Central Asia), China (North, East, Central, South, Southwest, Northwest China, Inner Mongolia, Xinjiang), Poland (Poland, Eastern Poland) and Germany (Germany, East Prussia, Austria, Bohemia and Moravia, Danzig). A nation is defeated only when it has lost all of its territories.

## Indicators

| Key | Range | Meaning |
|---|---|---|
| `gdp` | 0–5000 (bn $) | Size of the economy |
| `industry` | 0–100 | Factory output |
| `resources` | 0–100 | Access to oil, steel, rubber, food |
| `army`, `navy`, `air` | 0–100 | Military strength |
| `manpower` | 0–60 (millions) | People who could be mobilised |
| `stability` | 0–100 | Government's grip on power. **0 = game over for the player** |
| `war_support` | 0–100 | Willingness to fight |
| `army_support` | 0–100 | Loyalty of the armed forces and officer corps to the government. Low values make mutiny or a coup more likely (narrated by the Game Master; no automatic rule) |
| `citizen_support` | 0–100 | Ordinary people's approval of the government and its policies (not the same as willingness to fight) |

**Safety limits:** one action can change a 0–100 indicator by at most 30, GDP by at most 20%, and manpower by at most 5 million. Larger requests are cut down to the limit.

## Action types

### `change_indicator`
```json
{ "type": "change_indicator", "country": "GER", "indicator": "industry", "delta": 5, "reason": "Four-Year Plan" }
```

### `set_indicator`
Sets a value (still subject to the per-action limit).
```json
{ "type": "set_indicator", "country": "UK", "indicator": "war_support", "value": 70 }
```

### `occupy_territory`
Partial military control. Use `delta` (change) or `percent` (absolute, 0–100). Shown on the map as stripes in the occupier's colour; thicker stripes mean more control. All occupiers of one territory together can't exceed 100%. If a nation's **home territory** is fully occupied by an enemy it is at war with, that nation automatically capitulates (see below).
```json
{ "type": "occupy_territory", "territory": "Canada", "occupier": "GER", "delta": 10 }
{ "type": "occupy_territory", "territory": "Poland", "occupier": "SOV", "percent": 50 }
```

### `liberate_territory`
Removes occupation: all occupiers, one occupier, or only some percent.
```json
{ "type": "liberate_territory", "territory": "France" }
{ "type": "liberate_territory", "territory": "France", "occupier": "GER", "percent": 20, "by": "UK" }
```

### `annex_territory`
Full, formal transfer of ownership. Clears occupation. If the old owner has no territory left, it is marked defeated and removed from all wars.
```json
{ "type": "annex_territory", "territory": "Austria", "new_owner": "GER" }
```

### `capitulate`
A nation surrenders, signs an armistice or its government falls. It is marked defeated and removed from all wars. It **keeps any land not occupied or annexed** — so France in 1940 can leave the war while its colonies remain (Vichy-style). Give `occupier` to mark how much of its remaining land the victor now holds; `percent` defaults to 100. Optionally list specific `territories` (otherwise all the nation's territories are used).
```json
{ "type": "capitulate", "country": "FRA", "occupier": "GER", "percent": 100 }
{ "type": "capitulate", "country": "POL", "reason": "Government flees into exile" }
```

A nation also capitulates automatically when its home territory is fully occupied by an enemy it is at war with.

### `declare_war` / `make_peace`
```json
{ "type": "declare_war", "attacker": "GER", "defender": "FRA" }
{ "type": "make_peace", "a": "GER", "b": "FRA" }
```
Declaring war also drops their relations to −60 or lower.

### `join_faction` / `leave_faction`
Known factions come from the active scenario (`Allies`, `Axis`, `Comintern`; the China scenario adds `United Front`). Any other name creates a new bloc.
```json
{ "type": "join_faction", "country": "ITA", "faction": "Axis" }
{ "type": "leave_faction", "country": "ITA" }
```

### `change_relation`
Relations run from −100 (hostile) to +100 (allied). `delta` is limited to ±40.
```json
{ "type": "change_relation", "a": "USA", "b": "JAP", "delta": -20 }
```

### `set_leader`
```json
{ "type": "set_leader", "country": "UK", "leader": "Winston Churchill" }
```

### `add_event`
Adds a milestone to the timeline strip under the map. Listed territories pulse on the map.
```json
{ "type": "add_event", "title": "Fall of France", "description": "France signs an armistice.", "category": "war", "territories": ["France"] }
```
`category`: `war`, `diplomacy`, `economy`, `politics` or `other`.

## Who may do what

- **Game Master**, **manual** and **MCP** actions can affect any nation.
- **Rival Leaders** actions are rejected if the acting nation is the player's (so AI rivals can't lower your stats directly). The "acting nation" is `country`, `occupier`, `new_owner`, `attacker`, `a`, or `by`, depending on the type.
## Adding a new action type

1. Add the name to `ACTION_TYPES` in `server/engine.js`.
2. Add a function with the same name to the `APPLY` object. Validate inputs, throw an `Error` with a clear message if invalid, mutate `state`, and return a one-line summary.
3. If the action has an acting nation, add it to `actorsOf()`.
4. Describe it in `ACTION_SPEC` in `server/agents.js` so the AI knows it exists.
5. If the map or panels should show it, update `public/js/map.js` or `public/js/panels.js`.
6. Add a test in `tests/engine.test.js` and a section here.
