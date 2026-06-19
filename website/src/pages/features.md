---
layout: '../layouts/MarkdownLayout.astro'
title: JBrowse 2 Feature Overview
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

- **Hi-C contact matrices** - render `.hic` contact data alongside other tracks

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

JBrowse 2 supports multiple view types that can be shown simultaneously in the
app. Third-party plugins can also add new view types.

- **Linear genome view** - The primary view for browsing genomic data along a
  reference sequence. Supports multiple tracks, zooming, navigation, and split
  view for comparing two regions simultaneously

- **Circular view** - Whole genome overview of chromosomal translocations. VCF
  breakend `<BND>` and `<TRA>` features are rendered as arcs across the genome

- **Breakpoint split view** - Shows the connection between long split alignments
  or paired-end reads across chromosomes using stacked linear genome views

- **Dotplot view** - Zoomable comparison of whole genome alignments or synteny
  datasets

- **Linear synteny view** - Exploration of syntenic alignments using stacked
  linear genome views

- **SV inspector** - Spreadsheet-like view of structural variants with a linked
  circular overview for visual context

- **Tabular view** - Open BED, VCF, CSV, TSV, or bespoke formats like
  STAR-fusion output in a sortable, filterable table

## Supported data formats

Core JBrowse 2 supports the following formats. Plugins extend this list further.

- Indexed FASTA / BGZip indexed FASTA
- 2bit
- BAM / CRAM
- htsget
- VCF (Tabix-indexed or plain text)
- GFF3 (Tabix-indexed or plain text)
- BED (Tabix-indexed or plain text)
- BigBed
- BigWig
- .hic (Hi-C contact matrix)
- JBrowse 1 nested containment lists (NCLists)
- CSV, TSV, BEDPE, STAR-fusion output (tabular view)
- UCSC track hubs [^1]

### Synteny and dotplot formats

- PAF
- Chain
- Delta
- Pairwise indexed format (PIF)
- [MCScan (Python version)](https://github.com/tanghaibao/jcvi)

## Integration and embedding

The JBrowse 2 platform and plugins are designed from the ground up to be modular
and reusable. Individual views (linear, circular, tabular, etc.) can be packaged
as embeddable components for other web applications, as demonstrated by
[@jbrowse/react-linear-genome-view](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view).

See the full list of
[embedded components](https://jbrowse.org/jb2/docs/embedded_components/).

[^1]:
    Requires the trackhub server to allow
    [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
