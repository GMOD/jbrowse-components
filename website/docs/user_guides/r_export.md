---
title: Export R script
description:
  The linear genome view's menu writes an R script that redraws the open tracks
  as an editable ggplot2 figure, reading the same data files
guide_category: General usage
---

The linear genome view's menu has an **Export R script** item. It downloads
`jbrowse_view.R`, a short script that redraws the tracks open in the view, over
the regions on screen, in R:

- **Each track is one call** to [ggjbrowse](https://github.com/GMOD/ggjbrowse),
  which runs JBrowse's own data engine inside R and reads the track with the
  settings it has in the view.
- **The figure is one call**, `jbrowse_stack()`, which stacks the tracks as the
  view does. `source()` the script and the figure appears; `Rscript` writes
  `figure.png`.

```r
library(ggjbrowse)

locus <- "ctgA:1,001-9,000"

# GFF3Tabix genes
genes <- jbrowse_features("https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz",
  locus,
  display = list(heightMode = "fit", height = 100),
  width = 1588)

# volvox-sorted.bam
reads <- jbrowse_alignments("https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-sorted.bam",
  locus,
  display = list(color = list(field = "mapq")))

fig <- jbrowse_stack("GFF3Tabix genes" = genes,
  "volvox-sorted.bam" = reads)
print(fig)
```

Each reader returns the tables its track draws, and every band is an ordinary
`ggplot2` plot, so a figure is edited the usual way: draw one band alone with
`autoplot(reads, "pileup")` and add a `geom_*`, a scale or a theme, or join your
own table to `genes$features`. A feature track exports at the height the view
gives it, so it drops the labels the view drops; change `"fit"` to `"grow"` to
draw them all.

## What it draws

Feature tracks (GFF3, GTF, BED, BigBed), variant tracks and multi-sample variant
matrices (VCF), quantitative tracks (BigWig, multi-BigWig) and alignments tracks
(BAM, CRAM). Several regions on screen draw end to end, as the view lays them
out.

## What it leaves out

A track ggjbrowse cannot read yet, such as an arc or GWAS track, and a setting
it cannot draw, such as facets on a feature track, go in a comment block at the
top of the script that lists where the figure differs from the view.

## Where the data lives

The script opens each track by its path or URL, so every track needs one an R
session can open.

- A track opened with **Choose File** in jbrowse-web has neither, because the
  browser keeps the file handle to itself. The exporter leaves it out and names
  it in the header. [JBrowse Desktop](/docs/quickstart_desktop) opens files by
  path, which the script uses directly.
- A file over HTTP needs its index beside it at the usual name, or the track's
  declared index, which the script passes along.
- A contig the assembly calls `chr1` and the file calls `1` reads under the
  file's name, from the assembly's aliases.

## Requirements

R with [ggjbrowse](https://github.com/GMOD/ggjbrowse) 0.11.0 or later:
`remotes::install_github("GMOD/ggjbrowse@v0.11.0")` installs the release the
script is tested against. It brings `ggplot2`, `patchwork` and `V8`; no
Bioconductor packages are needed. The script stops with that install line if the
installed ggjbrowse is older.

## How close to the view it is

The data, rows, colors and keys are the browser's own, computed by the same
engine. The drawing is ggplot2's: its text, antialiasing and panel spacing, so
the figure shows what the view shows without being a screenshot of it.
