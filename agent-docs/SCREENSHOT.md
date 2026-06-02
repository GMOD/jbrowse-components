# Reviewing doc screenshots

`website/scripts/review-screenshots.ts` interactively reviews every screenshot a
doc references — both the PNGs `generate-screenshots.ts` produces (driven by
`screenshot-specs.ts`) **and** hand-captured images that only live in
`static/img` (UI-flow walkthroughs, the gallery read-vs-ref shot, etc.). The
review set is the union of all specs and every `/img/<name>.png` referenced
across `docs/`, `blog/`, `src/pages/` whose PNG exists on disk, computed by
`collectScreenshots()` in `screenshot-review-lib.ts`. Items with no spec are
flagged "manual capture, no generator" — they can't be regenerated, only
re-shot by hand.

```bash
cd website
pnpm review-screenshots                       # review all
pnpm review-screenshots --filter=alignments   # subset by name substring
pnpm review-screenshots --filter=dotplot --exact
```

Flags: `--all` re-reviews already-judged shots; `--no-open` skips launching the
image viewer.

For each shot it opens the PNG, prints every doc usage (the `<Figure caption>`
or gallery alt text + following paragraph, scanned across `docs/`, `blog/`,
`src/pages/`), and prompts `[y]es / [n]o / [s]kip / [q]uit` with an optional
note. Verdicts persist to `scripts/screenshot-review.json` (gitignored) so the
review is resumable; at the end it prints a ready-to-paste regenerate command
for each spec-backed shot marked bad, and lists manual shots separately since
those must be re-captured by hand.

`pnpm review-screenshots-web` serves the same review set as a side-by-side
gallery UI (approve/deny per card, an "only manual (no generator)" filter, and a
running manual count), writing to the same `screenshot-review.json`.
