
  What I built

  A new interactive review script — website/scripts/review-screenshots.ts — that complements the existing generate-screenshots.ts / screenshot-specs.ts pipeline.

  Run it with:
  cd website
  pnpm review-screenshots                          # review all
  pnpm review-screenshots --filter=alignments      # subset by name substring
  pnpm review-screenshots --filter=dotplot --exact # one exact spec
  Flags: --all (re-review ones already judged), --no-open (don't launch the image viewer).

  For each generated screenshot it:
  - Reuses the same specs list as the generator, so the two stay in sync automatically.
  - Prints the image path and every place the doc uses it — scanning docs/, blog/, and src/pages/ for /img/<name>.png. It pulls the <Figure caption="..."> text and, for gallery-style markdown images, the
  alt text plus the descriptive paragraph that follows.
  - Opens the PNG in your OS viewer (xdg-open).
  - Prompts good? [y]es / [n]o / [s]kip / [q]uit: and asks for an optional note (for "no", "what's wrong with it?").

  Output: verdicts persist to scripts/screenshot-review.json (gitignored), so the review is resumable — re-running skips already-judged shots. At the end it lists everything marked bad with a
  ready-to-paste regenerate command:
  node --experimental-strip-types scripts/generate-screenshots.ts --filter=<name> --exact   # <your note>

  Verified: doc-context extraction (both <Figure> and gallery markdown), good/bad/skip/quit flow, report writing, resume, the regenerate summary, and that it typechecks clean. I also added
  generate-screenshots and review-screenshots to package.json scripts and a .gitignore entry for the report.

  Two notes: the existing generate-screenshots.ts has two pre-existing tsgo errors (puppeteer clickCount/LaunchOptions) — untouched by me. And eslint ignores the whole scripts/ dir, so the new file follows
  that same (unlinted) convention as the generator.


