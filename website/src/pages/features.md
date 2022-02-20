# JBrowse 2 feature overview

## New view types

JBrowse 2 supports creating new "view types" that can be shown alongside other
views in the app. Importantly, these can be added by third-party plugins.

The view types available by default with JBrowse 2 web include

- Circular view - Used to show whole genome overview of chromosomal
  translocations. The VCF breakend `<BND>` and `<TRA>` type features can be
  rendered as arcs across the view

- Breakpoint split view - Our breakpoint split view shows the connection
  between long split alignments or paired end reads across multiple chromosomes
  using stacked linear genome views

- Dotplot view - Zoomable comparison of whole genome alignments or synteny
  datasets

- Linear synteny view - Another option for exploration of syntenic alignments
  using stacked linear genome views

- Tabular view - Open formats like BED, VCF, CSV, TSV, or even bespoke
  formats like STAR-fusion in the tabular view

## Feature comparison

| Feature                                                                   | JBrowse 2               | JBrowse 1          |
| ------------------------------------------------------------------------- | ----------------------- | ------------------ |
| Status updates during track loading (e.g. Downloading BAM index...)       | :heavy_check_mark:      | :x:                |
| Sort, color, and filter by BAM/CRAM tags and other advanced options       | :heavy_check_mark:      | :x:                |
| Uses webworkers for parsing and rendering tracks                          | :heavy_check_mark:      | :x:                |
| Supports interactive editing of configuration in the app                  | :heavy_check_mark:      | :x:                |
| Can "flip" or reverse complement the linear view                          | :heavy_check_mark:      | :x:                |
| Hi-C data rendering                                                       | :heavy_check_mark:      | :x:                |
| Can display multiple chromosomes in a single view                         | :heavy_check_mark:      | :x:                |
| Sort read pileup in alignments tracks                                     | :heavy_check_mark:      | :x:                |
| Show soft clipping in alignments tracks                                   | :heavy_check_mark:      | :x:                |
| Built-in tabular view for datasets                                        | :heavy_check_mark:      | :x:                |
| Can open UCSC track hubs                                                  | :heavy_check_mark: [^1] | :x:                |
| Add and remove plugins without running scripts                            | :heavy_check_mark:      | :x:                |
| Non-administrator users can open tracks and share them with others        | :heavy_check_mark:      | :x:                |
| Embeddable in JavaScript projects using NPM                               | :heavy_check_mark: [^2] | :x:                |
| Embeddable directly in React applications                                 | :heavy_check_mark: [^2] | :x:                |
| Ability to search by gene name/ID (added in 1.4.0)                        | :heavy_check_mark:      | :heavy_check_mark: |
| URL query API e.g. specifying ?loc=chr1:1-100 in URL bar (added in 1.6.4) | :heavy_check_mark:      | :heavy_check_mark: |

[^1] If using with JBrowse 2 web, requires that trackhub server be configured to allow [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

[^2] See [`@jbrowse/react-linear-genome-view` on npm](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view)

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

The JBrowse 2 platform and plugins are designed from the ground up to be
modular and reusable. For example, individual JBrowse 2 views (e.g. linear,
circular, tabular, etc) can be packaged to be embeddable in other web
applications (as demonstrated by the
[@jbrowse/react-linear-genome-view](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view)
package).
