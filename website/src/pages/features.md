---
layout: '../layouts/MarkdownLayout.astro'
title: JBrowse 2 Feature Overview
description:
  A GPU-accelerated, fully client-side genome browser with linked views,
  structural variant and synteny visualization, deep alignments and methylation
  inspection, population variants, Hi-C, and an extensible plugin system,
  running on the web, on desktop, or embedded in your own app.
---

# JBrowse 2 feature overview

JBrowse 2 is a pluggable, GPU-accelerated, fully client-side genome browser. The
same core runs as a web app on static hosting (no server required), as a
cross-platform desktop app, and as embeddable components inside other websites,
notebooks, and R.

This page is a curated tour, not an exhaustive checklist. For the definitive,
always-current lists, see the
[track and display types](/docs/config_guides/tracks) and
[supported file types](/docs/config_guides/file_types) references, both
generated directly from the source. For visuals, browse the [gallery](/gallery/).

## What sets JBrowse apart

- **GPU-accelerated rendering** - each track uploads its data to the GPU once,
  then zooming and panning redraw from that data instead of re-fetching and
  re-rendering. Scroll-zoom and drag-pan are continuous and immediate on every
  track type, even on whole-genome views. Browsers without WebGPU or WebGL2 fall
  back to a Canvas2D renderer with the same behavior.
- **Fully client-side, no server** - host the whole app on static storage like
  S3 or GitHub Pages. Indexed files (BAM, CRAM, BigWig, tabix) are read by HTTP
  byte-range requests, so only the bytes in view are fetched and multi-gigabyte
  files work without a backend. Your data can stay on your own machine.
- **Local files that survive a refresh** - open files from disk in the web app,
  and JBrowse retains access across page reloads using the
  [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle)
  (handles persisted in IndexedDB), so you do not have to re-pick them every
  time.
- **Reproducible, shareable sessions** - the full state of a session encodes
  into a URL. Share a link or bookmark it, and it reopens exactly as you left
  it.
- **Runtime plugins** - install community plugins from the in-app plugin store
  without rebuilding or redeploying anything.
- **Exports match the screen** - SVG export reuses the same drawing code as the
  on-screen renderer, so a figure looks exactly like what you saw.

## View types

Any number of these can be open at once and linked together, and plugins can add
more. See the [user guide](/docs/user_guide) for walkthroughs of each.

- **Linear genome view** - browse tracks along a reference, with split view and
  multiple regions side by side
- **Circular view** - whole-genome overview of translocations and other
  rearrangements, drawn as arcs, with zoom-to-cursor
- **Dotplot view** - zoomable whole-genome alignment and synteny comparison,
  with lockable aspect ratio and cursor-anchored zoom
- **Linear synteny view** - stacked genomes with their syntenic alignments drawn
  between them, including multi-way and all-vs-all comparisons
- **Breakpoint split view** - connect split or paired-end reads across
  chromosomes with stacked linear views
- **SV inspector** - a sortable, filterable spreadsheet of structural variants
  with a linked circular overview
- **Spreadsheet view** - BED, VCF, CSV/TSV, or bespoke formats like STAR-fusion
  output in a sortable, filterable table

## Track and data types

JBrowse renders a wide range of data types, each with display modes tuned to it.
For the complete track-to-display mapping, see the
[track and display types reference](/docs/config_guides/tracks).

- **Sequence** - [reference sequence](/docs/user_guides/feature_sequence) with
  six-frame translation, GC content, and GC-skew
- **Genes and features** - GFF3, GTF, BED, and BigBed with gene glyphs,
  subfeatures, collapse-introns, and automatic `itemRgb` / bigBed coloring
- **Alignments** - [BAM, CRAM, and htsget](/docs/user_guides/alignments_track)
  in pileup, coverage, and paired/arc modes, with sorting, grouping by
  sample/tag/chain, tag coloring, per-base quality, sashimi junction arcs, and a
  discordant-pairs SAMplot mode
- **Base modifications and methylation** - per-modification-type toggles,
  two-color and "show only" modes, bisulfite / EM-seq mode, and CpG/CHG/CHH
  context
- **Quantitative signal** - BigWig and bedGraph as XY, line, density, or scatter
  plots, with multi-wiggle overlays, hierarchical-clustering group-by, and local
  or global autoscaling
- **Variants** - [VCF variant tracks](/docs/user_guides/multivariant_track),
  structural variants, and population-scale multi-sample variant matrices with
  virtual scrolling
- **GWAS / Manhattan** -
  [genome-wide association results](/docs/user_guides/gwas_track) as a Manhattan
  plot
- **Hi-C** - [`.hic` contact matrices](/docs/user_guides/hic_track) with
  selectable, zoom-tracking resolution
- **Multiple alignment (MAF)** - [per-sample rows](/docs/user_guides/maf_track)
  with CDS frame overlays and a per-row percent-identity / conservation readout
- **Synteny** -
  [PAF, chain, delta, PIF, and MCScan](/docs/user_guides/linear_synteny_view)
  alignments between assemblies, colored by identity or mapping quality
- **Multi-row feature / chromosome painting** - many feature rows in one track
  with clustering and per-position sorting, for local-ancestry and ChromHMM
  views

## Analysis and interaction

- **Search** - jump to a gene or feature by name using a text index, or to any
  region by locstring, with a "recent locations" menu
- **Sort, group, color, and filter** - reshape alignment, variant, and feature
  tracks interactively from the track menu
- **Color variants by consequence, impact, or SV type** - read SnpEff/VEP
  annotations, filter by no-call fraction, and view phased haplotypes
- **Linkage disequilibrium coloring** - LocusZoom-style color-by-LD-to-a-SNP,
  backed by precomputed PLINK `.ld` matrices
- **[BLAT and in-silico PCR](/docs/user_guides/blat)** - align a sequence
  against a genome, or find where a primer pair amplifies, against hosted UCSC
  databases
- **[CRISPR guide and motif search](/docs/user_guides/sequence_search)** -
  discover guide-RNA / PAM candidates (with per-guide GC% and poly-T flags) or
  arbitrary sequence motifs directly against the reference
- **Alternative genetic codes** - NCBI `transl_table` resolved per reference
  sequence, plus `transl_except` for selenocysteine and other exceptions
- **Highlight or isolate features** - highlight a feature, or "show only" it to
  mute everything else, baked into SVG export
- **Feature details** - click any feature for a panel with its attributes and
  subfeatures

## Working with your data

- **Edit any track's settings in-app** - open the configuration editor for any
  track, with a filter box and an "advanced settings" toggle. Non-admin changes
  become a personal override that travels with the session, not the shared
  config
- **Pin a setting as your default** - pin almost any track setting (color
  scheme, feature height, group-by, ...) as the default; it badges affected
  tracks and rides along in a shared link
- **Track hubs and connections** - load UCSC track hubs and JBrowse connections
  by URL
- **Bulk and faceted track management** - add many tracks at once, and filter,
  sort, and multi-select in the faceted track selector
- **Determinate download progress** - index, BigWig, and tabix fetches report
  real progress instead of an indeterminate spinner
- **Pre-loaded genomes** - launch any of a
  [large database of species](https://genomes.jbrowse.org) without configuring
  an assembly yourself

## Supported data formats

JBrowse reads common genomics formats directly in the browser: sequence (FASTA,
2bit), alignments (BAM, CRAM, htsget), features (GFF3, GTF, BED, BigBed),
quantitative signal (BigWig, bedGraph), variants (VCF), Hi-C (`.hic`), synteny
(PAF, chain, delta, PIF, MCScan), multiple alignment (MAF), linkage
disequilibrium (PLINK `.ld`), and tabular data (CSV, TSV, BEDPE). It also
connects to UCSC track hubs, and plugins add more.

For the complete list, every format and the adapter it maps to, see
[supported file types](/docs/config_guides/file_types).

## Sharing and export

- **Shareable sessions** - capture a session as a compressed share link or as
  plaintext JSON, or bookmark it to return later. Bookmarks can travel with the
  session too
- **Publication-ready export** - export any view as an SVG that matches the
  screen, or high-resolution PNG, with a font selector. Render static images
  from the command line with [@jbrowse/img](/docs/jbrowse-img)
- **Desktop to web** - export a desktop session to a shareable web link

## Integration and embedding

The JBrowse 2 platform and its plugins are modular and reusable. Individual
views can be packaged as prop-driven components for other applications.

- **Embedded components** - drop a genome view into your own web app with
  [@jbrowse/react-linear-genome-view](/docs/embedded_components) and related
  packages, configured declaratively through props and an `init` field
- **R** - genome views as an htmlwidget in Shiny, R Markdown, or the console
  with [JBrowseR](/docs/jbrowser)
- **Python** - genome views as an anywidget in Jupyter, Colab, VS Code, or
  marimo with [JBrowse Jupyter](/docs/jbrowse_jupyter)
- **Automation** - drive URL, embedded, and session launches from a shared
  [init spec](/docs/automating)

## Extensibility

- **Plugins** - add view types, tracks, adapters, renderers, and widgets. See
  the [developer guide](/docs/developer_guide) to build one
- **Plugin store** - install community plugins directly from within the app, no
  rebuild required
- **Configuration and callbacks** - drive appearance and behavior through
  configuration, including JEXL callbacks for dynamic coloring and filtering

See the [gallery](/gallery/) for examples of what JBrowse 2 can do, or dive
into the [user guide](/docs/user_guide) to get started.
