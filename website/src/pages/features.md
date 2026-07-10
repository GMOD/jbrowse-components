---
layout: '../layouts/MarkdownLayout.astro'
title: JBrowse 2 Feature Overview
description:
  Multiple linked view types, structural variant and synteny visualization, deep
  alignments inspection, Hi-C, and an extensible plugin system — all running on
  the web, on desktop, or embedded in your own app.
---

# JBrowse 2 feature overview

JBrowse 2 is a pluggable, fully client-side genome browser. The same core runs
as a web app on static hosting (no server required), as a cross-platform desktop
app, and as embeddable React components inside other websites.

## Highlights

- **Many view types in one session** - open linear, circular, dotplot, synteny,
  breakpoint, and tabular views side by side and link them together, rather than
  being limited to a single linear track viewer

- **Synteny and structural variants** - compare whole genomes with dotplot and
  linear synteny views, and inspect SVs with the breakpoint split view, circular
  arcs, and the spreadsheet-style SV inspector. This was the original motivation
  for JBrowse 2 and remains a core strength

- **Deep alignments inspection** - sort, color, and filter reads by BAM/CRAM
  tag, including base modification / methylation coloring, with per-track
  display modes for pileup and coverage

- **Hi-C, multi-sample variants, and MAF** - render `.hic` contact matrices,
  population-scale variant matrices, and multiple-alignment (MAF) data alongside
  everything else

- **Pre-loaded genomes** - launch any of a
  [large database of species](https://genomes.jbrowse.org) without configuring
  an assembly yourself

- **Extensible** - add view types, tracks, adapters, and renderers through
  plugins, installable directly from the in-app plugin store

- **Runs anywhere** - web, desktop, embedded React components, Jupyter, and R;
  client-side rendering means data can stay on the user's machine

- **Shareable and exportable** - share a live view via URL, and export any view
  as a publication-ready SVG

See the [demos](/demos/) and [gallery](/gallery/) for more examples of what
JBrowse 2 can do.

## View types

Any number of these can be open at once and linked together, and plugins can add
more. See the [user guide](https://jbrowse.org/jb2/docs/user_guide/) for full
walkthroughs.

- **Linear genome view** - browse tracks along a reference, with split view for
  comparing regions side by side
- **Circular view** - whole-genome overview of translocations, drawn as arcs
- **Breakpoint split view** - connect split or paired-end reads across
  chromosomes with stacked linear views
- **Dotplot view** - zoomable whole-genome alignment / synteny comparison
- **Linear synteny view** - stacked genomes with their syntenic alignments drawn
  between them
- **SV inspector** - spreadsheet of structural variants with a linked circular
  overview
- **Spreadsheet view** - BED, VCF, CSV/TSV, or bespoke formats like STAR-fusion
  output in a sortable, filterable table

## Supported data formats

JBrowse reads common genomics formats directly in the browser — sequence (FASTA,
2bit), alignments (BAM, CRAM, htsget), features (GFF3, GTF, BED, BigBed),
quantitative signal (BigWig, bedGraph), variants (VCF), Hi-C (`.hic`), synteny
(PAF, chain, delta, PIF, MCScan), multiple alignment (MAF), and tabular data
(CSV, TSV, BEDPE). It also connects to UCSC track hubs, and plugins add more.

For the complete list — every format and the adapter it maps to — see
[supported file types](https://jbrowse.org/jb2/docs/config_guides/file_types/).

## Integration and embedding

The JBrowse 2 platform and plugins are designed from the ground up to be modular
and reusable. Individual views (linear, circular, tabular, etc.) can be packaged
as embeddable components for other web applications, as demonstrated by
[@jbrowse/react-linear-genome-view](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view).

See the full list of
[embedded components](https://jbrowse.org/jb2/docs/embedded_components/).
