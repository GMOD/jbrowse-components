---
title: Quantitative track
description: BigWig/BedGraph signal tracks, one signal or a whole cohort
guide_category: Track types
---

BigWig and BedGraph files store genome-wide quantitative signals (read depth,
ChIP-seq enrichment, conservation scores). One track draws one signal or a whole
cohort of them.

## Rendering types

The track menu's **Plot type** submenu (backed by the display's
[`mark`](/docs/config/linearwiggledisplay/#slot-mark) and its
[`interpolate`](/docs/config/wigglemark/#slot-interpolate)) offers these styles:

- **Bar plot:** filled bars
- **Density:** a heatmap row, compact for many signals at once
- **Line (step):** the tops of the bars as a stepped line
- **Line (interpolated):** midpoint to midpoint, smoother for sparse signals
- **Scatter:** individual points, for sparse data

<Figure caption="One BigWig in every plot type: Bar plot, Heatmap, Line (step), Line (interpolated) and Scatter." src="/img/bigwig_line.png" />

## Score options

**Resolution** in the track menu sets how many points per pixel a BigWig is read
at, finer or coarser than one per pixel, and **Bin summary** sits beneath it.

### The Y axis panel

**Y axis...** opens the track's axis settings in the side drawer. The track
redraws as you change them, and **Reset to defaults** returns to the track's
configuration. On an alignments track the row is **Coverage axis...**, and on a
density plot **Score range...**.

<Figure src="/img/bigwig/y_axis_panel.png" caption="A BigWig's Y axis drawer with Max pinned and one labelled reference line. Bars past the pinned Max end in a red strip." />

- **Scale:** signed log keeps zero and negative scores.
- **Min** and **Max** pin either end of the axis
  ([`encoding.y.scale.domainMin`](/docs/config/yscale/#slot-domainmin)); an
  empty field follows the data in view and shows where that end lands now.
- **Include 0** ([`encoding.y.scale.zero`](/docs/config/yscale/#slot-zero)),
  ticked by default, extends an empty end to 0, so a bar shows its whole height.
  Unticked, the axis spans the values in view, so a GC track holding 30 to 60%
  draws 30 to 60.
- **Clip extreme outliers**
  ([`encoding.y.scale.fenceQuantile`](/docs/config/yscale/#slot-fencequantile)),
  ticked by default, stops an empty end short of a spike that would stretch the
  axis past twice the height the other 99% of values need, and marks the bars
  past it with a red strip. A config takes any quantile, `0.95` for a tighter
  fence.
- **Share axis with** ticks the other tracks in the view that share this one's
  axis, which then autoscales over all of their data as you pan and zoom
  ([`encoding.y.scale.share`](/docs/config/yscale/#slot-share)). A coverage
  band, a mark display and a Manhattan plot take the same `share`.

Include 0 and Clip extreme outliers move only an end left empty, so both leave
the panel once Min and Max are both set; Include 0 also leaves on a log axis,
which has no 0. Density mode offers neither Include 0 nor reference lines. The
**?** in the drawer's header sums these up.

### Bin summary

Zoomed out, a BigWig serves precomputed summary bins.

- **Resolution → Bin summary** picks the statistic drawn per bin: **Minimum**,
  **Maximum** or **Mean**, which write
  [`encoding.y.field`](/docs/config/yfieldchannel/#slot-field) as `minScore`,
  `maxScore` or `score`. A narrow peak averaged over a wide bin fades out;
  **Maximum** keeps it visible.
- **Show min and max** draws the bin's range around it
  ([`mark.extent`](/docs/config/wigglemark/#slot-extent)): a bar plot nests the
  darker bar inside the lighter range, and a line plot fills it as a translucent
  band behind the line. Density mode draws no range.
- **Raw values**, from a bedGraph or a BigWig zoomed all the way in, make the
  three statistics one number, so neither setting changes anything. A y field
  naming another feature field hides **Bin summary**.

The
[mappability tutorial](/docs/tutorials/mappability_qc#mappability-coverage-and-read-tracks-across-the-smn1-and-smn2-region)
reads a mappability track with **Minimum**, the worst position in each bin.

### Colors

**Edit colors/arrangement...** opens the plot's two colors on one line, one
above the baseline and one below; a flat plot uses one color for both.

- **Subtracks** are listed beneath. **Color rows by → Each row** picks a
  subtrack's color there, and on overlapping plots gives each subtrack its own
  palette entry.
- **Edit plot...** in that dialog sets the rest: a ramp
  (`{ "field": "score", "scale": "linear", "scheme": "viridis" }`), the colors a
  heatmap fades through, or several cut points with a color per band.

The
[quantitative track configuration](/docs/config_guides/quantitative_track#colors)
guide writes the same object into a config file.

## Many signals in one track

A `MultiQuantitativeTrack` combines several quantitative signals (typically
BigWig files) into one track on a shared Y axis, and opens with one row per
signal. **Plot type** lists the plot styles under **Multi-row** and again under
**Overlapping**, so one click picks how a signal is drawn and whether it gets
its own row. Where the subtracks carry a `group`, or the config sets
[`rows.field`](/docs/config/quantitativerows/#slot-field) to another subtrack
attribute, a third layout, **Rows by group**, draws one row per value with that
row's subtracks overlaid in their own colors
([config](/docs/config_guides/quantitative_track/#a-row-per-group-its-subtracks-overlaid)).

<Figure caption="The track menu lists the available plot types." src="/img/multiwig/multi_renderer_types.png" />

Each row keeps its subtrack's configured color, and overlapping sources take a
palette entry each. An outlier on one signal can stretch the shared Y axis until
the others flatten; **Clip extreme outliers** in the **Y axis...** panel, or a
pinned Min and Max, keeps them readable.

<Figure caption="Twelve per-cell-type BigWigs as one multi-quantitative track over CD8A and MS4A1." src="/img/scatac/pbmc5k_marker_swap.png" />

### Adding a multi-quantitative track

- **"Add a track" form:** paste a list of BigWig URLs, or open several BigWig
  files from your machine.
- **Track selector:** multi-select existing tracks and combine them, as the
  [single-cell pseudobulk tutorial](/docs/tutorials/scrna_pseudobulk) does with
  per-cell-type BigWigs.
- **Config:** see
  [quantitative track configuration](/docs/config_guides/quantitative_track#many-signals-in-one-track).

<Figure caption="The Add a track form's workflow selector, which reaches the multi-quantitative workflow." src="/img/multiwig/addtrack.png" />
<Figure caption="The track selector's ... menu adds tracks to the selection, and the cart icon turns it into a multi-quantitative track." src="/img/multiwig/trackselector.png" />

### Loading bedMethyl as a multi-quantitative track

[modkit](https://github.com/nanoporetech/modkit) pileup writes a
[bedMethyl](https://www.encodeproject.org/data-standards/wgbs/) file, a BED with
the methylation fraction at one CpG for one modification type (e.g. 5mC or 5hmC)
per row. It loads through `BedTabixAdapter` as a `MultiQuantitativeTrack` with
one subtrack per modification type; see
[Loading bedMethyl as a multi-quantitative track](/docs/config_guides/quantitative_track#loading-bedmethyl-as-a-multi-quantitative-track)
for the file and the adapter config, and the
[methylation tutorial](/docs/tutorials/methylation#aggregate-methylation-with-modkit-bedmethyl)
for a worked run. For the per-read view of the same calls, see
[Color by base modifications](/docs/user_guides/alignments_track#modifications-and-methylation)
on the alignments track.

### Clustering rows by score

**Clustering → Cluster rows by score...** in the track menu reorders rows by
signal similarity over the visible region. A sample with patchy coverage
clusters by the values it has, and a log or signed log axis compares values as
it draws them. See [](/docs/user_guides/clustering) for the modes, the
dendrogram, and how to share a result in a session URL. The
[population CNV tutorial](/docs/tutorials/population_cnv#a-deletion-nested-inside-another-on-chr3-sorted-by-clustering)
clusters a copy-number panel.

<Figure caption="The Cluster rows by score dialog (top), and the rows reordered by signal similarity (bottom)." src="/img/multiwig/cluster_dialog.png" />

### Sorting rows by score at one position

Right-click a row at the column you want to rank on and choose **Sort rows by
score here**. The rows reorder by their score at that base, highest at the top.

- **Reset row order**, in the same right-click menu and the track menu, returns
  the rows to their loaded order, undoing a sort, a clustering run or a
  hand-arranged order.
- **A starting order:** the
  [`rows`](/docs/config/linearwiggledisplay/#slot-rows) slot's `sort` lists the
  sources that lead; the rest keep the adapter's order, and the reset returns to
  that order.
- **In a session:** `sortRowsBy` persists the sort, as `runClustering` persists
  a clustering run; see [](/docs/models/linearwiggledisplay).

## Viewing whole-genome coverage for CNV profiling

For a chromosome-scale view of copy-number changes:

- Open the BigWig track
- Show all regions in the assembly
- Leave **Clip extreme outliers** ticked in the **Y axis...** panel, so the
  repeat spikes stay off the axis
- Increase the **Resolution** until the profile looks smooth
- Drag the bottom edge of the track down to make it taller

<Figure caption="A whole-genome coverage BigWig, each chromosome a region." src="/img/bigwig/whole_genome_coverage.png" />

For tumor vs normal on one Y axis, put both signals in one track; for a whole
cohort, the [TCGA cohort copy number tutorial](/docs/tutorials/tcga_cohort_cnv).

Coverage is also shaped by GC content, mappability, repeats and PCR bias, so not
every dip or spike is a copy-number change.

## See also

- [](/docs/tutorials/genomes_basics), a worked example on a hosted BigWig, from
  finding the track to reading it against the gene model
- [Methylation tutorial](/docs/tutorials/methylation)
- [](/docs/tutorials/scrna_pseudobulk)
- [](/docs/user_guides/gwas_track)
- [SV visualization: working with large SVs](/docs/user_guides/sv_visualization#working-with-large-svs)
- [Quantitative track configuration](/docs/config_guides/quantitative_track)
- [LinearWiggleDisplay config schema](/docs/config/linearwiggledisplay)
