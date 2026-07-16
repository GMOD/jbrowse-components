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

The download is a single script with one function, `plot_region(chrom, start,
end)`, that reads every track in the view and stacks one panel per track with
[`patchwork`](https://patchwork.data-imaginist.com/), sharing a genomic x-axis.
The current view is one call at the bottom:

```r
p <- plot_region("ctgA", 1620, 1780)
ggsave("jbrowse_region.png", p, width = 12, height = 8, dpi = 150)
```

Because the whole figure is a function of the region, you can loop it over a BED
file to batch-render many loci (a commented example is included at the end of the
script).

Everything the script needs is emitted as small, visible helper functions
(`read_bigwig`, `read_bam`, `read_vcf`, …) rather than hidden in a package, so you
can read and edit any part of the plot — the geoms, scales, colors, and theme are
all right there.

## Requirements

The script uses base R plus a handful of Bioconductor/CRAN packages, only the
ones the tracks in your view actually need:

- `ggplot2`, `patchwork` (always)
- `rtracklayer` (BigWig, GFF)
- `Rsamtools`, `GenomicAlignments` (BAM; VCF and GWAS read via tabix)
- `strawr` (Hi-C `.hic` contact maps)

CRAM tracks additionally shell out to `samtools` (Bioconductor's reader is
BAM-only), which the script decodes to a temporary BAM automatically.

## Supported tracks

Most JBrowse track types export, each as the idiomatic ggplot2 equivalent of what
the browser draws:

- **Quantitative** (BigWig) — bars, lines, or a density strip, single or
  multi-wiggle
- **Alignments** (BAM/CRAM) — a coverage histogram plus a pileup with
  reference-free mismatch ticks (from the MD tag), color-by schemes, modifications
  (MM/ML), per-base quality, clip indicators, CIGAR indels, linked reads, and the
  center-line sorts below
- **Features / genes** (GFF3, BED)
- **Variants** (VCF), including the multi-sample matrix and per-sample rows
- **Hi-C** (`.hic`) — the rotated contact triangle
- **GWAS** (tabixed BED) — a Manhattan plot

## Sorting

The alignments "Sort by..." options are reproduced by a `sorted_pileup_layout`
helper that mirrors JBrowse's localized sort: the reads covering the center-line
column are ordered by the criterion (start position, strand, or base) and placed
first, so they line up as a block, and the remaining reads fill in around them.
The sort column is baked into the script as an editable `sort_pos` variable.

<Figure caption="Alignments pileup exported with 'Sort by base' at ctgA:1,693: reads carrying the alternate allele (blue mismatch ticks) are grouped at the top, reference-matching reads below." src="/img/rexport/alignments_sort.png"/>

## Not pixel-perfect, by design

The export favors idiomatic, hackable R over matching JBrowse's exact rendering.
Row packing uses `IRanges::disjointBins` rather than JBrowse's layout, colors
approximate the canvas palette, and a few details (LD coloring on GWAS, phase-set
hues on phased genotypes) are simplified. The goal is a figure that shows the same
data and that you can restyle freely, not a screenshot.

A gallery of example figures for every track type lives in the
[R export gallery](https://github.com/GMOD/jbrowse-components/tree/main/website/static/img/rexport).
