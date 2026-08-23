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

- XY plot - filled bar chart; good for coverage and discrete peaks
- Density - a single-row heatmap where color intensity encodes the value;
  compact for browsing many tracks at once
- Line (step) - traces the tops of the bars as a stepped line; best for dense
  binned data where each pixel is a real bin
- Line (interpolated) - joins the midpoint of each data point straight to the
  next; smoother for sparse or discrete signals where the stepped plateaus look
  wrong
- Scatter - draws individual points without filling; useful for sparse data and
  seeing single values

<Figure caption="The same BigWig rendered in every plot type at once (XY plot, Density, Line (step), Line (interpolated), and Scatter), so the styles can be compared directly. Switch a track between them from its Plot type menu." src="/img/bigwig_line.png" />

## Score options

**Plot type** and **Resolution** are top-level track menu items; the rest of the
settings below are grouped under **Score**.

### Autoscale type

Controls the Y-axis range (the display's
[`autoscale`](/docs/config/linearwiggledisplay/#slot-autoscale) slot). All three
rescale to the region in view, and differ in how they treat outliers:

- Local - the plain min and max of the visible data, so one anomalous position
  flattens everything else against the axis
- Local (99th percentile) - clips the outermost 1% of each sign, which keeps a
  few extreme positions from setting the scale for the whole track
- Local ± 3σ - scales to three standard deviations of the local signal, a harder
  clip than the percentile when the spikes are very tall

### Summary score mode

Zoomed out, a BigWig serves precomputed summary bins rather than per-base
values, and this picks which statistic of the bin a pixel draws: **Minimum**,
**Maximum**, **Average**, or **Whiskers**, which draws all three at once as a
darker average band inside the lighter min-to-max range
([`summaryScoreMode`](/docs/config/linearwiggledisplay/#slot-summaryscoremode)).
Density mode maps score to color rather than height, so it has no whiskers
presentation and draws the average instead.

A narrow peak that is obvious at full resolution can fade out across a whole
chromosome, because averaging it over a wide bin flattens it. **Maximum** keeps
it visible.

### Other score options

- Scale type - switch the Y axis between linear and log scaling; log is useful
  when signal spans several orders of magnitude
- Resolution - JBrowse auto-selects resolution from the view width; use this to
  override it
- Set min/max score - pin the Y axis to specific values for side-by-side
  comparison across samples

## Viewing whole-genome coverage for CNV profiling

To get a chromosome-scale view of copy-number changes:

- Open your BigWig track
- Show all regions in the assembly to get the whole-genome overview
- Set **Autoscale type** to **Local ± 3σ** to clip outlier spikes
- Increase the **Resolution** a few times until the profile looks smooth

Drag the bottom edge of the track down to make it taller.

<Figure caption="Whole-genome CNV coverage profile from a BigWig file. Each chromosome is shown as a separate region; the signal represents read depth normalized by the pipeline. Copy-number gains appear as elevated signal; losses as depressed signal." src="/img/bigwig/whole_genome_coverage.png" />

For tumor vs normal comparisons using two BigWig tracks on the same Y-axis, see
[Multi-quantitative tracks](/docs/user_guides/multiquantitative_track). To scale
this up to a whole cohort, one row per tumor, see the
[TCGA cohort copy number tutorial](/docs/tutorials/tcga_cohort_cnv).

Coverage is shaped by GC content, mappability, repeats, PCR bias, and (when
mapping a divergent strain) hyper-divergent regions, so not every dip or spike
is a true copy-number change.

## See also

- [](/docs/tutorials/genomes_basics), a worked example on a hosted BigWig, from
  finding the track to reading it against the gene model
- [](/docs/user_guides/multiquantitative_track)
- [](/docs/user_guides/gwas_track)
- [SV visualization: working with large SVs](/docs/user_guides/sv_visualization#working-with-large-svs)
- [Quantitative track configuration](/docs/config_guides/quantitative_track)
- [LinearWiggleDisplay config schema](/docs/config/linearwiggledisplay)
- [Gallery: coverage, copy number, and epigenomics](/gallery/#coverage)
