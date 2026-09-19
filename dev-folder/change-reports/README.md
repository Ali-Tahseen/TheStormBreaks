# Change reports

This folder holds a short report for each meaningful change to the project, so a later
coding agent (or human) can see what changed, why, and how to verify it without reading
the whole diff.

## Convention

One file per work session or feature, named:

```
YYYY-MM-DD-short-slug.md
```

Each report should contain:

1. **Scope** — one sentence on what the change was.
2. **Files touched** — grouped by area, with a one-line note each.
3. **Key decisions** — anything a future agent must not undo.
4. **Verification** — the exact commands run and their result.
5. **Follow-ups / known limitations** — what is deliberately left out.

Keep it concise. Link to the relevant docs (`docs/ARCHITECTURE.md`, `docs/AI_HANDOFF.md`,
`docs/API.md`) rather than repeating them.

The design vision this work is measured against lives in
`dev-folder/historical_strategy_game_design.md`.
