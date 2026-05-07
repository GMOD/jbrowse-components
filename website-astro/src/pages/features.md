---
layout: '../layouts/MarkdownLayout.astro'
title: JBrowse 2 Feature Overview
---

# JBrowse 2 feature overview

## New view types

JBrowse 2 supports creating new "view types" that can be shown alongside other
views in the app. Importantly, these can be added by third-party plugins.

The view types available by default with JBrowse 2 web include

- Circular view - Used to show whole genome overview of chromosomal
  translocations. The VCF breakend `<BND>` and `<TRA>` type features can be
  rendered as arcs across the view

- Breakpoint split view - Our breakpoint split view shows the connection between
  long split alignments or paired end reads across multiple chromosomes using
  stacked linear genome views

- Dotplot view - Zoomable comparison of whole genome alignments or synteny
  datasets

- Linear synteny view - Another option for exploration of syntenic alignments
  using stacked linear genome views

- Tabular view - Open formats like BED, VCF, CSV, TSV, or even bespoke formats
  like STAR-fusion in the tabular view

## Feature comparison

| Feature                                                              | JBrowse 2 | JBrowse 1 |
| -------------------------------------------------------------------- | --------- | --------- |
| Status updates during track loading (e.g. Downloading BAM index...)  | ✓         | ✗         |
| Sort, color, and filter by BAM/CRAM tags and other advanced options  | ✓         | ✗         |
| Uses webworkers for parsing and rendering tracks                     | ✓         | ✗         |
| Supports interactive editing of configuration in the app             | ✓         | ✗         |
| Can "flip" or reverse complement the linear view                     | ✓         | ✗         |
| Hi-C data rendering                                                  | ✓         | ✗         |
| Can display multiple chromosomes in a single view                    | ✓         | ✗         |
| Sort read pileup in alignments tracks                                | ✓         | ✗         |
| Show soft clipping in alignments tracks                              | ✓         | ✗         |
| Built-in tabular view for datasets                                   | ✓         | ✗         |
| Can open UCSC track hubs                                             | ✓ [^1]    | ✗         |
| Add and remove plugins without running scripts                       | ✓         | ✗         |
| Non-administrator users can open tracks and share them with others   | ✓         | ✗         |
| Embeddable in JavaScript projects using NPM                          | ✓ [^3]    | ✗         |
| Embeddable directly in React applications                            | ✓ [^2]    | ✗         |

## Supported data formats

Here is a short list of data formats supported in core JBrowse 2. Plugins are
available for additional data formats.

- CRAM
- BAM
- htsget
- VCF (Tabix-indexed)
- GFF3 (Tabix-indexed)
- BED (Tabix-indexed)
- BigBed
- BigWig
- JBrowse 1 nested containment lists (NCLists)
- plain text VCF, BED, CSV, TSV, BEDPE, STAR-fusion output (tabular formats)
- PAF (synteny/dotplot)
- Indexed FASTA/BGZip indexed FASTA
- 2bit
- .hic (Hi-C contact matrix visualization)

## Integration and embedding

The JBrowse 2 platform and plugins are designed from the ground up to be modular
and reusable. For example, individual JBrowse 2 views (e.g. linear, circular,
tabular, etc) can be packaged to be embeddable in other web applications (as
demonstrated by the
[@jbrowse/react-linear-genome-view](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view)
package).

See the full list of our embedded components
[here](https://jbrowse.org/jb2/docs/embedded_components/).

[^1]: If using with JBrowse 2 web, requires that trackhub server be configured to
allow [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

[^2]: See
[`@jbrowse/react-linear-genome-view` on npm](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view)

[^3]: See the full list of
[embedded components](https://jbrowse.org/jb2/docs/embedded_components/)
