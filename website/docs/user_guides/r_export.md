---
title: Export R script
description:
  The linear genome view's menu writes an R script that redraws the open tracks
  as an editable ggplot2 figure, reading the same data files
guide_category: General usage
---

The linear genome view's menu has an **Export R script** item. It downloads
`jbrowse_view.R`, a script that redraws the tracks open in the view over the
regions on screen, reading the same data files. Run it with `Rscript` to get
`figure.png`, or `source()` it and keep working with the plot objects.

- **Feature, quantitative and alignments tracks** read through
  [ggjbrowse](https://github.com/GMOD/ggjbrowse), which runs JBrowse's own data
  engine inside R. Each track's settings go to the engine as the track's config
  writes them, so the figure shows what the browser shows.
- **Mark displays** read through
  [`rtracklayer`](https://bioconductor.org/packages/rtracklayer/) and draw as
  plain `ggplot2` geoms.

Every panel is an ordinary [`ggplot2`](https://ggplot2.tidyverse.org/) plot. A
ggjbrowse track is `ggplot(result)` plus a geom per table
(`geom_jbrowse_reads()`, `geom_jbrowse_glyphs()`, `geom_jbrowse_wiggle()`, ...),
each taking any column of its table in `aes()`. You can add a `geom_*`, map
another column, change a theme or stack the panels with `patchwork`.

## What it draws

| Track                                          | Drawn                                                                                                                                          |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature tracks (GFF3, GTF, BED, BigBed)        | Each feature's glyph on the display's rows, with transcripts, UTRs, intron lines, strand chevrons and arrows, and the labels shown at the zoom |
| Quantitative tracks (BigWig, multi-BigWig)     | The display's plot type, colors, score axis and reference lines, a row per source where the display gives one                                  |
| Alignments tracks (BAM, CRAM)                  | Splice-junction arcs, the coverage band with its allele colors, read-connection arcs, and the pileup with mismatches, indels and clips         |
| Mark displays over BigWig, GFF3, VCF, BED, BAM | Each mark, color, shape and size scale, transform step, facet and row, as the display's config spells them                                     |

A view of several regions draws them end to end on one axis, each track's panel
spanning all of them.

## What it leaves out

A track the exporter cannot draw, and a setting it cannot reproduce, land in a
comment block at the top of the script. A figure that differs from the view says
so there. Today that covers facets on feature tracks, a key for a linear color
ramp, linked reads and chains, and displays other than those in the table.

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

`ggplot2` always, `patchwork` when more than one panel is drawn,
[ggjbrowse](https://github.com/GMOD/ggjbrowse) for feature, quantitative and
alignments tracks (`remotes::install_github("GMOD/ggjbrowse")`), and for mark
displays only the Bioconductor packages they need: `rtracklayer` and
`GenomicRanges` for BigWig, GFF3 and BED, `Rsamtools` for tabix files. A BigBed
reads with base R and `curl`.

## Not pixel-perfect

The export favours idiomatic R over matching the browser's rendering. Palettes
approximate the browser's, a mark never draws narrower than two figure pixels,
and ggplot2 chooses its own antialiasing. The aim is a figure that shows the
same data and that you can restyle, not a screenshot.
