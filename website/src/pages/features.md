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

## Key features

- Status updates during track loading (e.g. "Downloading BAM index...")
- Sort, color, and filter alignments by BAM/CRAM tags and other options
- Web workers for parallel track parsing and rendering
- Interactive configuration editing in the app
- Flip / reverse complement the linear view
- Hi-C contact matrix rendering
- Multiple chromosomes in a single linear view
- Sort and color read pileup in alignment tracks
- Soft clipping visualization in alignment tracks
- Sequence search within the visible region
- SVG export of the current view
- Can open UCSC track hubs [^1]
- Add and remove plugins without running scripts
- Non-administrator users can open tracks and share sessions with others
- Embeddable directly in React applications [^2]
- Embeddable in JavaScript projects via NPM [^3]

## Supported data formats

Core JBrowse 2 supports the following formats. Plugins extend this list further.

- Indexed FASTA / BGZip indexed FASTA
- 2bit
- BAM / CRAM
- htsget
- VCF (Tabix-indexed or plain text)
- GFF3 (Tabix-indexed)
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
