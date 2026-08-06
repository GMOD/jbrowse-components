# Website

Astro, deployed to `s3://jbrowse.org/jb2/` on commits to `main` containing
"update docs". `pnpm index` once for local search (`static/pagefind/` is
gitignored). `deploy_staging.sh` wraps a staging deploy.

## Figure store (`static/img/` is gitignored)

Figure **bytes** live in `s3://jbrowse.org/jb2-figures/`, content-addressed and
immutable; git tracks `figures.lock` at the repo root, one line per figure.
`website/scripts/figure-store.ts` explains why. `pnpm figures` is the CLI.

- **`pnpm figures:pull` installs them, and needs no credentials** — it is a
  plain HTTPS GET through CloudFront, hash-verified, cached under
  `node_modules/.cache`. `dev` and `build` run it for you.
- **`pnpm figures:push` after a regen**, then commit `figures.lock`. It uploads
  before it rewrites the manifest, in that order and never the other way: a
  manifest line whose bytes were never pushed breaks `pull` for everyone. CI
  catches that anyway — a fresh runner has no figures, so its `pull` verifies
  every entry.
- **A figure change is now a one-line hash swap**, so `pnpm figures:report`
  (`--base`, `--markdown`) is how you *look* at one. Every revision ever pushed
  is still at its own URL, so it renders before/after side by side. The `Figures
  moved` CI job posts that to the run summary on every branch.
- **The line carries `WxH`**, which is the one change a pixel diff cannot see —
  `pngDiffFraction` returns null on a size mismatch. A resize shows up in
  `git diff` as `1400x900 -> 1400x1240`.
- **`push` is also the restore path.** It uploads any blob the store lacks, so
  any checkout with figures on disk rebuilds the whole store in ~25s. What is
  genuinely single-copy is *superseded* revisions, not the current set.
- **An unpushed regen is invisible to git**, so a regen you never push means
  everyone else keeps getting the old image with nothing saying so. CI can't
  catch it — the evidence is a file on your disk. So a sweep ends on
  `NOT IN THE FIGURE STORE` and the review UI banners it; both report the whole
  worktree, not just that run, and both say so when there's nothing outstanding.
- **Don't hand-write a store URL** — it is content-addressed, so it goes stale
  the next time that figure is regenerated, and a stale one shows the wrong
  picture indefinitely. Site docs use `/img/...` and never a store URL at all.
  The jbrowse-img README is the one exception, because GitHub and npm render it
  outside the site: its image URLs point at the store and are *generated* by
  `sync-img-readme.ts` from `figures.lock`, with `autogen --check` failing on
  drift. `/jb2/img/...` is not an option there — it 404s until a production
  deploy, and deploys currently go to `/jb2-staging`.

## Screenshots (`static/img/`)

`scripts/generate-screenshots.ts`, run with `node` — **not `npx tsx`**, whose
`keepNames` breaks `page.evaluate`'d functions. Specs in
`scripts/screenshot-specs.ts`. A new `screenshot-*` module must be added to
`GLOBAL_TRIGGERS` in `screenshot-impact.ts`, or `--affected` will not know it
changes every capture.

- **Display config in a session spec goes on the track**, inside its own
  `displays: [{ type, ...slots }]`. Slots on the view's `tracks` entry are
  silently dropped and the display falls back to schema defaults.
- **An unfiltered regen only rewrites a PNG whose capture changed**, so a sweep
  can't churn 288 figures over antialiasing. `--filter` implies `--force`: a run
  that names its specs rewrites them, since the gate's 0.5% is wider than a
  renamed label. If an unfiltered sweep says unchanged where you expected a
  change, `--force` and diff the two rather than trusting the gate.
- **`--affected` narrows a sweep to what a change could have moved**
  (`scripts/screenshot-impact.ts`, runnable on its own to see its reasoning). It
  narrows only — it does **not** imply `--force`, and it intersects with
  `--filter`. **The unfiltered sweep is its oracle**: a PNG a full regen
  rewrites that `--affected` would not have selected is a bug in the map, not an
  acceptable miss. Expect it to select everything about half the time — honestly
  so, since a `packages/core` change can move any figure.
- **`--cover` answers a different question from `--affected`**: not "which
  figures moved" but "does every type still launch, paint and settle". It
  renders the smallest set of specs that still puts every declared type on
  screen. Reach for it before pushing a change under `packages/core`, where
  `--affected` can only say "all". It proves **nothing** about whether a figure
  is out of date; only a sweep does.
- **Don't propose making any of this a PR gate.** Nearly every spec fetches from
  jbrowse.org, hgdownload or an ENCODE bucket, so a required check built on them
  fails on somebody else's outage rather than on the change under review, and
  the remote-free subset is far too small to gate on. The sweep runs weekly off
  the PR path (`.github/workflows/figures.yml`, `workflow_dispatch` for on
  demand); `--cover` and `--affected` are what you run locally to avoid paying
  30 minutes to learn that nothing moved.
- **A spec's own `diffThreshold` is a last resort**, and the run says so: a keep
  that only happened because of a raised gate is reported under
  `KEPT BEHIND A RAISED diffThreshold`, because a deliberate recolor of one bar
  moves ~2.4% of pixels and a 2% allowance would silently keep the old image.
  The few that raise it are irreducible jitter — dense per-base glyphs,
  remote-fetch timing. Anything else is a bug in whatever is producing the
  nondeterminism; fix that first.
- **Size a figure from the run's own two reports, not from the PNG.**
  `CONTENT CLIPPED BELOW THE FOLD` gives the exact css px to raise
  `viewportHeight` by and `blank below the last content` the px to lower it.
  Both beat measuring off an image, and the clipped one cannot be recovered from
  the image at all.
- **`DISPLAYS NOT PAINTED AT CAPTURE` names a frame that may hold a blank
  track.** Every settle wait is best-effort, so "all painted" and "we stopped
  waiting" otherwise look identical; the run re-checks
  `[data-display-drawn="false"]` at shoot time and lists what was still pending.
  Raise that spec's `settleMs`, or fix the display that never reports done —
  don't accept the figure because it looks plausible.
- **Downscale before reading a PNG** — captures are ~3000px and Read rejects
  them: `convert static/img/<n>.png -resize 1400x /tmp/shot.png`.
- **Never hand-measure a callout position** — every annotation `anchor`s. Prefer
  an in-app `highlight` over an overlay at all. Add shapes to
  `@jbrowse/browser-test-utils/src/annotationOverlay.ts` (shared with the
  desktop harness), not to `scripts/`.
- **A click anchors too.** `anchor: {track, locus, fracY}` on a
  click/rightclick/hover resolves through the live view
  (`scripts/locusAnchor.ts`, the LGV sibling of `graphAnchor.ts`), so a canvas
  feature is named by its coordinate rather than by a pixel. A `from: {x, y}` is
  only correct for the width, locus and layout it was measured against, and
  nothing tells you when one of those moves: `alignments_sort_by_base` kept its
  108bp-era coordinate after the spec was narrowed to 31bp, which read as 17%
  render flakiness for months. Share one anchor between the action and the
  callouts that explain it.
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
- **A figure a non-specialist can't read is a bad figure**, however correct. If
  it needs the field's vocabulary to mean anything, delete it — a caption won't
  rescue it. Separate from density: `ld/anopheles_r2_vs_dprime` was two clean
  triangles and still failed.
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
