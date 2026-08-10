# Website

Astro, deployed to `s3://jbrowse.org/jb2/` on commits to `main` containing
"update docs". `pnpm index` once for local search (`static/pagefind/` is
gitignored). `deploy_staging.sh` wraps a staging deploy.

## CSS: where a rule goes

Three homes, and the question that picks one is **who renders the markup**.

- **A component renders it** → that component's scoped `<style>`, or a
  `*.module.css` next to it. Unlayered, because those selectors only ever match
  markup the component itself renders. Most of the site is this, and it stays
  this.
- **The markdown pipeline emits it as a string** (remark/rehype plugins,
  `spec-recipe/html.ts`, the api-docs scripts) →
  `src/styles/widgets/<emitter>.css`, one file per emitter, in `@layer widget`,
  imported by BaseLayout. There is no component to scope it to, so **no rule may
  name a page-context ancestor** — the same markup lands in `.docs-content` on
  one page and a gallery card on the next.
- **Generic styling of rendered markdown** (headings, `pre`, tables, lists) →
  `styles/prose.module.css` or DocsLayout, in `@layer prose`.

`src/styles/layers.css` declares the order (`base, prose, widget`) and explains
it. **The layer is what lets a widget rule win**, so it no longer needs an
ancestor to out-specify `.docs-content[data-astro-cid-…] pre` — which is what
the ancestors were always for, and how the Config/CLI tabs came to be qualified
with `.spec-dialog` and render both panels at once everywhere else. Two classes
deep is now enough; if you find yourself adding a third to win a fight, the rule
is in the wrong layer.

`pnpm check-widget-styles` (after a build; runs in the `buildwebsite` job) loads
the built pages in headless Chrome and asserts the effective layer order plus
one property per widget that only the widget layer sets. It has to be computed
styles: the broken selector _was_ present in the stylesheet, just unreachable,
so nothing textual catches this.

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
- **`push --filter <name>` when the worktree is shared, and the sweep prints the
  exact command.** A bare `push` publishes the whole worktree and rewrites
  `figures.lock` from every figure on disk, so another agent's un-pushed regen
  lands in your lock diff under whichever commit message is written next.
  `--filter` scopes both the upload and the rewrite to the figures named
  (substring on the `figureName` the reports print, `a,b` or repeated, `--exact`
  for whole-name) and copies every other line through untouched. It also skips
  hashing the rest, which is the 62 MB of reads that makes an unfiltered push
  slow. `--dry-run` shows the selection first. **Don't hand-assemble the token
  list from spec names** — 27 of 349 spec names are a substring of some other
  figure's name, so `--filter dotplot` reaches eleven figures you did not touch.
  The end-of-run report already emits the correct `--exact` command for what
  that run wrote; the figure list above it is still the whole worktree, and that
  disagreement is deliberate.
- **A figure change is now a one-line hash swap**, so `pnpm figures:report`
  (`--base`, `--markdown`) is how you _look_ at one. Every revision ever pushed
  is still at its own URL, so it renders before/after side by side. The
  `Figures moved` CI job posts that to the run summary on every branch.
- **`figures.lock` is also what a review compares against.** Nothing about a
  figure is in the tree any more, so `git diff`/`git ls-tree` over `static/img`
  answer "nothing there" — asked about figures they do not report "unchanged",
  they report the state of a fresh clone. `review-screenshots-web` reads the
  lock at `origin/main` instead, and points its before-image straight at the
  store URL that line names. Its **Compare control stacks the two** (per card,
  or every card at once) three ways — `onion` fades between them, `swipe` puts a
  divider you drag across the picture, `diff` blends them to black everywhere
  they agree. That is how you see the small moves — a repacked row of labels, a
  recoloured bar — that two columns 700px apart read as identical. Reach for
  `diff` to answer "did anything move at all", `swipe` to answer "what is under
  this bit", `onion` with `blink` on for a change you can't localise.
- **When a layout change rewrites most of the corpus, `pnpm figures:triage` says
  which figures actually redrew.** It aligns each figure to its baseline row by
  row and ranks by how much a vertical slide accounts for, so the tail (99%+, 89
  of 209 on the sweep it was written for) is the part needing no eye. Pass
  `--base <sha>^`: publishing the regen is what makes `origin/main` agree with
  your disk, and it then has nothing to compare. It does **not** separate a
  re-pack from a redraw — a display that fits rows to available height scores
  like one that moved an element — so read down the ranking, don't trust the top
  of it as a verdict.
- **The line carries `WxH`**, which is the one change a pixel diff cannot see —
  `pngDiffFraction` returns null on a size mismatch. A resize shows up in
  `git diff` as `1400x900 -> 1400x1240`.
- **`push` is also the restore path.** It uploads any blob the store lacks, so
  any checkout with figures on disk rebuilds the whole store in ~25s. What is
  genuinely single-copy is _superseded_ revisions, not the current set.
- **An unpushed regen is invisible to git**, so a regen you never push means
  everyone else keeps getting the old image with nothing saying so. CI can't
  catch it — the evidence is a file on your disk. So a sweep ends on
  `NOT IN THE FIGURE STORE` and the review UI banners it; both report the whole
  worktree, not just that run, and both say so when there's nothing outstanding.
- **Don't hand-write a store URL** — it is content-addressed, so it goes stale
  the next time that figure is regenerated, and a stale one shows the wrong
  picture indefinitely. Site docs use `/img/...` and never a store URL at all.
  The jbrowse-img README is the one exception, because GitHub and npm render it
  outside the site: its image URLs point at the store and are _generated_ by
  `sync-img-readme.ts` from `figures.lock`, with `autogen --check` failing on
  drift. `/jb2/img/...` is not an option there — it 404s until a production
  deploy, and deploys currently go to `/jb2-staging`.

## Screenshots (`static/img/`)

`scripts/generate-screenshots.ts`, run with `node` — **not `npx tsx`**, whose
`keepNames` breaks `page.evaluate`'d functions. Specs in
`scripts/screenshot-specs.ts`. A new `scripts/screenshot-*` module needs no
bookkeeping: `GLOBAL_TRIGGERS` in `screenshot-impact.ts` matches that prefix, so
`--affected` knows it changes every capture the day it is added.

- **An inline key on a session spec's `tracks` entry reaches a config slot and a
  model prop alike**, so display settings need no nesting. `normalizeTrackInit`
  folds every key except `trackId` / `trackSnapshot` / `displaySnapshot` into
  the display snapshot, and `showTrackGeneric` then `setSlot`s the ones that are
  real slots onto the persistent display config (#5591) — which is also what
  makes them outlive a hide/retick, where a model prop is instance state and
  does not. `{ trackId, height: 450, forceLoad: true, colorBy: {…} }` works as
  written. An explicit `displaySnapshot` still wins over an inline key of the
  same name, and a track config's own `displays: [{ type, ...slots }]` is still
  where slots go when you are defining the track rather than opening it.
- **`forceLoad` is the declarative half of the FORCE LOAD button** nothing can
  click in a capture (`RegionTooLargeMixin`'s `configForceLoad`), so a spec
  _can_ put a lane past the byte gate — and the live link then opens what the
  figure shows. `gallery/nanopore_methylation` deliberately omits it and is the
  spec that checks the default budget still draws an ordinary CRAM.
- **What fails is a key that is neither**, silently and in both directions: MST
  drops unknown snapshot keys, and the `setSlot` pass skips whatever
  `isConfigurationSlot` rejects. A slot spelled for the wrong display type, or a
  typo, leaves the display on schema defaults with nothing logged. `type` is
  exempt from that pass — it picks the display, it is not a setting on one.
- **`rowHeight` is a slot whose `0` means auto-fit**, not zero height: rows
  stretch to fill the display, so adding rows shrinks them rather than growing
  the track. Set it to pin a px height, and read `effectiveRowHeight` for the
  resolved value — never `rowHeight`, which is the raw setting including the
  sentinel.
- **`pnpm --filter jbrowse-web build` silently does nothing** — "No projects
  matched", exit 0. The package is `@jbrowse/web`. A regen after a code change
  then shoots the OLD build, which looks exactly like the change having no
  effect.
- **Restart the review server after editing a caption.** It loads the docs at
  startup, so a reviewer reading it sees the stale text and files a verdict
  against prose you already fixed. Same for editing the review UI itself: its
  page is React under `scripts/review-app/`, bundled by esbuild once at startup
  with no watcher, so a reload serves the bundle the last restart built.
- **"This figure changes between runs" is checkable, and usually isn't a race.**
  A review entry's `hash` is the sha1 of the PNG the verdict was made against,
  so `sha1sum` the file on disk and compare. Both revisions are fetchable from
  the content-addressed store
  (`jbrowse.org/jb2-figures/<name>.<first12 of sha256>.png`), so **diff the two
  blobs before hunting nondeterminism** — the usual answer is a verdict filed
  against a superseded revision. A delta far larger than the stated fix is not
  evidence against this: a label layout that shifts by one row moves every name
  after it, so gene lanes re-packing dominate the pixel count.
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
- **The generator serves the BUILD's copy of `test_data`**, so a config edit
  there is invisible until a rebuild. Likewise, render against the local build,
  not `jb2/latest`, or new view/display props are silently dropped.
- **A figure on a brand-new `test_data/` fixture has a live link that 404s until
  the next release.** That is expected — don't "fix" it by repointing the link.
- **Size a figure from the run's own two reports, not from the PNG.**
  `CONTENT CLIPPED BELOW THE FOLD` gives the exact css px to raise
  `viewportHeight` by and `blank below the last content` the px to lower it.
  Both beat measuring off an image, and the clipped one cannot be recovered from
  the image at all.
- **But the two reports have a blind spot, and it is a LANE that is wrong rather
  than the page.** Both answer "is the capture the right height"; neither can
  answer "is this display the right height", and three review rounds turned on
  that difference.
  - **A lane that does not fit SCROLLS**, so it reads as complete to both
    reports while cutting its own content in half. Three pinned heights on
    `cancer_sv/k562_fusion_inspector_split` (260, 380, 480) each did this. The
    tell is a scrollbar thumb on the display's own right edge; the fix is
    `heightMode: 'grow'` plus sizing the frame off the report.
  - **A full lane can still be the wrong size in either direction, and only
    geometry says which.** An unsquashed LD panel draws at natural aspect — apex
    depth is half the drawn width — so `ld/anopheles_2la`'s 2La block needed
    327px, had 300, and the block the figure exists to show was cut flat while
    the lane read as packed. Conversely its karyotype lanes were sized off their
    row COUNT (297px for 297 mosquitoes) when the rows are grouped, and what the
    lane is read for is three contiguous bands — 140px draws them 77/32/31.
    **Compute what the content's shape demands** before believing a lane that
    looks full.
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
- **A dotplot cell is `anchor: {hLocus, vLocus}`** (`scripts/dotplotAnchor.ts`),
  each a bare refName for the whole chromosome or `4A:600,000,000-645,000,000`
  for part of one; naming one axis spans the plot on the other. That is the unit
  an off-diagonal block wants — "this chromosome against that one" is a grid
  cell, and a box on it needs no chromosome lengths in the spec.
  `node scripts/probe-dotplot-axes.ts <spec>` prints both axes with the px each
  region covers, which is also how you find out **which** assembly ended up on
  which axis. Anchors on the two canvas view types are resolved node-side and
  handed to the overlay as a rect, so a new one has to be added to `annotations`
  _and_ to the pre-resolved branch in `annotationOverlay.ts`; the axis `bpToPx`
  returns a bare number, and reading `.offsetPx` off it yields a NaN that
  serializes to null and parks every callout in the top-left corner.
- **Text pills draw last**, over arrows and boxes (`annotationOverlay.ts`). An
  arrow's tail has to start inside the pill it leaves from, and a pill's width
  is only known in-page — so place the pill's RIGHT edge with `textAlign: 'end'`
  and put the tail 10px left of it. Don't hand-tune a `dx` against a width you
  measured off an image.
- **Don't `convert -append` a before/after figure by hand** — use a `compose`
  spec, or `stages` when a state is only reachable through the UI.
- **A UI click-chain waiting on a fixed timeout is a red flag.** Make the
  trigger declarative and wait on a `data-testid` on the real result.
- **The capture rasterizes in software, so a spec that dies on _volume_ is a
  claim about swiftshader until you check it.** Run the same session in a real
  browser, or the harness with `--use-angle=gl` (`scripts/cancel-bench.ts`
  does), before concluding the app cannot draw it. A 2504-sample cohort over all
  24 contigs is ~7.8M quads into a 1400x420 box: 34 minutes and then puppeteer's
  `protocolTimeout` here, and quick on both WebGL and WebGPU on real hardware.
  The cost of getting this backwards is not a missing figure — it is writing an
  imaginary product limit into a spec comment, a caption, or an optimization
  nobody needed. A figure that has to stay narrower than what users can actually
  do is a capture limit; say so where the spec explains itself, and don't let it
  leak into prose about the product.
- **`hgdownload.soe.ucsc.edu` is not dependable from the capture box**, and
  three broken figures were committed before that was pinned down. A whole-file
  GET times out outright (`net::ERR_TIMED_OUT`, reproduced with a bare
  in-browser `fetch`, while the same URL ranged returns 206); a ranged 2bit
  header read failed 2 of 6 captures; a RefSeq bigBed failed twice with
  generic-filehandle's "chrome CORS header caching bug" refetch failing too.
  Read hs1 genes off `jbrowse.org/ucsc/hs1/hs1.gff.gz` (ours, and what the hg38
  lane already uses), and give a fixture assembly a committed `chrom.sizes`.
- **A display's config is per TRACK, not per pane.** A figure drawing one
  segments track in two panes had a `color` on the second pane repaint the
  first, because both panes share the same track config. If two panes of one
  track must differ, the difference has to come from the data (a rank branch in
  the ramp, say), not from a second display config.
- **A spec appended to a `specs/*.ts` array can leave a sparse hole**, and the
  generator then dies far away with
  `TypeError: Cannot read properties of undefined (reading 'mode')` inside
  `screenshot-specs.ts` — which reads as somebody else's broken spec file, and
  was misattributed to a concurrent agent three times.
  **`Array.prototype.filter` SKIPS holes**, so `arr.filter(x => !x).length` is
  not a hole check and will report the array clean. Use
  `for (let i = 0; i < a.length; i++) if (!(i in a)) …`.
- **A `TMPDIR` under the session scratchpad is too long for Chrome**, which dies
  with `FATAL: Socket path too long: …/SingletonSocket` before any spec renders.
  Use a short one (`/tmp/ss`). Distinct from the "insufficient resources"
  failure a _missing_ TMPDIR gives.
- **A `stages` capture stacks the stage frames only.** The spec's own `actions`
  are setup for stage one, not a frame — put the interaction in the first stage
  or the committed PNG is just the last frame.
- **Gate a row-label spec on the toolbar too**, e.g.
  `body:has([data-testid="graph-row-label"]) [data-testid="graph-layout-select"]`.
  The rows land first, and a capture in between shows the graph under a header
  with no dropdowns in it.
- **A synteny figure draws far more than its window, on both axes for different
  reasons.** `LinearSyntenyDisplay.fetchRegions` is `syntenyFetchRegions` over
  the **query axis only**, which is the visible window expanded by
  `syntenyPanBufferPx = max(width * 0.5, 2000)` px of bp per side and snapped
  outward to that grid — at 1000px and 350 bp/px that is 700 kb per side, so one
  inversion figure fetched `chr1:143.5-145.6 Mb` for a 350 kb frame. The target
  axis is then unscoped by design ("query regions in, every mate out"), so a
  record whose mate sits a megabase off the other row's window comes back too
  and draws a ribbon across the frame. Cut the fixture PAF to the frame, and ask
  `node scripts/probe-synteny-features.ts <spec>` what a figure actually drew
  rather than reasoning about what the view "should" have fetched.
- **A killed run leaves its server on :3334**, so the next one fails instantly
  with `EADDRINUSE` and looks like a new bug. Likewise a run that seems hung:
  check the node process. Idle at ~0% CPU on `about:blank` means it is burning
  `readyTimeout` and will fail; pegged high means it is working and the timeout
  is the thing to raise. "Processes gone, no output" usually means the run is
  still alive — its output is buffered behind whatever pipe it was written to.

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
