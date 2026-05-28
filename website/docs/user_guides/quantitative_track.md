---
id: quantitative_track
title: Quantitative tracks
description: BigWig/BedGraph signal tracks
guide_category: Track types
---

BigWig and BedGraph files store genome-wide quantitative signals — read depth,
ChIP-seq enrichment, conservation scores, and more. JBrowse renders them as
continuous tracks with several visual styles.

## Renderer types

The **Rendering type** option offers four styles:

- **XY plot** (default) — filled bar chart; good for coverage and discrete peaks
- **Density** — a single-row heatmap where color intensity encodes the value;
  compact for browsing many tracks at once
- **Line** — connects data points with a line; better for smooth signals and
  fine resolution comparisons
- **Scatter** — draws individual points without filling; useful for sparse data
  and seeing single values

<Figure caption="XY plot (bar) renderer for a wiggle/BigWig track. Each bar represents the signal value at that position; colored mismatches relative to the reference appear in the coverage of alignment-derived BigWigs." src="/img/bigwig_xyplot.png" />

<Figure caption="Line renderer for the same track. The line renderer emphasizes the shape of the signal rather than amplitude, and is useful for comparing multiple overlapping tracks." src="/img/bigwig_line.png" />

## Autoscale options

The **Autoscale type** option controls the Y-axis range:

- **Local** (default) — rescales to the current view (useful when navigating to
  regions with very different signal levels)
- **Global** — scales to the full range of values in the file (good for
  consistent comparison across sessions)
- **Global ± 3σ** — scales to three standard deviations around the file-wide
  mean
- **Local ± 3σ** — scales to three standard deviations of the local signal,
  clipping outlier spikes; recommended for coverage tracks that have a few
  anomalously high positions

## Other track options

- **Scale type** — switch the Y axis between linear and log scaling; log is
  useful when signal spans several orders of magnitude
- **Resolution** — manually increase or decrease the data resolution; JBrowse
  auto-selects resolution based on view width but you can override it
- **Set min/max score** — pin the Y axis to specific values for side-by-side
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
[Multi-quantitative tracks](/docs/user_guides/multiquantitative_track).
