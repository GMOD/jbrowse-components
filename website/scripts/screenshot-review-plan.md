# Screenshot review — agent handoff

Working the `bad`-status backlog in `screenshot-review.json` (tracked, so
verdicts are shared rather than local-only). **The json's `status` is the source
of truth, not this doc** — this doc is for pipeline mechanics and durable
gotchas, not a log of what's currently open. Extract the backlog with:

```bash
jq -r '[to_entries[]|select(.value.status=="bad")]|.[]|"\(.value.name)\t\(.value.note)"' \
  scripts/screenshot-review.json
```

## How the system works

- Specs live in `scripts/specs/*.ts` (aggregated by `screenshot-specs.ts`).
  `jbrowse-img`/CLI specs are in `screenshot-spec-helpers.ts`. One spec object
  per figure; `name` == the PNG path under `static/img/` (cli/jbrowse-img specs
  land in `products/jbrowse-img/img/` instead).
- PNGs are rendered by `generate-screenshots.ts` (puppeteer), run with `node`
  (**not** `npx tsx` — its `keepNames` injects a helper that breaks
  `page.evaluate`'d functions), from `website/`:
  ```bash
  node scripts/generate-screenshots.ts --filter <name> --exact --force
  ```
  - **Use `--force`.** The content-stable gate (see root `website/CLAUDE.md`)
    keeps the old PNG when a re-render differs by <0.5%, which silently skips
    small text/annotation edits.
  - The Bash tool's 2-min default timeout kills specs that fetch big remote data
    (1000g, cactus, celegans, cgiab) — pass a longer tool timeout (~400000ms).
    Concurrency is 4, so batch a few `--filter a,b,c` together, or pass your own
    `--localport` if another agent's regen is already running (default 3334 is a
    hard `EADDRINUSE`; `ps` first).
  - A code change to app/plugin **source** needs a rebuild first:
    `cd products/jbrowse-web && NODE_ENV=production node scripts/build.ts` (~a
    few min) — the generator renders the built bundle, not source. `--port=3000`
    proxies to a running dev server (`pnpm --filter @jbrowse/web start`)
    instead, which HMRs source edits with no rebuild — faster for iterating on
    plugin code, but the server must stay up.
  - `jbrowse-img`/CLI specs run `jb2export` from source via tsx (no build needed
    for `jb2export` src edits):
    `cd products/jbrowse-img && npx tsx --tsconfig ../../tsconfig.json src/bin.ts <args> --out /tmp/x.png`
    runs the bin directly so you see stderr the generator otherwise swallows.
  - Shaders: edit `.slang`, run `pnpm gen:shaders` (never hand-edit
    `*.generated.ts`).
- **A `test_data/` edit IS live to a regen — no rebuild needed.** This bullet
  previously said the opposite (that `build/test_data/` is a build-time copy, so
  an edit needs a rebuild or a `cp`). That is not what the code does:
  `generate-screenshots.ts` passes `testDataRoot = products/jbrowse-web` — the
  **source** tree — to `createTestServer`, which serves `/test_data/*` from
  there, and that path is the `test_data -> ../../test_data` symlink. It has
  been that way since the astro migration (May 2026). Verified directly while
  adding the Hi-C compartment tracks: `build/test_data/config_demo.json` did
  **not** contain them and the figure rendered them anyway, naming them in its
  track labels. Only non-`test_data` URLs come out of `build/`, so an **app or
  plugin source** change still needs
  `NODE_ENV=production node scripts/build.ts`. Whatever cost the hour on that
  earlier new-Hi-C-track spec, this mechanism was not it — so don't spend a
  rebuild on a config edit, and if a new track's `readySelector` times out,
  suspect the track (adapter, CORS, an empty region) rather than a stale copy.
- **Viewing PNGs**: capture is ~1500w@2x ≈ 3000px, too big for the Read tool —
  downscale first: `convert static/img/<name>.png -resize 1100x /tmp/x.png`,
  then Read `/tmp/x.png`. Whole-genome/many-row figures (470-way, dotplots,
  whole-chromosome coverage) are the worst offenders.
- Mark a verdict with
  `node scripts/flip-review.ts good|answered|remove <name> "<note>"`, which
  stamps a fresh sha1 of the PNG for you (`isVerdictStale` only re-surfaces a
  `bad` verdict whose stored hash still matches the committed PNG — a changed
  PNG makes the note stop applying). **Never write the file directly** — no jq
  pipeline, no editor, no hand-rolled read-modify-write. Both it and the review
  server rewrite the whole map, so an unlocked write drops every verdict
  recorded since it read, and a reviewer is usually running the server while you
  work. `flip-review.ts` and the server share one lock (`updateReport` in
  `@jbrowse/browser-test-utils`); anything outside it does not.
- Housekeeping after structural edits:
  - Changed a **gallery** spec's URL, or added/removed/renamed a spec →
    `pnpm gen:gallery-links` (CI gate: `pnpm autogen --check`).
  - Added/removed a spec or a doc `<Figure>` → `pnpm audit-figures`.
  - `npx eslint --cache --fix scripts/specs/*.ts` — eslint reflows the whole
    file, which churns lines you didn't touch (inflates the diff, entangles with
    other agents' edits — see the worktree note below).

- **Another agent rebuilding `jbrowse-web` mid-regen fails the spec that was in
  flight**, with `ChunkLoadError: Loading chunk NNNN failed` and a handful of
  404s in the browser log, then a ready-gate timeout. The build writes
  content-hashed chunks, so a page that loaded `index.html` before the swap asks
  for chunks that no longer exist. It reads as a broken spec and is not one —
  `popgen/in2lt_per_sample` failed this way and passed unchanged on a re-run
  against the settled build. `stat -c %y products/jbrowse-web/build/index.html`
  against the run's start time is the check, and the fix is just to re-run the
  failed spec. Nothing is corrupted: a failed spec leaves its committed PNG
  alone.

- **`until ! pgrep -f "generate-screenshots"` never exits**: the waiting shell's
  own command line contains the pattern, so it matches itself and spins forever
  — and any regen chained after it never starts, silently. Match the process
  rather than the pattern (`pgrep -x node` plus a check on the log), or just run
  the regen in the foreground with a long tool timeout.

## The review log is largely stale — triage by PNG hash before touching anything

Most `bad` entries are already fixed or already deleted; the human just hasn't
re-reviewed. An item is only _genuinely_ still-bad when its committed PNG is
byte-identical to the hash the review was made against:

```bash
jq -r '[to_entries[]|select(.value.status=="bad")]|.[]|"\(.value.name)\t\(.value.hash)"' \
  scripts/screenshot-review.json | while IFS=$'\t' read -r name hash; do
  f="static/img/${name}.png"
  if [ ! -f "$f" ]; then echo "NOPNG (deleted)  $name"
  elif [ "$(sha1sum "$f" | cut -d' ' -f1)" = "$hash" ]; then echo "UNCHANGED (real) $name"
  else echo "changed (addressed?) $name"; fi
done
```

- **NOPNG** = spec+PNG already deleted. Resolved.
- **changed** = PNG differs from the reviewed one → the fix is likely already in
  the spec; verify by reading it rather than assuming the note is stale.
- **UNCHANGED** = the real backlog. Even then, read the whole note: often one
  sub-part is stale while another is still open.

## Shared worktree — important

Multiple agents share this working tree and commit concurrently. **Scope any
commit to explicit pathspecs (`git commit -m .. -- <files>`); never `git add -A`
/ bare `git commit`.** `screenshot-specs.ts`/`scripts/specs/*.ts` and
`screenshot-review.json` are multi-agent dirty essentially always — expect to
find another agent's in-progress edits there and leave them alone; `git status`
before editing, don't revert what you didn't touch.

`screenshot-review.json` is the one file that **cannot** be split by pathspec:
it is rewritten wholesale under one lock, so whoever commits it carries every
verdict written in that window, the human reviewer's live ones included. Say so
in the commit message rather than pretending they are yours.

**So keep the flips out of the branch entirely.** A worktree does not share the
review server's lock, and a branch that carries this file also makes the ff-only
landing refuse against a reviewer's dirty copy — which is the one thing that has
to keep working. Work the figures in a worktree and accumulate the verdict
changes as `flip-review.ts` calls instead, then run them from the primary
checkout, where the server runs, after the branch lands.

**Rebase before assuming an item is still open.** Two agents worked one backlog
at once and it showed up twice: a figure deleted on main by another agent while
the branch was mid-flight, and one reverted by the same hand this branch had
deleted it with. Re-run the hash triage rather than trusting a list you made
before the last rebase.

**Accumulate the flips as a script and commit THAT.**
`scripts/flips-screenshot-review-bad.sh` is the worked example: one
`flip-review.ts` call per item, with the reply as its note, run from the primary
checkout after the branch lands. It keeps `screenshot-review.json` off the
branch (which is what the paragraphs above are for) while still leaving the
replies reviewable in the diff, and an item that could not be finished is a
comment in the same file rather than a silent omission.

**A `figures push` with no `--filter` will sweep in other agents' regens even
when you are only retiring a figure.** The retiring recipe says a bare
`push --allow-deletions` is what expresses a deletion, and that is true — but if
you have already removed the lock line by hand, the deletion is a no-op and all
the bare push does is adopt every locally-modified figure on disk. Four came in
that way in one run. Check `git diff figures.lock` immediately after; restoring
the lock and re-pushing with `--exact --filter` is the fix, and the blobs the
stray push uploaded are harmless (content-addressed, and their lock lines stay
their owner's to commit).

**Discriminate a sweep on pixels, not on the file list.** `--affected` selected
89 specs for one variants change and rewrote 15, of which 3 had anything to do
with it; narrowing to "every spec whose session carries a
`LinearMultiSampleVariantDisplay`" still rewrote 14, the same 3 real. Get that
list by importing the specs rather than grepping, then count pixels near the
color the change introduces, current file vs `git show HEAD:<path>`:

```bash
node --input-type=module -e "
const { specs } = await import('./scripts/screenshot-specs.ts')
for (const s of specs) {
  if (JSON.stringify(s).includes('LinearMultiSampleVariantDisplay')) console.log(s.name)
}"
```

Revert the ones with zero delta — sweeping them in misattributes another agent's
work to your commit, which the shared worktree makes easy to do by accident. Two
traps in that scan, both hit: **numpy `int16` overflows on a squared channel
difference** (255² wraps negative, passes any `< threshold` test, and matched
all 283 figures — cast to `int32`), and a color-distance ball catches unrelated
palettes, so for "is this color used at all" match **exactly** and keep the
tolerance ball for "did this figure move".

## Useful facts learned (durable, not tied to any one session)

- **"Did MY change move this figure" cannot be answered by diffing the PNG.** A
  forced regen rewrites figures other agents' landed commits already moved, so a
  whole-image diff says "changed" for nearly everything — measured:
  `variants/population_1000genomes` differed from HEAD by 59k pixels while
  containing not one pixel of the color the change was about. Counting the color
  a change introduces is much better, and is what to reach for first, but it is
  blind in the other direction: a legend or label **text** edit moves no colored
  pixels at all and reads as "unchanged". Neither measure decides it on its own.
  What does is a structural claim about which specs can possibly be affected —
  "only a display that draws an insertion marker gets the Insertions section" —
  with the pixel count used to confirm it. Then revert the rest, because
  sweeping them in puts another agent's work under your commit message. Two
  traps in the counting itself, both hit for real:
  - **numpy `int16` overflows on a squared channel difference** (255² = 65025
    wraps negative), which passes any `< threshold` test and matches every
    figure in the tree. Cast to `int32`.
  - **A tolerance ball catches near colors.** `chromhmm_hoxa_9celltype`'s
    ChromHMM state color `#cf0bc6` sits inside a distance-900 ball around
    `#c000c0`, and antialiasing along a solid bar's edge lands inside a ball
    around any paler shade of it. Match exactly for "is this color used at all";
    keep the ball only for "did this figure move".
- **Hi-C: three things that cost hours, for whoever picks up the demo.** The
  `hic/whole_genome` figure needs a `.hic` whose master index holds
  **inter-chromosomal** pairs; the demo's own `intra_nofrag_30.hic` has 26
  entries and every one is a self-pair, which is why its off-diagonal was empty.
  Read the footer rather than trusting a file name — the same check ruled out an
  ENCODE "contact matrix" that was actually ChIA-PET.
  - **juicer_tools' region-restricted dump (`chr3:x1:x2`) silently returns ZERO
    records below 250 kb** on ENCODE's v9 files. No error, no warning, an empty
    output file. It works at 250 kb / 500 kb / 1 Mb and returns nothing at 100
    kb, 50 kb, 25 kb, 10 kb and 5 kb. This is how you ship an empty subset
    without noticing; whole-chromosome-pair dumps are unaffected, so the
    workaround is to dump the whole pair and filter with `awk` — and check the
    record count before believing the result.
  - **The display picks its binsize from the FILE's own resolution list** —
    largest `<= 2*bpPerPx`, falling back to the finest when nothing qualifies
    (`LinearHicDisplay`'s `availableResolutions`). So a file carrying one
    resolution degrades rather than breaks when zoomed: it keeps drawing that
    binsize and the stepper offers no finer step. This is also the mechanism
    `resolutionBias` biases.
  - **These files are enormous and almost all of it is resolution you never
    draw.** The GM12878 whole-genome source is 1.72 GB, and its sibling intact
    file is **74 GB** across 18 resolutions down to 1 bp.
    `scripts/build_gm12878_wholegenome_hic.sh` shrinks one to its coarsest
    binsize (~1000x smaller) by dumping every chromosome pair and rebuilding
    with `juicer_tools pre`; it verifies the rebuild reproduces the source
    counts **exactly** by round-tripping a pair, and fails if not. `SRC`, `NAME`
    and `RES` are overridable, so it applies to whichever whole-genome file a
    demo settles on. Nothing is hosted from it yet — deploying is a deliberate
    step, not something the script does.

- **Hi-C, four more, from building the two `hic/*` figures.** These are about
  making a Hi-C figure _argue_ something rather than about the file format.
  `hic/whole_genome` is still on the backlog and untouched by any of this.
  - **The auto-picked binsize is usually too fine to see anything.** The rule is
    the largest binsize `<= 2*bpPerPx`, which over a 2.4 Mb view lands on 2 kb;
    at 2 kb every bin is nearly empty and the matrix renders as red speckle with
    no domain edges. `resolutionBias: 2` steps to 10 kb and the blocks appear.
    Every Hi-C figure wants this — if a matrix "looks like noise", it is this
    before it is the data. And `useLogScale` is the opposite of a fix on a deep
    file: it pushes every bin to the top of the ramp and returns solid red.
  - **`squashToHeight` is usually the wrong reflex.** A pair's contacts are
    drawn at depth `|x2-x1|/2`, so with two 2 Mb windows the cross-block apex is
    ~280 css px down, not the ~990 px the full wedge is tall. Squashing spent
    half the frame on the empty long-range corner; leaving it off kept square
    bins AND fit. Compute the depth of the feature you care about before
    reaching for it.
  - **A shallow control is not a control, and a balanced matrix deletes the
    finding.** For the translocation figure, ENCODE's "supernatant" GM12878
    (`ENCSR730CER`, the file `config_demo.json` already carried) has ~140
    occupied bin pairs in the window with a max of 7 contacts, so next to K562
    it looks spectacular for the wrong reason — sequencing depth, not karyotype.
    `ENCSR410MDC` is the depth-matched file and is the one to compare against;
    it carries MORE total chr9–chr22 contact than K562 and still 149 contacts at
    the junction bin where K562 has 161,282. Separately, `INTER_SCALE` moves the
    K562 peak off the fusion entirely and onto a mapping artifact present in
    both lines: matrix balancing divides out per-bin coverage, and an amplified
    fusion IS per-bin coverage. Both tracks pin `selectedNormalization: NONE`.
    `scripts/scan_hic_translocation.sh` prints all of these numbers.
  - **BEDPE gotchas that fail silently, both hit in one figure.** (1) A contact
    domain has both mates set to the same interval, so as a
    `LinearPairedArcDisplay` the arc runs from the domain to itself and draws
    NOTHING — an empty 78px lane, no error. Read Arrowhead output as a
    `FeatureTrack` and each domain is a box. (2) `parseNamesFromHeader` takes
    the **last** header line, and juicer writes `# juicer_tools version …`
    _after_ the defline; that line has no tabs, so column-name resolution
    returns undefined and every column past 10 reads back as `undefined`. A jexl
    expression on `observed` then evaluates against nothing and silently takes
    its else-branch — which looks exactly like a threshold that is merely wrong.
    Set the adapter's `columnNames` explicitly on any juicer BEDPE.

- **Hi-C compartments: the checkerboard is not renderable here, and three ways
  to compare them wrongly.** From adding `hic/compartment_switch`.
  - **A/B compartmentalisation cannot be drawn from a `.hic` in JBrowse.** The
    published checkerboard comes from an _observed/expected_ matrix (each bin
    divided by the mean at its separation, then correlated), and there is no O/E
    transform — so against the distance decay the plaid stays a faint texture.
    Both ends of the ramp were tried on one view: linear+percentile leaves it
    near-white, `useLogScale` on a deep file returns solid red. Balanced
    (SCALE) + linear shows the most, and is what the figure uses. Don't burn
    time hunting a ramp that produces a checkerboard; load the pipeline's
    eigenvector instead.
  - **The eigenvector's sign is a property of the FILE, not a convention.** A
    compartment eigenvector is equally valid negated, so "positive = A" is an
    assumption. Anchor it against gene density (A is gene-rich by definition):
    measured over chr8/14/18/19, mean eigenvector in bins with >=3 gene TSSs vs
    bins with none came out positive-vs-negative in both files, so positive is A
    for these two. **And cross-file comparison needs the orientations to agree,
    which nothing guarantees** — checked at 87-93% same-sign agreement per 100kb
    bin with each file ~50/50 positive, where arbitrary relative orientation
    would sit at 50%. Without that check a whole-chromosome orientation
    difference reads as compartment switching everywhere.
  - **Subcompartment cluster numbers are arbitrary labels**, not the published
    A1/A2/B1/B2/B3 naming, so a number means nothing alone and two files only
    compare because the same pipeline gave the same colours.
    `hic/compartment_switch` therefore requires BOTH the cluster id and the
    eigenvector sign to differ before calling a region switched: a renumbering
    moves ids without moving the eigenvector. Note the slice run matters —
    `ENCSR742SAT` emits SIX clusters where the two used here emit five.
  - **Pin `minScore`/`maxScore` on every eigenvector track you stack.**
    Autoscaling makes each fill its own lane from its own extremes, which is
    exactly the comparison the figure is making.
  - **A 12-column BED that is not BED12 is misread twice, silently.** ENCODE's
    subcompartment BED has no tabix index (use `BedAdapter`, it is ~150kB) and
    its last three columns are cluster metadata, not block fields — so
    positionally the cluster count becomes `blockCount` and every feature grows
    phantom subfeatures. Its colour column is also spelled `itemRGB`, which is
    not the name JBrowse looks for, and the header is not consulted anyway
    because a second comment line follows the column line (same last-header-line
    rule as the juicer BEDPE above). Explicit `columnNames` fixes both.

- **A legend that gains a section can outgrow its lane.** Adding one to the
  multi-sample variant display pushed it past the 120px `height` the
  `pangenome/maf` spec gave the track, and the last swatch was sliced in half by
  the track boundary — invisible in the run's own reports, since the clipping is
  inside the display rather than below the fold. Long item labels ellipsize
  rather than wrap, so the tail of a label is lost silently too. Look at the
  legend after a change that adds to it.
- **A declared legend sits ON the data unless the window makes room.**
  `FloatingLegend` is pinned `right: 10, top: 10` with an opaque paper
  background and there is no placement slot, so on a track whose content runs to
  the right edge it covers the top-right corner of every row — on
  `dtu/dtu_colored_gene_glyph` that was the last exon of seven transcripts, and
  the run's own reports cannot see it (the occlusion is inside the display, not
  below the fold). The only lever a spec has is where the data is: carry the
  window a few kb past the end of the thing being drawn. Budget ~210 css px of
  frame width for the box and convert that to bp at the figure's own scale.
- **Two ways to find a window's real cost before rendering it.** A locus that
  "feels" too wide usually is not, and the check is cheap in both directions:
  - **bgzf-block granular reads do not scale with span.** Measured off the HPRC
    `.tai` with the repo's own `queryBlockSpan`, chr6 at C4: 30 kb is a 189 KB
    read, and 70 kb, 83 kb and 90 kb are all the same 292 KB. So a window
    narrowed "so the fetch stays sane" can usually be widened for nothing —
    `maf_hprc_pangenome` was cropped to a third of its subject on that guess and
    excluded the second gene its own caption named. Run the index through
    `taiRegionByteSize`/`queryBlockSpan` in node rather than estimating.
  - **`tabix` reads the hosted PIF/GFF directly**, so "what will this synteny
    figure actually draw" is answerable before a spec exists:
    `tabix hg38ToHs1.over.pif.gz tchr5:69200000-71700000`. PIF indexes both
    sides — `t`-prefixed names are the target, `q`-prefixed the query — and
    `tabix -l` tells you which are present.
- **Over a segmental duplication a synteny track needs `cigarMode: 'off'`.** The
  default `'full'` draws every CIGAR block of every chain; where several chains
  overlap the same span that is thousands of slivers and the band renders as a
  hairball. `'off'` gives one ribbon per chain, which is the level a claim about
  chains is made at. Pair it with `minAlignmentLength` to drop the sub-kb chains
  a segdup throws off, and with `alpha` well above the 0.2 default — that
  default protects against pile-up, and three ribbons are not a pile-up.
- **`heightMode: 'fixed'` + `height` is how a session spec pins a lane whose
  track config says `grow`.** Worth reaching for before assuming a `height` was
  ignored: `hs1-genes` is configured to grow, and over a segdup its RefSeq-All
  pseudogene rows grew the lane to ~450 px — taller than the synteny band it was
  context for. The mirror-image trap is `geneGlyphMode: 'all'` on a grow track,
  where it is not a lane setting but a lane SIZE (one gene with ~25 transcripts
  took `qc/smn_vs_t2t`'s hg38 lane past 400 px and pushed the band off frame).
- **A Hi-C figure's locus should be scored out of the call files, not picked.**
  `scripts/hic_pick_loop.py` (new) ranks every 250-900 kb Arrowhead domain by
  the strongest HiCCUPS loop sitting on its two corners, which is the pair worth
  drawing: the domain, the arc and the block in the matrix are then one object
  seen three ways. 1,142 GM12878 domains carry such a loop. Its `--window` mode
  prints what a candidate frame contains, which is the check that matters — a
  domain crossing the frame edge draws as a bar rather than a box, and a loop
  with one anchor outside adds an arc going nowhere. That is what the old chr18
  window of `hic/loops_and_domains` was: four edge-to-edge bars and a forty-arc
  fan (review: "where is the 'logic'?").
- **`LinearPairedArcDisplay` has no filter slot, so colour is the filter.**
  `color: "jexl:get(feature,'observed')>200?'#8b1a1a':'rgba(0,0,0,0)'"` draws
  the weak calls fully transparent. Used in `hic/loops_and_domains` to drop the
  calls whose other anchor is off-frame.
- **A raw matrix cannot argue for compartments, so don't spend a lane on it.**
  `hic/compartment_switch` carried a 300 px squashed matrix under four lanes
  that state the answer outright, and the guide's own paragraph says why it
  could not work (compartments only become a checkerboard in an
  observed/expected matrix, which JBrowse does not compute). Dropping it and
  narrowing 10 Mb to 4 Mb is what made the 100 kb subcompartment strips read as
  blocks rather than as noise (review: "there is too much going on in this
  image").
- **The 1000 Genomes copy-number Zarr is per-window, and adding a window is
  cheap.** `scripts/build_1000g_cnv_zarr.sh` lists the regions it builds; adding
  one re-runs in well under a minute for 2504 samples and appends columns, so
  the existing chunks stay byte-identical and figures on the old windows do not
  move. That is how `multisv_rhd` got a depth lane under the callset (review:
  "the nested cnv are hard to see with vcf"). A figure that needs the Zarr
  plugin has to load `test_data/1000g_cnv/config.json`, since a plugin can only
  be declared by a config — the callset then comes in as session tracks.
- **A clustered display needs `data-clustered=true` waited on, not a settle.**
  `multisv_rhd`'s first render came back mid-clustering with a "Clustering
  samples 62%" overlay and the rows in panel order. The attribute rides on the
  same element as the first-paint testid, so
  `` `${displayPainted('multi-wiggle-display')}[data-clustered="true"]` `` as a
  `waitForSelector` action (with its own `timeout`) is the gate.
- **hgdownload can fail INSIDE the browser while `curl` from the same box gets
  200s.** Three consecutive renders of `pangenome/hprc_chm13_allele` drew the
  hs1 RepeatMasker lane as an error banner (360 MB bigBed, repeated ranged
  reads, plausibly throttling) while `curl -I -H Range:` returned 206 with
  `Access-Control-Allow-Origin: *`. That spec sets `allowUnsettled: true`, so
  the run SUCCEEDS and commits the banner — check the lane before committing any
  figure of that page, and restore the committed PNG rather than shipping one
  with a banner in it.
- **Point at a graph node by NAME, never by pixel.**
  `anchor: { view, graphNode: 's2037' }` works on a click, a rightclick, a hover
  and on any annotation; it resolves through the view's own `nodePositions` and
  transform (`scripts/graphAnchor.ts`), and throws if the node is not there, so
  a moved node fails the spec instead of acting on empty canvas. A box anchor
  takes the node's drawn bounds, everything else takes a point ON the polyline
  (a bent node's bounding-box centre can be in the hole the arc encloses).
  `node scripts/probe-graph-nodes.ts <spec> [--view=N] [--hover=<id>]` prints a
  cut's node ids with lengths, ranks and resolved coordinates, so a spec picks
  its target from the graph rather than from a finished PNG. Every hand-measured
  coordinate in this set had a comment listing the occasions it had gone stale.
- **`{ mode: 'compose', direction: 'horizontal' }`** places parts side by side
  (`+append`) instead of stacking. Use it when the two parts are the same view
  drawn two ways — stacked, the second reads as the next step rather than as the
  alternative. Size each part to its own content: `+append` pads the shorter
  one, so a shared height only adds dead space to the part that did not need it.

- **jbrowse-img (CliSpec) gene tracks: use `--hub <genome> --track <trackId>`,
  not a raw `--gffgz <url>`.** `--hub hg38` supplies the assembly (built-in
  refName aliases, no `--fasta`/`--aliases` needed) plus a bonus ideogram, and
  `--track hg38-ncbiRefSeqCurated` adds a pre-configured hosted NCBI RefSeq
  track. A raw UCSC `hg38.gff.gz` also carries RefSeqGene `match`/`region`
  features with no `Name` → they render as bare-UUID full-width bars. Find
  hosted trackIds with `jb2export list <genome> <filter>`. `--track` tokens
  stack above `--bam`/`--cram`/`--hic` in argv order (gene-on-top = list
  `--track` before the data track).
- **NCBI gene tracks already in `config_demo.json`** (no rehosting needed):
  `ncbi_refseq_109_hg38_latest` (hg38), `ncbi_gff_hg19` (hg19). Add the trackId
  as the first entry in the session `tracks` array.
- **View-as-pairs** = `linkedReads: 'normal'` in a `displaySnapshot`. The
  pairs→`insertSizeAndOrientation` coloring only auto-applies via the _menu
  action_, not on snapshot load — set `colorBy` explicitly in the snapshot too.
- **Dotplot init fields** (top-level in the session view object, routed to
  `init`): `autoDiagonalize: true`, `showColorLegend: false`, `colorBy`,
  `minAlignmentLength`. Same for `LinearSyntenyView` (`autoDiagonalize`,
  `colorBy`, `alpha`, `levelHeights`).
- **Arcs below coverage** = `readConnectionsDown: true` (the modern default).
- **A read-pair arc band is a claim, and some deletions cannot support it.**
  `multisv_rhd_dosage` spent three review rounds on one, and the answer was to
  delete the band: `scripts/count_rhd_mate_pairs.py` counts **one** pair
  spanning the RHD deletion in the homozygous carrier against 36 and 56 RHD↔RHCE
  paralog pairs in the two non-carriers. A deletion whose breakpoints sit inside
  a long identical repeat — RHD's are the ~9 kb Rhesus boxes — has no
  mate-distance signal at all, because a fragment crossing the junction lands
  inside the hybrid repeat and aligns collinearly. Check the count before
  designing a figure around discordant pairs; over a segmental duplication the
  band will fill with paralog mismappings instead and read as noise, busiest in
  the control. The two settings that narrow such a band, and are worth knowing
  even though no spec now sets them: `drawInter: false` (an interchromosomal
  pair is never an arc — it drops a tick at each endpoint, `compute.ts`
  `if (p1Ref !== p2Ref)`, so a segdup at 30x draws a picket fence) and
  `drawLongRange: false` (otherwise a mate's RECORDED position outside the
  window still gets an arc). Neither `properPairs: 'exclude'` nor a jexl
  insert-size filter is available as a third: both run before the COVERAGE
  pipeline, so they take the curve with them.
- **The nested-bubble trap** (pggb/Minigraph-Cactus variant tracks): both emit
  top-level bubble records thousands of bp wide alongside the decomposed SNPs,
  one alt allele per sample. A single such record paints kilobases of flat solid
  color across the genotype rows and buries everything under it — that reads as
  a rendering bug but isn't one. Fix with a `jexl:` length filter on the
  genotype lane (e.g. `alleleLength(feature) < 100`); filtering on `end - start`
  instead doesn't work, an insertion consumes no reference so its span is 1.
- **Right-click hit-testing in a `stages` spec**: for a synteny/alignments
  track, only rows that actually paint a feature under the cursor return a
  context menu — a few px off (a band vs. the pileup row) returns nothing, which
  looks like "the feature is missing" rather than "wrong coordinate". Aim clicks
  at the widest/longest feature in view.
- **Two `LinearMultiSampleVariantDisplay`s in one view kill the right-click
  context menu on both.** Same callset, distinct trackIds (the
  `variants/potato_missingness` pattern): the right-click reaches the canvas
  (the hover crosshair draws) but nothing opens, so a spec gated on
  `waitForText: 'Sort by genotype'` times out against a fully-rendered matrix.
  One lane alone works every time. Not fixed — the workaround is a capture per
  colouring plus `mode: 'compose'`.
- **That sort right-click is flaky even with one lane.** The same spec succeeded
  at `height: 400` / `y: 450` and failed at `height: 340` / `y: 400`. Re-run
  before re-designing a sort spec.
- **A `compose` HAS an annotation layer, anchored per part.** It was built after
  the note here said it did not exist; `annotateComposition` opens a page that
  is nothing but the composed PNG plus one absolutely-positioned div per part,
  and runs the same `drawAnnotationOverlay` every other figure's callouts go
  through. So `anchor: { selector: '[data-part="1"]' }` plus the usual
  alignX/alignY/dx/dy is a real anchor, an arrow CAN cross the seam, and a
  `jb2export` part can carry a callout at all — which is the only way one ever
  will, since those render through React SSR with no page in them.

  Two things it still cannot do. **Anchoring INSIDE a part** is not available:
  the composition is a flat image with no view model and no track elements, so
  anything pointing at a locus belongs on the part's own spec. And **a part's
  DATA AREA is not its box** — the app draws a left gutter for a wiggle y axis
  and a right one for its scrollbar, ~5% and ~5% of a 1500 px capture, so a
  fraction of the part is not a fraction of the genome it lays out. `fracX`
  takes a sub-span of the anchored rect for the one shape that needs it (below);
  the fractions have to be solved for against landmarks in the part, not
  assumed.

- **`trapezoid` is the lineage wedge**, joining `fromAnchor`'s facing edge to
  `anchor`'s: the idiom for "that span of the panel above opens into this one".
  `popgen/in2lt_inversion` is the worked example and carries the arithmetic. Two
  things to know before authoring one:

  - **it needs a gutter to exist in.** Stacked parts are flush, so the wedge's
    two horizontal edges are the same line and it has no height. `gutter: N` on
    the compose spec splices white space above each part after the first —
    opt-in, so no existing stacked figure moves.
  - **`fracX` is solved for, not measured.** Fit `x = L + f*W` over several
    landmarks whose genomic fractions are known (region dividers are ideal,
    since a multi-region row hands you one per boundary). Five of them agreeing
    to a tenth of a pixel is what makes the pair safe to commit, and a layout
    change that moved the gutter would miss all five at once — visibly, since
    the wedge's edge sits on a divider.

- **A callout anchored to a node can land under another callout.** Render and
  look before believing an offset — the MHC pair's two landmarks are an allele
  and the reference stretch it replaces, so the force layout draws them touching
  and the pane's caption sat on top of the second ring.
- **`renderingMode` is often auto-detected (`detectPhased`) rather than set in
  the spec**, so a static grep for `'phased'` over the specs mislabels figures
  like `hprc2/mhc_clustered`. The pixels are the oracle, not the spec text.
- **Insertion markers take the theme's `palette.insertion` (#800080), not
  alignments-core's `INSERTION_COLOR` (#c000c0).** The latter is the
  theme-agnostic fallback in `DEFAULT_CIGAR_OP_DRAW_COLORS`, for worker code
  with no theme to read. Drawing the same event in both purples in one figure is
  how that was found.
- `bcftools` in this sandbox is broken (`bcf_format_gt_v2`) — slice a remote VCF
  with `tabix -h <url> <region> | bgzip` instead.
- **Rebuilding the E. coli Minigraph-Cactus pangenome** (`~/ecoli_cactus5/`,
  `scripts/build_ecoli_pangenome_cactus.sh`): `cactus-pangenome` on the four
  genomes takes ~11 minutes; every downstream projection (halSynteny, hal2maf,
  taffy, odgi depth/pav/viz) finishes in ~15s total after that. Don't edit the
  build script while it's running — Bash reads it incrementally by byte offset,
  so an insert mid-run shifts everything after and can garble what it parses
  next, or silently not take effect.

## Hosted-track source: `~/src/jb2hubs/ucsc2jbrowse`

UCSC→JBrowse conversions, hosted at `https://jbrowse.org/ucsc/<asm>/<file>`
(relative track paths in `configs/<asm>.json` resolve there) plus some direct
UCSC URLs (`https://hgdownload.soe.ucsc.edu/gbdb/<asm>/...`). This is where to
find CpG-island / ClinVar / gene / repeat tracks for any UCSC assembly. Recipe:
`python3 -c "import json; d=json.load(open('configs/hg38.json')); ..."` to pull
a track's adapter, then verify the URL with `curl -sI`. Confirmed-good URLs:

- ClinVar CNVs (SVs):
  `https://hgdownload.soe.ucsc.edu/gbdb/hg38/bbi/clinvar/clinvarCnv.bb` (BigBed;
  autoSql fields incl. `clinSign`, `type`, `_varLen`, `_starCount`)
- CpG islands hg38: `https://jbrowse.org/ucsc/hg38/cpgIslandExt.bed.gz`
  (+`.csi`); `config_demo` also already has `cpgisland_ucsc_hg38` (UCSCAdapter)
- ce11 NCBI RefSeq: `https://jbrowse.org/ucsc/ce11/ncbiRefSeqCurated.gff.gz`
  (+`.csi`, index type CSI not TBI; chrom names chrI/chrII match the maf
  refnames)
- MANE Select hg38 (in `config_demo` as `MANE.GRCh38.v1.4.refseq`; or the BigBed
  at ftp.ncbi.nlm.nih.gov). Cleanest gene track for hg38 (one transcript/gene).
  Reusable spec consts in `specs/maf.ts`: `HG38_MANE_TRACK`, `CE11_GENE_TRACK`.

To add an out-of-config track, switch the spec from `lgvSession` to
`sessionSpec` with `sessionTracks: [...]`. If an over-dense track needs
thinning, use `jexlFiltersSetting: ["jexl:...", ...]` on its display snapshot
(ANDed).

## `hg002_haplotypes_location_markers`: the flat line is a location marker, and it is kept on purpose

Diagnosed but NOT fixed, because the fix asked for is the reverse of a rule that
exists for a reason. Review: "there is a weird very flat almost horizontal line
in the linearsyntenyview ribbons area. why is this? ideally things crossing the
view offscreen to the left and right so drastically are filtered out."

**What the mark is.** Not a ribbon edge and not a second statement of the same
homology: the chain file has exactly ONE chain over that window, and it is
answerable without the app —

```bash
curl -s .../hg002v1.2_to_other_haplotype.chain.gz | gunzip -c | awk '/^chain/ ...'
#   T chr8_MATERNAL:7,618,894-7,822,846 (203,952 bp)
#   Q chr8_PATERNAL:7,475,532-7,681,207 (205,675 bp)  strand +
```

204 kb against the figure's 70 kb frame, so both of that chain's corners are off
screen — 81 kb to the left and 53 kb to the right. The mark is one of
`emitGridMarkers`' ticks, a line from a point in the top view to the point it
maps to in the bottom one, and at that geometry it enters the band on one side
and leaves on the other, which is a near-horizontal line rather than a
near-vertical one.

**Why it is not culled.** `buildSyntenyGeometry` culls a tick by the HULL of its
two ends and says why in the source: testing the ends individually and dropping
the tick when both fail is the per-edge rule for a ribbon, and it deleted
exactly the ticks the two renderers were fixed to keep — on an inversion the
ends are pulled apart by up to the ribbon's whole horizontal travel, so a tick
well inside the frame at mid-height can have both endpoints outside the band.
The review is asking for that rule back.

**So it needs a third rule, not the old one.** The candidate: cull a tick whose
two ends are farther apart HORIZONTALLY than the view is wide. That separates
the two cases rather than trading them — an inversion drawn on screen travels at
most about a view width, while this chain travels about three, and a tick at a
shallower angle than any correspondence a reader could follow has nothing
anchoring it either. It is a change to every synteny figure's marker set, so it
wants its own review and its own before/after rather than riding a figure pass.

## A synteny window over chr8's pericentromere threw DataCloneError — FIXED

Kept because the diagnosis in it was WRONG in a way worth not repeating.

`chr8_MATERNAL:44,880,000-45,180,000` rendered the whole synteny band as an
error banner, on every run:

```
DataCloneError: Failed to execute 'postMessage' on 'DedicatedWorkerGlobalScope':
ArrayBuffer at index 19 is already detached.
```

`executeSyntenyFeaturesAndPositions` hand-maintained its transfer list (18+
`.buffer` entries, no dedup), so the obvious cause was a duplicate. This section
used to say **that was tried and is NOT it** — that wrapping the list in a `Set`
changed nothing, so something was holding a typed array across calls.

That was wrong. Replacing the hand list with `rpcResultWithArrayBuffers`, which
dedupes through a `Set` and now also walks one level into `instanceData`, fixes
it outright: the locus renders and `hg002_haplotypes_location_markers` moved
there. The earlier attempt presumably deduped only the flat half of the list and
left the nested `instanceData` entries alone, which is exactly where the
duplicate was.

**The lesson is the shape of the note, not the bug.** A handoff sentence saying
an obvious fix was tried and failed writes that fix off for everyone who reads
it afterwards; it cost this figure two review rounds. Say what was run, so the
next reader can tell a refuted hypothesis from a mis-run experiment.

The helper now names the field rather than an index, so the next one of these
reports `instanceData.alignmentLengths` instead of `index 19`.

## Known blockers (check `screenshot-review.json` for current status first)

- ~~`hgdownload.soe.ucsc.edu` is unreachable~~ — **resolved 2026-08-05**, and
  all 12 UCSC-dependent specs re-render against the real host. Kept because it
  will happen again and the symptom is misleading: an outage presents as three
  pending requests (`hg19.2bit`, `hg19.chromAlias.txt`, `cytoBand.txt.gz`) and
  then a ready-gate timeout, which reads like a data or CORS problem in the
  spec's own track. `curl -sI` the 2bit before believing the spec is broken.

  The specs that go dark with it: the three naming `hgdownload` directly
  (`pangenome/hprc_chm13_allele`, `embed_linear_genome_view/final`,
  `jbrowse-img/1`) and the eleven reaching it through a UCSC hub config, whose
  `TwoBitAdapter` points there (`genomes_synteny/launch_sequence`,
  `genomes_basics/turn_on_phylop`, `genomes_basics/phylop_tp53`,
  `genomes_basics/phylop_bases`, `ld/lct_pooled_vs_panel`, `ld/anopheles_2la`,
  `ld/lct_lactase`, `ld/lct_haploblock`, `popgen/fst_in2lt_2L`,
  `popgen/tajimad_cyp6g1`, `popgen/in2lt_per_sample`). The three
  `genomes_basics` ones go dark twice over: the hg38 hub's own 2bit, and the
  phyloP BigWig the hub's track points at.

  **`hgdownload2.soe.ucsc.edu` serves the same paths** (200 on the 2bit,
  chromAlias, cytoBand and the gbdb bigBeds, with ranges and
  `Access-Control-Allow-Origin: *`), so next outage the recipe is to add,
  temporarily, to the Chrome args in `generate-screenshots.ts`:

  ```
  '--host-resolver-rules=MAP hgdownload.soe.ucsc.edu <hgdownload2 IP>',
  '--ignore-certificate-errors',
  ```

  Host resolution rather than `page.setRequestInterception`, which disables the
  HTTP cache and stalled even local chunk requests until the run timed out.
  **Revert it before committing** — it is a workaround for an outage, not a
  setting, and the cert override is not something to leave in a figure pipeline.
  It is also faithful: `ld/lct_haploblock` was captured through the mirror, and
  re-rendering it against the real host once UCSC returned reproduced the
  committed PNG **byte for byte**, so the detour costs the figure nothing.

- `jbrowse-img/multisample_variants` — `jb2export`'s static SSR renders the
  per-sample genotype matrix **empty** for the 1000G phase3 callset (volvox's
  simpler path works); a real fix needs a `jb2export` matrix-render bug chase.
  Real pop data is also ref-dominant (grey) — the compelling view is
  `colorBy:'population'`, which needs a `samplesTsv:` jb2export CLI feature.
- `alignments_sort_by_base` — no sort mode sorts split reads to the bottom;
  current sort options are position/strand/basePair/tag only. Feature request,
  not a spec bug.
- `read_vs_ref_insertion`'s "drop protein-translation/showReverse/legend from
  launched read-vs-ref synteny by default" note is an app-default change in the
  synteny-launcher code, not a spec edit — the figure loads a saved remote
  session that already bakes those settings on.

## Pangenome graph figures: the plugin publish loop

The plugin lives in `~/src/jb2plugins/jbrowse-plugin-graphgenomeview`, and the
three `test_data/graphgenomeview/*.json` configs pin `esmUrl` to a
content-addressed prefix, so **a plugin change reaches no figure until it is
published**. The loop, all three steps or none:

```bash
cd ~/src/jb2plugins/jbrowse-plugin-graphgenomeview && pnpm betabuild   # prints the hash
sed -i 's|graphgenomeviewer/<old>/|graphgenomeviewer/<new>/|g' test_data/graphgenomeview/*.json
cd website && node scripts/generate-screenshots.ts --force --filter pangenome/
```

`betabuild` uploads to the public `s3://jbrowse.org/demos/graphgenomeviewer/`,
moves the unversioned entry point the published figures' live links resolve, and
invalidates CloudFront — **ask before running it.** Last published
`4bcef24fbaa7` (2026-08-14).

**A publish ships every plugin commit since the last one, not just yours**, so
the figures it moves are not the figures your change explains. That publish
carried a deletion-bow fix aimed at one anchored figure AND a bandage `<cmath>`
fix committed two weeks earlier, so a force-layout figure that the bow cap
cannot touch (`pangenome/rgfa_hover_sync`) moved as well — correctly, since it
was drawn against a bundle nobody was serving. Regenerate and push those rather
than reverting them to bytes rendered against an unpublished plugin; separate
the two in the commit message instead.

**And the typecheck gate will fail on files you did not touch** if the plugin's
`@jbrowse/mobx-state-tree` has drifted from the one `@jbrowse/core` resolves in
this checkout — 19 errors across seven files, all `[$type]`/assignability, none
of them yours. Compare the two installed versions before reading any of it as
breakage; the fix is a version bump in the plugin and it is types-only.

The gate is not optional: it is what catches a bundle importing a host global
that does not exist. Two of its failure modes read as real breakage and are not.
**A wave of `[$type]` / assignability errors across unrelated files is two
copies of MST**, from the plugin pinning a different
`@jbrowse/mobx-state-tree`/`mobx` than core — both are host globals at runtime,
so the bump is types-only. And a suite that fails to **load** is usually a
`vi.mock`/`jest.mock` of `@jbrowse/core/configuration` wholesale for one
`readConfObject` stub, which leaves anything transitively pulling a schema with
an undefined `ConfigurationSchema` at module-eval time; `importOriginal` fixes
it, and once gave back 58 tests that had silently not been running.

Regenerating the whole `pangenome/` set with `--force` after a publish sweeps in
churn the publish did not cause: the E. coli figures that mount no graph view at
all (`pav`, `depth`, `maf`, `pggb_synteny`) come back 4-10% different by raw
`compare -metric AE` and pixel-identical to the eye, which is GPU rasterization
wiggle. Diff each changed PNG against `HEAD` and revert the ones the change
cannot explain, or regenerate without `--force` and let the content-stable gate
decide.

A menu label is a published API for the specs: `hprc_node_menu` failed its regen
on `click target not found: text "Highlight this node"` the moment that item was
shortened. Grep `scripts/specs/*.ts` for the old text before renaming one, and
the tutorials too — they quote the labels in prose. The same rule cost the
`cancer_sv` derivative specs: the draw dialog gained `Replace current view` and
renamed its submit to `Draw in new view`, and both specs would have failed their
next regen either way.

**Iterating against a local plugin build** is `GRAPH_PLUGIN_LOCAL=1` (header of
`scripts/specs/graph.ts`) plus the plugin's `dist/` copied to
`test_data/graphgenomeview/_localdist/` **at the repo root** — _not_ under
`products/jbrowse-web/build/test_data/`, which is never consulted for it
(`createTestServer` routes `/test_data/*` to `jbrowseWebRoot`, and
`products/jbrowse-web/test_data` is a symlink to the root's). The tell that you
got this wrong is a render that reproduces the pre-fix behaviour bit-for-bit;
confirm by reading a marker off the model rather than by re-diffing images.
Switch back before committing figures — `pnpm check-live-configs` is the
tripwire. The `*_local.json` configs are **written by `graph.ts` from their
tracked siblings** on every run; don't reintroduce a hand-maintained copy, since
a gitignored copy of a tracked config drifts and nothing notices
(`hprc_local.json` predated two CFHR gene tracks, so under `GRAPH_PLUGIN_LOCAL`
those tracks were absent and a figure failed on annotation anchors resolving to
nothing — which reads as a regression in whatever you are testing).

**Scraping a `--filter` list from `name:` properties misses compose parts.** Six
part specs (`graph_context_none/_hop1`, `hprc_mhc_layout_*`, `local_subgraph_*`)
are positional arguments to a `part(...)` helper, so a scraped list skips them
and the parent silently recomposes from stale halves. Scrape every
`'pangenome/...'` string literal instead.

**Escape does not close a JBrowse cascade menu.** Measured live: three presses
with focus verifiably inside the list leave both levels and both modals
standing, while one backdrop click takes the whole cascade down.
`closeMenusFirst` used to be Escape plus a 300ms delay, so a stage asking for a
clean slate got the previous stage's menu, and `clickElement`'s covered-element
fallback dispatched on the node anyway — nothing errored, and a `::-p-text()`
match then resolved against two overlapping copies of the same menu. It now
clicks each menu-bearing modal's backdrop, loops, and **throws if a menu is
still open**; that was the whole of the two launch-out specs' one-in-six
flakiness.

**Which colour scheme a graph figure uses is settled, so it does not get
relitigated: a graph shown beside a linear view uses reference-position, a graph
shown alone or whose subject is rank keeps stable-rank.** The linear segments
lane in a paired figure carries the matching `referencePositionColor` over the
graph's own `loadedRegion`, through a named region constant so the lane's ramp
and the graph's cut cannot drift.

**A bubble's path count is combinatorial and can be absurd.**
`MinigraphBubbleAdapter` labels each bubble `<segments>, up to <paths> paths`;
one class II MHC bubble reports 510,105,601 and 406 of release 2's bubbles
saturate int32, while C4 and LPA show 98 and 584 and are informative. If it ever
needs suppressing, that is a **spec** edit with no plugin publish — the drawn
second line is `labels.description` on the canvas display and the feature
carries `segmentCount`, so
`labels: { description: "jexl:get(feature,'segmentCount') + ' segments'" }`
drops the count from the label while leaving it in the details popup.

**The anchored graph pane's aspect ratio is pinned** (row spacing is a fraction
of the reference span), so it is two rows tall whatever `viewportHeight` says.
Growing the viewport only adds page under it, and a three-line text pill
anchored below a node falls through the pane's border into the composite's
padding. Put long callouts on the force half.

## Choosing a pangenome locus from the data, not from a locus list

Both graphs ship an index that answers "where does this graph say the most", and
scoring it beats picking a gene and hoping. The scripts below were written
against local copies (`curl` the `.bed.gz` once; the HPRC bubbles file is 60
MB).

- **HPRC** (`jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.bubbles.bed.gz`): one
  row per bubble, `col4` = segments, `col5` = paths, `col7`/`col8` = min/max
  allele length. Rank by max allele length **and** cap segments — the top of the
  unfiltered list is centromeric and acrocentric hairballs (chr7 61.1 Mb, chr14
  105.5 Mb, KIR at 209 segments in one bubble), and a picture a reader cannot
  follow argues nothing. Scored candidates, all verified against RefSeq:

  | Locus       | Bubble                         | Segments / paths | Alleles       |
  | ----------- | ------------------------------ | ---------------- | ------------- |
  | LPA KIV-2   | `chr6:160,606,991-160,639,012` | 33 / 584         | 4.3 - 176 kb  |
  | CFHR3/CFHR1 | `chr1:196,753,088-196,837,771` | 28 / 721         | **0** - 88 kb |
  | AMY1        | `chr1:103,611,080-103,732,636` | 95 / many        | up to 317 kb  |
  | SMN1/SMN2   | `chr5:70,996,742-71,121,626`   | 27 / 1089        | up to 376 kb  |
  | FCGR2/3     | `chr1:161,514,686-161,596,343` | 20 / 257         | up to 84 kb   |
  | HP/HPR      | `chr16:72,049,451-72,076,250`  | 10 / 9           | up to 27 kb   |
  | CYP2D6      | `chr22:42,123,461-42,139,682`  | 3-14 / 2-13      | up to 27 kb   |

- **E. coli rGFA** (`ecoli_minigraph.segs.bed.gz` + `.links.bed.gz`): seed from
  the K12 rank-0 segments in a window, BFS the links, and group the rank>0
  segments into connected runs. The largest run is 148 kb at K12
  1,196,217-1,223,579; the densest 50 kb window is 2,030,000-2,080,000, where
  CFT073 contributes 116 kb at the `asnT`/`asnW`/`asnU`/`asnV` tRNA loci, the
  classic pathogenicity-island integration sites.

  **The seed window's width sets the launched locus's width**, because a launch
  frames a strain on the widest run of its segments in the subgraph. The 50 kb
  window opens CFT073 at 131 kb, holding both the yersiniabactin island and the
  pks island, at a scale where no gene carries a label. Narrowing the seed to
  the 8 kb `asnW`/`asnU`/`asnV` cluster (2,056,000-2,064,000) drops it to 65 kb,
  which is the pks island alone with `clbA`-`clbS` legible —
  `pangenome/rgfa_strain_launch`. Score a candidate on what the launch opens,
  not on what the seed contains.

### A deletion has nowhere to be drawn — do not spend a session on this again

CFHR3/CFHR1 above is the better _story_ (two named genes a fifth of haplotypes
do not carry, protective for AMD, a risk factor for aHUS). All three displays
were tried and none of them show it:

- **sample rows** — a deletion contributes no segment, so a carrier's row is
  empty and reads identically to a haplotype the window says nothing about;
- **anchored** — what it does contribute is an edge between two rank-0 segments,
  which the layout draws flat along the backbone row, underneath the backbone;
- **the 464-haplotype callset** — the bubble's own top-level record is alt for
  nearly every haplotype (the nested-bubble trap), so the lane washes solid blue
  and says "everyone differs here", not "these carry the deletion";
- **the allele inventory** — draws it correctly, as two grey bars. True, and not
  a figure.

`hprc_lpa_kiv2` is the same scan's best _expansion_, and expansions draw fine.
Making the deletion legible is a product change (a per-haplotype presence
channel), not a spec edit.

## Open plugin work

- **`paneHeight` is committed in the plugin and NOT PUBLISHED** (plugin commit
  `449bae4`, 2026-08-06). A `GraphGenomeView` session prop that replaces
  `MAX_CANVAS_HEIGHT` for that view, with the `MIN_CANVAS_HEIGHT` hover floor
  still winning; three tests in `model.test.ts`. It exists because the pane is
  as tall as the drawing's aspect ratio, which one very long node makes all arc:
  `pangenome/hprc_chm13_allele` pins the 600 px ceiling and spends most of it on
  a 142 kb loop (review: "we might want to consider ways to reduce height of the
  graph genome viewer"). Rendered against a local plugin build at
  `paneHeight: 420`: the drawing goes 24.6% to 16.1%, the boxed arc is still
  what the eye lands on, the chain stays legible, 180 px back. **After the next
  `betabuild`, the spec edit is one line** — `paneHeight: 420` on that figure's
  `GraphGenomeView` — and the figure's `viewportHeight` drops from 1495 to
  ~1315. Do not add it before the publish: the hosted bundle has no such prop.
- **`bubbleSpread: 'compress'` is not a height fix, and was tried on that same
  figure.** It does shorten the arc, and the result is worse: the subject node
  becomes a ~20 px box at the end of a long thin chain and the annotation box
  marking it becomes the most prominent thing in the pane. The setting is for a
  cut spanning kb and bp whose SHAPE is the subject, which is what its
  description says.

- **A launch's tracks are the assembly's annotation, and only for the single
  view.** `launchTracks` scans the session for FeatureTracks on the assembly
  being opened, which is what makes `pangenome/rgfa_strain_launch` possible (the
  per-strain launch used to land on `No tracks active`). The synteny launch
  deliberately does NOT do this — tried, and a gene track per panel costs ~160px
  of a row that is otherwise a ruler, so on five strains the annotation is most
  of the viewport and the ribbons are squeezed into the gaps. Don't re-propose
  it; `collapseEmptyRows` exists for the same reason.
- **Edges attach to the end the GFA link names.** `computeEdgeCurves` always
  leaves the from-node's last point for the to-node's first, but
  `L s2087 + s378 -` attaches to `s378`'s RIGHT end, so on a reverse-complement
  link the edge is drawn backwards past the segment it rejoins — the three
  crossed bubbles `bubbleCrossing.test.ts` still excludes. Proven by re-running
  that check with each edge attached to whichever ends face each other: 3
  crossings to 0. Needs the link strands carried onto `GraphEdge`
  (`fromAtHead = strand1 === canonical(from)`,
  `toAtTail = strand2 === canonical(to)`), each node's drawn orientation
  relative to the reference propagated through the run in `placeOffReference`,
  and `computeEdgeCurves` picking endpoints from those. Then tighten the test
  back to a bare `expect([])`.

  **One figure is waiting on this.** `pangenome/hprc_inversion` has no graph
  panel because a reverse-complement edge is all such a panel would draw; add
  one once this lands. That is the whole reason it is filed here rather than as
  a figure debt.
