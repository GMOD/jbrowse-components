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

- Circos view - Used to show whole genome overview of chromosomal
  translocations. The VCF breakend `<BND>` and `<TRA>` type features can be
  rendered as arcs across the view

- Breakpoint split view - Our breakpoint split view shows the connection
  between long split alignments or paired end reads across multiple chromosomes
  using stacked linear genome views

- Dotplot view - Zoomable comparison of whole genome alignments or synteny
  datasets

- Linear synteny view - Another option for exploration of syntenic alignments
  using stacked linear genome views

- Spreadsheet-like view - Open formats like BED, VCF, CSV, TSV, or even bespoke
  formats like STAR-fusion in the spreadsheet view

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
| Built-in spreadsheet-like view for datasets                         | :heavy_check_mark:      | :x:                |
| Can connect to UCSC track hubs                                      | :heavy_check_mark: [^1] | :x:                |
| Can load plugins at run-time instead of build time                  | :heavy_check_mark: [^2] | :x:                |
| Non-admin users can open tracks and share them with others          | :heavy_check_mark: [^3] | :x:                |
| Name searching e.g. ability to type a gene name/ID to search for it | :x:                     | :heavy_check_mark: |
| URL query params API e.g. specifying ?loc=chr1:1-100 in URL bar     | :x:                     | :heavy_check_mark: |

[^1] Requires that the trackhub host support CORS for the jbrowse-web, jbrowse-desktop does not require this however

[^2] This means using plugins does not require a rebuild of the app. Our config_demo.json exemplifies loading several plugins

[^3] These are so-called "session tracks" and can be shared via our URL sharing mechanism. Users can currently open tracks only from URLs and not local files on their computer as of writing.

## Data format support

Here is a short list of current data format support

- CRAM/BAM
- htsget protocol for BAM files
- VCF (tabixed)
- GFF3 (tabixed)
- BED (tabixed)
- BigBed
- BigWig
- JBrowse 1 NCList (backcompat)
- plain text VCF, BED, CSV, TSV, BEDPE, STAR-fusion output (spreadsheet formats)
- PAF (synteny/dotplot)
- Indexed FASTA/BGZip indexed FASTA
- 2bit
- .hic (Hi-C contact matrix visualization)
