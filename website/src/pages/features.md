# JBrowse 2 features

JBrowse 2 was designed to address some shortcomings that were going to be large
hacks or difficult to add to the JBrowse 1, and enable brand new modalities
such as new view types that can be displayed alongside our linear genome view.

## Feature comparison

| Feature                                                                                    | JBrowse 2               | JBrowse 1 |
| ------------------------------------------------------------------------------------------ | ----------------------- | --------- |
| Displays status updates during track loading (e.g. Downloading BAM index...)               | :heavy_check_mark:      | :x:       |
| Uses webworkers for parsing and rendering tracks                                           | :heavy_check_mark:      | :x:       |
| Supports interactive editing of configuration in the app                                   | :heavy_check_mark:      | :x:       |
| Can "flip" or reverse complement the linear view                                           | :heavy_check_mark:      | :x:       |
| Supports htsget                                                                            | :heavy_check_mark:      | :x:       |
| Hi-C data rendering                                                                        | :heavy_check_mark:      | :x:       |
| Can display multiple chromosomes in a single view                                          | :heavy_check_mark:      | :x:       |
| Sort read pileup in alignments tracks                                                      | :heavy_check_mark:      | :x:       |
| Show soft clipping in alignments tracks                                                    | :heavy_check_mark:      | :x:       |
| Supports new view types such as circular, dotplot, etc.                                    | :heavy_check_mark:      | :x:       |
| Connect to UCSC trackHubs                                                                  | :heavy_check_mark: [^1] | :x:       |
| Built in spreadsheet for flipping through variant datasets                                 | :heavy_check_mark:      | :x:       |
| Ability for non-admin users to open tracks and share them with others in their session URL | :heavy_check_mark:      | :x:       |

[^1] Requires that the trackhub host support CORS for the jbrowse-web, jbrowse-desktop does not require this however

## New view types

JBrowse 2 also supports things never before really possible in JBrowse 1 such
as entirely new "view types" that can be shown alongside other views in the
app. This includes:

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

- Spreadsheet view - Open formats like BED, VCF, CSV, TSV, or even bespoke
  formats like STAR-fusion in the spreadsheet view

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
