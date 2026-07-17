---
title: Export R script
description: Redraw the current view as an editable ggplot2 figure
guide_category: Other features
---

The linear genome view's **Export R script** option (in the view's three-dot
menu) downloads a self-contained `.R` file that redraws the current view from the
same data sources, using plain [`rtracklayer`](https://bioconductor.org/packages/rtracklayer/)
and [`ggplot2`](https://ggplot2.tidyverse.org/). It is meant for publication
figures and batch rendering, where you want a vector-quality plot you can restyle
with ordinary ggplot2 knowledge.

## What the script contains

The download reads every track in the view and stacks one panel per track with
[`patchwork`](https://patchwork.data-imaginist.com/), sharing a genomic x-axis.
The main function is `plot_regions(regions)`, which takes a
`data.frame(chrom, start, end)`; `plot_region(chrom, start, end)` is the
single-region shorthand. The current view is one call at the bottom:

```r
p <- plot_region("ctgA", 1620, 1780)
ggsave("jbrowse_region.png", p, width = 12, height = 8, dpi = 150)
```

Because the whole figure is a function of the region, you can loop
`plot_region()` over a BED file to batch-render many loci (a commented example is
included at the end of the script).

Everything the script needs is emitted as small, visible helper functions
(`read_bigwig`, `read_bam`, `read_vcf`, …) rather than hidden in a package, so you
can read and edit any part of the plot — the geoms, scales, colors, and theme are
all right there.

### Multiple regions

If the view is showing several regions at once (a discontiguous view), they are
concatenated left-to-right onto one continuous axis — the same layout JBrowse
uses — with a region-name ruler on top, a divider between regions, and each
region keeping its own coordinate labels. Every track shares the axis, so rows
stay aligned across the divider, and an alignments track drawn with linked reads
will connect a mate or split-read segment to its partner even when the two land
in different regions. You can render your own multi-region figure any time by
passing several loci at once:

```r
p <- plot_regions(data.frame(
  chrom = c("ctgA", "ctgA"),
  start = c(1000, 15000),
  end   = c(6000, 17000)))
```

## Requirements

The script uses base R plus a handful of Bioconductor/CRAN packages, only the
ones the tracks in your view actually need:

- `ggplot2`, `patchwork` (always)
- `rtracklayer` (BigWig, GFF)
- `Rsamtools`, `GenomicAlignments` (BAM; VCF and GWAS read via tabix)
- `strawr` (Hi-C `.hic` contact maps)

CRAM tracks additionally shell out to `samtools` (Bioconductor's reader is
BAM-only), which the script decodes to a temporary BAM automatically.

## Gallery

Every figure below is genuine export output — the generated `.R` run through
`Rscript` — one per track type. Each is the idiomatic ggplot2 equivalent of what
the browser draws.

### Quantitative (BigWig)

A single BigWig track becomes `geom_rect` bars (or lines / a density strip,
matching the display's render mode).

<Figure caption="A BigWig track redrawn as geom_rect bars (Volvox microarray, ctgA:1-50,000)." src="/img/rexport/wiggle.png"/>

A multi-wiggle track reads every BigWig into one long data.frame and draws it in
whichever mode the display is in — multi-row (one facet per source), overlay
(one panel colored by source), or density (a per-source viridis heatmap strip).

<Figure caption="A multi-wiggle track drawn multi-row: one faceted, colored row per BigWig source." src="/img/rexport/multiwiggle_rows.png"/>

### Alignments (BAM/CRAM)

A BAM or CRAM track exports as a coverage histogram above a strand-colored
pileup, with rows packed by `IRanges::disjointBins`.

<Figure caption="A BAM track: a coverage histogram above a strand-colored pileup (Volvox alignments, ctgA:1-8,000)." src="/img/rexport/alignments.png"/>

**Modifications / methylation.** With `colorBy: modifications` (or `methylation`)
the read bodies stay grey and per-base modification ticks are parsed
reference-free from the MM/ML tags, colored by modification type above an
editable probability threshold.

<Figure caption="colorBy modifications: MM/ML base-modification ticks on grey read bodies — 5mC (red) and 5hmC (magenta) from an Arabidopsis WGBS modBAM." src="/img/rexport/modifications.png"/>

**CIGAR indels and splicing.** Each read's CIGAR is walked so a deletion draws as
a grey rect over the body, a spliced intron (`N`) as an erased body with a thin
teal connector between exons, and an insertion as a purple tick.

<Figure caption="CIGAR-aware pileup: spliced RNA-seq reads split across an intron (teal connectors), coverage dropping to zero over the gap (ctgA:401-1,100)." src="/img/rexport/spliced.png"/>

**Sorting.** JBrowse's localized "Sort by..." (at the center line) is reproduced
by a `sorted_pileup_layout` helper that mirrors JBrowse: the reads covering the
sort column are ordered by the criterion (start position, strand, or base) and
placed first as a block, then the remaining reads fill in around them. The sort
column is baked into the script as an editable `sort_pos` variable.

<Figure caption="Alignments pileup exported with 'Sort by base' at ctgA:1,693: reads carrying the alternate allele (blue mismatch ticks) group at the top, reference-matching reads below." src="/img/rexport/alignments_sort.png"/>

### Genes and features (GFF3, BED)

Gene models draw with directional `geom_segment` bodies (arrowheads point in the
transcription direction) plus `geom_rect` boxes — thin for exons/UTRs, thick for
CDS — keyed off the feature `type` so coding regions read like the browser glyph.
GFF3 and BED (expanding BED12 blocks into exons) feed the same panel.

<Figure caption="A gene track (GFF3): directional bodies with thin exon/UTR boxes and thick CDS boxes (Volvox genes)." src="/img/rexport/genes.png"/>

### Variants (VCF)

A VCF track reads over the tabix index and draws each record as a `geom_rect`
box, like a feature track.

<Figure caption="A VCF track: each record a geom_rect box, rows packed by IRanges::disjointBins (ctgA:1-20,000)." src="/img/rexport/variants.png"/>

The multi-sample matrix display draws a per-sample genotype grid instead: each
cell is classed ref / het / hom / other / no-call, samples (rows) are ordered by
`hclust` with a hand-rolled dendrogram composed as a left panel, and columns are
laid out by site index (matching JBrowse's matrix, not genomic position).

<Figure caption="The multi-sample variant matrix: per-sample genotype cells, samples clustered with hclust and a dendrogram drawn alongside (1094-sample simulation)." src="/img/rexport/variant_matrix.png"/>

### Hi-C

A `.hic` contact map is read with `strawr` and rotated 45° into the triangular
contact view — the diagonal on the genomic x-axis, interaction distance up the
y-axis — so it stacks with ordinary 1-D tracks on a shared x-range. Bin size and
normalization are emitted as editable script variables.

<Figure caption="A Hi-C .hic contact map rotated into the triangular view, log-scaled viridis (HMEC, Rao et al. 2014, 1:1,000,000-2,000,000)." src="/img/rexport/hic.png"/>

### GWAS

GWAS summary statistics from a tabix'd BED draw as a Manhattan plot of
-log10(p) against position, with the 5e-8 genome-wide significance line.

<Figure caption="GWAS summary statistics as a Manhattan plot with the 5e-8 significance line (SLE association peak, hg19 chr2)." src="/img/rexport/gwas.png"/>

### Combining tracks and regions

Every track in the view stacks into one `patchwork` figure sharing an x-range, so
one `plot_region()` call redraws the whole panel — loop it over a BED file for
batch figures.

<Figure caption="Wiggle, genes, and an alignments coverage+pileup stacked into one patchwork figure over one shared axis (ctgA:1-8,000)." src="/img/rexport/combined.png"/>

A discontiguous view concatenates its regions onto one cumulative-bp axis, with a
region ruler, a divider, and each region keeping its own genomic tick labels.

<Figure caption="A two-region view (ctgA:1,001-6,000 + ctgA:15,001-17,000) on one cumulative axis: coverage, genes, and a pileup, each region's features clipped at its boundary." src="/img/rexport/multiregion.png"/>

## Filtering

The alignments "Filter by" settings (SAM flag include/exclude, read-name match,
and tag filters like HP or RG) are reproduced by a `read_filter` helper emitted
as editable script variables (`flag_include`, `flag_exclude`, `read_name`,
`tag_filters`). Rather than dropping reads, it marks a `keep` column so the
per-base overlays still line up by read index; the layout then leaves a filtered
read at an NA row, which ggplot omits. The flag defaults match JBrowse
(`flag_exclude <- 1540` = unmapped + QC-fail + duplicate).

## Not pixel-perfect, by design

The export favors idiomatic, hackable R over matching JBrowse's exact rendering.
Row packing uses `IRanges::disjointBins` rather than JBrowse's layout, colors
approximate the canvas palette, and a few details (LD coloring on GWAS, phase-set
hues on phased genotypes) are simplified. The goal is a figure that shows the same
data and that you can restyle freely, not a screenshot.

A deeper gallery, with per-track design notes and the R helper details, lives in
the [R export gallery README](https://github.com/GMOD/jbrowse-components/tree/main/website/static/img/rexport).
</content>
</invoke>
