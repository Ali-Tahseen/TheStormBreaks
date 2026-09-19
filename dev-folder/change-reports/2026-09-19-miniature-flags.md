# Change report: miniature flags in nation swatches

Date: 2026-09-19 (earlier session, recorded here for completeness)

## Scope

Every small colour swatch next to a nation name now shows that nation's flag, cropped to the square box. This covers the map tooltip, the start-screen nation picker, the diplomacy chips, the intel card and the country report.

## Files touched

- `public/js/flags.js`: `swatchStyle(nation)` returns `background: <colour> url(<flag>) center / cover`. It falls back to the plain nation colour for unknown tags. The colour is sanitised so `hsl(...)` minor-nation colours survive.
- `public/vendor/flag-icons/1x1/*.svg` + `LICENSE`: square flags copied from the MIT-licensed `flag-icons` package (dev dependency in `package.json`). They are used for flags that were the same in 1939 or look the same at this size.
- `public/img/flags/*.svg`: hand-drawn period flags for nations whose flag has changed since 1939. These are USSR, Germany (1935–45), Italy (Savoy arms), Manchukuo, CCP, Yugoslavia, Slovakia, Spain, Egypt, Mongolia, South Africa (1928), Canada (Red Ensign), Iran, Iraq, Afghanistan, Tibet, Muscat & Oman and Yemen.
- `public/js/app.js`, `public/js/panels.js`: the swatches use `swatchStyle()`.

## Key decisions

- Minor nations get their tag from the map name (e.g. `ESTONIA`), so their flags are keyed by that tag in `flags.js`.
- Swatches keep the nation colour behind the flag, so a missing file never shows an empty box.

## Verification

Every nation in both campaigns resolved to an existing flag file (69 in WWII, 70 in China). The flags were checked in the browser at 12 px.
