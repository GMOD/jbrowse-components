# @jbrowse/img

Static exports of JBrowse 2 rendering.

## Prerequisites

The tool renders from local or remote files and needs no JBrowse 2 installation.
Requirements:

- NodeJS v23+

## Setup

Install the `@jbrowse/img` package from npm; with a typical Node setup this puts
a `jb2export` command on your PATH.

```bash
npm install -g @jbrowse/img
```

If you are a developer and want to modify the code, see the
[source on GitHub](https://github.com/GMOD/jbrowse-components/tree/main/products/jbrowse-img)

## Quickstart

A multi-track human (hg19) view at the IFFO2 / ALDH4A1 locus (NCBI RefSeq genes,
ClinGen gene–disease mapping, phyloP conservation, and SKBR3 nanopore reads),
rendered straight from public files in a single command (`--aliases` reconciles
the `1` / `chr1` / `NC_000001.10` refname styles across the files):

![A multi-track hg19 view: NCBI RefSeq genes, ClinGen gene-disease mapping, phyloP conservation, and SKBR3 nanopore reads](https://jbrowse.org/jb2-figures/jbrowse-img/1.325b21c2873e.png)

<!-- jb2export: 1 -->

```bash
jb2export --fasta https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz \
  --aliases https://jbrowse.org/genomes/hg19/hg19_aliases.txt \
  --gffgz https://s3.amazonaws.com/jbrowse.org/genomes/hg19/ncbi_refseq/GRCh37_latest_genomic.sort.gff.gz '{"showOnlyGenes":true}' \
  --bigbed https://jbrowse.org/genomes/hg19/clinGen/clinGenGeneDisease.bb \
  --bigwig https://hgdownload.soe.ucsc.edu/goldenpath/hg19/phyloP100way/hg19.100way.phyloP100way.bw \
  --cram https://s3.amazonaws.com/jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.cram \
  --loc 1:19,190,000-19,240,000 --width 1200 --out 1.png
```

The `'{"showOnlyGenes":true}'` after the GFF is a raw-JSON per-track override
(any display setting can be set this way). NCBI RefSeq GFFs carry non-gene
support features (`region`, `match`, `biological_region`) that would otherwise
render as unnamed rows above the genes; `showOnlyGenes` restricts the track to
gene/transcript features.

## Basic usage

### Local files

This runs on local files as a plain node script with no browser involved, using
React SSR to create the SVG

```bash
## generate an indexed fasta e.g. fai file
samtools faidx yourfile.fa

## generate an indexed BAM
samtools index yourfile.bam


## simple rendering of a your local files
jb2export --fasta yourfile.fa --bam yourfile.bam --loc chr1:1,000,000-1,001,000 --out file.svg
```

If `--out` is not specified it writes SVG to stdout

### Remote files

An example with remote files, human hg19 and several tracks. Note the use of
--aliases, which smoothes over refname differences e.g. fasta contains 1 for
chr1, and bigbed contains chr1, gff contains NC_000001.10

<!-- jb2export: remote_files -->

```bash
jb2export --fasta https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz \
  --aliases https://jbrowse.org/genomes/hg19/hg19_aliases.txt \
  --bigbed https://hgdownload.soe.ucsc.edu/gbdb/hg19/bbi/clinvar/clinvarMain.bb \
  --gffgz https://jbrowse.org/genomes/hg19/ncbi_refseq/GRCh37_latest_genomic.sort.gff.gz \
  --bigwig https://jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.regions.bw \
  --loc 1:48,683,542-48,907,531 --width 1200 --out remote_files.png
```

![ClinVar variants above NCBI RefSeq genes across a 220 kb window of hg19 chromosome 1, every file streamed from a public URL](https://jbrowse.org/jb2-figures/jbrowse-img/remote_files.1495a910f238.png)

### Hosted assemblies (genomes.jbrowse.org)

`--hub <name>` pulls a whole assembly config from
[genomes.jbrowse.org](https://genomes.jbrowse.org), supplying the sequence,
cytobands (shown in the overview ideogram), and refName aliasing in place of
`--fasta`/`--aliases`/`--cytobands`. `<name>` is either a UCSC database name
(`hg19`, `hg38`, `mm10`, ...) or a GenArk accession (`GCA_...`/`GCF_...`):

```bash
## refName aliasing comes from the hosted config: "1" resolves to chr1
jb2export --hub hg19 --loc 1:1,000,000-1,100,000 --out out.svg

## a GenArk accession
jb2export --hub GCA_964188535.1 --loc <contig>:1-100000 --out out.svg
```

Every track in the hosted config can be shown by its trackId with `--track`,
which is repeatable and accepts the same display modifiers as the track-type
flags (see [Track modifiers](#track-modifiers)):

<!-- jb2export: hub_tracks -->

```bash
jb2export --hub hg19 --track hg19-ncbiRefSeqCurated --track hg19-clinvarMain \
  --loc chr1:1,020,000-1,040,000 --width 1200 --out hub_tracks.png
```

![NCBI RefSeq genes and ClinVar variants at the start of hg19 chromosome 1, both named by trackId from the hosted hg19 hub](https://jbrowse.org/jb2-figures/jbrowse-img/hub_tracks.89facf2b108a.png)

Hosted trackIds are all prefixed with the assembly name (`hg19-...`), so
`--track` fills that in for you: `--track ncbiRefSeqCurated` resolves to
`hg19-ncbiRefSeqCurated`. Matching is also case-insensitive and works on a
track's display name, and a token that doesn't match anything errors with the
closest trackIds:

```
$ jb2export --hub hg19 --track clinvar ...
Error: --track "clinvar" not found in the config. Did you mean: hg19-clinvarMain,
hg19-clinvarCnv, hg19-dbSnp155ClinVar, ...?
```

Hosted configs also carry a gene text-search index, so `--loc` accepts a **gene
name** and jumps to it:

<!-- jb2export: gene_name_search -->

```bash
jb2export --hub hg19 --track ncbiRefSeqCurated --loc BRCA1 --width 1200 \
  --out gene_name_search.png
```

![The BRCA1 gene, reached by typing its name instead of its coordinates](https://jbrowse.org/jb2-figures/jbrowse-img/gene_name_search.634abbba5248.png)

`--loc` still takes ordinary locstrings (`chr1:1-10000`,
`1:1,000,000-1,100,000`, or `all`); a name that isn't a locstring is looked up
in the index and the view jumps to the top hit.

The `list` subcommand prints hub names and trackIds:

```bash
## every assembly on genomes.jbrowse.org (name — organism — description)
jb2export list

## every track in a hub (trackId, type, name)
jb2export list hg19

## just the tracks whose id or name matches a filter
jb2export list hg19 refseq
```

`--config` also accepts a URL, so you can point at any hosted JBrowse
`config.json` the same way; relative data URIs inside it resolve against the
config's location, exactly as they do in JBrowse web.

## Output formats

The output format is chosen by the extension of `--out`: `.svg`, `.png`, or
`.pdf`. With no `--out`, SVG is written to stdout. PNG and PDF use
`rsvg-convert`, so you will need to install it on your system, e.g. with
`sudo apt install librsvg2-bin`.

```bash
## SVG (vector)
jb2export --fasta yourfile.fa --bam yourfile.bam --loc chr1:1,000,000-1,001,000 --out file.svg

## PNG
jb2export --fasta yourfile.fa --bam yourfile.bam --loc chr1:1,000,000-1,001,000 --out file.png

## PDF
jb2export --fasta yourfile.fa --bam yourfile.bam --loc chr1:1,000,000-1,001,000 --out file.pdf
```

By default the pileup, coverage, and hic layers are rasterized into the SVG to
keep file sizes down. Pass `--noRasterize` to render everything as SVG vectors
instead (larger files, fully editable in vector tools).

### Converting SVG to PNG manually

The tool runs `rsvg-convert` automatically when `--out` ends in `.png`.
Alternatively, you can convert an SVG yourself:

```bash
## with inkscape

sudo apt install inkscape
inkscape --export-type png --export-filename out.png -w 2048 out.svg

## with librsvg

sudo apt install librsvg2-bin
rsvg-convert -w 2048 out.svg -o out.png

## with imagemagick

sudo apt install imagemagick
convert -size 2048x out.svg out.png

```

## Track gallery

The examples below are reproducible with the bundled volvox data (and a couple
of public remote files); see [Track modifiers](#track-modifiers) for the full
list of per-track options used here.

### Alignments tracks

A `--bam`/`--cram` track renders a coverage histogram over a read pileup, with
mismatches highlighted. Reproducible with the bundled volvox alignments:

<!-- jb2export: alignments_pileup -->

```bash
jb2export --fasta data/volvox/volvox.fa --bam data/volvox/volvox-sorted.bam \
  --loc ctgA:1-20000 --width 1200 --out alignments_pileup.png
```

![A coverage histogram over a read pileup, with mismatches highlighted](https://jbrowse.org/jb2-figures/jbrowse-img/alignments_pileup.de1a3ac6c0a2.png)

Track modifiers color, sort, and group the reads. `sort:base` orders the pileup
by the base each read carries at the center position: here, HG008-T PacBio HiFi
reads over the `CUZD1` gene, where the sort pulls every read carrying a ~1.8 kb
somatic deletion into one contiguous band so the heterozygous deletion (and its
coverage dip) pops out of the pileup:

<!-- jb2export: alignments_readgroup -->

```bash
jb2export --hub hg38 --track hg38-ncbiRefSeqCurated height:55 \
  --bam https://jbrowse.org/demos/cgiab/HG008-T_chr10_CUZD1_deletion.bam sort:base height:420 \
  --loc chr10:122,831,700-122,840,800 --width 1200 \
  --out alignments_readgroup.png
```

![HG008-T PacBio HiFi reads over CUZD1, sorted by the base at the center position so the reads carrying a ~1.8 kb somatic deletion cluster into one band](https://jbrowse.org/jb2-figures/jbrowse-img/alignments_readgroup.4f9289261226.png)

`group:tag:HP` splits the pileup into one stacked sub-track per haplotype. This
HG002 ultralong-ONT example (hg19, streamed from the GIAB FTP) groups and colors
by the `HP` tag: the heterozygous deletion shows in one haplotype and not the
other:

<!-- jb2export: alignments_haplotype -->

```bash
jb2export --fasta https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz \
  --bam https://jbrowse.org/demos/hg002/HG002.ONTrel2.HP.hs37d5.demo_slices.bam group:tag:HP color:tag:HP height:400 \
  --loc 1:63,005,675-63,007,432 --width 1200 --out alignments_haplotype.png
```

![Reads grouped and colored by haplotype (HP tag), showing a heterozygous deletion in one haplotype](https://jbrowse.org/jb2-figures/jbrowse-img/alignments_haplotype.070a6f6821a3.png)

`color:methylation` paints per-base CpG methylation calls from a modified-base
(`MM`/`ML`) BAM/CRAM: methylated cytosines red, unmethylated blue. This COLO829
nanopore CRAM (hg38, streamed from the ONT open-data S3) with the UCSC
CpG-island BED on top shows the methylated flanks giving way to the unmethylated
island cores, read against the annotated island boundaries. `legend` draws the
color key, worth adding to any export whose coloring is not the default one: the
app leaves it off, where a reader can open the track menu instead.

<!-- jb2export: methylation -->

```bash
jb2export --fasta https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz \
  --aliases https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt \
  --bedgz https://jbrowse.org/ucsc/hg38/cpgIslandExt.bed.gz index:https://jbrowse.org/ucsc/hg38/cpgIslandExt.bed.gz.csi \
  --bam https://jbrowse.org/demos/ont/COLO829_tumor.ht.chr20_18.5Mb.bam color:methylation legend height:350 \
  --loc chr20:18,503,000-18,509,000 --width 1200 --out methylation.png
```

![COLO829 nanopore reads colored by per-base CpG methylation over a CpG island](https://jbrowse.org/jb2-figures/jbrowse-img/methylation.0cbc3e895e78.png)

`sashimi:auto` overlays splice-junction arcs on the coverage band, sized by the
number of reads spanning each junction: the standard RNA-seq splice view.
`coverageHeight:` makes the coverage/sashimi band tall so the arcs are legible,
and `scaletype:log` is what puts every exon on the plot: RNA-seq depth here
spans three orders of magnitude, so on a linear axis the tallest exon is the
only one with any height and the arcs land over a flat line. This
strand-specific paired-end RNA-seq (hg19, public) over `B2M` shows the long
first intron as one big arc and the closely-spaced downstream exons as smaller
arcs, with the spliced read pairs (green mate lines) below:

<!-- jb2export: sashimi_junctions -->

```bash
jb2export --hub hg19 --track hg19-ncbiRefSeqCurated height:90 \
  --bam https://s3.amazonaws.com/jbrowse.org/genomes/hg19/paired_end_rnaseq/Pairend_StrandSpecific_51mer_Human_hg19.bam sashimi:auto coverageHeight:170 scaletype:log featureHeight:super-compact height:420 \
  --loc B2M --width 1400 --out sashimi_junctions.png
```

![RNA-seq sashimi plot over B2M: splice-junction arcs on the coverage band sized by junction read depth, over the spliced read pileup](https://jbrowse.org/jb2-figures/jbrowse-img/sashimi_junctions.42adbc12cc98.png)

This 1000 Genomes ONT sample (HG00151, long reads streamed from the 1000G-ONT
S3) over a ~1.2 kb inversion on chr1 draws the same event three ways:

- **`arcs:up` / `arcs:down`** draws a read-connection arc for every split
  (supplementary) read, linking its two alignment segments, the arc color
  encoding the junction's orientation: here the two breakpoints joined by
  **purple inversion-junction arcs**, where a read's two halves map in opposite
  orientations.
- **`linkedReads:normal`** chains each read's split segments, so the same
  inversion reads in the pileup itself: a **blue reverse-strand core between red
  forward-strand flanks**, spanning breakpoint to breakpoint.
- **`group:splitRead`** puts those reads in their own labelled section above the
  flat background pileup.

<!-- jb2export: sv_read_arcs -->

```bash
jb2export --hub hg38 \
  --bam https://jbrowse.org/demos/ont/HG00151-ONT-hg38.chr1_inversion.bam arcs:down linkedReads:normal group:splitRead coverageHeight:80 height:560 \
  --loc chr1:197,786,900-197,789,700 --width 1400 --out sv_read_arcs.png
```

![HG00151 ONT long reads over a ~1.2 kb chr1 inversion, grouped on SA-tag presence: the split reads sit in their own section under the purple junction arcs, chained so a blue reverse-strand core runs between red forward-strand flanks](https://jbrowse.org/jb2-figures/jbrowse-img/sv_read_arcs.82749bd6f26f.png)

### Breakpoint split views

Both sides of a junction, stacked, with a curve per read that leaves one panel
and arrives in the other. Everything above draws an SV in **reference**
coordinates; this draws the two loci it joins.

**Repeating `--loc` stacks a panel; whitespace inside one `--loc` adds a window
to that panel** — the meaning a space already has for a linear view. So the
two-breakend case is two bare `--loc` flags with no shell quoting, and a quoted
`--loc` is how a panel takes two windows.

A connector is drawn dashed when the read carrying it has a supplementary
alignment at a locus that is not on screen: the view is reporting an incomplete
picture, and the fix is to give it the missing panel. COLO829's der(3) is a
closed cycle over three chromosomes, so the junction below needs a chr10 panel
between the two it appears to join, and with it every connector in the figure is
solid.

**One render per sample, and the control is the other render.** A somatic call
is the difference between the tumour and its matched normal, so the figure that
argues it is two of these side by side: the same `--loc` list and the same
`--width`, one `--track` each. The connecting curves are drawn per track, so
they fill the tumour render and the normal render carries none.

<!-- jb2export: sv_review_tumor -->

```bash
jb2export breakpoint --config https://jbrowse.org/demos/cancer_sv/config.json \
  --assembly hg38 \
  --track COLO829_tumor_ont height:130 force:true featureHeight:super-compact \
  --loc chr3:25,358,511-25,359,711 --loc chr10:58,716,962-58,718,162 \
  --loc chr12:72,272,512-72,273,712 --width 1000 --out sv_review_tumor.png
```

![The three loci of the COLO829 melanoma line's der(3), chr3 then chr10 then chr12, in the tumour nanopore reads. Every connecting curve is solid](https://jbrowse.org/jb2-figures/jbrowse-img/sv_review_tumor.3689b42cb674.png)

Then the same command with the other sample's track:

<!-- jb2export: sv_review_normal -->

```bash
jb2export breakpoint --config https://jbrowse.org/demos/cancer_sv/config.json \
  --assembly hg38 \
  --track COLO829BL_normal_ont height:130 force:true featureHeight:super-compact \
  --loc chr3:25,358,511-25,359,711 --loc chr10:58,716,962-58,718,162 \
  --loc chr12:72,272,512-72,273,712 --width 1000 --out sv_review_normal.png
```

![The same three loci in the matched normal, with no connecting curves in any panel](https://jbrowse.org/jb2-figures/jbrowse-img/sv_review_normal.593787f22ddb.png)

Both commands carry these two modifiers:

- **`force:true`** is there because the chr3 panel is 1.2 kb of 200x nanopore,
  which is over the byte gate; without it that panel draws the gate's message
  instead of reads.
- **`featureHeight:super-compact`** draws each read 1 px tall, which is what
  keeps six pileups on one screen.

**A reconstructed allele is an assembly, so it is a third render.** Once the
junctions have been resolved into a derivative contig, the three loci above stop
needing three panels: they are one axis, in order. That contig is an assembly in
the same config, so the only thing that changes is which `--assembly` is named.

<!-- jb2export: sv_review_derivative -->

```bash
jb2export --config https://jbrowse.org/demos/cancer_sv/config.json \
  --assembly der3_RARB_BICC1_TRHDE --track der3_segments height:128 \
  --track reads_vs_der3 height:440 --loc der3_RARB_BICC1_TRHDE:1-39,549 \
  --width 1000 --out sv_review_derivative.png
```

![The COLO829 der(3) allele as a single 39.5 kb contig: 32.7 kb of chr3, 199 bp of chr10 and 183 bp of chr12 end to end, with the spanning reads running through every junction](https://jbrowse.org/jb2-figures/jbrowse-img/sv_review_derivative.d83731441113.png)

Putting the three beside each other is your docs' job; jb2export does not
compose them.

To do that for a whole callset rather than one junction, `jb2export batch`
renders one image per row of a BEDPE. See the
[SV callset review tutorial](https://jbrowse.org/jb2/docs/tutorials/sv_callset_review/),
and `jb2export batch --help`.

More alignment recipes (see [Track modifiers](#track-modifiers) for all
options):

```bash
## color by splice strand (XS tag), sort by haplotype (HP tag)
jb2export --fasta ref.fa --bam reads.bam color:tag:XS sort:tag:HP --loc chr1:1-10000

## color by base modifications (MM/ML tags) in super-compact layout
jb2export --fasta ref.fa --bam reads.bam color:modifications featureHeight:super-compact \
  --loc chr1:1-10000

## color by insert size + orientation to highlight structural variants
jb2export --fasta ref.fa --bam reads.bam color:insertSizeAndOrientation --loc chr1:1-10000

## read-cloud SV view — the read cloud overlays the coverage band, so use
## coverageHeight to make the panel tall (NOT readConnectionsHeight, which only sizes
## the regular up/down arcs panel). The read cloud disappears if coverage:false.
jb2export --fasta ref.fa --bam reads.bam arcs:cloud coverageHeight:300 \
  readConnectionsLineWidth:2 height:600 --loc chr1:1-50000

## view as pairs / link supplementary alignments: mates and split segments of one
## read share a row, joined by a connecting line. linkedReads:bezier is NOT this —
## it is a back-compat alias for the curved-connector overlay (showBezierConnections)
## and leaves the layout an ordinary pileup. Add both to curve the connectors that
## cross between displayed regions, which the per-region line pass cannot draw.
jb2export --fasta ref.fa --bam linked.bam linkedReads:normal --loc chr1:1-50000
```

### BigWig / quantitative tracks

`--loc all` shows the full assembly, and several bigwig plotting options help
draw a bigwig genome-wide.

This logscale, manual-minmax example plots the SKBR3 breast-cancer cell line's
read coverage genome-wide (hg19, public bigwig), where the amplifications and
deletions of the cancer karyotype stand out:

<!-- jb2export: skbr3_cov -->

```bash
jb2export --loc all --fasta https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz \
  --bigwig https://jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.regions.bw scaletype:log fill:false resolution:superfine height:400 color:purple minmax:1:1024 \
  --width 1900 --out skbr3_cov.png
```

![SKBR3 cell-line read coverage genome-wide, log scale, showing cancer amplifications and deletions](https://jbrowse.org/jb2-figures/jbrowse-img/skbr3_cov.02ad625567a3.png)

The score scaling can also autoscale: here to "localsd" (mean plus/minus three
standard deviations) on a linear scale:

```bash
jb2export --loc all \
  --bigwig coverage.bw autoscale:localsd fill:false resolution:superfine height:400 color:purple \
  --assembly hg19 \
  --config data/config.json
```

### MultiWiggle (many BigWigs in one track)

`--multiwig` aggregates many BigWig files into a single multi-row
`MultiQuantitativeTrack`, where each subtrack shares one autoscale so the rows
are directly comparable. Its argument is either a comma-separated list of BigWig
files (local paths or URLs), or a `.json` file holding an array (of plain BigWig
paths/URLs, or of _subadapter_ objects that give each row its own `name`,
`color`, and `group`):

```bash
## quick shorthand: a comma-separated file list, one row per file
jb2export --hub hg38 --multiwig a.bw,b.bw,c.bw height:300 --loc GAPDH --out multi.png

## curated rows: a JSON sources file (name/color/group per subtrack)
jb2export --hub hg38 --multiwig sources.json height:520 --loc GCG --out multi.png
```

This example renders the CATlas single-cell ATAC accessibility-by-cell-type data
(Zhang et al 2021): 16 human cell types, each a BigWig, wired up with per-row
labels/colors/groups in
[`data/scatac_catlas.json`](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-img/data/scatac_catlas.json),
over the `GCG` (glucagon) locus. The **Alpha (glucagon)** row (the pancreatic
cell type that expresses GCG) shows strong open chromatin across the gene while
the other 15 cell types stay quiet on the shared scale, a clean readout of
cell-type-specific chromatin accessibility at a marker gene:

<!-- jb2export: scatac_multiwiggle -->

```bash
jb2export --hub hg38 --track hg38-ncbiRefSeqCurated height:60 \
  --multiwig data/scatac_catlas.json 'name:CATlas single-cell ATAC (accessibility by cell type)' height:440 \
  --loc chr2:162,000,000-162,300,000 --width 1400 --out scatac_multiwiggle.png
```

![CATlas single-cell ATAC accessibility across 16 cell types over the GCG locus, with the Alpha (glucagon) row showing cell-type-specific open chromatin](https://jbrowse.org/jb2-figures/jbrowse-img/scatac_multiwiggle.9663f7aca4cf.png)

### Variant tracks

A `--vcfgz` track draws each variant with its reference-to-alternate change.
Reproducible with the bundled volvox VCF:

<!-- jb2export: variants -->

```bash
jb2export --fasta data/volvox/volvox.fa \
  --vcfgz data/volvox/volvox.filtered.vcf.gz --loc ctgA:1-20000 --width 1200 \
  --out variants.png
```

![A variant track drawing each SNV with its reference-to-alternate change](https://jbrowse.org/jb2-figures/jbrowse-img/variants.faae1fdaea87.png)

### Multi-sample variant matrix

A VCF with many samples renders as a genotype matrix (one row per sample, each
alt genotype painted over the reference background) with the
`display:multivariant` modifier (the `LinearMultiSampleVariantDisplay`);
`display:multivariantmatrix` selects the index-spaced matrix variant. This
example draws the 1000 Genomes phase 3 chr11 callset (2,504 samples) over the
HBB β-globin locus, with the NCBI RefSeq gene track (via `--hub`/`--track`) for
context. Common variants read as solid vertical bands, rarer ones as sparse
speckle:

<!-- jb2export: multisample_variants -->

```bash
jb2export --hub hg19 --track hg19-ncbiRefSeqCurated \
  --vcfgz https://jbrowse.org/genomes/hg19/1000genomes/ALL.chr11.phase3_v5b.HBB_5.2-5.3Mb.vcf.gz display:multivariant height:450 force:true \
  --loc chr11:5,246,000-5,251,000 --width 1200 --out multisample_variants.png
```

![The 1000 Genomes phase 3 chr11 callset (2,504 samples) as a multi-sample genotype matrix over the HBB locus, with the NCBI RefSeq gene track above](https://jbrowse.org/jb2-figures/jbrowse-img/multisample_variants.541839885de1.png)

### Hi-C tracks

A `--hic` track draws the contact matrix as a triangular heatmap. This example
streams the public hg19 demo `.hic` and shows the TAD structure along chr1, with
the NCBI RefSeq gene track (via `--hub`/`--track`) on top for context:

<!-- jb2export: hic -->

```bash
jb2export --hub hg19 --track hg19-ncbiRefSeqCurated \
  --hic https://jbrowse.org/genomes/hg19/intra_nofrag_30.hic height:400 \
  --loc 1:2,500,000-12,500,000 --width 1200 --out hic.png
```

![Hi-C contact matrix as a triangular heatmap showing TAD structure along hg19 chr1](https://jbrowse.org/jb2-figures/jbrowse-img/hic.23a60dfee199.png)

### Gene tracks and the reference sequence

Feature tracks (`--gffgz`, `--bigbed`, `--bedgz`, or a hosted `--track`) render
their glyphs with labels, and `--refseq` adds the assembly's reference-sequence
track. Zoomed to base level, it shows the DNA bases and the six-frame
translation (green start codons, red stops). This human example zooms into a
`TP53` intron/CDS boundary so the gene track's structure reads at base level:
the intron thins to a connector line, the coding exon begins as a solid CDS
block, and that block edge lines up with a specific reference base and reading
frame. `showOnlyGenes` keeps the RefSeq track to its gene features:

<!-- jb2export: gene_track -->

```bash
jb2export --hub hg38 \
  --track hg38-ncbiRefSeqCurated height:60 '{"showOnlyGenes":true,"geneGlyphMode":"longestCoding"}' \
  --refseq --loc chr17:7,675,018-7,675,098 --width 1500 --out gene_track.png
```

![A TP53 intron/CDS boundary at base level: the reference sequence's DNA bases and six-frame translation above the NCBI RefSeq gene track, whose CDS exon block begins where the intron connector ends](https://jbrowse.org/jb2-figures/jbrowse-img/gene_track.addac51c834a.png)

### Themes

`--themeName` selects a built-in theme: `default`, `lightStock`, `lightMinimal`,
`darkStock`, or `darkMinimal`. (Plain `dark`/`light` are not theme names, use
the keys above.)

<!-- jb2export: dark_theme -->

```bash
jb2export --hub hg38 --track hg38-ncbiRefSeqCurated height:100 \
  --track hg38-phyloP100way height:140 --loc chr10:87,860,000-87,975,000 \
  --themeName darkStock --width 1200 --out dark_theme.png
```

![The hg38 PTEN locus: NCBI RefSeq genes over phyloP conservation, rendered with the darkStock theme](https://jbrowse.org/jb2-figures/jbrowse-img/dark_theme.634c9652362d.png)

## Track modifiers

Per-track settings use a colon-based syntax that follows the track file
argument, e.g. `--bam reads.bam color:tag:RG height:400`. This is the full list
of available modifiers.

Modifiers are grouped below by the track types they apply to. Passing one to a
track type it does not apply to (say `sashimi:up` on a BigWig) prints a warning
naming the types it does work on.

A modifier **value** the modifier can't use — `arcs:upp`, `height:8o`,
`coverage:ture` — is an error, not a warning: the tool writes one figure and
exits, so a warning would scroll past and leave you with a wrong image. The
`true|false` modifiers (`coverage`, `softClipping`, `force`, `crosshatch`,
`fill`) also read bare, so `coverage` on its own means `coverage:true`.

**All tracks**

| Modifier        | Example                | Description                                          |
| --------------- | ---------------------- | ---------------------------------------------------- |
| `height:N`      | `height:400`           | Track height in pixels                               |
| `force:true`    | `force:true`           | Render even if region is too large                   |
| `display:value` | `display:multivariant` | Pick a non-default display for the track (see below) |
| `name:label`    | `name:"Tumor"`         | Track label (defaults to the filename)               |
| `index:path`    | `index:reads.bam.csi`  | Index file, when it isn't a sibling of the data file |

A track is identified by its filename, so two inputs sharing one —
`--bam tumor/sample.bam --bam normal/sample.bam` — would both be labelled
`sample.bam`. Both render, but pass `name:` to tell them apart in the figure.

With no `index:`, a **local** file's index is whichever of these siblings is
actually there, opened as the type it is:

<!-- INJECT_INDEX_SPELLINGS START: auto-filled from indexSpellings in packages/core/src/util/indexCandidates.ts by website/scripts/generate-img-doc.ts -->

| Spelling                                  | Written by                                                     |
| ----------------------------------------- | -------------------------------------------------------------- |
| `<file>.tbi`, `<file>.bai`, `<file>.crai` | samtools, tabix                                                |
| `<file>.csi`                              | htslib, for a reference over 512 Mb and on request at any size |
| `reads.bai` beside `reads.bam`            | Picard, GATK                                                   |

<!-- INJECT_INDEX_SPELLINGS END -->

A remote file is not probed, since checking costs a request, so a hosted `.csi`
still wants an explicit `index:`.

By default each track uses its primary display. `display:value` selects an
alternate one. These friendly aliases are recognized (any other value is passed
through verbatim as a display state-model name):

| `display:` value     | Selected display                        | Use                                           |
| -------------------- | --------------------------------------- | --------------------------------------------- |
| `multivariant`       | `LinearMultiSampleVariantDisplay`       | multi-sample VCF genotype matrix (rows)       |
| `multivariantmatrix` | `LinearMultiSampleVariantMatrixDisplay` | multi-sample matrix laid out by feature index |

**Alignment tracks (BAM/CRAM)**

Reads & coloring:

| Modifier                         | Example                        | Description                                                                                                                        |
| -------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `color:type` or `color:type:tag` | `color:strand`, `color:tag:XS` | Color scheme (see types below)                                                                                                     |
| `sort:type` or `sort:type:tag`   | `sort:strand`, `sort:tag:RG`   | Sort reads (`position`, `strand`, `basePair`, or `tag:<TAG>`)                                                                      |
| `group:type` or `group:type:tag` | `group:strand`, `group:tag:HP` | Group reads into in-track stacked sections (`strand`, `firstOfPairStrand`, `pairOrientation`, `splitRead`, `mapq`, or `tag:<TAG>`) |
| `softClipping:true\|false`       | `softClipping:true`            | Show soft-clipped bases                                                                                                            |
| `legend:true\|false`             | `legend`                       | Draw the color key. Off by default in the app, where the reader can open the track menu instead                                    |

Which reads are drawn. These filter before the coverage pipeline as well as
before layout, so a filter that removes reads removes them from the coverage
band too.

The last four name a read category and take one vocabulary: `only` keeps that
category, `exclude` drops it, and omitting the modifier leaves it alone. They
are AND-ed with each other and with the masks above, so the SV export — the
split reads of the pairs the aligner did not call concordant — is
`properPairs:exclude split:only`. Passing `all` is accepted and stores nothing,
which lets a script pass a category through from a variable that may be empty.

| Modifier                    | Example                | Description                                                                                                                                                                                                                                                                                                            |
| --------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flags:include:exclude`     | `flags::SECONDARY,DUP` | SAM flag masks, `samtools -f` then `-F`. Each half is a number or samtools' flag names, comma-separated (`PAIRED`, `PROPER_PAIR`, `UNMAP`, `MUNMAP`, `REVERSE`, `MREVERSE`, `READ1`, `READ2`, `SECONDARY`, `QCFAIL`, `DUP`, `SUPPLEMENTARY`). Either half may be empty to leave that mask as the track's config set it |
| `filterTag:TAG:value`       | `filterTag:HP:1`       | Keep only reads whose tag has this value. Repeatable, and every one must pass                                                                                                                                                                                                                                          |
| `properPairs:only\|exclude` | `properPairs:exclude`  | Concordant pairs — flagged proper (0x2) AND in FR orientation. Excluding them leaves the discordant and split chains, which is an SV view                                                                                                                                                                              |
| `split:only\|exclude`       | `split:only`           | Reads the aligner gave a supplementary segment (SAM flag 0x800), read off the SA tag                                                                                                                                                                                                                                   |
| `singletons:only\|exclude`  | `singletons:exclude`   | Reads whose mate and supplementary segments are all outside the window                                                                                                                                                                                                                                                 |
| `spliced:only\|exclude`     | `spliced:only`         | Reads whose CIGAR carries a reference skip (N) — an intron, in RNA-seq                                                                                                                                                                                                                                                 |

Overlays & subtracks:

| Modifier               | Example               | Description                                                                            |
| ---------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| `arcs:mode`            | `arcs:cloud`          | Read-connection arcs / read-cloud panel (`off`, `up`, `down`, `cloud`)                 |
| `linkedReads:mode`     | `linkedReads:normal`  | Linked-read chains (`off`, `normal`, `bezier`)                                         |
| `sashimi:mode`         | `sashimi:up`          | Sashimi splice-junction arcs (`off`, `up`, `down`, `auto`)                             |
| `coverage:true\|false` | `coverage:false`      | Toggle coverage subtrack                                                               |
| `snpcov`               | `snpcov`              | Coverage-only view — resizes the coverage band to fill the track                       |
| `sashimiScore:N`       | `sashimiScore:3`      | Minimum reads a splice junction needs before its arc is drawn                          |
| `arcColor:mode`        | `arcColor:insertSize` | Read-connection arc coloring (`insertSizeAndOrientation`, `insertSize`, `orientation`) |

Layout & sizing:

| Modifier                     | Example                                          | Description                                                                                                                 |
| ---------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `featureHeight:preset\|N`    | `featureHeight:super-compact`, `featureHeight:4` | Per-read height (spacing between reads is derived from it). Presets: `normal` (7px), `compact` (3px), `super-compact` (1px) |
| `coverageHeight:N`           | `coverageHeight:200`                             | Height of the coverage subtrack (also the height of the read-cloud overlay)                                                 |
| `readConnectionsHeight:N`    | `readConnectionsHeight:120`                      | Height of the paired-arcs panel — only applies to `arcs:up` / `arcs:down`                                                   |
| `readConnectionsLineWidth:N` | `readConnectionsLineWidth:2`                     | Stroke width for read-connection arcs/lines in pixels                                                                       |
| `sashimiHeight:N`            | `sashimiHeight:120`                              | Height of the sashimi arc band                                                                                              |
| `maxHeight:N`                | `maxHeight:4000`                                 | Row cap for the pileup, in pixels. Raise it when the export shows the "Max height reached" notice                           |

Available `color:type` values:

| Type                       | Description                                               |
| -------------------------- | --------------------------------------------------------- |
| `normal`                   | Default (grey reads, mismatches highlighted)              |
| `strand`                   | Forward/reverse strand                                    |
| `mappingQuality`           | MAPQ                                                      |
| `perBaseQuality`           | Per-base quality overlay                                  |
| `insertSize`               | Paired-end insert size                                    |
| `pairOrientation`          | Paired-end orientation                                    |
| `insertSizeAndOrientation` | Combined insert size + orientation                        |
| `modifications`            | Base modifications via MM/ML tags                         |
| `methylation`              | CpG methylation via MM/ML tags                            |
| `tag:<TAG>`                | Color by any BAM tag, e.g. `color:tag:HP`, `color:tag:RG` |

**Feature tracks (GFF3/BED/BigBed) and VCF tracks**

These share one display base, so every modifier below applies to both.

| Modifier                            | Example                 | Description                                                                                                                                                                                                       |
| ----------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color:value`                       | `color:magenta`         | Glyph fill: any CSS color, or `strand` to color by feature strand (tomato forward, cornflowerblue reverse)                                                                                                        |
| `color:attribute:name`              | `color:attribute:type`  | One stable color per distinct value of that feature attribute — the canvas analogue of an alignments `color:tag:XX`                                                                                               |
| `featureHeight:preset`              | `featureHeight:compact` | Display mode (`normal`, `compact`, `super-compact`)                                                                                                                                                               |
| `heightMode:<fixed\|grow\|fit>[:N]` | `heightMode:fit:200`    | Track-height strategy: `fixed` scrolls to see all features, `grow` resizes the track to fit every feature, `fit` shrinks glyphs so every row fits without scrolling; an optional number sets the track height too |

**BigWig tracks**

The first three name a score axis rather than a BigWig, so they also apply to a
BAM/CRAM track's coverage band, where `scaletype:log` is usually what an RNA-seq
figure wants. The rest are BigWig-only and warn on any other track type.

| Modifier                 | Example                | Description                                               |
| ------------------------ | ---------------------- | --------------------------------------------------------- |
| `autoscale:mode`         | `autoscale:localsd`    | Autoscale mode (`local`, `localsd`, `localpercentile`)    |
| `minmax:min:max`         | `minmax:0:100`         | Manual score range                                        |
| `scaletype:type`         | `scaletype:log`        | Scale type (`linear` or `log`)                            |
| `fill:true\|false`       | `fill:false`           | Fill under curve                                          |
| `crosshatch:true\|false` | `crosshatch:true`      | Draw crosshatches                                         |
| `resolution:value`       | `resolution:superfine` | BigWig resolution (`fine`, `superfine`, or a multiplier)  |
| `color:value`            | `color:purple`         | Fill color (any CSS color — `tag:` form is BAM/CRAM only) |

### Raw display settings (JSON)

Any track modifier that starts with `{` is parsed as JSON and merged into the
display's settings: an escape hatch for settings without a dedicated modifier
above. Use compact JSON (a single shell token, no spaces):

```bash
jb2export --fasta ref.fa --bam reads.bam '{"colorBy":{"type":"strand"}}' \
  --loc chr1:1-10000 --out out.svg
```

## Comparative views

### Compare two assemblies (dotplot / synteny)

Two assemblies can be compared with the `dotplot` and `synteny` subcommands. The
primary assembly is supplied with `--fasta`/`--loc` (as usual) and the second
with `--fasta2`/`--loc2`. The alignment between them is a comparison track
(`--paf`, `--delta`, `--chain`, or `--blasttab`); the query side of that file is
the first assembly and the target side is the second.

The examples below use the public yeast comparison (S. cerevisiae R64 vs the
YJM1447 strain) and reproduce as-is with network access.

A whole-genome dotplot: every query contig on x, every target contig on y.
`--autoDiagonalize` reorders the target contigs so the main alignment forms a
clean diagonal:

<!-- jb2export: yeast_dotplot -->

```bash
jb2export dotplot \
  --fasta https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/yjm1447.fa \
  --fasta2 https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/r64.fa \
  --paf https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/r64_vs_yjm1447.paf \
  --autoDiagonalize --width 1100 --out yeast_dotplot.png
```

![Whole-genome dotplot of two yeast assemblies (R64 vs the YJM1447 strain)](https://jbrowse.org/jb2-figures/jbrowse-img/yeast_dotplot.c789460b7da2.png)

A linear synteny ribbon between one chromosome in each assembly (here YJM1447
chr `I` vs R64 chr `I`, accession `NC_001133.9`). `--drawCurves` renders the
ribbon as a smooth bezier instead of straight trapezoids:

<!-- jb2export: yeast_synteny -->

```bash
jb2export synteny \
  --fasta https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/yjm1447.fa \
  --loc I \
  --fasta2 https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/r64.fa \
  --loc2 NC_001133.9 \
  --paf https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/r64_vs_yjm1447.paf \
  --drawCurves --width 1400 --out yeast_synteny.png
```

![Linear synteny ribbon between YJM1447 chr I and R64 chr I](https://jbrowse.org/jb2-figures/jbrowse-img/yeast_synteny.2c39e4a0bab1.png)

Omitting `--loc`/`--loc2` shows the whole assembly on that axis (note: `dotplot`
ignores `--loc` and always shows the whole genome). `--autoDiagonalize` and
`--drawCurves` are the CLI shortcuts for the busiest-comparison knobs; the full
set is available via `--spec` (see the table below). Run
`jb2export dotplot --help` for the full list of comparative options.

### Multi-way synteny (three or more assemblies)

Stack any number of assemblies straight from the command line: repeat the
assembly flag for each one and place each alignment file between the two
assemblies it compares. Assemblies stack top-to-bottom in the order written, and
each synteny file becomes the ribbon for the gap it sits in. No config or spec
JSON is required.

Use `--chromSizes` instead of `--fasta` for a whole-genome comparison: it builds
the assembly from a `chrom.sizes` file (two tab-separated columns,
`name<TAB>length`), skipping the multi-GB sequence a genome-wide dotplot never
draws.

So the flags alternate, and each one's position is what it means:

```
--chromSizes a.chrom.sizes    assembly 1, the top row
--paf        a_vs_b.paf       the ribbon between rows 1 and 2
--chromSizes b.chrom.sizes    assembly 2
--paf        b_vs_c.paf       the ribbon between rows 2 and 3
--chromSizes c.chrom.sizes    assembly 3, the bottom row
```

which as a command is:

```bash
jb2export synteny \
  --chromSizes a.chrom.sizes \
  --paf a_vs_b.paf \
  --chromSizes b.chrom.sizes \
  --paf b_vs_c.paf \
  --chromSizes c.chrom.sizes \
  --out synteny.svg
```

Per-assembly options ride on the assembly flag as `key:value` modifiers, e.g.
`--fasta a.fa loc:chr1 aliases:a.aliases.txt`. The busy-comparison knobs are
flags:

| Flag                   | Effect                                                          |
| ---------------------- | --------------------------------------------------------------- |
| `--autoDiagonalize`    | Reorders each lower assembly's chromosomes for least overlap    |
| `--minAlignmentLength` | Hides alignments shorter than N bp — the main de-spaghetti knob |
| `--colorBy query`      | Tints each ribbon by its query chromosome                       |
| `--alpha`              | Ribbon opacity (0–1); lower values reveal overlap density       |
| `--drawCurves`         | Bezier ribbons instead of straight trapezoids                   |
| `--levelHeights`       | Per-level pixel height (comma-separated, e.g. `300,300`)        |

> **Query vs. target orientation.** PAF/BLAST list the query first, so the
> assembly written _above_ the alignment is the query. A chain/delta liftover
> maps target→query (a UCSC `targetToQuery.over.chain`), so there the assembly
> above is the _target_. `jb2export` handles this per format automatically: just
> write the assemblies in stacked order.

Alternatively, drive the view from a session-spec JSON with `--spec` (assemblies
and comparison tracks supplied via `--config`). The spec is the same shape used
by the JBrowse Web URL `&session=spec-` parameter, so JSON copied out of a
browser URL works directly: see
[URL query parameter API](https://jbrowse.org/jb2/docs/urlparams/#linear-synteny-view-multi-way)
for the full format. `tracks` is one sub-array per level (the gap between
adjacent `views`); the subcommand is optional since the render mode comes from
the spec's view `type`.

```bash
jb2export --config jbrowse.json --spec spec.json --out synteny.svg
```

Without a `--spec`, `synteny --config` stacks the config's assemblies in the
order they are listed and places each SyntenyTrack by its `assemblyNames`: a
pairwise track lands in the one gap between the two genomes it names, and a
track listing three or more (an `AllVsAllPAFAdapter` or `MCScanBlocksAdapter`
file covering N genomes, as built in the
[all-vs-all](https://jbrowse.org/jb2/docs/tutorials/allvsall_synteny/) and
[multiway](https://jbrowse.org/jb2/docs/tutorials/multiway_synteny_grape_peach_cacao/)
synteny tutorials) backs every band whose pair it covers. A track covering no
adjacent pair — an A-vs-C alignment in an A/B/C stack — is reported and skipped
rather than drawn between the wrong two genomes.

A whole-genome example (peach vs grape, the chrom.sizes come from this repo and
the alignment PAF from S3):

<!-- jb2export: grape_peach_synteny -->

```bash
jb2export synteny --chromSizes data/comparative/peach.chrom.sizes \
  --paf https://s3.amazonaws.com/jbrowse.org/genomes/synteny/peach_grape.paf.gz \
  --chromSizes data/comparative/grape.chrom.sizes --autoDiagonalize \
  --colorBy query --alpha 0.4 --levelHeights 350 --drawCurves --width 1400 \
  --out grape_peach_synteny.png
```

![Whole-genome synteny, grape vs peach, with autoDiagonalize and colorBy query](https://jbrowse.org/jb2-figures/jbrowse-img/grape_peach_synteny.a99a488eeb48.png)

A mammalian-scale test: human (hs1/T2T) vs mouse (mm39) liftOver, where the
`--minAlignmentLength 500000` filter is what keeps the plot from turning into
spaghetti. `--chromSizes` means no multi-GB sequence is downloaded (whole-genome
synteny draws none); the chrom.sizes are committed and the liftOver chain
streams from the web, so this reproduces with only the public chain:

<!-- jb2export: hs1_mm39_synteny -->

```bash
jb2export synteny --chromSizes data/comparative/hs1.chrom.sizes \
  --chain https://jbrowse.org/demos/hs1ToMm39/hs1ToMm39.over.chain.gz \
  --chromSizes data/comparative/mm39.chrom.sizes --minAlignmentLength 500000 \
  --autoDiagonalize --colorBy query --alpha 0.4 --levelHeights 350 --drawCurves \
  --cigarMode matches --width 1400 --out hs1_mm39_synteny.png
```

![Mammalian-scale synteny, human (hs1) vs mouse (mm39)](https://jbrowse.org/jb2-figures/jbrowse-img/hs1_mm39_synteny.b681810f2751.png)

A three-level stack: hg38, hs1 (T2T), and mm39, with one ribbon per adjacent
pair: the conserved hg38↔hs1 build liftover on top (near-vertical bands) and the
diverged hs1↔mm39 human–mouse synteny below. Each UCSC liftOver `.chain` sits
between the two assemblies it relates (`hg38ToHs1` between hg38 and hs1,
`hs1ToMm39` between hs1 and mm39):

<!-- jb2export: hg38_hs1_mm39_synteny -->

```bash
jb2export synteny --chromSizes data/comparative/hg38.chrom.sizes \
  --chain data/comparative/hg38ToHs1.over.chain.gz \
  --chromSizes data/comparative/hs1.chrom.sizes \
  --chain https://jbrowse.org/demos/hs1ToMm39/hs1ToMm39.over.chain.gz \
  --chromSizes data/comparative/mm39.chrom.sizes --minAlignmentLength 500000 \
  --autoDiagonalize --colorBy query --alpha 0.4 --levelHeights 300,300 \
  --drawCurves --cigarMode matches --width 1400 --out hg38_hs1_mm39_synteny.png
```

![Three-level synteny stack: hg38, hs1, and mm39](https://jbrowse.org/jb2-figures/jbrowse-img/hg38_hs1_mm39_synteny.bf2fbcbc046e.png)

### All-vs-all alignments (PGGB, minimap2 -X)

The stacks above take one alignment file per gap. An all-vs-all PAF — every
genome aligned against every other, from
[PGGB](https://github.com/pangenome/pggb) or from `minimap2 -X` over
[PanSN](https://github.com/pangenome/PanSN-spec)-named contigs — already holds
every pair, so it is instead **one track that backs every band**: the file is
read once, and each band asks the adapter for its own pair of assemblies.

That makes it a `--config` case. `--paf` builds a pairwise `PAFAdapter`, which
reads the whole file as a single query-vs-target comparison, so repeating the
same all-vs-all file across the gaps draws an empty view and prints
`<assembly> not found in this adapter` — the PanSN prefixes that say which
genome each record belongs to mean nothing to that adapter. The adapter that
reads them is `AllVsAllPAFAdapter` (or `AllVsAllIndexedPAFAdapter` for a
`make-pif` index), named in a config:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_ava",
  "name": "E. coli pangenome (all-vs-all PAF)",
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"],
  "adapter": {
    "type": "AllVsAllPAFAdapter",
    "uri": "all_vs_all.paf.gz",
    "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"]
  }
}
```

`synteny --config` then places that one track on every gap whose pair its
`assemblyNames` cover, which for a file covering the whole stack is all of them.
The
[all-vs-all synteny tutorial](https://jbrowse.org/jb2/docs/tutorials/allvsall_synteny/)
builds this track and the five strain assemblies it names.

Where a config holds more than one such track, `--spec` says which one each band
uses. The hosted demo below is that case — it carries the same five strains
aligned four ways (minimap2, pggb/wfmash, cactus, and untangle) — and its spec
is where the repetition is, one entry per band:

```json
{
  "type": "LinearSyntenyView",
  "views": [
    { "assembly": "K12" },
    { "assembly": "Sakai" },
    { "assembly": "CFT073" },
    { "assembly": "NCTC86" },
    { "assembly": "IAI39" }
  ],
  "tracks": [["ecoli_ava"], ["ecoli_ava"], ["ecoli_ava"], ["ecoli_ava"]],
  "minAlignmentLength": 10000,
  "levelHeights": [130, 130, 130, 130]
}
```

Five rows means four bands, so `tracks` has four entries and every one of them
is the same trackId. `minAlignmentLength` drops minimap2's short alignments,
which otherwise bury the shared backbone under a noise band.

<!-- jb2export: ecoli_ava_synteny -->

```bash
jb2export --config https://jbrowse.org/demos/ecoli_pangenome/config.json \
  --spec data/comparative/ecoli_ava.spec.json --width 1400 \
  --out ecoli_ava_synteny.png
```

![Five E. coli strains stacked from one all-vs-all PAF, every band served by the same track](https://jbrowse.org/jb2-figures/jbrowse-img/ecoli_ava_synteny.23545e23ae7c.png)

The unbroken ribbons are the backbone shared by all five strains and the gaps
are where they differ; the crossings in the bottom band are IAI39's inversions
against the others.

All the example images in this README (including the comparative ones above) are
regenerated by `pnpm screenshots --filter jbrowse-img` from the repo root: see
the `CliSpec` entries in
[`website/scripts/screenshot-specs.ts`](https://github.com/GMOD/jbrowse-components/blob/main/website/scripts/screenshot-specs.ts).

### Circular view (chord plot)

The `circular` subcommand renders one assembly's chord tracks (e.g. a VCF of
structural variants) as a circular ideogram with chords drawn between the two
breakends of each rearrangement. It is single-assembly and shows the whole
genome (no `--loc`); each track picks its chord display automatically.

```bash
jb2export circular --fasta ref.fa --vcfgz sv.vcf.gz --out circular.svg
```

This example uses SKBR3 (a breast-cancer cell line) long-read Sniffles SV calls
on hg19: each inter-chromosomal chord is a translocation, the classic dense
rearranged-cancer-genome view. `--fasta` reads only the `.fai` for chromosome
names and lengths (the circular view fetches no sequence):

<!-- jb2export: circular_chords -->

```bash
jb2export circular --fasta https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz \
  --vcfgz https://jbrowse.org/genomes/hg19/SKBR3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.filtered.vcf.gz \
  --width 800 --out circular_chords.png
```

![Circular chord plot of SKBR3 structural variants on hg19, inter-chromosomal chords marking translocations](https://jbrowse.org/jb2-figures/jbrowse-img/circular_chords.d3023abf23c5.png)

Run `jb2export circular --help` for the full list of options.

## Configs and sessions

### Use with a jbrowse config.json

A config.json can be specified with extra tracks supplied outside the config
e.g. with `--bam`. Files referenced in the config can be remote (`uri`) or local
(`localPath`).

```bash
jb2export --config data/config.json \
  --assembly hg19 \
  --bam custom_bam.bam \
  --loc 1:1,000,000-1,100,000
```

The jbrowse CLI tool (e.g. npm install -g @jbrowse/cli) refers to "uri" paths by
default, but you replace them with localPath like this

```js

  //replace this:
  "vcfGzLocation": {
    "uri": "volvox.dup.vcf.gz"
  },

  //with this:
  "vcfGzLocation": {
    "localPath": "volvox.dup.vcf.gz"
  }
```

<!-- jb2export: volvox_config -->

```bash
jb2export --config data/volvox/config.json --assembly volvox --track volvox_sv \
  --loc ctgA:1-50,000 --width 1200 --out volvox_config.png
```

![Structural-variant calls over 50 kb of volvox ctgA, read from a config whose VCF is a localPath rather than a URL](https://jbrowse.org/jb2-figures/jbrowse-img/volvox_config.744ba8204bcd.png)

localPaths resolve relative to the config file supplied, so with
`--config data/volvox/config.json` and `"localPath": "volvox.dup.vcf.gz"` this
example resolves data/volvox/volvox.dup.vcf.gz

See data/volvox/config.json for a config that contains localPaths, or
data/config.json for a config that just contains URLs

### Use a session file exported from jbrowse

In jbrowse-web, File->Export session produces a session.json file for the
--session parameter. Specify the assembly as well, it currently does not infer
the assembly from the session

<!-- jb2export: skbr3_session -->

```bash
jb2export --config data/config.json --session data/skbr3/session.json \
  --assembly hg19 --width 1400 --out skbr3_session.png
```

![SKBR3 whole-genome read coverage, restored from a saved session file rather than described on the command line](https://jbrowse.org/jb2-figures/jbrowse-img/skbr3_session.325e8668f0a6.png)

The session names its tracks by trackId, so the `--config` you pass has to be
the one those ids come from — `data/config.json` here, which defines hg19 and
the `ngmlr_cov` coverage track that `data/skbr3/session.json` opens.

`data/skbr3/session.json` is also worth reading as the short way to write one by
hand. A view says where to go and what to open with an `init` block, and each
track entry carries its own display settings inline:

```json
{
  "session": {
    "name": "SKBR3 whole-genome coverage",
    "views": [
      {
        "type": "LinearGenomeView",
        "init": {
          "assembly": "hg19",
          "tracks": [
            {
              "trackId": "ngmlr_cov",
              "height": 275,
              "defaultRendering": "scatter"
            }
          ]
        }
      }
    ]
  }
}
```

Omitting `loc` shows the whole genome. Those inline track keys are the same
vocabulary as the track's config — anything the track menu can set, a session
can ask for here.

### Track order on the command line

Example:

```
jb2export --bam file1.bam --bigwig file.bw --bam file2.bam
```

This will respect the order of the tracks and list file1.bam, file.bw, and
file2.bam in that order, which is why the command line parser is a custom one

## Overriding render defaults

### Force render a large region

Some jbrowse track types (alignments, gene tracks, etc) will not display if
zoomed too far out. Add force:true to make it render

```bash
jb2export --bam file.bam force:true --loc 1:1,100,000-1,200,000 --fasta hg19.fa
```

### Render only the SNPCoverage track of an alignments track

`snpcov` collapses the alignments display down to coverage-only by sizing the
coverage band to fill the whole track. Combine with `height:N` (overall track
height) to get a coverage-only render at the size you want. Reproducible with
the bundled volvox alignments:

<!-- jb2export: snpcov -->

```bash
jb2export --fasta data/volvox/volvox.fa \
  --bam data/volvox/volvox-sorted.bam snpcov height:200 --loc ctgA:1-20000 \
  --width 1200 --out snpcov.png
```

![The same volvox alignments as a coverage histogram alone, with the read pileup hidden](https://jbrowse.org/jb2-figures/jbrowse-img/snpcov.38194d761a26.png)

## Parameters

Flags take their value as the next argument (`--width 1200`) or inline with an
equals sign (`--width=1200`).

### Assembly params

- `--fasta` — path or http(s) URL to an indexed FASTA (`.fa`, `.fa.gz`)
- `--aliases` — tab-separated refname aliases; column 1 matches the FASTA, other
  columns are aliases (e.g. maps `1` → `chr1`)
- `--cytobands` — path or URL to a cytoband BED file for the assembly
- `--hub` — a genomes.jbrowse.org assembly to pull the whole config from: a UCSC
  db name (`hg19`, `mm10`) or GenArk accession (`GCA_...`/`GCF_...`); supplies
  sequence, cytobands, and refName aliasing (see
  [Hosted assemblies](#hosted-assemblies-genomesjbrowseorg))

### Track params

Specify a filename (local) or http(s) URL. Can be repeated for multiple tracks
of the same type, e.g. `--bam file1.bam --bam file2.bam`

- `--bam`
- `--cram`
- `--bigwig`
- `--multiwig` — many BigWigs as one multi-row `MultiQuantitativeTrack`; its
  argument is a comma-separated BigWig file list (local paths or URLs) or a
  `.json` sources file (an array of BigWig paths/URLs, or of subadapter objects
  carrying per-row `name`/`color`/`group`) — see
  [MultiWiggle](#multiwiggle-many-bigwigs-in-one-track)
- `--vcfgz`
- `--gffgz`
- `--bigbed`
- `--bedgz`
- `--hic`

### Config file params (optional)

- `--assembly` — path to a JBrowse 2 assembly JSON (e.g.
  [data/assembly.json](data/assembly.json)), or the name of an assembly in
  `--config`; can be used in place of `--fasta`
- `--tracks` — path to a JSON file containing an array of JBrowse 2 track
  configs (e.g. [data/tracks.json](data/tracks.json))
- `--session` — path to a JBrowse 2 session JSON exported from File → Export
  session
- `--config` — path or URL to a full JBrowse 2 config.json (e.g.
  [data/config.json](data/config.json))
- `--track` — show a trackId already in the config (from `--hub`/`--config`),
  e.g. `--track hg19-ncbiRefSeqCurated`; repeatable, and accepts the same
  display modifiers as the track-type flags
- `--defaultSession` — use the `defaultSession` embedded in `--config`

### Output params

- `--loc` — location string to render, e.g. `chr1:1-10000` or `all`; also a gene
  name when the config has a text-search index (e.g. from `--hub`)
- `--out` — output file path; `.svg`, `.png`, or `.pdf`
- `--width` — view width in pixels (default: 1500)
- `--noRasterize` — render everything as SVG vectors instead of rasterizing
  canvas layers (pileup, coverage, hic); results in larger files

### Appearance params

- `--themeName` — theme to use for rendering: `default`, `lightStock`,
  `lightMinimal`, `darkStock`, or `darkMinimal`
- `--showGridlines` — draw genomic coordinate gridlines
- `--trackLabels` — label position: `offset`, `overlay`, `left`, or `none`

## Full command-line help

Run `jb2export --help` for the full option list, or
`jb2export <subcommand> --help` (e.g. `jb2export dotplot --help`) for a
subcommand's options. The complete output:

<!-- INJECT_HELP START: auto-filled from buildFullHelp() by website/scripts/generate-img-doc.ts; run `pnpm gen-img-doc` to refresh -->

```
Usage: jb2export [options]
       jb2export <dotplot|synteny|circular|breakpoint> [options]
       jb2export list [hub] [filter]

Options:
  --fasta           Path to indexed FASTA file
  --chromSizes      Path to a chrom.sizes file (whole-genome assembly, no sequence). Repeat for each assembly in a comparative view
  --aliases         Path to reference name aliases file
  --assembly        Path to assembly JSON (or "-" for stdin) or name in config
  --hub             Pull a whole config from genomes.jbrowse.org: a UCSC db name (hg19, mm10) or GenArk accession (GCA_/GCF_...). Gives cytobands, refName aliasing, and hosted trackIds (see --track)
  --track           Show a trackId already in the config (from --hub/--config), e.g. --track hg19-ncbiRefSeqCurated (the hg19- prefix is optional). Repeatable; accepts the same display modifiers as track flags (height:, color:, ...)
  --config          Path to JBrowse config.json (path, URL, or "-" for stdin)
  --session         Path to session JSON (or "-" for stdin)
  --loc             Location to render (e.g., chr1:1-1000 or "all"), or a gene name when the config has a text-search index (e.g. from --hub)
  --out             Output file path (SVG, PNG, or PDF by extension). Omit it to write the SVG to stdout, which pipes into rsvg-convert for other formats
  --width           Width of output in pixels [default: 1500]
  --noRasterize     Disable rasterization of pileup/coverage [default: false]
  --defaultSession  Use default session from config [default: false]
  --tracks          Path to JSON file with an array of track configs (or "-" for stdin)
  --cytobands       Path to cytoband file for the assembly
  --themeName       Theme for rendering: default, lightStock, lightMinimal, darkStock, or darkMinimal
  --fontFamily      Font family for all text (serif, sans-serif, monospace, or a named family) [default: serif]
  --showGridlines   Show genomic coordinate gridlines in the output [default: false]
  --trackLabels     Track label position: offset, overlay, left, or none
  --refseq          Show the reference sequence track [default: false]
  --spec            Session-spec JSON (inline, path to .json, or "-" for stdin) describing the view; see urlparams.md. Drives N-way comparative views from a --config
  --help            Show help
  --version         Print version

Examples:
  jb2export --fasta ref.fa --bam reads.bam --loc chr1:1-10000 --out out.svg
      Render BAM alignments to SVG
  jb2export --fasta ref.fa --vcfgz variants.vcf.gz --loc chr1:1-50000 --out out.png
      Render VCF variants to PNG
  jb2export --fasta ref.fa --bam reads.bam height:80 color:strand --loc chr1:1-10000 --out out.svg
      Custom track height and strand coloring
  jb2export --hub hg19 --track hg19-ncbiRefSeqCurated --loc chr1:1-100000 --out out.svg
      Pull the hg19 config from genomes.jbrowse.org and show a hosted track
  jb2export --config jbrowse.json --assembly hg38 --tracks tracks.json --loc chr1:1-100000 --out out.svg
      Render from config with a JSON tracks file
  jb2export --fasta ref.fa.gz --cytobands cytobands.bed --bigwig signal.bw --loc chr1 --out out.svg
      Render BigWig with cytobands

Track options: --bam, --cram, --bigwig, --multiwig, --vcfgz, --gffgz, --hic, --bigbed, --bedgz

Comparative subcommands (run "jb2export dotplot --help"): dotplot, synteny, circular, breakpoint

Discovery: "jb2export list" lists genomes.jbrowse.org assemblies; "jb2export list <hub> [filter]" lists a hub's tracks

Usage: jb2export dotplot [options]

Options:
  --fasta               Path to indexed FASTA file
  --chromSizes          Path to a chrom.sizes file (whole-genome assembly, no sequence). Repeat for each assembly in a comparative view
  --aliases             Path to reference name aliases file
  --assembly            Path to assembly JSON (or "-" for stdin) or name in config
  --hub                 Pull a whole config from genomes.jbrowse.org: a UCSC db name (hg19, mm10) or GenArk accession (GCA_/GCF_...). Gives cytobands, refName aliasing, and hosted trackIds (see --track)
  --track               Show a trackId already in the config (from --hub/--config), e.g. --track hg19-ncbiRefSeqCurated (the hg19- prefix is optional). Repeatable; accepts the same display modifiers as track flags (height:, color:, ...)
  --config              Path to JBrowse config.json (path, URL, or "-" for stdin)
  --session             Path to session JSON (or "-" for stdin)
  --loc                 Location to render (e.g., chr1:1-1000 or "all"), or a gene name when the config has a text-search index (e.g. from --hub)
  --out                 Output file path (SVG, PNG, or PDF by extension). Omit it to write the SVG to stdout, which pipes into rsvg-convert for other formats
  --width               Width of output in pixels [default: 1500]
  --noRasterize         Disable rasterization of pileup/coverage [default: false]
  --defaultSession      Use default session from config [default: false]
  --tracks              Path to JSON file with an array of track configs (or "-" for stdin)
  --cytobands           Path to cytoband file for the assembly
  --themeName           Theme for rendering: default, lightStock, lightMinimal, darkStock, or darkMinimal
  --fontFamily          Font family for all text (serif, sans-serif, monospace, or a named family) [default: serif]
  --showGridlines       Show genomic coordinate gridlines in the output [default: false]
  --trackLabels         Track label position: offset, overlay, left, or none
  --refseq              Show the reference sequence track [default: false]
  --spec                Session-spec JSON (inline, path to .json, or "-" for stdin) describing the view; see urlparams.md. Drives N-way comparative views from a --config
  --fasta2              Second assembly indexed FASTA (shorthand)
  --aliases2            Reference name aliases for fasta2
  --loc2                Location on the second assembly
  --autoDiagonalize     Reorder the next assembly's chromosomes for least overlap (a clean diagonal) [default: false]
  --minAlignmentLength  Hide alignments shorter than N bp (de-spaghetti a busy plot)
  --colorBy             Color synteny ribbons (e.g. "query" tints by query chromosome): default, strand, query, target, reference, identity, meanQueryIdentity, mappingQuality, dnds, or track
  --showColorLegend     Show the floating colorBy legend [default: false]

Examples:
  jb2export dotplot --fasta a.fa --fasta2 b.fa --paf a_vs_b.paf --out out.svg
      Whole-genome dotplot of two assemblies via a PAF
  jb2export synteny --fasta a.fa loc:chr1 --paf a_vs_b.paf --fasta b.fa loc:chr1 --out out.svg
      Linear synteny of a region in each assembly (loc: rides on the assembly flag)
  jb2export synteny --chromSizes a.sizes --paf a_b.paf --chromSizes b.sizes --chain b_c.chain --chromSizes c.sizes --out out.svg
      Multi-way (3+) synteny: repeat the assembly flag, put each alignment between the pair it compares
  jb2export synteny --config jbrowse.json --spec spec.json --out out.svg
      N-way synteny from a config + session-spec JSON (see urlparams.md)

Comparison track options: --paf, --blasttab, --chain, --delta

Usage: jb2export synteny [options]

Options:
  --fasta               Path to indexed FASTA file
  --chromSizes          Path to a chrom.sizes file (whole-genome assembly, no sequence). Repeat for each assembly in a comparative view
  --aliases             Path to reference name aliases file
  --assembly            Path to assembly JSON (or "-" for stdin) or name in config
  --hub                 Pull a whole config from genomes.jbrowse.org: a UCSC db name (hg19, mm10) or GenArk accession (GCA_/GCF_...). Gives cytobands, refName aliasing, and hosted trackIds (see --track)
  --track               Show a trackId already in the config (from --hub/--config), e.g. --track hg19-ncbiRefSeqCurated (the hg19- prefix is optional). Repeatable; accepts the same display modifiers as track flags (height:, color:, ...)
  --config              Path to JBrowse config.json (path, URL, or "-" for stdin)
  --session             Path to session JSON (or "-" for stdin)
  --loc                 Location to render (e.g., chr1:1-1000 or "all"), or a gene name when the config has a text-search index (e.g. from --hub)
  --out                 Output file path (SVG, PNG, or PDF by extension). Omit it to write the SVG to stdout, which pipes into rsvg-convert for other formats
  --width               Width of output in pixels [default: 1500]
  --noRasterize         Disable rasterization of pileup/coverage [default: false]
  --defaultSession      Use default session from config [default: false]
  --tracks              Path to JSON file with an array of track configs (or "-" for stdin)
  --cytobands           Path to cytoband file for the assembly
  --themeName           Theme for rendering: default, lightStock, lightMinimal, darkStock, or darkMinimal
  --fontFamily          Font family for all text (serif, sans-serif, monospace, or a named family) [default: serif]
  --showGridlines       Show genomic coordinate gridlines in the output [default: false]
  --trackLabels         Track label position: offset, overlay, left, or none
  --refseq              Show the reference sequence track [default: false]
  --spec                Session-spec JSON (inline, path to .json, or "-" for stdin) describing the view; see urlparams.md. Drives N-way comparative views from a --config
  --fasta2              Second assembly indexed FASTA (shorthand)
  --aliases2            Reference name aliases for fasta2
  --loc2                Location on the second assembly
  --autoDiagonalize     Reorder the next assembly's chromosomes for least overlap (a clean diagonal) [default: false]
  --drawCurves          Draw synteny ribbons as bezier curves instead of trapezoids [default: false]
  --minAlignmentLength  Hide alignments shorter than N bp (de-spaghetti a busy plot)
  --colorBy             Color synteny ribbons (e.g. "query" tints by query chromosome): default, strand, query, target, reference, identity, meanQueryIdentity, mappingQuality, dnds, or track
  --alpha               Ribbon opacity 0-1 (lower reveals density)
  --levelHeights        Comma-separated pixel height per level, e.g. 300,300 (one value applies to all)
  --cigarMode           CIGAR-level indel detail in synteny ribbons: 'off' (blocks only), 'matches' (indels see-through), or 'full' (indels colored) [default: full]
  --showColorLegend     Show the floating colorBy legend [default: false]

Examples:
  jb2export dotplot --fasta a.fa --fasta2 b.fa --paf a_vs_b.paf --out out.svg
      Whole-genome dotplot of two assemblies via a PAF
  jb2export synteny --fasta a.fa loc:chr1 --paf a_vs_b.paf --fasta b.fa loc:chr1 --out out.svg
      Linear synteny of a region in each assembly (loc: rides on the assembly flag)
  jb2export synteny --chromSizes a.sizes --paf a_b.paf --chromSizes b.sizes --chain b_c.chain --chromSizes c.sizes --out out.svg
      Multi-way (3+) synteny: repeat the assembly flag, put each alignment between the pair it compares
  jb2export synteny --config jbrowse.json --spec spec.json --out out.svg
      N-way synteny from a config + session-spec JSON (see urlparams.md)

Comparison track options: --paf, --blasttab, --chain, --delta

Usage: jb2export circular [options]

Options:
  --fasta           Path to indexed FASTA file
  --chromSizes      Path to a chrom.sizes file (whole-genome assembly, no sequence). Repeat for each assembly in a comparative view
  --aliases         Path to reference name aliases file
  --assembly        Path to assembly JSON (or "-" for stdin) or name in config
  --hub             Pull a whole config from genomes.jbrowse.org: a UCSC db name (hg19, mm10) or GenArk accession (GCA_/GCF_...). Gives cytobands, refName aliasing, and hosted trackIds (see --track)
  --track           Show a trackId already in the config (from --hub/--config), e.g. --track hg19-ncbiRefSeqCurated (the hg19- prefix is optional). Repeatable; accepts the same display modifiers as track flags (height:, color:, ...)
  --config          Path to JBrowse config.json (path, URL, or "-" for stdin)
  --session         Path to session JSON (or "-" for stdin)
  --loc             Location to render (e.g., chr1:1-1000 or "all"), or a gene name when the config has a text-search index (e.g. from --hub)
  --out             Output file path (SVG, PNG, or PDF by extension). Omit it to write the SVG to stdout, which pipes into rsvg-convert for other formats
  --width           Width of output in pixels [default: 1500]
  --noRasterize     Disable rasterization of pileup/coverage [default: false]
  --defaultSession  Use default session from config [default: false]
  --tracks          Path to JSON file with an array of track configs (or "-" for stdin)
  --cytobands       Path to cytoband file for the assembly
  --themeName       Theme for rendering: default, lightStock, lightMinimal, darkStock, or darkMinimal
  --fontFamily      Font family for all text (serif, sans-serif, monospace, or a named family) [default: serif]
  --showGridlines   Show genomic coordinate gridlines in the output [default: false]
  --trackLabels     Track label position: offset, overlay, left, or none
  --refseq          Show the reference sequence track [default: false]
  --spec            Session-spec JSON (inline, path to .json, or "-" for stdin) describing the view; see urlparams.md. Drives N-way comparative views from a --config

Examples:
  jb2export circular --fasta ref.fa --vcfgz sv.vcf.gz --out out.svg
      Circular (chord) view of structural variants

Usage: jb2export breakpoint [options]

Options:
  --fasta           Path to indexed FASTA file
  --chromSizes      Path to a chrom.sizes file (whole-genome assembly, no sequence). Repeat for each assembly in a comparative view
  --aliases         Path to reference name aliases file
  --assembly        Path to assembly JSON (or "-" for stdin) or name in config
  --hub             Pull a whole config from genomes.jbrowse.org: a UCSC db name (hg19, mm10) or GenArk accession (GCA_/GCF_...). Gives cytobands, refName aliasing, and hosted trackIds (see --track)
  --track           Show a trackId already in the config (from --hub/--config), e.g. --track hg19-ncbiRefSeqCurated (the hg19- prefix is optional). Repeatable; accepts the same display modifiers as track flags (height:, color:, ...)
  --config          Path to JBrowse config.json (path, URL, or "-" for stdin)
  --session         Path to session JSON (or "-" for stdin)
  --loc             Location to render (e.g., chr1:1-1000 or "all"), or a gene name when the config has a text-search index (e.g. from --hub)
  --out             Output file path (SVG, PNG, or PDF by extension). Omit it to write the SVG to stdout, which pipes into rsvg-convert for other formats
  --width           Width of output in pixels [default: 1500]
  --noRasterize     Disable rasterization of pileup/coverage [default: false]
  --defaultSession  Use default session from config [default: false]
  --tracks          Path to JSON file with an array of track configs (or "-" for stdin)
  --cytobands       Path to cytoband file for the assembly
  --themeName       Theme for rendering: default, lightStock, lightMinimal, darkStock, or darkMinimal
  --fontFamily      Font family for all text (serif, sans-serif, monospace, or a named family) [default: serif]
  --showGridlines   Show genomic coordinate gridlines in the output [default: false]
  --trackLabels     Track label position: offset, overlay, left, or none
  --refseq          Show the reference sequence track [default: false]
  --spec            Session-spec JSON (inline, path to .json, or "-" for stdin) describing the view; see urlparams.md. Drives N-way comparative views from a --config

Examples:
  jb2export breakpoint --fasta ref.fa --bam tumor.bam --loc chr1:1,000,000-1,001,000 --loc chr5:2,000,000-2,001,000 --out sv.png
      Both sides of one breakend, with the reads that cross it drawn between
  jb2export breakpoint --hub hg38 --bam tumor.bam --loc chr3:25,358,000-25,361,000 --loc chr10:58,716,500-58,718,500 --loc chr12:72,272,000-72,275,000 --out chain.png
      A multi-hop chain: one panel per locus, in the order the reads cross them
  jb2export breakpoint --fasta ref.fa --bam tumor.bam --loc "chr9:28,030,000-28,032,000 chr9:28,058,000-28,060,000" --loc chr9:28,059,000-28,061,000 --out fb.png
      Quote one --loc to put several windows in a single panel
```

<!-- INJECT_HELP END -->

## Troubleshooting

### `ENOENT: ... .fa.fai` (or `.bai` / `.tbi` / `.crai`)

Data files are read alongside their index, so generate the index next to the
file first:

```bash
samtools faidx yourfile.fa     # -> yourfile.fa.fai
samtools index yourfile.bam    # -> yourfile.bam.bai
tabix -p vcf yourfile.vcf.gz   # -> yourfile.vcf.gz.tbi
```

### `unknown reference sequence name in location ...`

The refname in `--loc` doesn't match the FASTA. Use the name exactly as it
appears in the FASTA, or pass `--aliases` to reconcile differing naming styles
(e.g. `1` vs `chr1` vs `NC_000001.10`) across the assembly and track files. See
[Remote files](#remote-files).

### A track renders empty when zoomed far out

Some track types (alignments, genes) refuse to render past a feature-density
limit. Add `force:true` after the track to override it. See
[Force render a large region](#force-render-a-large-region).

## See also

- [@jbrowse/capture](https://www.npmjs.com/package/@jbrowse/capture) drives a
  real browser instead of rendering server-side. Slower, and it downloads
  Chromium, but it photographs the whole application — canvas and WebGPU
  displays, menus, dialogs — and can click through it.
- [Using JBrowse with AI agents](https://jbrowse.org/jb2/docs/agents/) for the
  loop these tools fit into.
