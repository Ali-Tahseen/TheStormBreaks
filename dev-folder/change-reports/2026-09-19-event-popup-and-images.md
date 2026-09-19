# Change report — centred event popup + pre-recorded event images

## Scope

After every resolved order the Game Master's headline and a short summary appear
in a wide, centred museum-style window: an archival photo on the left, the story on
the right, and a red **Continue** button. Image selection is a simple, category-based
match so the GM is given no extra work.

## Files touched

**Frontend**
- `public/index.html` — new `#event` overlay (`event-sheet`).
- `public/js/panels.js` — `eventPopupHTML()` pure builder: close ×, split grid,
  eyebrow ("A major event unfolds"), date + feasibility pill, serif headline,
  summary, image with credit, Continue.
- `public/js/event-images.js` — **new**: `eventCategory()` (keyword classifier:
  capitulation > destruction > war) and `pickEventImage()` (random image within the
  matched category), plus `summaryFromNarrative()`.
- `public/js/app.js` — loads the manifest at boot; `openEventPopup()` /
  `closeEventPopup()`; after a turn the popup shows first and the map focus + lesson
  drawer run on Continue; Escape/Continue dismiss (backdrop click does not); narration
  starts with the popup.
- `public/css/style.css` — blurred/dimmed backdrop, two-panel wide sheet, archival
  grayscale image, oxblood eyebrow and Continue button, responsive single-column.

**Assets / logistics**
- `public/img/events/manifest.json` — images grouped by `category` (`war` ×2,
  `capitulation`, `destruction`, `economic_growth`, `low_economy`,
  `diplomatic_negotiations`) with alt text.
- `public/img/events/*.jpg` — supplied images.
- `.gitattributes` — Git LFS for `public/img/events/**/*.{jpg,jpeg,png,webp}`.

**Tests / docs**
- `tests/event.test.js` — 12 tests; registered in `package.json` `test`.
- `docs/ARCHITECTURE.md`, `docs/AI_HANDOFF.md` — popup, category matcher, how to add an image.

## Key decisions

1. **The popup is the beat.** Map focus and the history lesson wait until the student
   clicks **Continue**. Escape and Continue both close it; the backdrop does not.
2. **The AI never chooses an image.** `event-images.js` reads the turn's headline and
   narrative, picks the most specific category, then a random image of that category
   (`war` has two, so they alternate). This keeps the GM prompt unchanged.
3. **Category = filename grouping.** The categories are the image groups (`war`,
   `capitulation`, `destruction`, `economic_growth`, `low_economy`,
   `diplomatic_negotiations`). Adding an image is a file plus one manifest entry.
4. **Wide, split layout.** Two near-equal panels (photo left, text right); the map is
   blurred and dimmed behind so the popup reads as the focal point.
5. **Headline stays in the orders log too**, so the scrollback remains complete.

## Verification

- `npm test` — 48 tests pass (17 engine, 6 advisors, 11 camera, 14 event).
- `node --check` on the changed JS files.
- Server smoke test: `/img/events/manifest.json` and `/js/event-images.js` serve 200.
- Manual: an invasion turn shows `war.jpg`/`war-2.jpg` at random; a surrender turn
  shows `capitulation.jpg`; a bombing turn shows `destruction.jpg`; Continue focuses
  changed territories and opens the lesson; a non-military turn is text-only.

## Follow-ups / known limitations

- Categories are matched by keywords in English only (the narrative language may be
  Chinese); non-matching turns fall back to a `default` image or no image.
- Credits are placeholders ("Archival photograph") — replace with the real source and
  licence before publishing.
- No setting to disable the popup yet; it shows after every turn by design.
