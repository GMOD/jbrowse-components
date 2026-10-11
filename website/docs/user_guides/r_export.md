---
title: Export R script
description:
  The linear genome view's menu writes an R script that redraws the open tracks
  as an editable ggplot2 figure, reading the same data files
guide_category: General usage
---

The linear genome view's menu has an **Export R script** item. It downloads
`jbrowse_view.R`, a script that redraws the tracks open in the view over the
regions on screen, reading the same data files: alignments through
[ggjbrowse](https://github.com/GMOD/ggjbrowse), which runs JBrowse's own data
engine inside R, and other tracks through
[`rtracklayer`](https://bioconductor.org/packages/rtracklayer/). Run it with
`Rscript` to get `figure.png`, or `source()` it and keep working with the plot
objects.

Each track is a data frame and a plain
[`ggplot2`](https://ggplot2.tidyverse.org/) plot, with small helper functions
defined inline, so you can add a `geom_*`, change a theme, join your own table
or stack the panels with `patchwork` using ordinary ggplot2 knowledge.

## What it draws

| Track                                                             | Drawn                                                                                                                   |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Wiggle and mark displays over BigWig, GFF3, VCF, BED, BigBed, BAM | Each mark, color, shape and size scale, transform step, facet and row, as the display's config spells them              |
| Feature tracks (GFF3, BED and BigBed gene models)                 | Exons, thinner UTRs, intron lines, strand arrows, transcripts stacked under their gene, labels                          |
| Alignments tracks (BAM, CRAM)                                     | A coverage band over the reads, packed as the browser packs them, filled as the browser fills them, with mismatch ticks |

Alignments take the display's **Color by** and **Filter by** settings as they
are: each read comes back from the engine in the color the browser paints it,
with the browser's key beside the panel. A view of several regions draws them
end to end on one axis, each track's panel spanning all of them.

## What it leaves out

A track the exporter cannot draw, and a setting it cannot reproduce, land in a
comment block at the top of the script. A figure that differs from the view says
so there. Today that covers modifications and per-base colors, linked reads and
chains, sort and facets on the alignments display, insertions and clips on
reads, and displays other than those in the table.

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
[ggjbrowse](https://github.com/GMOD/ggjbrowse) for alignments
(`remotes::install_github("GMOD/ggjbrowse")`), and only the Bioconductor
packages the other open tracks need: `rtracklayer` and `GenomicRanges` for
BigWig, GFF3 and BED, `Rsamtools` for tabix files. A BigBed reads with base R
and `curl`.

## Not pixel-perfect

The export favours idiomatic R over matching the browser's rendering. Palettes
approximate the browser's, a mark never draws narrower than two figure pixels,
and ggplot2 chooses its own antialiasing. The aim is a figure that shows the
same data and that you can restyle, not a screenshot.
