---
title: Multi-quantitative track
description: Multiple signal tracks displayed together
guide_category: Track types
---

**TL;DR:** A multi-quantitative track combines several quantitative signals
(typically BigWig files) into one track with a shared Y axis. The track menu's
**Plot type** submenu groups the modes by layout:

- **Multi-row** (`XY plot`, `Density`, `Line (step)`, `Line (interpolated)`,
  `Scatter`) draws one plot per subtrack, stacked
- **Overlapping** (`XY plot`, `Line (step)`, `Line (interpolated)`, `Scatter`)
  draws all subtracks together

<Figure caption="The track menu lists the available plot types." src="/img/multiwig/multi_renderer_types.png" />

Multi-row modes keep each subtrack's configured color. Overlapping modes
auto-assign colors from the palette. Edit colors and ordering from the track
menu.

An outlier on one subtrack can blow out the shared Y axis. The "Local ± 3σ"
autoscale type clips to three standard deviations of the visible data for a more
readable view, or pin the min and max from the track menu.

<Figure caption="Twelve per-cell-type BigWigs from a 5k PBMC scATAC dataset as one multi-quantitative track, over CD8A and MS4A1 in one discontinuous view. CD8A is carried by the CD8, MAIT and NK rows and MS4A1 by the two B rows, on one shared scale." src="/img/scatac/pbmc5k_marker_swap.png" />

## Adding a multi-quantitative track

Three ways to create one:

- The "Add a track" form lets you paste a list of BigWig URLs, or open multiple
  BigWig files from your machine
- The track selector lets you multi-select existing tracks and combine them into
  a multi-quantitative track, which is how a set of per-cell-type BigWigs
  becomes one stacked track (see the
  [single-cell ATAC pseudobulk tutorial](/docs/tutorials/scatac_pseudobulk))
- Hand-edit the config, described in the
  [multi-quantitative track configuration](/docs/config_guides/multiquantitative_track/)
  guide

<Figure caption="The 'Add a track' form's workflow selector (red callout) lets you reach the multi-quantitative workflow, where you can paste a list of BigWig URLs or open multiple BigWig files from disk." src="/img/multiwig/addtrack.png" />
<Figure caption="In the track selector, the '...' menu adds individual tracks or whole categories to your selection. The cart icon in the 'Add a track' form then turns the selection into a multi-quantitative track." src="/img/multiwig/trackselector.png" />

## Loading bedMethyl as a multi-quantitative track

[modkit](https://github.com/nanoporetech/modkit) pileup produces a
[bedMethyl](https://www.encodeproject.org/data-standards/wgbs/) file, a
tab-separated BED format where each row reports the methylation fraction at a
single CpG position for one modification type (e.g. 5mC or 5hmC). It loads as
`BedTabixAdapter` and naturally maps to `MultiQuantitativeTrack`, with one
subtrack per modification type; see
[Loading bedMethyl as a multi-quantitative track](/docs/config_guides/multiquantitative_track#loading-bedmethyl-as-a-multi-quantitative-track)
for generating the file and the adapter config. For the per-read view of the
same modified-base calls, see
[Color by base modifications](/docs/user_guides/alignments_track#modifications-and-methylation)
on the alignments track.

## Clustering rows by score

Reorder subtracks by signal similarity, via **Clustering → Cluster rows by
score...** in the track menu. Auto mode samples signal values at each pixel
across the visible region to build the matrix. See
[](/docs/user_guides/clustering) for the modes, the dendrogram, and how to share
a result in a session URL.

<Figure caption="Clustering a multi-quantitative track. Top: the 'Cluster rows by score' dialog with its auto/manual mode options. Bottom: after clustering, rows are reordered by signal similarity." src="/img/multiwig/cluster_dialog.png" />

## Sorting rows by score at one position

Right-click a multi-row plot at the column you want to rank on and choose **Sort
rows by score here**. The subtracks are reordered by the score each carries at
that base, highest at the top, so a cohort reads top-to-bottom at a candidate
locus. Clustering orders the rows by the whole region in view; this orders them
by a single column.

**Reset row order** puts the subtracks back in the order they were loaded in. It
appears in the same right-click menu and in the track menu, and it undoes a
sort, a clustering run, and a hand-arranged order alike.

A session can bake the sort in with `sortRowsBy`, the way `runClustering` bakes
in a clustering run — see [](/docs/models/multilinearwiggledisplay) for both
fields.

## See also

- [](/docs/user_guides/quantitative_track)
- [Methylation tutorial](/docs/tutorials/methylation)
- [Single-cell ATAC pseudobulk tutorial](/docs/tutorials/scatac_pseudobulk)
- [Multi-quantitative track configuration](/docs/config_guides/multiquantitative_track)
- [Gallery: coverage, copy number, and epigenomics](/gallery/#coverage)
