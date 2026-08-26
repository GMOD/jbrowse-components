---
name: r-export-handoff
description: The state of the LGV "Export R script" exporter after its second pass — what was fixed (wiggle coordinates, sort-by-base under --spec, gene filters, discontiguous Hi-C), the unsupported-track skip, and the codegen bugs the gallery renders found.
---

# R export — handoff

All of this is committed. The branch was rebased onto main long afterwards — see
the `feat(r-export): export a linear view as a reproducible R script` commit
message for what 4834 commits of drift forced, and note that `bam_mismatches`
has since grown a reference fallback for reads with no MD tag, which the
descriptions below of it as "reference-free" predate.

## Done in the first pass

1. **Wiggle xyplot gaps** — a coordinate bug, not a rendering one. `read_bigwig`
   returned rtracklayer's 1-based inclusive coords as-is while every other reader
   converts to 0-based half-open, so adjacent bins never touched and the device
   antialiased a 1bp hole into scattered full-height white seams. `read_bigwig.R`
   now does `df$start <- df$start - 1L`. Verified clean at 100/110/125/150 dpi.
2. **"Sort by base" did nothing** — two causes. `applyDisplayOpts` called
   `view.showTrack(...)`, and `showTrackGeneric` returns an already-open track
   untouched, so with `--spec` every `--track id opt:value` was a silent no-op;
   it now hides and re-opens, then `moveTrack`s back. And the source spec starts
   deliberately unsorted, so `rexport.ts` passes the display state the click
   produces (`sortedBy.pos` 0-based, not `sort:base`, which anchors on the view
   centre).
3. **Gene tracks drew features JBrowse filters out** — new `feature_filter.R`
   plus `translateFeatureFilters()`, reproducing `jexlFilters` +
   "Show only genes". Untranslatable jexl is emitted as a `NOT TRANSLATED`
   comment rather than dropped.
4. **Discontiguous Hi-C lost the cross-region contacts** — `hic_triangle.R`
   replaced by `hic_regions.R`, which reads every region PAIR (i ≤ j) like
   `HicAdapter` does, so the block between two windows is drawn.
5. Bugs fixed on the way: `bam_modifications` read through `BamFile(uri)` (no
   sibling index over http, so every remote modBAM died); the alignments panel's
   unguarded `reads$.region <- ri` killed a figure on an empty region;
   `read_gff` recycled a bare `NA_character_`; `parseSpec` dropped a spec's
   `sessionTracks`; `safeVarName` guarded a leading digit with `_`, which R
   rejects at parse time just as it rejects the digit.

## Done in this pass

**Unsupported tracks are skipped, not fatal** (`products/jbrowse-img/src/unsupportedTracks.ts`).
jb2export bundles a fixed plugin set; a `--config` may name more. The demo
config's `cpgisland_ucsc_hg38` is a `UCSCAdapter`, showTrackGeneric's validation
threw, the error went to `notifyError`, and renderRegion promotes the first error
snackbar to a fatal — so one unloadable lane killed every methylation figure. Now
a track whose track type or adapter type (at any depth: `subadapters`,
`sequenceAdapter`) no plugin registers is skipped with a warning, at each point
that would open one: the `--spec` view init, `--track`/`openTracks`, and the
circular view's own filter. The warning fires when a track is actually left out,
not at the config scan — a big config has five unopenable tracks nobody asked for.

**The emitted script names what it left out.** `collectFragments` used to drop a
display with no `exportRCode` (and one that declined the track) in silence.
Both now land in a comment block under the header.

**MM-tag figure added** — `rexport/modifications`, from
`methylation/hg002_snrpn_ungrouped`. Deliberately not from the grouped or the
combined figure: `groupBy` has no R translation, and the modkit lanes are
MultiQuantitativeTracks over a BedTabix bedMethyl, which the BigWig-only
multi-wiggle exporter contributes nothing for. Both would have made the R twin
quietly contradict its source.

**Structural-variant section added to the gallery** — `sv_clipping`,
`sv_fusion`, `sv_multisample`, and the CRAM ones below.

### Four more real codegen bugs, all found by rendering the SV figures

- **BigBed feature tracks emitted `path <- ""`.** `BigBedAdapter`'s
  `preProcessSnapshot` rewrites the `uri` shorthand into `bigBedLocation`, which
  the display's export never read — so every UCSC-hub track died in R on "path
  cannot be an empty string". `read_bed` also grew a `format = "bigBed"` mode:
  rtracklayer's plain `import(format="bed")` cannot open a `.bb`, and a whole-record
  BigBed import fails on `bigBed 9 +` (an itemRgb "0,0,200" read as a signed
  integer aborts the import), so it reads through `BigBedSelection` naming only
  the fields the panel draws.
- **CRAM decoding died on a reference name mismatch.** Given `-T`, samtools uses
  ONLY that fasta — and a JBrowse assembly routinely pairs a no-prefix fasta with
  refname aliases, so `chr9` was "not present". `cram_to_bam` now retries unaided
  with the ENA md5 service as `REF_PATH` (a published CRAM's own UR header is
  usually the producer's dead cluster path, and modern htslib does not fall back
  on its own). That is what unblocked `sv_foldback` / `sv_tumour_normal`.
- **`ggsave()` refuses a dimension over 50 inches**, and the figure height is the
  unbounded sum of the panels' weights — a multi-wiggle weights itself by source
  count, so the 2504-sample copy-number cohort asked for 5008 inches and the
  script died at its very last line, after every read. Clamped.
- **A single-row feature panel drew its gene as a solid block.** A glyph is a
  fixed fraction of one row, so a 1-row panel had a y-range of 0.7 and the CDS
  rect filled it. `expand_limits(y = 4)` floors the scale; a no-op past 4 rows.

**A multi-wiggle panel is sized by the display's height, not its source count.**
This display is always fit-to-height in the browser
(`effectiveRowHeight = getRowHeight(height, numSources)`), so a 104-sample cohort
in a 420px lane overplots into 4px rows; the export instead gave every source a
row of its own, which is how the 2504-sample cohort came to ask for 5008 inches.
Density mode also stops faceting: each density facet is a bare 0..1 strip, so the
facet machinery buys nothing and cannot scale — the sources now stack on one
continuous y (`match(source, <names>)`, which keeps the display's own row order
where a ggplot factor would sort alphabetically), and the per-source axis labels
drop out once the figure's own row pitch falls under 10px.

**The gallery publishes the exact `jb2export` command behind each figure**, in a
`REXPORT_COMMANDS` marker block regenerated by `pnpm autogen`. The sweep and the
docs both go through `rExportInvocation()` (`website/scripts/rexportCommand.ts`)
so a published command cannot drift from the one that drew the picture — a wrong
one would still run and still draw something. The shell rendering is split into
`rexportCommandText.ts` because the spec registry reaches puppeteer and Jest's
CJS transform cannot load it. `r_export.md` gained a "Headless, from the command
line" section.

**Labels are decimated like JBrowse's `fitWidth`** (`label_room.R`). The panel
labelled every top-level feature, so a dense window came out as a wall of
overlapping text where the browser draws bare glyphs (1009 DGV records → 215
labels kept). The panel centres each name on its feature, so the rule is
centre-to-centre against combined half-widths, not "is the box wide enough": long
features stacked across one window have near-identical centres however wide each
box is.

## Done in this pass (modification coverage)

**The coverage panel now carries the MM/ML counts**, which is most of what a
modBAM figure is for and which it was dropping in silence: the lane showed grey
depth and mismatch bars while the browser's band shows stacked per-column
methylation. Three new helpers, all reference-free like the rest:
`read_base_counts` (per-strand read bases at the modified columns — the
modifiable/detectable denominator), `mod_coverage` (IGV's
`BaseModificationCoverageRenderer` height, `(modifiable/depth) * (calls/detectable)`,
stacked in JBrowse's fixed `MOD_TYPE_RANK` order with the mean call likelihood as
the segment alpha) and `mod_simplex_types`.

- **Simplex is the whole game.** An ONT modBAM's MM groups are `C+m` with no `-`
  partner, so only the examined strand was basecalled; dividing by every read
  carrying the base halves every bar. `detectSimplexModifications` runs over the
  whole dataset, so the R side does too — `bam_modifications` hangs the
  `<sign><type>` pairs of every group it *parsed* on its result as an
  `mm_strands` attribute (an attribute, not a column, because it has to survive
  the `min_prob` filter that drops those rows), and the panel pools them across
  regions before calling `mod_coverage`. Any row subset drops attributes, so the
  generated code reads it before `keep_rows`.
- `bam_modifications` also gained a `base` column — the MM group's target base as
  written in the tag, never complemented, matching `getModPositions`. That is
  what the denominator keys off (a 5mC sits on a C, and the same cytosine from
  the other strand reads as a G, so both count).
- **The band's mismatch bars grey out** while mods are drawn, which is what
  JBrowse does (`buildCigarOpDrawColors` swaps every base color for
  `mutedSnpBase`) so the mod colors are the only color in the panel. `#555555`,
  not JBrowse's `#888`, because this panel's coverage grey is *already* `#888888`
  and the bars would vanish into it.
- `unreproduced` now also rides on the coverage fragment, not just the pileup: a
  display can be coverage-only, and the new modification notes are about which
  calls both panels count. `assembleRScript` dedups.

Checked against two independent oracles in `exportRRun.test.ts` (R-gated):
`mod_coverage` reproduces `computeModificationCoverage` exactly on a hand-built
frame (simplex + duplex bins in one column, all three stack ranks, alpha), and
`read_base_counts` is `all.equal` to `Rsamtools::pileup()` at the 92 modified
columns of `methylation_clip.bam`.

### Still missing from the modification family

- **`fillUnmarked` is not translated** and the gallery's `rexport/modifications`
  figure uses it (`methylation/hg002_snrpn_ungrouped` sets
  `modifications: {fillUnmarked: true}`). JBrowse then ignores the threshold and
  paints the most-likely state at *every* CpG in context — including the blue
  unmodified ones, which stack over the red in the coverage bar. The R twin draws
  only the above-threshold calls. It now says so in the script header rather than
  contradicting its source, but the honest fix is `getMethBins`' context walk +
  implicit-unmodified fill, which changes the pileup overlay too.
- `twoColor`, `bisulfite` and the per-type filter are noted, not drawn, for the
  same reason.
- The gallery PNG still shows the old coverage lane — the figures are not
  regenerated on this machine (`NOT IN THE FIGURE STORE`).

## Still open

- ~~**`qc/callsets_at_smn` is deliberately not a gallery figure**~~ — closed,
  and not by doing the work it asks for. The height fix already exists
  (`heightWeightExpr` weights a feature panel by the row count R finds at draw
  time, so 61 rows ask for ~30 inches), and main has since DELETED the source
  spec on review. The comment in `website/scripts/specs/rexport.ts` has both
  halves. Nothing to do here.
- **`geneGlyphMode` is not translated.** `cancer_sv/foldback_reconstruction` sets
  `longestCoding`; the R panel draws every transcript. Same family as the above.
- **`rexport/genes_sarscov2` is a weak figure** — the caption promises ORF1ab's
  mature peptide products and the panel shows one bar. Predates this pass.
- ~~`pnpm figures:push` and commit `figures.lock`~~ — done. All 19
  `img/rexport/*` figures resolve in the store; verified against every hash in
  `figures.lock` after the rebase onto main, since a lock line whose bytes were
  never pushed breaks `figures:pull` for every fresh checkout and for CI.

## Checks

- `pnpm test plugins/canvas/src/LinearBasicDisplay plugins/hic/src
  products/jbrowse-img/src plugins/linear-genome-view/src/LinearGenomeView`
- `pnpm typecheck` clean; `pnpm lint` clean for these files (the remaining errors
  are in `website/scripts/review-screenshots-web.ts`, another agent's).
- **`pnpm gen:rhelpers` and `pnpm build:esm` before generating figures** —
  jb2export runs against the built `esm/`, not `src/`.
