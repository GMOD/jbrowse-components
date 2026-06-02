# Reviewing doc screenshots

`website/scripts/review-screenshots.ts` interactively reviews the PNGs produced
by `generate-screenshots.ts` (both share `screenshot-specs.ts`, so they stay in
sync).

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
for each shot marked bad.
