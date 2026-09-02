---
title: Quantitative track
description: BigWig/BedGraph signal tracks
guide_category: Track types
---

**TL;DR:** BigWig and BedGraph files store genome-wide quantitative signals
(read depth, ChIP-seq enrichment, conservation scores). JBrowse renders them as
an XY plot, a density heatmap, a line, or a scatter plot, switchable from the
track menu's **Plot type** submenu.

## Rendering types

The track menu's **Plot type** submenu (backed by the display's
[`defaultRendering`](/docs/config/linearwiggledisplay/#slot-defaultrendering)
slot) offers these styles:

- XY plot - filled bar chart
- Density - a single-row heatmap, compact for many tracks at once
- Line (step) - the tops of the bars as a stepped line
- Line (interpolated) - midpoint to midpoint, smoother for sparse signals
- Scatter - individual points, for sparse data

<Figure caption="The same BigWig rendered in every plot type at once (XY plot, Density, Line (step), Line (interpolated), and Scatter), so the styles can be compared directly. Switch a track between them from its Plot type menu." src="/img/bigwig_line.png" />

## Score options

**Plot type** and **Resolution** are top-level track menu items; the rest of the
settings below are grouped under **Score**.

### Autoscale type

The Y-axis range (the display's
[`autoscale`](/docs/config/linearwiggledisplay/#slot-autoscale) slot). All three
rescale to the region in view and differ in how they treat outliers:

- Local - the plain min and max, so one anomalous position flattens the rest
- Local (99th percentile) - clips the outermost 1% of each sign
- Local ± 3σ - three standard deviations of the local signal, a harder clip when
  the spikes are very tall

### Summary score mode

Zoomed out, a BigWig serves precomputed summary bins, and this picks which
statistic a pixel draws: **Minimum**, **Maximum**, **Average**, or **Whiskers**,
a darker average band inside the lighter min-to-max range
([`summaryScoreMode`](/docs/config/linearwiggledisplay/#slot-summaryscoremode)).
Density mode draws the average, since it maps score to color.

A narrow peak fades out across a whole chromosome when averaged over a wide bin.
**Maximum** keeps it visible.

### Other score options

- Scale type - linear or log Y axis
- Resolution - overrides the resolution chosen from the view width
- Set min/max score - pins the Y axis, for comparison across samples

## Viewing whole-genome coverage for CNV profiling

For a chromosome-scale view of copy-number changes:

- Open the BigWig track
- Show all regions in the assembly
- Set **Autoscale type** to **Local ± 3σ** to clip outlier spikes
- Increase the **Resolution** until the profile looks smooth
- Drag the bottom edge of the track down to make it taller

<Figure caption="Whole-genome CNV coverage profile from a BigWig file. Each chromosome is shown as a separate region; the signal represents read depth normalized by the pipeline. Copy-number gains appear as elevated signal; losses as depressed signal." src="/img/bigwig/whole_genome_coverage.png" />

For tumor vs normal on one Y-axis, see
[Multi-quantitative tracks](/docs/user_guides/multiquantitative_track); for a
whole cohort, the
[TCGA cohort copy number tutorial](/docs/tutorials/tcga_cohort_cnv).

Coverage is also shaped by GC content, mappability, repeats and PCR bias, so not
every dip or spike is a copy-number change.

## See also

- [](/docs/tutorials/genomes_basics), a worked example on a hosted BigWig, from
  finding the track to reading it against the gene model
- [](/docs/user_guides/multiquantitative_track)
- [](/docs/user_guides/gwas_track)
- [SV visualization: working with large SVs](/docs/user_guides/sv_visualization#working-with-large-svs)
- [Quantitative track configuration](/docs/config_guides/quantitative_track)
- [LinearWiggleDisplay config schema](/docs/config/linearwiggledisplay)
- [Gallery: coverage, copy number, and epigenomics](/gallery/#coverage)
