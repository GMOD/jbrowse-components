# R script export

"Export R script" (LGV view menu) downloads a self-contained `.R` file that
reproduces the current view. Committed in `04c4cd49f9`.

## Product shape (what the emitted script is)

Pure **`rtracklayer` + base `ggplot2`** — no bespoke R package. The script is a
loopable `plot_region(chrom, start, end)` function that reads each track from
source and stacks one ggplot panel per track with patchwork; the current view
is one call and a commented BED loop shows batch use. `start`/`end` are 0-based
half-open (BED-style).

**Why no package** (decided with the user, do not reverse without asking):
wrapping the logic in a package (an earlier `ggjbrowse` attempt) makes the
emitted code a black box — a user, or an assistant editing the output, can't
tweak it with ordinary ggplot2 knowledge. Everything the script needs is emitted
as small **visible inline helper functions** instead. Also: **not pixel-perfect**
by design — idiomatic R that shows the same data beats matching JBrowse's exact
rendering. A TS→R transpiler was considered and rejected (emits non-idiomatic
machine R, fights the hackability goal, and its only win — perfect layout sync —
is moot since we're not pixel-perfect).

## Architecture

- `plugins/linear-genome-view/src/LinearGenomeView/exportR.ts`
  - `assembleRScript(region, fragments)` (exported from the plugin index) —
    the pure codegen entry: emits `library()`s, the deduped inline helper defs,
    per-track file-path vars, `plot_region()`, the current-view call, and the
    batch-loop comment. `exportR(model)` is the thin download wrapper.
  - `HELPERS` table: inline R helper defs (`read_bigwig`, `read_bam`,
    `bam_coverage`, `bam_mismatches`, `base_colors`, `read_fill_colors`,
    `snp_freq_threshold`, `pileup_layout`, `read_gff`, `gene_layout`,
    `bp_axis`, …); only the ones a fragment references are emitted.
    `bam_mismatches` walks CIGAR + the MD tag to emit reference-free per-read
    SNP ticks; `base_colors` is the A/C/G/T/N palette, used with
    `scale_fill_identity` so read bodies and mismatch ticks share one fill scale
    (no `ggnewscale`). `read_fill_colors` bakes the color-by scheme
    (normal/strand/mappingQuality/insertSize) as literal read-body hex — also
    scale_fill_identity, so it composes with the same fill scale as the ticks;
    `snp_freq_threshold` is JBrowse's depth-dependent SNP-calling cutoff (80%
    below 10x easing to 30% at ≥30x) the SNP-coverage panel applies by default.
- `RTrackFragment` (LGV `types.ts`, re-exported from the plugin): one stacked
  panel = `{ packages, helpers, setup, plotVariable, plotExpr, heightWeight }`.
  `plotExpr` references `chrom`/`start`/`end` from inside `plot_region()`.
- Per-display `exportRCode(self)` model method returns a fragment (or
  `RTrackFragment[]` for multi-panel tracks); the view iterates every track's
  `display.exportRCode` and `collectFragments` flattens arrays. Each display
  also has a pure `*Fragment(params)` builder that is what the unit tests hit.

## Track types done

| Track | Display | R approach |
| --- | --- | --- |
| wiggle | `LinearWiggleDisplay` | `geom_rect` (solid), `geom_step` (line), `scale_fill_manual` on `score >= pivot` (bicolor), viridis strip (density) |
| multi-wiggle | `MultiLinearWiggleDisplay` | `read_multibigwig` long data.frame (`source` factor); overlay = one panel colored by source, multi-row = `facet_grid(rows = vars(source))`, density = per-source viridis strip; geom picked from `renderingType` (area/step/line/point) |
| alignments BAM/CRAM | `LinearAlignmentsDisplay` | SNP-coverage panel (grey `geom_area` total + per-base mismatch counts stacked via `geom_col`, thresholded by `snp_freq_threshold` unless `showLowFreqMismatches`) + color-by `geom_rect` pileup (`read_fill_colors` bakes normal/strand/mappingQuality/insertSize per `self.colorBy.type`) with per-base mismatch ticks; mismatches from the MD tag via `bam_mismatches` (reference-free, like JBrowse's `MismatchParser`), colored by `base_colors` with `scale_fill_identity`; rows from `IRanges::disjointBins` (not JBrowse's `placeRect`) |
| genes GFF3/BED | `LinearBasicDisplay` | `geom_segment` bodies + `geom_rect` leaf exons/CDS; `gene_layout` groups by top-level parent then `disjointBins` |
| variants VCF | `LinearVariantDisplay` | `read_vcf` = Rsamtools `scanTabix` (NO VariantAnnotation) → classify SNV/INS/DEL/MNV/SV; `geom_segment` span + `geom_point` lollipop head colored by type; `vcf_layout` `disjointBins` row-pack |
| multi-sample variant matrix | `LinearMultiSampleVariantMatrixDisplay` | `read_vcf_gt` = Rsamtools `scanTabix` genotype reader (header sample names + FORMAT GT locator, NO VariantAnnotation) → per-cell ref/het/hom/other/nocall by dosage of the site's most-frequent ALT; `geom_tile` heatmap, columns by site index, samples ordered by `hclust`; hand-rolled `dendro_segments` dendrogram as a left `patchwork` panel; MAF/missingness floors emitted as editable vars |
| multi-sample variant rows | `LinearMultiSampleVariantDisplay` | same `read_vcf_gt` reader + ref/het/hom/other/nocall classing, but one `geom_rect` row per sample at honest genomic position (site `start`/`end`, single-base sites floored to a min width); samples in VCF order (no clustering); shares `coord_cartesian(xlim=)` so it aligns with 1-D genomic tracks |
| Hi-C `.hic` | `LinearHicDisplay` | `hic_triangle` = `strawr::straw` upper triangle rotated 45° into diamond `geom_polygon`s (JBrowse's triangular view) over a genomic x-axis, so it stacks with 1-D tracks; log `scale_fill_viridis_c`; `binsize`/`norm` emitted as editable script vars (default = display's `effectiveResolution`/`activeNormalization`) |
| GWAS BED | `LinearManhattanDisplay` | `read_gwas` = Rsamtools `scanTabix` over the tabix'd BED; score column looked up by NAME in the header, position column from the tabix index (`headerTabix()$indexColumns`), so any BED layout works (NO GWAS package); `geom_point` at genomic pos vs -log10(p) + 5e-8 genome-wide `geom_hline`; native `scoreTransform` (`negLog10`/`negLog10FromLn`) reproduced in the y aesthetic; LD (r²) coloring not reproduced (single-color) |

Every panel ends with `coord_cartesian(xlim = c(start, end))` so stacked tracks
share one x-range (features/reads overhang the fetch region; without this the
panels don't vertically align).

## Adding a track type (recipe)

1. Add any new reader/layout helper to `HELPERS` in `exportR.ts`.
2. In the display plugin add `exportRCode.ts`: a pure `xFragment(params)`
   builder + `exportRCode(self)` that reads `getContainingTrack(self)`'s adapter
   uri and resolved styling. Return `RTrackFragment` (or `[]`).
3. Wire an `exportRCode(): RTrackFragment` model method (**explicit return type
   is required** — it breaks the self-referential MST model-type cycle, same
   trick as `renderSvg`). Import `RTrackFragment` from
   `@jbrowse/plugin-linear-genome-view`.
4. Add `exportRCode.test.ts` (unit) + `exportRRun.test.ts` (runs the real
   `assembleRScript` output through `Rscript`, skips if R absent).

## Verifying (the real accuracy technique)

`Rscript` **is installed in this environment** with ggplot2, patchwork,
rtracklayer, GenomicRanges, GenomicAlignments, Rsamtools, strawr. The
`exportRRun.test.ts` files execute the actual generated script against
`test_data/volvox/*`; run them locally. This is what catches real bugs
(execution, not just codegen string checks) — e.g. it caught `g[[nm]]` failing
on a `GRanges` (must use `mcols(g)[[nm]]`; GRanges has `$` but no `[[`), and that
`VariantAnnotation::readVcf(which=)` rejects a region whose seqname isn't in the
VCF header's `##contig` seqinfo — which is why variants read via Rsamtools
`scanTabix` instead (no VariantAnnotation dependency at all; test VCFs live at
`test_data/volvox/volvox.filtered.vcf.gz` (SNV+indel) and `volvox.sv.vcf.gz`
(symbolic `<DEL>`/`<INV>`/`<INS>`)).

## Gotchas

- **GRanges has no `[[`** — read metadata columns via `mcols(g)[[nm]]` (the `$`
  accessor works but `[[` does not).
- **Model-type cycle** — annotate the `exportRCode()` method return type
  explicitly, else `tsc` reports a circular self-reference.
- **Shared worktree** — multiple agents share this tree. Stage explicit
  pathspecs when committing; don't sweep up unrelated changes.

A small gallery of rendered example figures (one per track type + a combined
multi-panel) lives in `website/static/img/rexport/` with a `README.md` index;
regenerate with the scripts noted there.

> **Gallery drift (alignments):** `colorBy` is now read from `self.colorBy.type`,
> whose default is `normal` = **grey** reads. The committed `alignments.png` and
> its README caption predate this and show/say "strand-colored". The export is
> correct (it mirrors the model); to keep a colorful figure, set `colorBy:
> strand` on the demo track (honest — the figure then shows a strand-colored
> track) rather than reverting the default. Update the caption either way.

**Advanced / multi-dimensional displays** — the 2-D/heatmap track types (Hi-C
contact maps, multi-sample variant matrix) plus the regular per-sample
`LinearMultiSampleVariantDisplay` are now shipped; see
`agent-docs/R_EXPORT_ADVANCED.md` for the design record and what remains (phased
HP split).

## Next

- CRAM: emits the same `read_bam`/`bam_mismatches`; untested. Mismatches are
  reference-free (MD tag), so they need no FASTA — but Rsamtools CRAM *decoding*
  itself needs the reference, resolved out-of-band via the CRAM `UR` header /
  `REF_CACHE`/`REF_PATH`, not by anything the export emits.
- Pileup/coverage **mismatch (SNP) coloring is done** — MD-tag `bam_mismatches`
  drives per-read ticks and the stacked SNP-coverage bars, reference-free; the
  SNP-coverage panel now applies JBrowse's depth-dependent `snp_freq_threshold`
  (off via `showLowFreqMismatches`).
- **`colorBy` is done** for the four schemes that bake cleanly to literal
  read-body hex (`read_fill_colors`, `scale_fill_identity`): normal (grey, the
  default), strand, mappingQuality (faithful MAPQ→hue ramp, mirrors the GPU
  `hueRampHalfSat`), insertSize (short/long via mean ± 3sd of |TLEN|). Read from
  `self.colorBy.type`; the insert-size family maps onto insertSize and
  firstOfPairStrand onto strand. Remaining `colorBy` parity: **pair orientation**
  (needs mate analysis the export skips — falls back to grey), **per-base
  quality**, and **methylation/modifications** (MM/ML overlay). Also still:
  CIGAR insertion/deletion markers (deletions currently render as continuous
  aligned sequence because `read_bam` uses reference-based coords), soft-clip
  bars, and position sort (`sortedBy`).
- Gene label de-clutter (avoid a ggrepel dep; maybe only label top-level).
- Phased HP split (`"<sample> HP0/HP1"` rows, `expandSourcesToHaplotypes`) is
  deferred for both multi-sample variant displays — default is one collapsed row
  per sample.
- Multi-wiggle: the per-source color uses `source.color ?? posColor`; the
  pos/neg bicolor split (row-mode neg keeps the shared `negColor`, see
  `buildSourceRenderData` ADR-016) is not reproduced — signed data colors by
  source only. Groups/clustering tree order isn't reflected either.
