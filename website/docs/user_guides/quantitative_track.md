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
[`mark`](/docs/config/linearwiggledisplay/#slot-mark) and
[`interpolate`](/docs/config/linearwiggledisplay/#slot-interpolate) slots)
offers these styles:

- XY plot - filled bar chart
- Density - a heatmap row, compact for many signals at once
- Line (step) - the tops of the bars as a stepped line
- Line (interpolated) - midpoint to midpoint, smoother for sparse signals
- Scatter - individual points, for sparse data

<Figure caption="The same BigWig rendered in every plot type at once (XY plot, Density, Line (step), Line (interpolated), and Scatter), so the styles can be compared directly. Switch a track between them from its Plot type menu." src="/img/bigwig_line.png" />

## Score options

**Plot type** and **Resolution** are top-level track menu items. Resolution
steps how many points per pixel a BigWig is read at, finer or coarser than one
per pixel, and holds **Summary score mode** beneath the stepper.

### The Y axis panel

**Y axis...** opens the track's axis settings in the side drawer, beside the
view. Every change redraws the track as you make it, and **Reset to defaults**
returns to what the track's configuration says. The row's label names a pinned
end and a non-linear scale, such as **Y axis (190 – auto, log)...**, so the
setting shows without opening it. On an alignments track the row is **Coverage
axis...**, and on a density plot, which maps score to colour, **Score
range...**.

- **Scale** - linear, log or symlog; symlog admits zero and negative scores.
- **Min** and **Max** pin either end of the axis
  ([`scales.y.domainMin`](/docs/config/valuescale/#slot-scalesydomainmin)); a
  field left empty follows the data in view, and the values in view are shown
  beneath them. A bar past a pinned end is cut at the edge with a red strip, so
  typing a min above a dip zooms onto the rest.
- **Include 0** ([`scales.y.zero`](/docs/config/valuescale/#slot-scalesyzero)),
  ticked by default, extends an empty end to 0, so a bar always shows its whole
  height. Unticked, the axis spans the lowest to highest value in view, so a GC
  track whose region holds 30 to 60% draws 30 to 60. Values that already reach
  or cross 0 draw the same either way.
- **Clip extreme outliers**
  ([`scales.y.domainQuantile`](/docs/config/valuescale/#slot-scalesydomainquantile)),
  ticked by default, keeps one spike from flattening the rest. The axis runs to
  the lowest and highest value in view unless one would stretch it past twice
  the height the other 99% of values need; that end stops there, and the bars
  past it wear a 2 px red strip. A plot with no spike shows no strip. A config
  takes any quantile, `0.95` for a tighter fence.
- **Share axis with** ticks the other tracks in the view that share this one's
  axis, which then autoscales over all of their data as you pan and zoom
  ([`scales.y.autoscaleGroup`](/docs/config/valuescale/#slot-scalesyautoscalegroup)).
  A coverage band, a mark display and a Manhattan plot take the same group.
- **Grid lines** rule the plot at every tick, and **Reference lines** draw a
  dashed line at each value you add, each with an optional label and colour.

Include 0 and Clip extreme outliers move only an end left empty, so both grey
out once Min and Max are both set; Include 0 also greys out on a log axis, which
has no 0. Density mode offers neither Include 0 nor the guides.

### Summary score mode

Zoomed out, a BigWig serves precomputed summary bins, and **Resolution → Summary
score mode** picks which statistic a pixel draws: **Minimum**, **Maximum**,
**Average**, or **Whiskers**
([`summaryScoreMode`](/docs/config/linearwiggledisplay/#slot-summaryscoremode)).
Whiskers shows all three. An XY plot nests a darker average bar inside the
lighter min-to-max range. A line plot fills min to max as a translucent band
behind the average line, stepped or interpolated to match the line. Density mode
draws the average, since it maps score to color.

A narrow peak fades out across a whole chromosome when averaged over a wide bin.
**Maximum** keeps it visible.

### Colors

**Edit colors/arrangement...** opens the plot's two colours on one line: one
above the baseline, one below, and both the same for a flat plot. Setting them
is the whole colour story for a single signal, and a track with subtracks gets
the list beneath them, where **Color rows by → Each row** hands every subtrack a
palette entry of its own.

**Edit plot...**, in that dialog, is the escape for what the line does not
offer: a ramp (`{ "field": "score", "scale": "linear", "scheme": "viridis" }`),
the colours a heatmap fades through, and a threshold naming several cut points,
a colour per band. The
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

An outlier on one signal can blow out the shared Y axis. **Clip extreme
outliers** in the **Y axis...** panel stops the axis short of a spike that would
flatten the other rows, or pin the min and max there.

<Figure caption="Twelve per-cell-type BigWigs from a 5k PBMC scATAC dataset as one multi-quantitative track, over CD8A and MS4A1 in one discontinuous view. The CD8, MAIT and NK rows have signal at CD8A and the two B rows at MS4A1, on one shared scale." src="/img/scatac/pbmc5k_marker_swap.png" />

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
score here**. This reorders the rows by the score each has at that base, highest
at the top, so a cohort reads top-to-bottom at a candidate locus. Clustering
orders the rows by the whole region in view; this orders them by a single
column.

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
- Leave **Clip extreme outliers** ticked in the **Y axis...** panel, so the
  repeat spikes stay off the axis
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
