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
  panel = `{ packages, helpers, setup, plotVariable, plotExpr, heightWeight,
  refNameMap }`. `plotExpr` references `chrom`/`start`/`end` from inside
  `plot_region()`; `refNameMap` (attached by the view, see Refname aliases) is
  the optional canonical→file-name translation.
- Per-display `exportRCode(self)` model method returns a fragment (or
  `RTrackFragment[]` for multi-panel tracks); the view iterates every track's
  `display.exportRCode` and `collectFragments` flattens arrays. Each display
  also has a pure `*Fragment(params)` builder that is what the unit tests hit.

## Track types done

| Track | Display | R approach |
| --- | --- | --- |
| wiggle | `LinearWiggleDisplay` | `geom_rect` (solid), `geom_step` (line), `scale_fill_manual` on `score >= pivot` (bicolor), viridis strip (density) |
| multi-wiggle | `MultiLinearWiggleDisplay` | `read_multibigwig` long data.frame (`source` factor); overlay = one panel colored by source, multi-row = `facet_grid(rows = vars(source))`, density = per-source viridis strip; geom picked from `renderingType` (area/step/line/point) |
| alignments BAM/CRAM | `LinearAlignmentsDisplay` | SNP-coverage panel (grey `geom_area` total + per-base mismatch counts stacked via `geom_col`, thresholded by `snp_freq_threshold` unless `showLowFreqMismatches`) + color-by `geom_rect` pileup (`read_fill_colors` bakes normal/strand/mappingQuality/insertSize/pairOrientation per `self.colorBy.type`) with per-base mismatch ticks; pair orientation from the flag/mate columns via `pair_orientation` (LR/RL/RR/LL + unmapped-mate/interchrom buckets, mate-consistent like `getPairOrientation`); mismatches from the MD tag via `bam_mismatches` (reference-free, like JBrowse's `MismatchParser`), colored by `base_colors` with `scale_fill_identity`; the `modifications`/`methylation` scheme instead keeps grey read bodies and overlays MM/ML modification ticks via `bam_modifications` (a faithful `getModPositions` port — reverse-strand target-base complement + 5'-end counting, interleaved combined-code ML, CIGAR ref-mapping; read via `scanBam` since the ML `B:C` array breaks `readGAlignments`), colored by `mod_colors` above an editable `min_prob` threshold; the `perBaseQuality` scheme likewise keeps grey bodies and overlays one `geom_rect` per aligned base via `bam_base_quality` (QUAL mapped to reference columns), colored by `quality_colors` (JBrowse's `HSL(score*1.5, 55%, 50%)` ramp), capped by an editable `max_quality_rects` so a wide region doesn't OOM ggplot; rows from `IRanges::disjointBins` (not JBrowse's `placeRect`); CRAM tracks (`isCram`) decode each region to a temp BAM via `cram_to_bam` (samtools, since Rsamtools can't read CRAM) before the `bam_*` helpers run — samtools restores the MD tag from the reference so `bam_mismatches` still works; when `self.linkedReads !== 'off'` the pileup uses `link_reads` chain layout instead of `pileup_layout` — records are grouped by QNAME (mates + supplementary segments), each chain packed on one row by its full template span, with a `geom_segment` connector drawn across each mate-pair/split gap under the read rects; soft-clip (blue) / hard-clip (red) indicator bars at read ends via `bam_clips`/`clip_colors` (first/last CIGAR `S`/`H` op → fixed-width vertical `geom_segment` + `scale_color_identity`), the breakpoint signal JBrowse's clip indicators show, drawn under every color scheme; CIGAR indels that `read_bam`'s aligned span otherwise swallows via `bam_indels`/`gap_colors` — deletions (grey `#808080`) and skipped introns (teal `#009a8a`) paint a `geom_rect` over the read body where no base aligns, insertions (purple `#800080`) a thin `geom_segment` tick — drawn after the read body but before the mismatch ticks, under every color scheme |
| genes GFF3/BED | `LinearBasicDisplay` | `geom_segment` bodies + `geom_rect` leaf exons/CDS; `gene_layout` groups by top-level parent then `disjointBins` |
| variants VCF | `LinearVariantDisplay` | `read_vcf` = Rsamtools `scanTabix` (NO VariantAnnotation) → classify SNV/INS/DEL/MNV/SV; `geom_segment` span + `geom_point` lollipop head colored by type; `vcf_layout` `disjointBins` row-pack |
| multi-sample variant matrix | `LinearMultiSampleVariantMatrixDisplay` | `read_vcf_gt` = Rsamtools `scanTabix` genotype reader (header sample names + FORMAT GT locator, NO VariantAnnotation) → per-cell ref/het/hom/other/nocall by dosage of the site's most-frequent ALT; `geom_tile` heatmap, columns by site index, samples ordered by `hclust`; hand-rolled `dendro_segments` dendrogram as a left `patchwork` panel; MAF/missingness floors emitted as editable vars |
| multi-sample variant rows | `LinearMultiSampleVariantDisplay` | same `read_vcf_gt` reader + ref/het/hom/other/nocall classing, but one `geom_rect` row per sample at honest genomic position (site `start`/`end`, single-base sites floored to a min width); samples in VCF order (no clustering); shares `coord_cartesian(xlim=)` so it aligns with 1-D genomic tracks |
| Hi-C `.hic` | `LinearHicDisplay` | `hic_triangle` = `strawr::straw` upper triangle rotated 45° into diamond `geom_polygon`s (JBrowse's triangular view) over a genomic x-axis, so it stacks with 1-D tracks; log `scale_fill_viridis_c`; `binsize`/`norm` emitted as editable script vars (default = display's `effectiveResolution`/`activeNormalization`) |
| GWAS BED | `LinearManhattanDisplay` | `read_gwas` = Rsamtools `scanTabix` over the tabix'd BED; score column looked up by NAME in the header, position column from the tabix index (`headerTabix()$indexColumns`), so any BED layout works (NO GWAS package); `geom_point` at genomic pos vs -log10(p) + 5e-8 genome-wide `geom_hline`; native `scoreTransform` (`negLog10`/`negLog10FromLn`) reproduced in the y aesthetic; LD (r²) coloring not reproduced (single-color) |

Both multi-sample variant displays honor `renderingMode`: `read_vcf_gt(..., phased = TRUE)` expands each sample into `"<sample> HP<n>"` haplotype columns, classing each single allele ref/alt/other/nocall (`set1` palette, mirroring `getPhasedColor`) instead of the collapsed ref/het/hom dosage.

Every panel ends with `coord_cartesian(xlim = c(start, end))` so stacked tracks
share one x-range (features/reads overhang the fetch region; without this the
panels don't vertically align).

## Refname aliases

`plot_region(chrom, start, end)` is called with the assembly's **canonical**
refName (e.g. `ctgA`, `chr1`), but a track's file may name the same contig
differently (`contigA`, `1`, `NC_000001.11`). JBrowse resolves this per-adapter
at fetch time via `assembly.getRefNameMapForAdapter` (a `CoreGetRefNames` RPC
against the assembly's `refNameAliases`); the export reuses **the exact same
map** so the script reads correctly instead of silently returning zero rows.

- The **view** (`collectFragments` in `exportR.ts`), not the per-display
  builder, resolves each track's `canonical -> file name` map and attaches the
  differing entries to every fragment of that track as `RTrackFragment.refNameMap`
  (a builder stays a pure codegen function that knows nothing about assemblies).
  Resolution failures are swallowed — the export still runs, just untranslated.
- Because the map covers the whole assembly (not one region), it is **loop-safe**:
  the emitted `plot_region()` still works for any locus in a batch BED loop.
- `assembleRScript` emits, only when some fragment carries a non-empty map: the
  inline `resolve_chrom(chrom, aliases)` helper, one deduped
  `<track>_refnames <- c(\`canonical\` = "file name", ...)` vector per aliased
  track, and wraps that panel's assignment in
  `local({ chrom <- resolve_chrom(chrom, <track>_refnames); <plotExpr> })`.
  `local()` shadows only `chrom` (translated to the file's name) while `start`/
  `end` stay lexically visible — so **no fragment builder changes**, and the
  `plot_annotation` title keeps the canonical name. The common no-alias case
  emits none of this.
- Test coverage: `exportRRefnames.test.ts` (codegen unit checks + a real
  `Rscript` run over `test_data/volvox/volvox_microarray.altname.bw`, whose contig
  is `contigA` while the volvox canonical name is `ctgA`, proving the canonical
  name reads real data only through `resolve_chrom`).

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
rtracklayer, GenomicRanges, GenomicAlignments, Rsamtools, strawr, and `samtools`
is on `PATH` (needed only for the CRAM run-test — it's the CRAM decoder the
`cram_to_bam` helper shells out to). The `exportRRun.test.ts` files execute the
actual generated script against `test_data/volvox/*`; run them locally. This is what catches real bugs
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
`agent-docs/R_EXPORT_ADVANCED.md` for the design record.

## Next

- **CRAM is done** (`cram_to_bam` helper). Rsamtools/GenomicAlignments is a
  BAM-only reader and flatly refuses CRAM — `scanBamHeader`/`readGAlignments`
  throw `'filename' is not a BAM file`, and it's a deliberate upstream gap
  (Bioconductor Rsamtools #21/#56), not a version issue, so no dep bump fixes it.
  Instead each alignments panel decodes the queried region to a temporary indexed
  BAM with `samtools view` (the universal CRAM tool) via the `cram_to_bam(uri,
  chrom, start, end, ref)` helper, then feeds that BAM to the unchanged `bam_*`
  helpers. samtools *restores the MD tag from the reference while decoding*, so
  the reference-free `bam_mismatches` walk still finds SNPs (verified: the CRAM
  run-test recovers the same ctgA:1693 C-SNP as the BAM). `ref` is the assembly's
  sequence-adapter FASTA, resolved in `exportRCode` via
  `referenceFastaUri(self)` (the CRAM adapter's own `sequenceAdapter` is injected
  at runtime and absent from its static config, so it's read off the assembly);
  when empty, `samtools` falls back to the CRAM's own `UR` header /
  `REF_PATH`/`REF_CACHE`. `cram_to_bam` returns a non-`.cram` path unchanged, so
  BAM and CRAM share one code path; it's only emitted for CRAM tracks (`isCram`).
  Needs `samtools` on `PATH` (the only non-R tool the export shells out to;
  ubiquitous in bioinformatics). A dev-branch Rsamtools with native CRAM
  (Bioconductor Rsamtools PR #69) was considered and rejected: it would force the
  script's users to `devtools::install_github` an unreleased branch, heavier than
  requiring stock `samtools`.
- **Per-base quality colorBy is done** — `bam_base_quality` maps a Phred score
  onto every reference-aligned base (reads QUAL, stored genomic-forward in BAM,
  and walks the CIGAR the same way `bam_mismatches` does), and `quality_colors`
  colors each on JBrowse's `HSL(hue = score * 1.5, 55%, 50%)` ramp (red low →
  yellow → green high; a maxed 255 pinned to green hue 150 — the exact
  `qualityCssColors` formula). Like modifications it keeps grey read bodies and
  overlays the per-base rects. It is **one rect per aligned base** — inherently
  dense, so, like JBrowse only rendering per-base quality zoomed in, the overlay
  is capped by an editable `max_quality_rects` (200000) that skips it with a
  `message()` over a wide region rather than exhausting ggplot's memory (a 50 kb
  volvox view = ~1M bases would otherwise build ~1M grobs).
- Remaining `colorBy` parity: modifications/methylation (MM/ML) is done
  (`bam_modifications`/`mod_colors`, see table above) but doesn't reproduce
  bisulfite methylation (reference-dependent C→T, no MM tag), the 5mC/5hmC
  winner-take-all collapse, or per-type
  `shownModifications`/`hiddenModifications` filtering (all types render; filter
  the `mm` data.frame in R). Also still: position sort (`sortedBy`).
- **Soft/hard-clip bars are done** — `bam_clips` reads the first/last CIGAR op
  (`S`/`H`) into `data.frame(read_index, pos, type, length)` at the read's aligned
  start/end; the pileup draws a fixed-width vertical `geom_segment` per clip,
  colored by `clip_colors` (soft blue `#0000ff` / hard red `#ff0000`) via a
  `scale_color_identity` (a distinct aesthetic from the read/mismatch fill scale).
  Always drawn (orthogonal to the color scheme), the same clip-indicator signal
  JBrowse shows by default; not the `showSoftClipping` expanded-bases mode (which
  needs SEQ the reference-coord reader skips).
- **CIGAR indel markers are done** — `bam_indels` walks each read's CIGAR for the
  reference-consuming ops `read_bam`'s aligned `start..end` silently swallows
  (a read spanning a deletion or intron looks like continuous sequence): `D`
  deletion, `N` skip/intron, `I` insertion (which doesn't consume reference, so
  it sits at one column). The pileup paints a grey (`#808080`) / teal
  (`#009a8a`, `gap_colors`) `geom_rect` over the read body for deletions / skips
  (a gap where no base aligns, JBrowse's deletion-rect + spliced-intron look) and
  a thin purple (`#800080`) `geom_segment` tick for insertions, joined to the read
  row by `read_index` exactly like the mismatch/clip overlays, drawn after the
  read body but before the mismatch ticks (mismatches sit on aligned columns,
  never inside a gap). Not the zoomed-in insertion-count label or the
  `hideSmallIndels` threshold — every indel draws, orthogonal to the color scheme.
- **Linked/paired reads is done** — `self.linkedReads === 'normal'` emits the
  `link_reads` chain layout (group by QNAME → mates + supplementary on one row,
  packed by full template span, with `geom_segment` gap connectors under the read
  rects). Only segments in the fetched window link (no cross-region mate fetch,
  which JBrowse does on the main thread); each chain spans its whole template so
  the view uses as many/more rows than a flat pileup. Bezier/arc read connections
  and the read-cloud (samplot) view are not reproduced.
- Gene label de-clutter (avoid a ggrepel dep; maybe only label top-level).
- Phased HP split: phase-set (`PS`) hue coloring is flattened to the mfa/secondary
  color.
- Multi-wiggle: the per-source color uses `source.color ?? posColor`; the
  pos/neg bicolor split (row-mode neg keeps the shared `negColor`, see
  `buildSourceRenderData` ADR-016) is not reproduced — signed data colors by
  source only. Groups/clustering tree order isn't reflected either.


Remaining "Next" items in R_EXPORT.md: position sort (sortedBy), bisulfite/5mC-5hmC methylation nuances, gene-label de-clutter, phased-HP PS hue, and the multi-wiggle pos/neg bicolor split. Want me to keep going on any of these?
