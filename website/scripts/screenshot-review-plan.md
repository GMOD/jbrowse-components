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
- **The generator serves `products/jbrowse-web/build/`, and its `test_data/` is
  a COPY taken at build time, not the symlink the source tree has.** So an edit
  to `test_data/<anything>.json` is invisible to a regen until you rebuild (or
  `cp` the file into `build/test_data/`), and the failure looks nothing like a
  stale config: the track simply never opens, so a `readySelector` waiting on
  that display's `-done` testid times out and the spec reports "Waiting for
  selector failed". Cost an hour of chasing CORS and file formats on a new Hi-C
  track that worked in every direct probe. A `browser-tests/` driver run against
  `startServer()` does NOT reproduce it — that serves the source tree, symlink
  and all, which is exactly why the probe passed while the regen failed.
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
- **A legend that gains a section can outgrow its lane.** Adding one to the
  multi-sample variant display pushed it past the 120px `height` the
  `pangenome/maf` spec gave the track, and the last swatch was sliced in half by
  the track boundary — invisible in the run's own reports, since the clipping is
  inside the display rather than below the fold. Long item labels ellipsize
  rather than wrap, so the tail of a label is lost silently too. Look at the
  legend after a change that adds to it.
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
- **A `compose` has no annotation layer.** `ComposeSpec` extends
  `BaseSpecFields`, which carries no `annotations`, and the parts are separate
  captures `+append`ed afterwards — so nothing can draw across the seam. An
  arrow from one half to the other is not available; number the two halves'
  anchors instead, as `pangenome/hprc_mhc_anchored` does with `circle` badges.
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

## Known blockers (check `screenshot-review.json` for current status first)

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
`5e1c0d4f42b5` (2026-07-30).

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
