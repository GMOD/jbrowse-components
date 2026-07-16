# R script export — handoff

"Export R script" (LGV view menu) downloads a self-contained `.R` that redraws
the current view from source in pure **`rtracklayer` + base `ggplot2`** (no
bespoke package). This is the working handoff for extending it; the *design
record* lives elsewhere and is not duplicated here:

- **User-facing guide:** `website/docs/user_guides/r_export.md`
- **Per-track design notes + rendered examples:**
  `website/static/img/rexport/README.md` (the gallery — one section per track
  type, each figure genuine `assembleRScript` output).
- **The code** is the source of truth for behavior.

## Non-negotiable design decisions (do not reverse without asking)

- **No bespoke package.** An earlier `ggjbrowse` attempt was rejected: wrapping
  logic in a package makes the emitted script a black box a user (or assistant)
  can't tweak with ordinary ggplot2 knowledge. Everything is emitted as small,
  visible inline helper functions instead.
- **Not pixel-perfect, by design.** Idiomatic R that shows the same data beats
  matching JBrowse's exact rendering. Row packing uses `IRanges::disjointBins`,
  colors approximate the canvas palette, etc.
- **A TS→R transpiler was considered and rejected** (non-idiomatic machine R,
  fights hackability). Note the `rhelpers/*.R` → `rHelpers.generated.ts` step is
  **not** that: it's a verbatim bundle of hand-written R (so the browser bundle
  can carry it), not a translation. The R a user reads is still the R a human
  wrote. Don't "extend" it into a transpiler.

## Architecture

- **`plugins/linear-genome-view/src/LinearGenomeView/rhelpers/*.R`** — the R
  helper library, one **real `.R` file per helper**, named for the helper it
  defines (`read_bam.R` defines `read_bam`). Edit these, then run
  **`pnpm gen:rhelpers`** to regenerate `rHelpers.generated.ts` (the `HELPERS`
  table `exportR.ts` imports). **Never hand-edit `rHelpers.generated.ts`** — CI
  runs `pnpm gen:rhelpers --check` and fails on a stale/edited artifact, the
  same convention as `.slang` → `pnpm gen:shaders`. Because they're real R:
  no TS-template escaping (write `"\\.cram$"`, not `"\\\\.cram$"`), and
  `rhelpers/rhelpers.test.ts` has R `parse()` every file (catching a syntax
  error without running a figure) and `sys.source()` the library to prove each
  file defines exactly its own helper.
- `plugins/linear-genome-view/src/LinearGenomeView/exportR.ts`
  - Only helpers a fragment references are emitted (deduped, alphabetical).
    The `REGION_HELPERS` (region_layout / read_regions / region_scale /
    region_dividers / region_xlim / region_ruler / region_title) are emitted
    into **every** script — they are core infrastructure, not per-fragment
    opt-in.
  - `HELPER_DEPS` + `resolveHelpers`: helper→helper calls. A fragment declares
    only what **its own plot code** calls; the transitive closure is added at
    assemble time (a caller of `read_bam` doesn't list `pair_orientation`).
    A helper that gains a call to another needs the edge added **here, and only
    here** — `exportR.test.ts` scans the R bodies and fails on a missing edge.
  - `assembleRScript(regions, fragments)` (re-exported; accepts one region or an
    array): pure codegen — emits `library()`s, deduped helper defs, per-track
    setup, `plot_regions()`, the `plot_region()` shorthand, the current-view call
    (all visible regions), the batch-BED-loop comment. Also handles refname
    aliases (`resolve_chrom`) when a fragment carries a `refNameMap`.
  - `getViewRegions(model)`: the visible regions, each collapsed to one span,
    grouped by `displayedRegionIndex` (a multi-region/discontiguous view yields
    several; consecutive tiles of one region merge).
  - `collectFragments` iterates every track's `display.exportRCode` and attaches
    each track's canonical→file-name `refNameMap`.
- `plugins/linear-genome-view/src/LinearGenomeView/rexportShared.ts`: shared
  codegen primitives — `rStr` (R string literal), `rName` (backtick name),
  `safeVarName`, `firstUri`, `getTrackRMeta` (the per-display preamble reading
  trackId/trackName/adapter).
- `RTrackFragment` (`types.ts`, re-exported): one stacked panel =
  `{ trackId, trackName, packages, helpers, setup, plotVariable, plotExpr,
  heightWeight?, cumulativeAxis?, refNameMap? }`. `plotExpr` references
  `regions` (a data.frame with `chrom`/`start`/`end` + the cumulative-layout
  columns `offset`/`width`/`cum_start`/`cum_end`/`gap`) from inside
  `plot_regions()`. Set `cumulativeAxis: false` for a panel not indexed by
  genomic bp (the site-indexed variant matrix) so it is not decorated with the
  shared axis.
- Per-display `plugins/*/src/*Display/exportRCode.ts`: a pure `xFragment(params)`
  builder (what the unit tests hit) + `exportRCode(self)` reading the model. The
  model wires an `exportRCode(): RTrackFragment` method with an **explicit return
  type** (breaks the self-referential MST model-type cycle, same as `renderSvg`).

## Multi-region (cumulative-bp axis)

A multi-region LGV exports as one figure with the regions concatenated
left-to-right on a single **cumulative-bp** x-axis — how JBrowse lays them out
internally (continuous `offsetPx` + inter-region padding). This is
`cumulativeBp`, not `facet_grid`: it was chosen over faceting because facets are
separate panels and **cannot draw a geom between two of them**, so cross-region
read connectors (a mate/segment split across regions) are only possible on one
continuous axis.

- **`region_layout(regions)`** computes each region's `offset` on the cumulative
  axis (region 1 anchored at its own genomic start, so a lone region keeps
  native coordinates and the single-region output is essentially unchanged).
- **`read_regions(reader, regions, coords, clip = TRUE)`** is the seam every
  simple track uses: it calls `reader(chrom,start,end)` per region, **clips**
  each feature to its region (JBrowse cuts features at the edge) and **shifts**
  the named coordinate columns onto the cumulative axis, tagging each row with
  `.region`. Readers stay genomic; this is the *only* place genomic→cumulative
  happens. `clip = FALSE` shifts without clipping (Hi-C diamond vertices).
- The shared x-scale (`region_scale`, per-region genomic tick labels),
  inter-region `region_dividers`, coord range (`region_xlim`) and the top
  `region_ruler` are added centrally by `plot_regions()` — each cumulative panel
  gets the scale/dividers/coord appended in its assignment; the ruler is stacked
  on top when >1 region.
- **Line-like geoms must group by `.region`** (`geom_step`/`geom_line`/
  `geom_area`, and `interaction(source, .region)` for multi-wiggle, coverage
  `geom_area(group = .region)`) so a line never connects across the gap.
- **Alignments** can't use `read_regions` directly: its overlays (mismatches,
  indels, clips, mods, quality) join to a pileup row by `read_index`, so it runs
  a per-region `for` loop that renumbers each region's `read_index` into its
  position in the **combined** `reads` frame, then lays out over the combined
  reads. That gives cross-region-consistent rows and — in chain mode
  (`link_reads`) — connectors spanning a mate/segment split across regions (the
  headline multi-region feature). The center-line sort position is mapped onto
  the cumulative axis before `sorted_pileup_layout`.
- **Variant matrix** is site-indexed, not bp: it concatenates the passing sites
  of every region along the column axis and sets `cumulativeAxis: false`.

## Adding a track type (recipe)

1. Add any reader/layout helper as `rhelpers/<name>.R` (defining `<name>`), then
   `pnpm gen:rhelpers`. A reader takes `(uri, chrom, start, end)` and returns a
   genomic-coordinate data.frame — never cumulative coords; `read_regions`
   handles the shift. If the helper calls another helper, add the edge to
   `HELPER_DEPS`; callers never list transitive helpers.
2. In the display plugin add `exportRCode.ts`: a pure `xFragment(params)` builder
   + `exportRCode(self)` reading `getTrackRMeta(self)`'s adapter uri + resolved
   styling. Return `RTrackFragment` (or `RTrackFragment[]`). For a genomic-bp
   track, wrap the reader in `read_regions(function(chrom, start, end) reader(...),
   regions, c("<coord cols>"))` and let `plot_regions()` add the axis — don't
   emit `bp_axis()`/`coord_cartesian()` yourself, and group any line/area geom by
   `.region`.
3. Wire an `exportRCode(): RTrackFragment` model method (**explicit return type
   required**). Import `RTrackFragment` from `@jbrowse/plugin-linear-genome-view`.
4. Add `exportRCode.test.ts` (codegen string checks) + `exportRRun.test.ts` (runs
   the real `assembleRScript` output through `Rscript`, `test.skip` when R deps
   absent). Test a multi-region call (`assembleRScript([r1, r2], ...)`) too.

## What's shipped (pointers, not detail)

wiggle, multi-wiggle, alignments (BAM/CRAM), genes (GFF3 + BED), variants,
multi-sample variant matrix + rows, Hi-C, GWAS. Alignments is the richest: SNP
coverage (`bam_coverage` carves deletions from depth via `grglist(drop.D.ranges)`
+ `interbase_indicators` breakpoint triangles, both matching JBrowse), color-by
schemes (insert-size uses JBrowse's robust median±3·1.4826·MAD band over primary
proper-pairs, not mean±sd), MD-tag mismatches with the depth-dependent
low-frequency fade (`mismatch_fade_alpha`, zoom-gated on `bpPerPx>1` like
`frequencyFade` — the coverage panel shows every fraction, the fade is on the
pileup ticks), MM/ML modifications, per-base quality, soft/hard clips, CIGAR
indels, linked reads, center-line **sort** (**every** JBrowse sort type:
position/strand/base/insertion/softclip/hardclip/tag), and
**Filter by** (flags/read-name/tags) — applied to the **coverage panel as well as
the pileup**, because JBrowse filters in the *adapter*
(`BamAdapter.getFeatures`), so one filtered read stream feeds every consumer.
`read_filter`'s `keep` is a logical in `readGAlignments` order, so it subsets
`bam_coverage(uri, chrom, start, end, keep)` and (via `keep_rows`) the coverage
panel's mismatch/indel/clip overlays; the pileup's fade denominator reads the
same filtered depth. `keep_rows` is **only** for the coverage panel — dropping
rows from a pileup overlay would desync the `read_index` join (see Gotchas).
See the gallery README section per type.

Cross-implementation equivalence tests run the *actual* JS and the R helpers over
identical synthetic data and assert read-for-read agreement — the strongest guard
that the two implementations stay semantically aligned. `exportRRun.test.ts`
covers `getInsertSizeStats`/`classifyInsertSize` and
`computeMismatchFrequencies`/`applyDepthDependentThreshold`;
`exportRSortEquivalence.test.ts` drives JBrowse's real `computeSortedLayout`
(via the shared `sortLayout.fixture.ts`) against the emitted
`sorted_pileup_layout` for base/insertion/softclip/tag. Reads there all span the
sort column so each takes its own row and the row assignment *is* the sort
order — which also sidesteps the one intended layout difference (JBrowse's
`placeRect` leaves a 2bp gap between reads sharing a row; the R helper packs on
strict overlap).

**The sort rules are subtle — mirror `sortLayout.ts`, don't reinvent:**
`sortByMapWithUnknownsLast` puts reads *carrying* the sorted-on feature first and
reads without it last **for base/interbase but not for `tag`** (a missing tag is
0/`""` and sorts among the rest). Interbase sorts key on an **exact column
match** (`== sort_pos`, longest first, longest event per read), unlike the base
sort's deletion **span** test. The tag sort goes numeric only when **every**
value parses (one numeric-looking value must not put a column of string tags into
NaN comparisons). Every R branch returns an ascending numeric key with `Inf` =
"no key", so a descending criterion is keyed negative rather than sorted
separately.

## Next steps (prioritized)

- **Bisulfite / 5mC-5hmC methylation.** `bam_modifications` handles MM/ML modBAM
  but not reference-dependent bisulfite C→T (no MM tag), the 5mC/5hmC
  winner-take-all collapse, or `shownModifications`/`hiddenModifications` per-type
  filtering (all types currently render).
- **Gene-label declutter** (avoid a `ggrepel` dep; maybe only label top-level).
- **Phased-HP PS hue.** Phased genotype export flattens phase-set (`PS`) coloring
  to the flat mfa/secondary color instead of a per-phase-set hue.
- **Multi-wiggle pos/neg bicolor split** isn't reproduced (signed data colors by
  source only); group/cluster tree order isn't reflected.

## Verification (the real accuracy technique)

`Rscript` is installed in this env with ggplot2, patchwork, rtracklayer,
GenomicRanges, GenomicAlignments, Rsamtools, strawr; `samtools` is on `PATH`
(CRAM only). The `exportRRun.test.ts` files execute the *actual* generated script
against `test_data/volvox/*` — this catches real bugs codegen string checks miss.
Pattern: build a script with `assembleRScript`, run it, assert the figure exists,
then a second `probe.R` (helpers split on `# Data sources`) that calls one helper
and asserts a known biological fact (e.g. the ctgA:1693 C-SNP, the RG:Z:4 200-read
split in `volvox-rg.bam`).

**Regenerating a gallery figure:** a throwaway `*.gen.test.ts` (see git history
for the sort figure) that builds the script and runs it to
`website/static/img/rexport/<name>.png`, then delete the test.

## Gotchas

- **`read_index` join is index-based.** Every alignment overlay (`bam_mismatches`,
  `bam_modifications`, `bam_clips`, `bam_indels`, `bam_base_quality`) emits a
  `read_index` = position in `readGAlignments` order, joined via
  `reads$row[x$read_index]`. **Do not drop rows from `reads`** — it desyncs the
  join. `read_filter` marks a `keep` column instead; the layout leaves filtered
  reads at an **NA row** and ggplot omits them (bodies and overlays vanish for
  free). Any new per-read filtering must follow this. **Multi-region:** each
  region's `read_index` is 1-based within *that* region's read, so the alignments
  loop adds a running `racc` (reads seen so far) to every region's overlay
  `read_index` before concatenation — after combining, `read_index` is the row in
  the combined `reads` frame and the join is unchanged.
- **Overlay rows outside a region are dropped, not clipped** (the alignments
  `reg()` helper filters `col >= start & col < end`). Reads' `start`/`end` are
  *clipped* (`pmin(pmax(...))`) so a read straddling the edge draws cut at the
  boundary; a mismatch/indel/clip *position* outside the region just isn't drawn
  (coord clipping only guards the whole-figure edges, not internal dividers).
- **GRanges has no `[[`** — read metadata columns via `mcols(g)[[nm]]`.
- **Model-type cycle** — annotate `exportRCode()`'s return type explicitly.
- **CRAM** — Rsamtools can't read CRAM (deliberate upstream gap, no dep bump
  fixes it). Each panel decodes the region to a temp BAM via `cram_to_bam`
  (samtools), which restores MD so `bam_mismatches` still works.
- **Shared worktree** — multiple agents edit these files. Stage explicit
  pathspecs when committing; never `git add -A`. (The former `agent-docs/
  R_EXPORT.md` + `R_EXPORT_ADVANCED.md` were deleted by another agent's commit
  `0be12eb49d`; this doc replaces them, lean and next-steps-focused.)

Relates to the memory `[[project-r-export-alignments-sort]]`.
