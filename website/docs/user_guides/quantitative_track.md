---
title: Quantitative track
description: BigWig/BedGraph signal tracks, one signal or a whole cohort
guide_category: Track types
---

BigWig and BedGraph files store genome-wide quantitative signals (read depth,
ChIP-seq enrichment, conservation scores). JBrowse renders them as an XY plot, a
density heatmap, a line, or a scatter plot, switchable from the track menu's
**Plot type** submenu. One track draws one signal or a whole cohort of them.

## Rendering types

The track menu's **Plot type** submenu (backed by the display's
[`defaultRendering`](/docs/config/linearwiggledisplay/#slot-defaultrendering)
slot) offers these styles:

- XY plot - filled bar chart
- Density - a heatmap row, compact for many signals at once
- Line (step) - the tops of the bars as a stepped line
- Line (interpolated) - midpoint to midpoint, smoother for sparse signals
- Scatter - individual points, for sparse data

<Figure caption="The same BigWig rendered in every plot type at once (XY plot, Density, Line (step), Line (interpolated), and Scatter), so the styles can be compared directly. Switch a track between them from its Plot type menu." src="/img/bigwig_line.png" />

## Score options

**Plot type** and **Resolution** are top-level track menu items; the rest of the
settings below are grouped under **Score**.

### Autoscale type

The Y-axis range (the display's
[`scales.y.autoscale`](/docs/config/valuescale/#slot-scalesyautoscale) slot).
All three rescale to the region in view and differ in how they treat outliers:

- Local - the plain min and max, so one anomalous position flattens the rest
- Local (99th percentile) - clips the outermost 1% of each sign
- Local ± 3σ - three standard deviations of the local signal, a harder clip when
  the spikes are very tall

### Summary score mode

Zoomed out, a BigWig serves precomputed summary bins, and **Summary score mode**
picks which statistic a pixel draws: **Minimum**, **Maximum**, **Average**, or
**Whiskers**
([`summaryScoreMode`](/docs/config/linearwiggledisplay/#slot-summaryscoremode)).
Whiskers shows all three. An XY plot nests a darker average bar inside the
lighter min-to-max range. A line plot fills min to max as a translucent band
behind the average line, stepped or interpolated to match the line. Density mode
draws the average, since it maps score to color.

A narrow peak fades out across a whole chromosome when averaged over a wide bin.
**Maximum** keeps it visible.

### Other score options

- Scale type - linear or log Y axis
- Resolution - overrides the resolution chosen from the view width
- Set min/max score - pins the Y axis, for comparison across samples
- Autoscale with other tracks - ticks the other tracks in the view that share
  this one's Y axis, which then autoscales over all of their data as you pan and
  zoom
  ([`scales.y.autoscaleGroup`](/docs/config/valuescale/#slot-scalesyautoscalegroup)).
  A coverage band, a mark display and a Manhattan plot take the same group
- Reference lines - a dashed line across the plot at each value you name, each
  with an optional label and colour

### Colors

**Edit color...** opens the colour spec the config file holds. A CSS color
string paints the whole plot in it; `{ "field": "score", "scale": "threshold" }`
is the two-sided plot, one colour below the cut and one above; a ramp
(`{ "field": "score", "scale": "linear", "scheme": "viridis" }`) is what density
mode fades through; and `{ "field": "source" }` gives each signal in the track a
palette entry of its own. The
[quantitative track configuration](/docs/config_guides/quantitative_track#colors)
guide writes the same object into a config file.

## Many signals in one track

A `MultiQuantitativeTrack` combines several quantitative signals (typically
BigWig files) into one track on a shared Y axis, and opens with one row per
signal. **Plot type** holds the five plot styles twice, once under **Multi-row**
and once under **Overlapping**, so one click picks both how a signal is drawn
and whether it gets a row of its own. A track with a single signal has no layout
to choose and lists the five styles on their own.

<Figure caption="The track menu lists the available plot types." src="/img/multiwig/multi_renderer_types.png" />

Each row keeps the colour its subtrack was configured with. Sources sharing one
plot box take a palette entry each instead, so the overlaid plots can be told
apart.

An outlier on one signal can blow out the shared Y axis. The "Local ± 3σ"
autoscale type clips to three standard deviations of the visible data for a more
readable view, or pin the min and max from the track menu.

<Figure caption="Twelve per-cell-type BigWigs from a 5k PBMC scATAC dataset as one multi-quantitative track, over CD8A and MS4A1 in one discontinuous view. CD8A is carried by the CD8, MAIT and NK rows and MS4A1 by the two B rows, on one shared scale." src="/img/scatac/pbmc5k_marker_swap.png" />

### Adding a multi-quantitative track

Three ways to create one:

- The "Add a track" form lets you paste a list of BigWig URLs, or open multiple
  BigWig files from your machine
- The track selector lets you multi-select existing tracks and combine them into
  a multi-quantitative track, which is how a set of per-cell-type BigWigs
  becomes one stacked track (see the
  [single-cell ATAC pseudobulk tutorial](/docs/tutorials/scatac_pseudobulk))
- Hand-edit the config, described in the
  [quantitative track configuration](/docs/config_guides/quantitative_track#many-signals-in-one-track)
  guide

<Figure caption="The 'Add a track' form's workflow selector (red callout) lets you reach the multi-quantitative workflow, where you can paste a list of BigWig URLs or open multiple BigWig files from disk." src="/img/multiwig/addtrack.png" />
<Figure caption="In the track selector, the '...' menu adds individual tracks or whole categories to your selection. The cart icon in the 'Add a track' form then turns the selection into a multi-quantitative track." src="/img/multiwig/trackselector.png" />

### Loading bedMethyl as a multi-quantitative track

[modkit](https://github.com/nanoporetech/modkit) pileup produces a
[bedMethyl](https://www.encodeproject.org/data-standards/wgbs/) file, a
tab-separated BED format where each row reports the methylation fraction at a
single CpG position for one modification type (e.g. 5mC or 5hmC). It loads as
`BedTabixAdapter` and naturally maps to `MultiQuantitativeTrack`, with one
subtrack per modification type; see
[Loading bedMethyl as a multi-quantitative track](/docs/config_guides/quantitative_track#loading-bedmethyl-as-a-multi-quantitative-track)
for generating the file and the adapter config. For the per-read view of the
same modified-base calls, see
[Color by base modifications](/docs/user_guides/alignments_track#modifications-and-methylation)
on the alignments track.

### Clustering rows by score

Reorder rows by signal similarity, via **Clustering → Cluster rows by score...**
in the track menu. Auto mode samples signal values at each pixel across the
visible region to build the matrix. See [](/docs/user_guides/clustering) for the
modes, the dendrogram, and how to share a result in a session URL.

<Figure caption="Clustering a multi-quantitative track. Top: the 'Cluster rows by score' dialog with its auto/manual mode options. Bottom: after clustering, rows are reordered by signal similarity." src="/img/multiwig/cluster_dialog.png" />

### Sorting rows by score at one position

Right-click a row at the column you want to rank on and choose **Sort rows by
score here**. This reorders the rows by the score each carries at that base,
highest at the top, so a cohort reads top-to-bottom at a candidate locus.
Clustering orders the rows by the whole region in view; this orders them by a
single column.

**Reset row order** puts the rows back in the order they were loaded in. It
appears in the same right-click menu and in the track menu, and it undoes a
sort, a clustering run, and a hand-arranged order alike. Where a track should
open on a particular order, the
[`rows`](/docs/config/linearwiggledisplay/#slot-rows) slot's `domain` lists the
sources that lead — the rest keep the adapter's order, and the reset returns to
that order rather than past it.

A session can persist the sort with `sortRowsBy`, the way `runClustering`
persists a clustering run — see [](/docs/models/linearwiggledisplay) for both
fields.

## Viewing whole-genome coverage for CNV profiling

For a chromosome-scale view of copy-number changes:

- Open the BigWig track
- Show all regions in the assembly
- Set **Autoscale type** to **Local ± 3σ** to clip outlier spikes
- Increase the **Resolution** until the profile looks smooth
- Drag the bottom edge of the track down to make it taller

<Figure caption="Whole-genome CNV coverage profile from a BigWig file. Each chromosome is shown as a separate region; the signal represents read depth normalized by the pipeline. Copy-number gains appear as elevated signal; losses as depressed signal." src="/img/bigwig/whole_genome_coverage.png" />

For tumor vs normal on one Y axis, put both signals in one track; for a whole
cohort, the [TCGA cohort copy number tutorial](/docs/tutorials/tcga_cohort_cnv).

Coverage is also shaped by GC content, mappability, repeats and PCR bias, so not
every dip or spike is a copy-number change.

## See also

- [](/docs/tutorials/genomes_basics), a worked example on a hosted BigWig, from
  finding the track to reading it against the gene model
- [Methylation tutorial](/docs/tutorials/methylation)
- [Single-cell ATAC pseudobulk tutorial](/docs/tutorials/scatac_pseudobulk)
- [](/docs/user_guides/gwas_track)
- [SV visualization: working with large SVs](/docs/user_guides/sv_visualization#working-with-large-svs)
- [Quantitative track configuration](/docs/config_guides/quantitative_track)
- [LinearWiggleDisplay config schema](/docs/config/linearwiggledisplay)
