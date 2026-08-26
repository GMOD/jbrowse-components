---
title: Export R script
description: Redraw the current view as an editable ggplot2 figure
guide_category: General usage
---

The linear genome view's **Export R script** option (in the view's three-dot
menu) downloads a self-contained `.R` file that redraws the current view from
the same data sources, using plain
[`rtracklayer`](https://bioconductor.org/packages/rtracklayer/) and
[`ggplot2`](https://ggplot2.tidyverse.org/). It is meant for publication figures
and batch rendering, where you want a vector-quality plot you can restyle with
ordinary ggplot2 knowledge.

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
`plot_region()` over a BED file to batch-render many loci (a commented example
is included at the end of the script).

Everything the script needs is emitted as small, visible helper functions
(`read_bigwig`, `read_bam`, `read_vcf`, …) rather than hidden in a package, so
you can read and edit any part of the plot — the geoms, scales, colors, and
theme are all right there.

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

## Headless, from the command line

[`jb2export`](/docs/jbrowse-img) — the same CLI that renders PNG and SVG images
— exports the identical script. It builds a real linear genome view headlessly
and writes the `.R` instead of an image, selected by an `--out` ending in `.R`:

```bash
jb2export --fasta ref.fa --bigwig signal.bw --loc chr1:1-50000 --out fig.R
Rscript fig.R
```

Any way of describing a view works — file flags as above, a `--config` plus
`--track`, or a `--spec` holding the same `{views:[…]}` JSON a `&session=spec-…`
URL carries, so a view you arranged in the browser can be exported from a script
without rebuilding it by hand:

```bash
jb2export --config https://example.com/config.json \
  --spec '{"type":"LinearGenomeView","assembly":"hg38","loc":"chr1:1-50000","tracks":["my_genes","my_reads"]}' \
  --out fig.R
```

This is the linear genome view only — the dotplot, synteny and circular views
have no R export, and `--out *.R` says so rather than writing an SVG into a file
named `.R`. Every figure in the gallery below is one of these commands, and the
gallery lists the exact command behind each one.

A track this build has no plugin for (an adapter from a plugin `jb2export`
doesn't bundle) is skipped with a warning rather than failing the run, and the
emitted script names what it left out in its header comment — so a figure that
is one track short says which.

## Local files: use JBrowse Desktop

The script reads each track from its own path, so every track in the figure
needs one an R session can open — a URL or a file on disk. A track opened with
"Choose File" in jbrowse-web has neither: the browser hands JBrowse a handle
that only that tab can redeem, with no path attached. Those tracks are left out
of the script, named in the export dialog before you download it and again in
the script's header comment.

[JBrowse Desktop](/docs/quickstart_desktop) opens the same file by its
filesystem path, which the exported script uses directly, so export from there
when your data is local. Tracks read over HTTP are unaffected in either product.

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

Every track type, drawn by the real exported script, is on its own page:
**[Export R script gallery](/docs/user_guides/r_export_gallery)**.

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
approximate the canvas palette, and a few details (LD coloring on GWAS,
phase-set hues on phased genotypes) are simplified. The goal is a figure that
shows the same data and that you can restyle freely, not a screenshot.

Per-track design notes and the R helper details live in the
[R export gallery README](https://github.com/GMOD/jbrowse-components/tree/main/website/static/img/rexport).
