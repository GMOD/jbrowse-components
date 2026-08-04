# Website

Astro, deployed to `s3://jbrowse.org/jb2/` on commits to `main` containing
"update docs". `pnpm index` once for local search (`static/pagefind/` is
gitignored). `deploy_staging.sh` wraps a staging deploy.

## Screenshots (`static/img/`)

`scripts/generate-screenshots.ts`, run with `node` — **not `npx tsx`**, whose
`keepNames` breaks `page.evaluate`'d functions. Specs in
`scripts/screenshot-specs.ts`.

- **Display config in a session spec goes on the track**, inside its own
  `displays: [{ type, ...slots }]`. Slots on the view's `tracks` entry are
  silently dropped and the display falls back to schema defaults.
- **An unfiltered regen only rewrites a PNG whose capture changed**, so a sweep
  can't churn 288 figures over antialiasing. `--filter` implies `--force`: a run
  that names its specs rewrites them, since the gate's 0.5% is wider than a
  renamed label. If an unfiltered sweep says unchanged where you expected a
  change, `--force` and diff the two rather than trusting the gate.
- **`--affected` narrows a sweep to what a change could have moved**, mapping
  changed file → workspace package → reverse-dependency closure → plugins →
  the type names those plugins own → specs whose session names them
  (`scripts/screenshot-impact.ts`, runnable on its own to see the reasoning).
  It narrows only — it does **not** imply `--force`, so the diff gate still
  decides what gets rewritten, and it intersects with `--filter`. It is an
  approximation with a known conservative floor (~45 specs that resolve to no
  in-repo type are always selected). **The unfiltered sweep is its oracle**: a
  PNG a full regen rewrites that `--affected` would not have selected is a bug
  in the map, not an acceptable miss.
- **No spec sets `diffThreshold`.** Treat a request for one as a bug in whatever
  is producing the nondeterminism.
- **Downscale before reading a PNG** — captures are ~3000px and Read rejects
  them: `convert static/img/<n>.png -resize 1400x /tmp/shot.png`.
- **Never hand-measure a callout position** — every annotation `anchor`s. Prefer
  an in-app `highlight` over an overlay at all. Add shapes to
  `@jbrowse/browser-test-utils/src/annotationOverlay.ts` (shared with the
  desktop harness), not to `scripts/`.
- **Don't `convert -append` a before/after figure by hand** — use a `compose`
  spec, or `stages` when a state is only reachable through the UI.
- **A UI click-chain waiting on a fixed timeout is a red flag.** Make the
  trigger declarative and wait on a `data-testid` on the real result.

## Prose, captions, cards

- **Never write a hand-computed statistic into prose.** Numbers must be
  published (with citation), structural, or emitted by a script in the repo.
  Anything else belongs in the figure — if a comparison matters, build the
  picture that shows it.
- **Captions name the tracks and the one visual takeaway.** If a caption needs a
  paragraph of background, fix the figure. On-image text is a label, not a
  paragraph.
- **Card titles**: dataset first, then the pipeline that produced the picture.
  No numerals, no JBrowse vocabulary, no biology lessons. ~32 characters.

## Gallery

Driven by `src/lib/gallery.ts`; a figure item's `spec:` supplies both its image
and its live link. It is a **curated highlight reel** — one item per capability,
one card per tutorial, and two cards showing the same view type on the same data
are one card. Skip `heavyNetwork` specs. Thumbnails are generated, not
committed; 1200x600 PNG is settled, don't relitigate. Tutorial card thumbs are
all generated from a figure the page embeds — no hand-made thumbs, and their
`--check` is not optional bookkeeping.
