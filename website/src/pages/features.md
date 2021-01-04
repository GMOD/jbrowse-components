# JBrowse 2 features

One of the biggest features of JBrowse 2 is the ability to have multiple views
on the same screen, or to compose multiple views together (e.g. a synteny view
combines multiple single linear genome views)

![](./img/linear_longread.png)
Example showing multiple views on the same screen, an alignments track on top
and a long read vs reference comparison with the "synteny" view

For more screenshots see the [gallery](./gallery)

## New view types

JBrowse 2 supports creating new "view types" that can be shown alongside other
views in the app. Importantly, plugins can also add new views, allowing for
extensibility by third party devs. By default, JBrowse 2 includes these
view types

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

## Feature comparison of JBrowse 2 vs JBrowse 1

| Feature                                                             | JBrowse 2               | JBrowse 1          |
| ------------------------------------------------------------------- | ----------------------- | ------------------ |
| Status updates during track loading (e.g. Downloading BAM index...) | :heavy_check_mark:      | :x:                |
| Uses webworkers for parsing and rendering tracks                    | :heavy_check_mark:      | :x:                |
| Supports interactive editing of configuration in the app            | :heavy_check_mark:      | :x:                |
| Can "flip" or reverse complement the linear view                    | :heavy_check_mark:      | :x:                |
| Hi-C data rendering                                                 | :heavy_check_mark:      | :x:                |
| Can display multiple chromosomes in a single view                   | :heavy_check_mark:      | :x:                |
| Sort read pileup in alignments tracks                               | :heavy_check_mark:      | :x:                |
| Show soft clipping in alignments tracks                             | :heavy_check_mark:      | :x:                |
| Built-in tabular view for datasets                                  | :heavy_check_mark:      | :x:                |
| Can open UCSC track hubs                                            | :heavy_check_mark: [^1] | :x:                |
| Can load plugins at run-time instead of build time                  | :heavy_check_mark: [^2] | :x:                |
| Non-administrator users can open tracks and share them with others  | :heavy_check_mark: [^3] | :x:                |
| Embeddable in JavaScript projects using NPM                         | :heavy_check_mark:      | :x:                |
| Name searching e.g. ability to type a gene name/ID to search for it | :x:                     | :heavy_check_mark: |
| URL query params API e.g. specifying ?loc=chr1:1-100 in URL bar     | :x:                     | :heavy_check_mark: |

[^1] Requires that the trackhub host support CORS for the jbrowse-web, jbrowse-desktop does not require this however

[^2] This means using plugins does not require a rebuild of the app. Our config_demo.json exemplifies loading several plugins

[^3] These are "session tracks" and can be shared via URL

## Data formats

Here is a short list of data formats supported in core JBrowse 2. Plugins are available for additional data formats.

- CRAM/BAM
- htsget
- VCF (tabixed)
- GFF3 (tabixed)
- BED (tabixed)
- BigBed
- BigWig
- JBrowse 1 nested containment lists (backward compatible)
- plain text VCF, BED, CSV, TSV, BEDPE, STAR-fusion output (tabular formats)
- PAF (synteny/dotplot)
- Indexed FASTA/BGZip indexed FASTA
- 2bit
- .hic (Hi-C contact matrix visualization)

## Embedding JBrowse 2

With JBrowse 2 we have some new concepts for embeddability. For example, we can
install just the linear-genome-view and use it as a react component.

The @jbrowse/react-linear-genome-view is specialized for certain use cases and
is not hooked up to session sharing, URL params, or anything but instead is a
simple React component

See here for more details https://www.npmjs.com/package/@jbrowse/react-linear-genome-view

Note that the entire jbrowse-web app that contains multiple views can't
currently be installed via NPM though
