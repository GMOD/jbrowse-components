---
layout: '../layouts/MarkdownLayout.astro'
title: JBrowse 2 Feature Overview
---

# JBrowse 2 feature overview

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

## What's new in JBrowse 2

JBrowse 2 was rebuilt from the ground up, with a primary focus on synteny and
structural variant visualization that JBrowse 1 could not support, while also
expanding on many other capabilities. The table below highlights what is new.

| Feature                                                                 | JBrowse 1 | JBrowse 2 |
| ----------------------------------------------------------------------- | :-------: | :-------: |
| Multiple simultaneous view types                                        |     ✗     |     ✓     |
| Circular / dotplot / synteny views                                      |     ✗     |     ✓     |
| Structural variant visualization (breakpoint split view, circular arcs) |     ✗     |     ✓     |
| Hi-C contact matrix                                                     |     ✗     |     ✓     |
| Web worker and WASM speed optimizations                                 |     ✗     |     ✓     |
| Sort, color, and filter alignments by BAM/CRAM tag                      |     ✗     |     ✓     |
| [Large database of pre-loaded species](https://genomes.jbrowse.org)     |     ✗     |     ✓     |
| In-app plugin store                                                     |     ✗     |     ✓     |
| UCSC track hub support [^1]                                             |     ✗     |     ✓     |
| SVG export of the current view                                          |     ✗     |     ✓     |
| Embeddable as React / NPM components [^2] [^3]                          |     ✗     |     ✓     |

See the [demos](/demos/) and [gallery](/gallery/) for more examples of what
JBrowse 2 can do.

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

## Synteny and dotplot formats

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

[^2]:
    See
    [`@jbrowse/react-linear-genome-view` on npm](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view)

[^3]:
    See the full list of
    [embedded components](https://jbrowse.org/jb2/docs/embedded_components/)
