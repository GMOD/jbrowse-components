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
rendered straight from public files in a single command. Each file is typed by
its name, and the genome's `aliases:` file reconciles the `1` / `chr1` /
`NC_000001.10` refname styles across the files:

![A multi-track hg19 view: NCBI RefSeq genes, ClinGen gene-disease mapping, phyloP conservation, and SKBR3 nanopore reads](https://jbrowse.org/jb2-figures/jbrowse-img/1.e2e6cac81c8d.png)

<!-- jb2export: 1 -->

```bash
jb2export https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz aliases:https://jbrowse.org/genomes/hg19/hg19_aliases.txt https://s3.amazonaws.com/jbrowse.org/genomes/hg19/ncbi_refseq/GRCh37_latest_genomic.sort.gff.gz '{"filter":["geneLike"]}' \
  --bigbed https://jbrowse.org/genomes/hg19/clinGen/clinGenGeneDisease.bb \
  --bigwig https://hgdownload.soe.ucsc.edu/goldenpath/hg19/phyloP100way/hg19.100way.phyloP100way.bw \
  --cram https://s3.amazonaws.com/jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.cram \
  --loc 1:19,190,000-19,240,000 --width 1200 --out 1.png
```

The `'{"filter":["geneLike"]}'` after the GFF is a raw-JSON per-track override
(any display setting can be set this way). NCBI RefSeq GFFs have non-gene
support features (`region`, `match`, `biological_region`) that would otherwise
render as unnamed rows above the genes; the `filter`'s `geneLike` entry keeps
the track to gene/transcript features.

## Basic usage

### Local files

The tool runs on local files as a plain node script with no browser, and creates
the SVG with React SSR

```bash
## generate an indexed fasta e.g. fai file
samtools faidx yourfile.fa

## generate an indexed BAM
samtools index yourfile.bam


## render them: the FASTA is the genome, the BAM a track
jb2export yourfile.fa yourfile.bam --loc chr1:1,000,000-1,001,000 --out file.svg
```

- A FASTA, 2bit or `.chrom.sizes` is the genome, and any other file is a track,
  typed by its name. A typed flag such as `--fasta`, `--bam` or `--bigwig` sets
  the type of a file with an unrecognized name; `jb2export --help` lists them.
- With no `--out`, the SVG goes to stdout.

### Remote files

An example with remote files, human hg19 and several tracks. The genome's
`aliases:` file reconciles refname differences, e.g. the fasta contains 1 for
chr1, the bigbed contains chr1 and the gff contains NC_000001.10

<!-- jb2export: remote_files -->

```bash
jb2export https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz aliases:https://jbrowse.org/genomes/hg19/hg19_aliases.txt https://hgdownload.soe.ucsc.edu/gbdb/hg19/bbi/clinvar/clinvarMain.bb https://jbrowse.org/genomes/hg19/ncbi_refseq/GRCh37_latest_genomic.sort.gff.gz https://jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.regions.bw \
  --loc 1:48,683,542-48,907,531 --width 1200 --out remote_files.png
```

![ClinVar variants above NCBI RefSeq genes, every file streamed from a public URL](https://jbrowse.org/jb2-figures/jbrowse-img/remote_files.5d179fabe07d.png)

### Hosted assemblies (genomes.jbrowse.org)

`--genome <name>` pulls a whole assembly config from
[genomes.jbrowse.org](https://genomes.jbrowse.org), supplying the sequence,
cytobands (shown in the overview ideogram), and refName aliasing in place of a
genome file with its `aliases:` and `cytobands:`. `<name>` is either a UCSC
database name (`hg19`, `hg38`, `mm10`, ...) or a GenArk accession
(`GCA_...`/`GCF_...`):

```bash
## refName aliasing comes from the hosted config: "1" resolves to chr1
jb2export --genome hg19 --loc 1:1,000,000-1,100,000 --out out.svg

## a GenArk accession
jb2export --genome GCA_964188535.1 --loc <contig>:1-100000 --out out.svg
```

Every track in the hosted config can be shown by its trackId with `--track`,
which is repeatable and accepts the same display modifiers as the track-type
flags (see [Track modifiers](#track-modifiers)):

<!-- jb2export: hub_tracks -->

```bash
jb2export --genome hg19 --track hg19-ncbiRefSeqCurated \
  --track hg19-clinvarMain --loc chr1:1,020,000-1,040,000 --width 1200 \
  --out hub_tracks.png
```

![NCBI RefSeq genes and ClinVar variants at the start of hg19 chromosome 1, both named by trackId from the hosted hg19 hub](https://jbrowse.org/jb2-figures/jbrowse-img/hub_tracks.8d7d42b9df94.png)

Hosted trackIds are all prefixed with the assembly name (`hg19-...`), so
`--track` fills that in for you: `--track ncbiRefSeqCurated` resolves to
`hg19-ncbiRefSeqCurated`. Matching is also case-insensitive and works on a
track's display name, and a token that doesn't match anything errors with the
closest trackIds:

```console
$ jb2export --genome hg19 --track clinvar ...
Error: --track "clinvar" not found in the config. Did you mean: hg19-clinvarMain,
hg19-clinvarCnv, hg19-dbSnp155ClinVar, ...?
```

Hosted configs also include a gene text-search index, so `--loc` accepts a
**gene name** and jumps to it:

<!-- jb2export: gene_name_search -->

```bash
jb2export --genome hg19 --track ncbiRefSeqCurated --loc BRCA1 --width 1200 \
  --out gene_name_search.png
```

![The BRCA1 gene, reached by typing its name](https://jbrowse.org/jb2-figures/jbrowse-img/gene_name_search.41d6f419d999.png)

`--loc` still takes ordinary locstrings (`chr1:1-10000`,
`1:1,000,000-1,100,000`, or `all`); a name that isn't a locstring is looked up
in the index and the view jumps to the top hit.

The `list` subcommand prints genome names and trackIds:

```bash
## every assembly on genomes.jbrowse.org (name — organism — description)
jb2export list

## every track in a genome (trackId, type, name)
jb2export list hg19

## just the tracks whose id or name matches a filter
jb2export list hg19 refseq
```

`--config` also accepts a URL, so you can point at any hosted JBrowse
`config.json` the same way; relative data URIs inside it resolve against the
config's location, exactly as they do in JBrowse web.

## Opening the same view in JBrowse Desktop

[JBrowse Desktop](https://jbrowse.org/jb2/docs/quickstart_desktop/) takes these
arguments too. Without `--out`, the command opens the view in a window to
explore:

```bash
jbrowse-desktop yourfile.fa yourfile.bam --loc chr1:1,000,000-1,001,000
jbrowse-desktop --genome hg19 --track ncbiRefSeqCurated --loc BRCA1
```

- `jbrowse-desktop` stands for the binary's full path, which
  [differs per platform](https://jbrowse.org/jb2/docs/quickstart_desktop/#launching-from-the-command-line).
- Desktop skips display modifiers such as `height:` and `color:` for now, and
  image flags such as `--width`, and names what it skipped.

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

![A coverage histogram over a read pileup, with mismatches highlighted](https://jbrowse.org/jb2-figures/jbrowse-img/alignments_pileup.07e7ddaf779a.png)

Track modifiers color, sort, and group the reads. `sort:base` orders the pileup
by the base each read has at the center position. Here it sorts HG008-T PacBio
HiFi reads over the `CUZD1` gene, so every read with a ~1.8 kb somatic deletion
falls into one contiguous band and the heterozygous deletion (and its coverage
dip) is visible in the pileup:

<!-- jb2export: alignments_readgroup -->

```bash
jb2export --genome hg38 --track hg38-ncbiRefSeqCurated height:55 \
  --bam https://jbrowse.org/demos/cgiab/HG008-T_chr10_CUZD1_deletion.bam sort:base height:420 \
  --loc chr10:122,831,700-122,840,800 --width 1200 \
  --out alignments_readgroup.png
```

![PacBio HiFi reads over CUZD1, sorted by the base at the center position](https://jbrowse.org/jb2-figures/jbrowse-img/alignments_readgroup.2e6d8de332d3.png)

`facet=tags.HP` splits the pileup into one stacked sub-track per haplotype. This
HG002 ultralong-ONT example (hg19, streamed from the GIAB FTP) groups and colors
by the `HP` tag: the heterozygous deletion shows in one haplotype and not the
other:

<!-- jb2export: alignments_haplotype -->

```bash
jb2export --fasta https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz \
  --bam https://jbrowse.org/demos/hg002/HG002.ONTrel2.HP.hs37d5.demo_slices.bam facet=tags.HP encoding.color.field=tags.HP height:400 \
  --loc 1:63,005,675-63,007,432 --width 1200 --out alignments_haplotype.png
```

![Reads grouped and colored by the HP tag](https://jbrowse.org/jb2-figures/jbrowse-img/alignments_haplotype.28d663cf6685.png)

`baseColor:methylation` paints per-base CpG methylation calls from a
modified-base (`MM`/`ML`) BAM/CRAM: methylated cytosines red, unmethylated blue.
This COLO829 nanopore CRAM (hg38, streamed from the ONT open-data S3) with the
UCSC CpG-island BED on top shows methylated flanks and unmethylated island
cores, read against the annotated island boundaries. `legend.show=true` draws
the color key. The app leaves the legend off because a reader can open the track
menu, so add it to any export whose coloring is not the default.

<!-- jb2export: methylation -->

```bash
jb2export https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz aliases:https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt https://jbrowse.org/ucsc/hg38/cpgIslandExt.bed.gz index:https://jbrowse.org/ucsc/hg38/cpgIslandExt.bed.gz.csi \
  --bam https://jbrowse.org/demos/ont/COLO829_tumor.ht.chr20_18.5Mb.bam baseColor:methylation legend.show=true height:350 \
  --loc chr20:18,503,000-18,509,000 --width 1200 --out methylation.png
```

![COLO829 nanopore reads colored by per-base CpG methylation over a CpG island](https://jbrowse.org/jb2-figures/jbrowse-img/methylation.6d394654f846.png)

`sashimi:auto` overlays splice-junction arcs on the coverage band, sized by the
number of reads spanning each junction. `coverage.height=` makes the
coverage/sashimi band tall so the arcs are legible, and `scales.y.type=log` puts
every exon on the plot, because RNA-seq depth here spans three orders of
magnitude, so on a linear axis the tallest exon is the only one with any height
and the arcs sit over a flat line. This strand-specific paired-end RNA-seq
(hg19, public) over `B2M` shows the long first intron as one big arc and the
closely-spaced downstream exons as smaller arcs, with the spliced read pairs
(green mate lines) below:

<!-- jb2export: sashimi_junctions -->

```bash
jb2export --genome hg19 --track hg19-ncbiRefSeqCurated height:90 \
  --bam https://s3.amazonaws.com/jbrowse.org/genomes/hg19/paired_end_rnaseq/Pairend_StrandSpecific_51mer_Human_hg19.bam sashimi:auto coverage.height=170 scales.y.type=log featureHeight:super-compact height:420 \
  --loc B2M --width 1400 --out sashimi_junctions.png
```

![RNA-seq sashimi plot over B2M: splice-junction arcs on the coverage band sized by junction read depth, over the spliced read pileup](https://jbrowse.org/jb2-figures/jbrowse-img/sashimi_junctions.daf65113f8d1.png)

Three modifiers draw the ~1.2 kb chr1 inversion in the 1000 Genomes ONT sample
HG00151 (long reads streamed from the 1000G-ONT S3):

- **`arcs:up` / `arcs:down`** draws a read-connection arc for every split
  (supplementary) read, linking its two alignment segments and colored by the
  junction's orientation. Here **purple inversion-junction arcs** join the two
  breakpoints, where a read's two halves map in opposite orientations.
- **`unit=chain`** chains each read's split segments, so the inversion shows in
  the pileup itself as a **blue reverse-strand core between red forward-strand
  flanks**, spanning breakpoint to breakpoint.
- **`facet=split`** puts those reads in a separate labelled section above the
  background pileup.

<!-- jb2export: sv_read_arcs -->

```bash
jb2export --genome hg38 \
  --bam https://jbrowse.org/demos/ont/HG00151-ONT-hg38.chr1_inversion.bam arcs:down unit=chain encoding.color.field=pairOrientation facet=split coverage.height=80 height:560 \
  --loc chr1:197,786,900-197,789,700 --width 1400 --out sv_read_arcs.png
```

![ONT reads over a chr1 inversion grouped on SA-tag presence, the split reads in their own section under the junction arcs](https://jbrowse.org/jb2-figures/jbrowse-img/sv_read_arcs.74712a4cbf99.png)

### Breakpoint split views

The `breakpoint` subcommand stacks both sides of a junction and draws a curve
for each read that has alignments in two panels. Everything above draws an SV in
**reference** coordinates; the breakpoint view draws the two loci it joins.

**Repeating `--loc` stacks a panel; whitespace inside one `--loc` adds a window
to that panel**, the meaning a space already has for a linear view. So the
two-breakend case is two bare `--loc` flags with no shell quoting, and a quoted
`--loc` is how a panel takes two windows.

A connector is drawn dashed when the read it joins has a supplementary alignment
at a locus that is not on screen. A dashed connector means a panel is missing,
so add that panel. COLO829's der(3) is a closed cycle over three chromosomes, so
the junction below needs a chr10 panel between the two it appears to join, and
with it every connector in the figure is solid.

**One render per sample, and the control is the other render.** A somatic call
is the difference between the tumour and its matched normal, so a figure for one
is two renders side by side, with the same `--loc` list and the same `--width`
and one `--track` each. The connecting curves are drawn per track, so the tumour
render has them and the normal render has none.

<!-- jb2export: sv_review_tumor -->

```bash
jb2export breakpoint --config https://jbrowse.org/demos/cancer_sv/config.json \
  --assembly hg38 \
  --track COLO829_tumor_ont height:130 force:true featureHeight:super-compact \
  --loc chr3:25,358,511-25,359,711 --loc chr10:58,716,962-58,718,162 \
  --loc chr12:72,272,512-72,273,712 --width 1000 --out sv_review_tumor.png
```

![COLO829's der(3) loci, chr3 then chr10 then chr12, in the tumour nanopore reads](https://jbrowse.org/jb2-figures/jbrowse-img/sv_review_tumor.ab381bb352f0.png)

Then the same command with the other sample's track:

<!-- jb2export: sv_review_normal -->

```bash
jb2export breakpoint --config https://jbrowse.org/demos/cancer_sv/config.json \
  --assembly hg38 \
  --track COLO829BL_normal_ont height:130 force:true featureHeight:super-compact \
  --loc chr3:25,358,511-25,359,711 --loc chr10:58,716,962-58,718,162 \
  --loc chr12:72,272,512-72,273,712 --width 1000 --out sv_review_normal.png
```

![The three der(3) loci in the matched normal, with no connecting curves in any panel](https://jbrowse.org/jb2-figures/jbrowse-img/sv_review_normal.87e24fe0b711.png)

The tumour and normal commands each take two modifiers:

- **`force:true`** overrides the byte gate, which the chr3 panel exceeds at 1.2
  kb of 200x nanopore; without it that panel draws the gate's message instead of
  reads.
- **`featureHeight:super-compact`** draws each read 1 px tall, so six pileups
  fit on one screen.

**A reconstructed allele is an assembly, so it is a third render.** Once the
junctions have been resolved into a derivative contig, the three loci above form
one axis, in order, so they need one panel instead of three. That contig is an
assembly in the same config, so only the `--assembly` argument changes.

<!-- jb2export: sv_review_derivative -->

```bash
jb2export --config https://jbrowse.org/demos/cancer_sv/config.json \
  --assembly der3_RARB_BICC1_TRHDE --track der3_segments height:128 \
  --track reads_vs_der3 height:440 --loc der3_RARB_BICC1_TRHDE:1-39,549 \
  --width 1000 --out sv_review_derivative.png
```

![The COLO829 der(3) allele as one contig, with the reads realigned to it](https://jbrowse.org/jb2-figures/jbrowse-img/sv_review_derivative.999f17f4e5ca.png)

jb2export writes one image per command, so place the three beside each other in
your docs.

To render a whole callset, `jb2export batch` renders one image per row of a
BEDPE. See the
[SV callset review tutorial](https://jbrowse.org/jb2/docs/tutorials/sv_callset_review/),
and `jb2export batch --help`.

More alignment recipes (see [Track modifiers](#track-modifiers) for all
options):

```bash
## color by splice strand (XS tag), sort by haplotype (HP tag)
jb2export --fasta ref.fa --bam reads.bam encoding.color.field=tags.XS sort:tag:HP --loc chr1:1-10000

## color by base modifications (MM/ML tags) in super-compact layout
jb2export --fasta ref.fa --bam reads.bam baseColor:modifications featureHeight:super-compact \
  --loc chr1:1-10000

## methylation over reads tinted by haplotype, in two quiet colors
jb2export --fasta ref.fa --bam reads.bam encoding.color.field=tags.HP encoding.color.scale.domain=1,2 encoding.color.scale.range=#d9c9a3,#b7c4b1 \
  baseColor:methylation legend.show=true --loc chr1:1-10000

## color by insert size + orientation to highlight structural variants
jb2export --fasta ref.fa --bam reads.bam color:insertSizeAndOrientation --loc chr1:1-10000

## read-cloud SV view — the cloud draws in its own band below the coverage band,
## sized by readConnections.height. With readConnections.placement=up it overlays
## the coverage band instead, sized by coverage.height.
jb2export --fasta ref.fa --bam reads.bam arcs:cloud readConnections.height=300 \
  readConnections.encoding.strokeWidth.value=2 height:600 --loc chr1:1-50000

## view as pairs / link supplementary alignments: mates and split segments of one
## read share a row, joined by a connecting line. pileup.showConnectors=true is
## the separate curved-connector overlay and leaves the layout an ordinary pileup.
## Add both to curve the connectors that cross between displayed regions, which
## the per-region line pass cannot draw.
jb2export --fasta ref.fa --bam linked.bam unit=chain --loc chr1:1-50000
```

### BigWig / quantitative tracks

`--loc all` shows the full assembly, and several bigwig plotting options help
draw a bigwig genome-wide.

The logscale, manual-minmax example below plots the SKBR3 breast-cancer cell
line's read coverage genome-wide (hg19, public bigwig), where the amplifications
and deletions of the cancer karyotype are visible:

<!-- jb2export: skbr3_cov -->

```bash
jb2export --loc all --fasta https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz \
  --bigwig https://jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.regions.bw scales.y.type=log mark=point resolution=100 height:400 color:purple scales.y.domainMin=1 scales.y.domainMax=1024 \
  --width 1900 --out skbr3_cov.png
```

![SKBR3 read coverage genome-wide on a log scale](https://jbrowse.org/jb2-figures/jbrowse-img/skbr3_cov.20b477a3ce08.png)

The axis clips outliers by default, stopping short of a spike that would flatten
the rest of the view; `scales.y.domainQuantile=1` follows the extremes instead:

```bash
jb2export --loc all \
  --bigwig coverage.bw scales.y.domainQuantile=1 mark=point resolution=100 height:400 color:purple \
  --assembly hg19 \
  --config data/config.json
```

### MultiWiggle (many BigWigs in one track)

`--multiwig` aggregates many BigWig files into a single multi-row
`MultiQuantitativeTrack`, where each subtrack shares one autoscale so the rows
are directly comparable. Its argument is either a comma-separated list of BigWig
files (local paths or URLs), or a `.json` file holding an array (of plain BigWig
paths/URLs, or of _subadapter_ objects that set `name`, `color`, and `group` for
each row):

```bash
## quick shorthand: a comma-separated file list, one row per file
jb2export --genome hg38 --multiwig a.bw,b.bw,c.bw height:300 --loc GAPDH --out multi.png

## curated rows: a JSON sources file (name/color/group per subtrack)
jb2export --genome hg38 --multiwig sources.json height:520 --loc GCG --out multi.png
```

The example below renders the CATlas single-cell ATAC accessibility-by-cell-type
data (Zhang et al 2021): 16 human cell types, each a BigWig, set up with per-row
labels/colors/groups in
[`data/scatac_catlas.json`](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-img/data/scatac_catlas.json),
over the `GCG` (glucagon) locus. The **Alpha (glucagon)** row (the pancreatic
cell type that expresses GCG) shows strong open chromatin across the gene while
the other 15 cell types show little signal on the shared scale:

<!-- jb2export: scatac_multiwiggle -->

```bash
jb2export --genome hg38 --track hg38-ncbiRefSeqCurated height:60 \
  --multiwig data/scatac_catlas.json 'name:CATlas single-cell ATAC (accessibility by cell type)' height:440 \
  --loc chr2:162,000,000-162,300,000 --width 1400 --out scatac_multiwiggle.png
```

![CATlas single-cell ATAC across 16 cell types over GCG](https://jbrowse.org/jb2-figures/jbrowse-img/scatac_multiwiggle.13ca0f7d318c.png)

### Variant tracks

A VCF track draws each variant with its reference-to-alternate change.
Reproducible with the bundled volvox VCF:

<!-- jb2export: variants -->

```bash
jb2export data/volvox/volvox.fa data/volvox/volvox.filtered.vcf.gz \
  --loc ctgA:1-20000 --width 1200 --out variants.png
```

![A variant track drawing each SNV with its reference-to-alternate change](https://jbrowse.org/jb2-figures/jbrowse-img/variants.c7d9a5843edd.png)

### Multi-sample variant matrix

A VCF with many samples renders as a genotype matrix (one row per sample, each
alt genotype painted over the reference background) with the
`display:multivariant` modifier (the `LinearMultiSampleVariantDisplay`);
`display:multivariantmatrix` draws the same display in equal-width columns. This
example draws the 1000 Genomes phase 3 chr11 callset (2,504 samples) over the
HBB β-globin locus, with the NCBI RefSeq gene track (via `--genome`/`--track`)
for context. Common variants read as solid vertical bands, rarer ones as sparse
speckle:

<!-- jb2export: multisample_variants -->

```bash
jb2export --genome hg19 \
  --track hg19-ncbiRefSeqCurated https://jbrowse.org/genomes/hg19/1000genomes/ALL.chr11.phase3_v5b.HBB_5.2-5.3Mb.vcf.gz display:multivariant height:450 force:true \
  --loc chr11:5,246,000-5,251,000 --width 1200 --out multisample_variants.png
```

![The 1000 Genomes phase 3 chr11 callset (2,504 samples) as a multi-sample genotype matrix over the HBB locus, with the NCBI RefSeq gene track above](https://jbrowse.org/jb2-figures/jbrowse-img/multisample_variants.da3e1a18014d.png)

### Hi-C tracks

A `--hic` track draws the contact matrix as a triangular heatmap. This example
streams the public hg19 demo `.hic` and shows the TAD structure along chr1, with
the NCBI RefSeq gene track (via `--genome`/`--track`) on top for context:

<!-- jb2export: hic -->

```bash
jb2export --genome hg19 --track hg19-ncbiRefSeqCurated \
  --hic https://jbrowse.org/genomes/hg19/intra_nofrag_30.hic height:400 \
  --loc 1:2,500,000-12,500,000 --width 1200 --out hic.png
```

![A Hi-C contact matrix as a triangular heatmap along hg19 chr1](https://jbrowse.org/jb2-figures/jbrowse-img/hic.239de0eebc0f.png)

`color:viridis` on a `--hic` track names the ramp the counts run across, any
[scheme HicColor takes](https://jbrowse.org/jb2/docs/config/hiccolor/#slot-scheme),
and `encoding.color.scale.type=log` places them on it by their log2.

### Gene tracks and the reference sequence

Feature tracks (GFF, BigBed, BED, or a hosted `--track`) render their glyphs
with labels, and `--refseq` adds the assembly's reference-sequence track. Zoomed
to base level, it shows the DNA bases and the six-frame translation (green start
codons, red stops). This human example zooms into a `TP53` intron/CDS boundary.
The intron thins to a connector line, the coding exon begins as a solid CDS
block, and the block's edge lines up with a specific reference base and reading
frame. The `filter`'s `geneLike` entry keeps the RefSeq track to its gene
features:

<!-- jb2export: gene_track -->

```bash
jb2export --genome hg38 \
  --track hg38-ncbiRefSeqCurated height:60 '{"filter":["geneLike"],"geneGlyphMode":"longestCoding"}' \
  --refseq --loc chr17:7,675,018-7,675,098 --width 1500 --out gene_track.png
```

![A TP53 intron/CDS boundary at base level: the sequence track and its six-frame translation above the NCBI RefSeq genes](https://jbrowse.org/jb2-figures/jbrowse-img/gene_track.890f9ba49a32.png)

### Themes

`--themeName` selects a palette (`default`, `stock` or `minimal`) and
`--themeMode` draws it `light` or `dark`. The combined names `darkStock`,
`lightMinimal` and the rest still work.

<!-- jb2export: dark_theme -->

```bash
jb2export --genome hg38 --track hg38-ncbiRefSeqCurated height:100 \
  --track hg38-phyloP100way height:140 --loc chr10:87,860,000-87,975,000 \
  --themeName stock --themeMode dark --width 1200 --out dark_theme.png
```

![The hg38 PTEN locus: NCBI RefSeq genes over phyloP conservation, rendered with the stock palette drawn dark](https://jbrowse.org/jb2-figures/jbrowse-img/dark_theme.000d69be1d7d.png)

## Track modifiers

Per-track settings use a colon-based syntax that follows the track file
argument, e.g. `--bam reads.bam color:strand height:400`. This is the full list
of named modifiers. Any other display setting is a
[slot write](#any-display-setting-slotpathvalue), spelled as the display spells
the slot.

Modifiers are grouped below by the track types they apply to. Passing one to a
track type it does not apply to (say `sashimi:up` on a BigWig) prints a warning
naming the types it does work on. A track whose display none of these target
(GWAS, MAF, LD, marks, synteny, sequence) takes only the all-tracks modifiers
and [slot writes](#any-display-setting-slotpathvalue).

A modifier **value** the modifier can't use, such as `arcs:upp`, `height:8o` or
`force:ture`, is an error. The tool writes one figure and exits, so a warning
would scroll past and leave you with a wrong image. The bare form `force` means
`force:true`.

**All tracks**

| Modifier        | Example                | Description                                          |
| --------------- | ---------------------- | ---------------------------------------------------- |
| `height:N`      | `height:400`           | Track height in pixels                               |
| `force:true`    | `force:true`           | Render even if region is too large                   |
| `display:value` | `display:multivariant` | Pick a non-default display for the track (see below) |
| `name:label`    | `name:"Tumor"`         | Track label (defaults to the filename)               |
| `index:path`    | `index:reads.bam.csi`  | Index file, when it isn't a sibling of the data file |

A track is identified by its filename, so two inputs with the same filename
(`--bam tumor/sample.bam --bam normal/sample.bam`) would both be labelled
`sample.bam`. Both render, but pass `name:` to tell them apart in the figure.

With no `index:`, a **local** file's index is whichever of these siblings is
actually there, opened as the type it is:

<!-- INJECT_INDEX_SPELLINGS START: auto-filled from indexSpellings in packages/add-track-core/src/indexCandidates.ts by website/scripts/generate-img-doc.ts -->

| Spelling                                  | Written by                                                     |
| ----------------------------------------- | -------------------------------------------------------------- |
| `<file>.tbi`, `<file>.bai`, `<file>.crai` | samtools, tabix                                                |
| `<file>.csi`                              | htslib, for a reference over 512 Mb and on request at any size |
| `reads.bai` beside `reads.bam`            | Picard, GATK                                                   |

<!-- INJECT_INDEX_SPELLINGS END -->

The tool does not probe a remote file, because checking costs a request. A
hosted `.csi` therefore needs an explicit `index:`.

By default each track uses its primary display. `display:value` selects an
alternate one. These friendly aliases are recognized (any other value is passed
through verbatim as a display state-model name):

| `display:` value     | Selected display                                              | Use                                             |
| -------------------- | ------------------------------------------------------------- | ----------------------------------------------- |
| `marks`              | `LinearMarkDisplay`                                           | bars, points, spans, text and links you declare |
| `multivariant`       | `LinearMultiSampleVariantDisplay`                             | multi-sample VCF genotype matrix (rows)         |
| `multivariantmatrix` | `LinearMultiSampleVariantDisplay`, `variantLayout: 'columns'` | the same, one equal-width column per variant    |

**Alignment tracks (BAM/CRAM)**

Reads & coloring:

| Modifier                       | Example                      | Description                                                                                |
| ------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------ |
| `color:field`                  | `color:strand`               | Color reads by a field (see fields below), or paint them all one CSS color                 |
| `baseColor:field`              | `baseColor:methylation`      | Draw a per-base layer over the reads, whatever `color:` fills them with (see fields below) |
| `sort:field` or `sort:tag:TAG` | `sort:strand`, `sort:tag:RG` | Sort reads (`position`, `strand`, `base`, or `tag:<TAG>`)                                  |

The modifiers below choose which reads are drawn. They filter before the
coverage pipeline as well as before layout, so a filter that removes reads
removes them from the coverage band too.

The last four modifiers in the table, `svSignal:`, `split:`, `alone:` and
`spliced:`, name a read category and take one vocabulary: `only` keeps that
category, `exclude` drops it, and omitting the modifier leaves it alone. A read
must pass each of them and the masks above. The SV export is `svSignal:only`.
Passing `all` is accepted and stores nothing, which lets a script pass a
category through from a variable that may be empty.

| Modifier                 | Example                | Description                                                                                                                                                                                                                                                                                                            |
| ------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flags:include:exclude`  | `flags::SECONDARY,DUP` | SAM flag masks, `samtools -f` then `-F`. Each half is a number or samtools' flag names, comma-separated (`PAIRED`, `PROPER_PAIR`, `UNMAP`, `MUNMAP`, `REVERSE`, `MREVERSE`, `READ1`, `READ2`, `SECONDARY`, `QCFAIL`, `DUP`, `SUPPLEMENTARY`). Either half may be empty to leave that mask as the track's config set it |
| `mapq:N`                 | `mapq:20`              | Keep only reads with a mapping quality of at least N, `samtools -q`. A read with MAPQ 255 (none reported) is kept                                                                                                                                                                                                      |
| `filterTag:TAG:value`    | `filterTag:HP:1`       | Keep only reads whose tag has this value. Repeatable, and every one must pass                                                                                                                                                                                                                                          |
| `svSignal:only\|exclude` | `svSignal:only`        | SV evidence, and the rest of the read's pair in the same window: a split read, an insertion or deletion of 50 bp or more, or a paired read the aligner did not call concordant (no 0x2, a mate unmapped or on another chromosome, or a pair not facing FR). `mapq:` judges each read alone                             |
| `split:only\|exclude`    | `split:only`           | Reads the aligner gave a supplementary segment (SAM flag 0x800), read off the SA tag                                                                                                                                                                                                                                   |
| `alone:only\|exclude`    | `alone:exclude`        | Reads with no mate or split segment in the window                                                                                                                                                                                                                                                                      |
| `spliced:only\|exclude`  | `spliced:only`         | Reads whose CIGAR has a reference skip (N), an intron in RNA-seq                                                                                                                                                                                                                                                       |

Overlays & subtracks:

| Modifier       | Example      | Description                                                            |
| -------------- | ------------ | ---------------------------------------------------------------------- |
| `arcs:mode`    | `arcs:cloud` | Read-connection arcs / read-cloud panel (`off`, `up`, `down`, `cloud`) |
| `sashimi:mode` | `sashimi:up` | Sashimi splice-junction arcs (`off`, `up`, `down`, `auto`)             |

Layout & sizing:

| Modifier                  | Example                                          | Description                                                                                                                 |
| ------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `featureHeight:preset\|N` | `featureHeight:super-compact`, `featureHeight:4` | Per-read height (spacing between reads is derived from it). Presets: `normal` (7px), `compact` (3px), `super-compact` (1px) |

Settings written as slots, spelled as the display spells them:

| Write                                             | Description                                                                                                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `facet=strand`                                    | Group reads into in-track stacked sections: `strand`, `firstOfPairStrand`, `pairOrientation`, `pairing`, `split`, `spliced`, `svSignal`, `mapq`, `tags.HP` |
| `unit=chain`                                      | What one row stands for: a `read`, or its mate and split segments chained                                                                                  |
| `legend.show=true`                                | Draw the color key. Off by default in the app, where the reader can open the track menu instead                                                            |
| `pileup.softClips.show=true`                      | Show soft-clipped bases                                                                                                                                    |
| `coverage.show=false`                             | Hide the coverage subtrack                                                                                                                                 |
| `pileup.show=false`                               | Hide the pileup; with `coverage.height`, a coverage-only view                                                                                              |
| `coverage.height=200`                             | Height of the coverage subtrack, and of `arcs:up` arcs drawn over it                                                                                       |
| `readConnections.height=120`                      | Height of the arcs' or read cloud's band, under `arcs:down` and `arcs:cloud`, or `arcs:up` with `coverage.show=false`                                      |
| `readConnections.encoding.strokeWidth.value=2`    | Stroke width for read-connection arcs and lines                                                                                                            |
| `sashimi.height=120`                              | Height of the sashimi arc band                                                                                                                             |
| `readConnections.encoding.color.field=insertSize` | Read-connection arc coloring (`insertSizeAndOrientation`, `insertSize`, `pairOrientation`)                                                                 |
| `pileup.maxLayoutHeight=4000`                     | Row cap for the pileup, in pixels. Raise it when the export shows the "Max height reached" notice                                                          |

A filter field takes no `key=value` write, since `filter` is one list: write the
list in a raw-JSON settings bag, as
`'{"filter":[{"field":"junction.reads","gte":3}]}'` for the minimum reads a
splice junction needs before its arc draws. The list merges with the display's
defaults by field.

Available `color:` fields, except `tags.<TAG>`, which is an
`encoding.color.field=` write. Anything else is a CSS color, painting every read
with it:

| Field                      | Description                                             |
| -------------------------- | ------------------------------------------------------- |
| `strand`                   | Forward/reverse strand                                  |
| `firstOfPairStrand`        | Strand of the first read in the pair                    |
| `mapq`                     | MAPQ                                                    |
| `insertSize`               | Paired-end insert size                                  |
| `pairOrientation`          | Paired-end orientation                                  |
| `insertSizeAndOrientation` | Combined insert size + orientation                      |
| `mateRefName`              | Reference the mate maps to                              |
| `mateAssembly`             | Assembly the mate maps to, for synteny reads            |
| `tags.<TAG>`               | Color by any BAM tag, as `encoding.color.field=tags.HP` |

Available `baseColor:` fields:

| Field           | Description                                           |
| --------------- | ----------------------------------------------------- |
| `modifications` | Base modifications via MM/ML tags                     |
| `methylation`   | CpG methylation via MM/ML tags                        |
| `bisulfite`     | Methylation from C→T conversion, no MM/ML tags needed |
| `baseQuality`   | Per-base quality                                      |
| `base`          | Per-base letters                                      |

**Feature tracks (GFF3/BED/BigBed) and VCF tracks**

Feature and VCF tracks share one display base, so every modifier below applies
to both. `facet=<field>` stacks the track into one labelled section per value:
`strand`, an attribute, or a dotted path such as `INFO.SVTYPE`.
`encoding.color.field=<attribute>` colors by one.

| Modifier                            | Example                 | Description                                                                                                                                                                                                       |
| ----------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color:value`                       | `color:magenta`         | Glyph fill: any CSS color, or `strand` to color by feature strand (tomato forward, cornflowerblue reverse)                                                                                                        |
| `featureHeight:preset`              | `featureHeight:compact` | Display mode (`normal`, `compact`, `super-compact`)                                                                                                                                                               |
| `heightMode:<fixed\|grow\|fit>[:N]` | `heightMode:fit:200`    | Track-height strategy: `fixed` scrolls to see all features, `grow` resizes the track to fit every feature, `fit` shrinks glyphs so every row fits without scrolling; an optional number sets the track height too |

**BigWig tracks**

A BigWig's score axis is the `scales.y` setting, which also applies to a
BAM/CRAM track's coverage band, where `scales.y.type=log` is the usual setting
for RNA-seq. `mark` names how the scores draw: `bar`, `point`, `line` or `span`.

| Write                                           | Description                              |
| ----------------------------------------------- | ---------------------------------------- |
| `scales.y.domainMin=0` `scales.y.domainMax=100` | Manual score range                       |
| `scales.y.type=log`                             | Scale type (`linear`, `log` or `symlog`) |
| `scales.y.grid=true`                            | Draw gridlines                           |
| `mark=point`                                    | `bar`, `point`, `line` or `span`         |
| `resolution=100`                                | BigWig resolution multiplier             |
| `color:purple`                                  | Fill color (any CSS color)               |

Two tracks read against each other need one axis, and an image has no menu to
open, so give both the same `scales.y.autoscaleGroup` and they share a domain:

```bash
jb2export --fasta ref.fa \
  --bigwig tumor.bw scales.y.autoscaleGroup=cov height:120 \
  --bigwig normal.bw scales.y.autoscaleGroup=cov height:120 \
  --loc chr17:7,660,000-7,690,000 --out pair.svg
```

### Any display setting (`slot.path=value`)

A modifier written `slot.path=value` sets that slot of the track's display, so
you can set any setting in the
[config docs](https://jbrowse.org/jb2/docs/config/) without a dedicated
modifier. Paths nest with dots, and a path into a setting, such as
`encoding.color.scale.domain`, changes that one member and keeps the rest of
what the track's config or a named modifier gave the setting, in whatever order
the modifiers come:

```bash
## a numeric tag on a color ramp
jb2export --fasta ref.fa --bam reads.bam encoding.color.field=tags.NM \
  encoding.color.scale.type=linear encoding.color.scale.range=white,darkred \
  --loc chr1:1-10000 --out out.svg

## haplotype in two declared colors, methylation over it, a log coverage axis
jb2export --fasta ref.fa --bam reads.bam encoding.color.field=tags.HP \
  encoding.color.scale.domain=1,2 encoding.color.scale.range=#d9c9a3,#b7c4b1 \
  baseColor:methylation scales.y.type=log \
  --loc chr1:1-10000 --out out.svg
```

- `true` and `false` are booleans and a number is a number
- a comma makes a list, and a trailing comma a list of one:
  `encoding.color.scale.range=tan,`
- a digit segment indexes a list, so `encoding.color.scale.range.0=tan` changes
  the first color of a range and `marks.1.encoding.color.value=red` the second
  mark of a declared plot, whereas `encoding.color.scale.range=tan,teal` sets
  the whole range. An index has to be one the list already reaches, so fill `0`
  before `1`. A list written from nothing reads better as one JSON modifier than
  as a path per member
- a `jexl:` item keeps the commas inside brackets and quotes, so
  `filter=jexl:get(feature,'score')>5,` is a list of one filter, and a location
  keeps the commas grouping its digits, so
  `clusterRegion=chr2:135,787,850-135,876,467` is one region
- a slot the display does not declare, or a key its object refuses, fails the
  export with the message the display reports

### Declaring what to draw (`display:marks`)

`display:marks` opens the track's
[mark display](https://jbrowse.org/jb2/docs/config/linearmarkdisplay/), which
draws the marks you declare instead of the glyphs its track type would: a list
of bars, points, spans, text or links, each naming which feature fields feed
which channel. It opens over a BAM, CRAM, VCF, GFF3, BED, BigBed, BigWig or
MultiWiggle track, which is everything but `--hic`, so the tracks differ in
which fields they provide. A read's `score` is its MAPQ; a variant has its
quality as `QUAL` and no `score` at all, so a mark over a VCF names the field it
wants; a BigWig past its raw section provides a zoom level's mean as `score`,
with `minScore` and `maxScore` beside it, and a raw record answers its score for
all three.

A whole plot is a list of objects, so state it as one JSON modifier, which has
the structure the track's config or a session spec holds. Here one BigWig draws
three marks in one plot: each bin's mean as bars, and its least and greatest
value as points.

```bash
jb2export --fasta ref.fa --bigwig conservation.bw display:marks height:300 \
  '{"marks":[{"mark":"bar","encoding":{"y":"score","color":{"value":"#9aa89a"}}},{"mark":"point","encoding":{"y":"minScore","color":{"value":"#3c7ea8"}}},{"mark":"point","encoding":{"y":"maxScore","color":{"value":"#c1553b"}}}]}' \
  --loc chr1:1-100000 --out out.svg
```

A mark has a `transform` list run before it draws, which nests the same way. A
binned count is two steps, and the aggregate's `ops` is a list inside the
second:

```bash
jb2export ref.fa genes.gff.gz display:marks height:160 \
  '{"marks":[{"mark":"bar","encoding":{"y":"count"},"transform":[{"type":"bin","step":100000},{"type":"aggregate","groupby":["start","end"],"ops":[{"op":"count"}]}]}]}' \
  --loc chr1:1-10,000,000 --out density.svg
```

**A path changes one mark of a list, where the JSON states the list whole.** A
track whose config already declares the plot takes
`marks.1.encoding.color.value=red` to repaint its second mark and leave the rest
alone, the way `encoding.color.scale.domain=` edits one member of a color
channel. `marks.2` before anything has written `marks.0` and `marks.1` is an
error, because a list cannot have holes.

A mark the display cannot draw as declared, such as a bar naming no `y` or a `y`
the data does not have, fails the export with the rule the display reports, and
jb2export writes no image of an empty plot.

### Raw display settings (JSON)

A modifier that starts with `{` is parsed as JSON. A JSON key sets its whole
setting, as a session spec does, so writing an `encoding` object here replaces
the one in the track's config. JSON is the readable way to write a list of
objects such as `marks`, and the only way to write a value a path cannot, such
as a color that contains commas. Use compact JSON (a single shell token, no
spaces):

```bash
jb2export --fasta ref.fa --bam reads.bam '{"encoding":{"color":{"scale":{"range":["rgb(217,201,163)"]}}}}' \
  encoding.color.field=tags.HP --loc chr1:1-10000 --out out.svg
```

## Comparative views

### Compare two assemblies (dotplot / synteny)

Two assemblies can be compared with the `dotplot` and `synteny` subcommands.
Each is a `--fasta` (or `--chromSizes`), with its region as a `loc:` modifier.
The alignment between them is a comparison track (`--paf`, `--delta`, `--chain`,
or `--blasttab`); the query side of that file is the first assembly and the
target side is the second.

The examples below use the public yeast comparison (S. cerevisiae R64 vs the
YJM1447 strain) and reproduce as-is with network access.

The dotplot below is whole-genome, with every query contig on x and every target
contig on y. `--view` writes settings on the view, by the names a session spec
gives them; `autoDiagonalize=true` reorders the target contigs so the main
alignment forms a clean diagonal:

<!-- jb2export: yeast_dotplot -->

```bash
jb2export dotplot \
  --fasta https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/yjm1447.fa \
  --fasta https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/r64.fa \
  --paf https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/r64_vs_yjm1447.paf \
  --view autoDiagonalize=true --width 1100 --out yeast_dotplot.png
```

![Whole-genome dotplot of two yeast assemblies (R64 vs the YJM1447 strain)](https://jbrowse.org/jb2-figures/jbrowse-img/yeast_dotplot.1de4ed23beac.png)

The linear synteny ribbon below joins one chromosome in each assembly (here
YJM1447 chr `I` vs R64 chr `I`, accession `NC_001133.9`).
`mark.interpolate=bump` draws the ribbon as a curve instead of straight
trapezoids:

<!-- jb2export: yeast_synteny -->

```bash
jb2export synteny \
  --fasta https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/yjm1447.fa loc:I \
  --fasta https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/r64.fa loc:NC_001133.9 \
  --paf https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/r64_vs_yjm1447.paf \
  --view mark.interpolate=bump --width 1400 --out yeast_synteny.png
```

![Linear synteny ribbon between YJM1447 chr I and R64 chr I](https://jbrowse.org/jb2-figures/jbrowse-img/yeast_synteny.399685cf2fcd.png)

An assembly without `loc:` shows whole on its axis. `--view` takes any setting
the view's session spec does; the table below lists the ones for busy
comparisons.

### Multi-way synteny (three or more assemblies)

Stack any number of assemblies straight from the command line, with no config or
spec JSON: repeat the assembly flag for each one and place each alignment file
between the two assemblies it compares. Assemblies stack top-to-bottom in the
order written, and each synteny file becomes the ribbon for the gap it sits in.

Use `--chromSizes` instead of `--fasta` for a whole-genome comparison: it builds
the assembly from a `chrom.sizes` file (two tab-separated columns,
`name<TAB>length`), skipping the multi-GB sequence a genome-wide dotplot never
draws.

The flags alternate, and the position of each flag determines its role:

```text
--chromSizes a.chrom.sizes    assembly 1, the top row
--paf        a_vs_b.paf       the ribbon between rows 1 and 2
--chromSizes b.chrom.sizes    assembly 2
--paf        b_vs_c.paf       the ribbon between rows 2 and 3
--chromSizes c.chrom.sizes    assembly 3, the bottom row
```

As a command:

```bash
jb2export synteny \
  --chromSizes a.chrom.sizes \
  --paf a_vs_b.paf \
  --chromSizes b.chrom.sizes \
  --paf b_vs_c.paf \
  --chromSizes c.chrom.sizes \
  --out synteny.svg
```

Per-assembly options attach to the assembly flag as `key:value` modifiers, e.g.
`--fasta a.fa loc:chr1 aliases:a.aliases.txt`. The settings for busy comparisons
go on `--view`:

| `--view` setting                             | Effect                                                          |
| -------------------------------------------- | --------------------------------------------------------------- |
| `autoDiagonalize=true`                       | Reorders each lower assembly's chromosomes for least overlap    |
| `filter.0.field=length filter.0.gte=500000`  | Hides alignments shorter than 500 kb, the main declutter option |
| `encoding.color.field=query`                 | Tints each ribbon by its query chromosome                       |
| `encoding.opacity=0.4`                       | Ribbon opacity (0–1); lower values reveal overlap density       |
| `mark.interpolate=bump`                      | Curved ribbons instead of straight trapezoids                   |
| `levelHeights=300` or `levelHeights=300,200` | Pixel height of every level, or of each level in turn           |
| `cigarMode=matches`                          | CIGAR indels drawn see-through; `off` draws one solid block     |

> **Query vs. target orientation.** PAF/BLAST list the query first, so the
> assembly written _above_ the alignment is the query. A chain/delta liftover
> maps target→query (a UCSC `targetToQuery.over.chain`), so there the assembly
> above is the _target_. `jb2export` handles this per format, so write the
> assemblies in stacked order.

Alternatively, drive the view from a session-spec JSON with `--spec` (assemblies
and comparison tracks supplied via `--config`). The spec has the same format as
the JBrowse Web URL `&session=spec-` parameter, so JSON copied out of a browser
URL works directly. See
[URL query parameter API](https://jbrowse.org/jb2/docs/urlparams/#linear-synteny-view-multi-way)
for the full format. A flat `tracks` list puts each track on every gap between
adjacent `views` that its `assemblyNames` cover; one sub-array per gap names
each gap's tracks instead. The subcommand is optional since the render mode
comes from the spec's view `type`.

```bash
jb2export --config jbrowse.json --spec spec.json --out synteny.svg
```

Without a `--spec`, `synteny --config` stacks the config's assemblies in the
order they are listed and places each SyntenyTrack by its `assemblyNames`: a
pairwise track goes in the one gap between the two genomes it names, and a track
listing three or more (a `MultiGenomePAFAdapter` or `MCScanBlocksAdapter` file
covering N genomes, as built in the
[all-vs-all](https://jbrowse.org/jb2/docs/tutorials/allvsall_synteny/) and
[multiway](https://jbrowse.org/jb2/docs/tutorials/multiway_synteny_grape_peach_cacao/)
synteny tutorials) backs every band whose pair it covers. A track covering no
adjacent pair, such as an A-vs-C alignment in an A/B/C stack, is reported and
skipped.

A whole-genome example (peach vs grape, the chrom.sizes come from this repo and
the alignment PAF from S3):

<!-- jb2export: grape_peach_synteny -->

```bash
jb2export synteny --chromSizes data/comparative/peach.chrom.sizes \
  --paf https://s3.amazonaws.com/jbrowse.org/genomes/synteny/peach_grape.paf.gz \
  --chromSizes data/comparative/grape.chrom.sizes \
  --view autoDiagonalize=true encoding.color.field=query encoding.opacity=0.4 levelHeights=350 mark.interpolate=bump \
  --width 1400 --out grape_peach_synteny.png
```

![Whole-genome synteny, grape vs peach, diagonalized and colored by query chromosome](https://jbrowse.org/jb2-figures/jbrowse-img/grape_peach_synteny.3b1a352d4f0b.png)

The mammalian-scale example is a human (hs1/T2T) vs mouse (mm39) liftOver, where
a `filter` hiding alignments under 500 kb keeps the plot readable. With
`--chromSizes`, the command downloads no multi-GB sequence (whole-genome synteny
draws none); the chrom.sizes are committed and the liftOver chain streams from
the web, so the example reproduces with only the public chain:

<!-- jb2export: hs1_mm39_synteny -->

```bash
jb2export synteny --chromSizes data/comparative/hs1.chrom.sizes \
  --chain https://jbrowse.org/demos/hs1ToMm39/hs1ToMm39.over.chain.gz \
  --chromSizes data/comparative/mm39.chrom.sizes \
  --view filter.0.field=length filter.0.gte=500000 autoDiagonalize=true encoding.color.field=query encoding.opacity=0.4 levelHeights=350 mark.interpolate=bump cigarMode=matches \
  --width 1400 --out hs1_mm39_synteny.png
```

![Mammalian-scale synteny, human (hs1) vs mouse (mm39)](https://jbrowse.org/jb2-figures/jbrowse-img/hs1_mm39_synteny.2dfa94dae59c.png)

The three-level stack of hg38, hs1 (T2T) and mm39 has one ribbon per adjacent
pair, with the conserved hg38↔hs1 build liftover on top (near-vertical bands)
and the diverged hs1↔mm39 human–mouse synteny below. Each UCSC liftOver `.chain`
goes between the two assemblies it relates (`hg38ToHs1` between hg38 and hs1,
`hs1ToMm39` between hs1 and mm39):

<!-- jb2export: hg38_hs1_mm39_synteny -->

```bash
jb2export synteny --chromSizes data/comparative/hg38.chrom.sizes \
  --chain data/comparative/hg38ToHs1.over.chain.gz \
  --chromSizes data/comparative/hs1.chrom.sizes \
  --chain https://jbrowse.org/demos/hs1ToMm39/hs1ToMm39.over.chain.gz \
  --chromSizes data/comparative/mm39.chrom.sizes \
  --view filter.0.field=length filter.0.gte=500000 autoDiagonalize=true encoding.color.field=query encoding.opacity=0.4 levelHeights=300 mark.interpolate=bump cigarMode=matches \
  --width 1400 --out hg38_hs1_mm39_synteny.png
```

![Three-level synteny stack: hg38, hs1, and mm39](https://jbrowse.org/jb2-figures/jbrowse-img/hg38_hs1_mm39_synteny.229bf6f58287.png)

### Hosted genomes

A `--genome` is a row too, so genomes from
[genomes.jbrowse.org](https://genomes.jbrowse.org) stack with no files. Each
hosted config lists the liftOver comparisons between its genome and others, and
`jb2export` draws one for each pair of adjacent rows:

<!-- jb2export: hosted_synteny -->

```bash
jb2export synteny --genome hg38 loc:chr7:27000000-27300000 \
  --genome mm39 loc:chr6:52000000-52300000 --view mark.interpolate=bump \
  --width 1400 --out hosted_synteny.png
```

![Synteny between the HOXA cluster in hg38 and mm39, from the hosted liftOver track](https://jbrowse.org/jb2-figures/jbrowse-img/hosted_synteny.bc64e5ee3cf5.png)

- A `--genome` row takes `loc:`; its hosted config supplies the rest.
- Genome files and `--genome` rows mix in one stack. A comparison file between
  two rows replaces the hosted comparison, and a pair no hosted config covers
  needs one.

### All-vs-all alignments (PGGB, minimap2 -X)

The stacks above take one alignment file per gap. An all-vs-all PAF holds every
pair (every genome aligned against every other, from
[PGGB](https://github.com/pangenome/pggb) or from `minimap2 -X` over
[PanSN](https://github.com/pangenome/PanSN-spec)-named contigs), so it is **one
track that backs every band**: the tool reads the file once, and the adapter
returns the alignments for each band's pair of assemblies.

An all-vs-all PAF therefore needs `--config`. `--paf` builds a pairwise
`PAFAdapter`, which reads the whole file as a single query-vs-target comparison,
so repeating the same all-vs-all file across the gaps fails every band past the
first with `AssemblyNotInAdapterError`, because that adapter ignores the PanSN
prefixes that say which genome each record belongs to. `MultiGenomePAFAdapter`
(or `MultiGenomeIndexedPAFAdapter` for a `make-pif` index) reads the prefixes,
and a config names it:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_ava",
  "name": "E. coli pangenome (all-vs-all PAF)",
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"],
  "adapter": {
    "type": "MultiGenomePAFAdapter",
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

Where a config holds more than one such track, the `--spec` file names the one
the stack uses. The hosted demo below is such a config. It has the five strains
aligned four ways (minimap2, pggb/wfmash, cactus, and untangle), and its spec
names one of them:

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
  "tracks": ["ecoli_ava"],
  "filter": [{ "field": "length", "gte": 10000 }],
  "levelHeights": [130, 130, 130, 130]
}
```

Five rows means four bands, so `tracks` has four entries and every one of them
is the same trackId. The `length` predicate in `filter` drops minimap2's short
alignments, which otherwise bury the shared backbone under a noise band.

<!-- jb2export: ecoli_ava_synteny -->

```bash
jb2export --config https://jbrowse.org/demos/ecoli_pangenome/config.json \
  --spec data/comparative/ecoli_ava.spec.json --width 1400 \
  --out ecoli_ava_synteny.png
```

![Five E. coli strains stacked from one all-vs-all PAF, every band served by the same track](https://jbrowse.org/jb2-figures/jbrowse-img/ecoli_ava_synteny.0ec07804fcb4.png)

The unbroken ribbons are the backbone shared by all five strains and the gaps
are where they differ; the crossings in the bottom band are IAI39's inversions
against the others.

All the example images in this README (including the comparative ones above) are
regenerated by `pnpm screenshots --filter jbrowse-img` from the repo root. See
the `CliSpec` entries in
[`website/scripts/screenshot-specs.ts`](https://github.com/GMOD/jbrowse-components/blob/main/website/scripts/screenshot-specs.ts).

### Circular view (chord plot)

The `circular` subcommand renders one assembly's chord tracks (e.g. a VCF of
structural variants) as a circular ideogram with chords drawn between the two
breakends of each rearrangement. It is single-assembly and shows the whole
genome (no `--loc`); the tool picks each track's chord display automatically.

The command draws the tracks that the track flags and `--track` name. Name
tracks when you use a `--genome` or a large `--config`, because their hundreds
of tracks would otherwise all be opened, as happens in a run that names none.

Display modifiers do not apply to the circular view, and a run that passes one
reports that. The modifiers name slots on the linear displays, and the circular
view draws a variant track as chords. Settings for a circular view go in the
config the track comes from, or in a `--spec`.

```bash
jb2export circular ref.fa sv.vcf.gz --out circular.svg
```

The example below uses SKBR3 (a breast-cancer cell line) long-read Sniffles SV
calls on hg19, and each inter-chromosomal chord is a translocation. `--fasta`
reads only the `.fai` for chromosome names and lengths (the circular view
fetches no sequence):

<!-- jb2export: circular_chords -->

```bash
jb2export circular https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz https://jbrowse.org/genomes/hg19/SKBR3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.filtered.vcf.gz \
  --width 800 --out circular_chords.png
```

![SKBR3 structural variants on hg19 as a circular view, each chord joining one variant's two breakpoints](https://jbrowse.org/jb2-figures/jbrowse-img/circular_chords.272733cacbdb.png)

Run `jb2export circular --help` for the full list of options.

Two genomes on one circle come from a config and a session spec, the way the
comparative views do. The example uses the
[circular synteny tutorial](https://jbrowse.org/jb2/docs/tutorials/circular_synteny/)'s
hosted config, which draws human and mouse liftOver blocks as ribbons inside a
ring of genes per 100 kb for both genomes. The spec names the pair of assemblies
and opens the ring with its density rendering:

<!-- jb2export: circular_synteny -->

```bash
jb2export --config https://jbrowse.org/demos/circular_synteny/config.json \
  --spec data/comparative/hg38_mm39_circular.spec.json --width 800 \
  --out circular_synteny.png
```

![Human chromosomes 1, 2 and X against their mouse counterparts on one circle, liftOver ribbons inside a gene density ring for both genomes](https://jbrowse.org/jb2-figures/jbrowse-img/circular_synteny.f253c8c722c7.png)

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

![Structural-variant calls over 50 kb of volvox ctgA, read from a config whose VCF is a localPath](https://jbrowse.org/jb2-figures/jbrowse-img/volvox_config.08670447ebfc.png)

localPaths resolve relative to the config file supplied, so with
`--config data/volvox/config.json` and `"localPath": "volvox.dup.vcf.gz"` this
example resolves data/volvox/volvox.dup.vcf.gz

See data/volvox/config.json for a config that contains localPaths, or
data/config.json for a config that just contains URLs

When a mark display (`LinearMarkDisplay`) loads a `marks` list whose slots
disagree with each other, the app lists what it cannot draw in the track's
corner chip. jb2export prints each of those problems to stderr, and exits
without writing an image on a problem the display's rule list classes as an
error, such as a bar naming no `y`. `jbrowse validate` checks a config file
against the same rules.

### Use a session file exported from jbrowse

In jbrowse-web, File->Export session produces a session.json file for the
--session parameter. Specify the assembly as well, it currently does not infer
the assembly from the session

<!-- jb2export: skbr3_session -->

```bash
jb2export --config data/config.json --session data/skbr3/session.json \
  --assembly hg19 --width 1400 --out skbr3_session.png
```

![SKBR3 whole-genome read coverage, restored from a saved session file](https://jbrowse.org/jb2-figures/jbrowse-img/skbr3_session.5c90436cd64a.png)

The session names its tracks by trackId, so the `--config` you pass has to be
the one those ids come from. Here that is `data/config.json`, which defines hg19
and the `ngmlr_cov` coverage track that `data/skbr3/session.json` opens.

`data/skbr3/session.json` shows the short way to write a session by hand. A view
sets the locus and the tracks to open with settings written directly on it, and
each track entry holds its display settings inline:

```json
{
  "session": {
    "name": "SKBR3 whole-genome coverage",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "hg19",
        "tracks": [
          {
            "trackId": "ngmlr_cov",
            "height": 275,
            "mark": "point"
          }
        ]
      }
    ]
  }
}
```

Omitting `loc` shows the whole genome. The inline track keys use the vocabulary
of the track's config, so a session can set anything the track menu can.

### Track order on the command line

Example:

```bash
jb2export --bam file1.bam --bigwig file.bw --bam file2.bam
```

jb2export keeps the order of the tracks and lists file1.bam, file.bw, and
file2.bam in that order, which is why the command line parser is a custom one

## Overriding render defaults

### Force render a large region

Some jbrowse track types (alignments, gene tracks, etc) will not display if
zoomed too far out. Add force:true to make it render

```bash
jb2export --bam file.bam force:true --loc 1:1,100,000-1,200,000 --fasta hg19.fa
```

### Render only the SNPCoverage track of an alignments track

`pileup.show=false` reduces the alignments display to coverage only; size the
coverage band with `coverage.height=N` to match `height:N`, the overall track
height. Reproducible with the bundled volvox alignments:

<!-- jb2export: snpcov -->

```bash
jb2export --fasta data/volvox/volvox.fa \
  --bam data/volvox/volvox-sorted.bam pileup.show=false coverage.height=200 height:200 \
  --loc ctgA:1-20000 --width 1200 --out snpcov.png
```

![The bundled volvox alignments as a coverage histogram alone, with the read pileup hidden](https://jbrowse.org/jb2-figures/jbrowse-img/snpcov.f03f3ef39afc.png)

## Parameters

Flags take their value as the next argument (`--width 1200`) or inline with an
equals sign (`--width=1200`).

### Assembly params

- a genome file — path or URL to an indexed FASTA (`.fa`, `.fa.gz`), a `.2bit`
  or a `.chrom.sizes`, typed by its name. `--fasta <file>` opens a file with any
  other name as an indexed FASTA. Two modifiers may follow it:
  - `aliases:<file>` — tab-separated refname aliases; column 1 matches the
    FASTA, other columns are aliases (e.g. maps `1` → `chr1`)
  - `cytobands:<file>` — a cytoband BED file for the assembly
- `--genome` — a genomes.jbrowse.org assembly to pull the whole config from: a
  UCSC db name (`hg19`, `mm10`) or GenArk accession (`GCA_...`/`GCF_...`);
  supplies sequence, cytobands, and refName aliasing (see
  [Hosted assemblies](#hosted-assemblies-genomesjbrowseorg))

### Track params

A data file (local path or URL) opens as a track of the type its name says, e.g.
`file1.bam file2.bam`. A flag names the format of a file whose name does not:

- `--bam`, `--cram`, `--bigwig`, `--bigbed`, `--hic`, `--vcf`, `--gff`, `--bed`:
  - `--gff` also opens a GTF file, and `--bed` a bedGraph or BEDPE file, typed
    by its name; a file named for another flag's format is an error
  - `--vcf`, `--gff` and `--bed` open a `.gz` name, or a file given `index:`,
    through the bgzipped, tabix-indexed adapter
- `--multiwig` — many BigWigs as one multi-row `MultiQuantitativeTrack`; the
  argument is a comma-separated BigWig file list (local paths or URLs) or a
  `.json` sources file (an array of BigWig paths/URLs, or of subadapter objects
  with per-row `name`/`color`/`group`); see
  [MultiWiggle](#multiwiggle-many-bigwigs-in-one-track)

### Config file params (optional)

- `--assembly` — the name of an assembly in `--config` or `--genome` to open
- `--tracks` — path to a JSON file containing an array of JBrowse 2 track
  configs (e.g. [data/tracks.json](data/tracks.json))
- `--session` — path to a JBrowse 2 session JSON exported from File → Export
  session
- `--config` — path or URL to a full JBrowse 2 config.json (e.g.
  [data/config.json](data/config.json))
- `--track` — show a trackId already in the config (from `--genome`/`--config`),
  e.g. `--track hg19-ncbiRefSeqCurated`; repeatable, and accepts the same
  display modifiers as the track-type flags
- `--defaultSession` — use the `defaultSession` embedded in `--config`

### Output params

- `--loc` — location string to render, e.g. `chr1:1-10000` or `all`; also a gene
  name when the config has a text-search index (e.g. from `--genome`)
- `--out` — output file path; `.svg`, `.png`, or `.pdf`
- `--width` — view width in pixels (default: 1500)
- `--noRasterize` — render everything as SVG vectors instead of rasterizing
  canvas layers (pileup, coverage, hic); results in larger files

### Appearance params

- `--themeName` — theme to use for rendering: `default`, `lightStock`,
  `lightMinimal`, `darkStock`, or `darkMinimal`
- `--showGridlines` — draw genomic coordinate gridlines
- `--trackLabels` — label position: `offset`, `overlapping`, `left`, or `hidden`

## Full command-line help

Run `jb2export --help` for the full option list, or
`jb2export <subcommand> --help` (e.g. `jb2export dotplot --help`) for a
subcommand's options. The complete output:

<!-- INJECT_HELP START: auto-filled from buildFullHelp() by website/scripts/generate-img-doc.ts; run `pnpm autogen img` to refresh -->

```text
Usage: jb2export [options]
       jb2export <dotplot|synteny|circular|breakpoint> [options]
       jb2export batch --sites <file> [options]
       jb2export list [genome] [filter]

Options:
  --fasta           Genome FASTA or 2bit, for a name the file does not say; takes aliases: and cytobands: modifiers naming those files
  --chromSizes      Path to a chrom.sizes file (whole-genome assembly, no sequence). Repeat for each assembly in a comparative view
  --assembly        Which of the config's assemblies to open, by name
  --genome          Pull a whole config from genomes.jbrowse.org: a UCSC db name (hg19, mm10) or GenArk accession (GCA_/GCF_...). Gives cytobands, refName aliasing, and hosted trackIds (see --track)
  --track           Show a trackId already in the config (from --genome/--config), e.g. --track hg19-ncbiRefSeqCurated (the hg19- prefix is optional). Repeatable; accepts the same display modifiers as track flags (height:, color:, ...)
  --config          Path to JBrowse config.json (path, URL, or "-" for stdin)
  --session         Path to session JSON (or "-" for stdin)
  --loc             Location to render (e.g., chr1:1-1000 or "all"), or a gene name when the config has a text-search index (e.g. from --genome). Several regions draw side by side
  --view            Settings written on the view, by the names a session spec gives them: path=value or a JSON object, e.g. --view mark.interpolate=bump encoding.opacity=0.3 for a synteny view
  --out             Output file path (SVG, PNG, or PDF by extension). Omit it to write the SVG to stdout, which pipes into rsvg-convert for other formats
  --width           Width of output in pixels [default: 1500]
  --noRasterize     Disable rasterization of pileup/coverage [default: false]
  --defaultSession  Use default session from config [default: false]
  --tracks          Path to JSON file with an array of track configs (or "-" for stdin); added to the config's tracks, replacing any with the same trackId
  --themeName       Palette for rendering: default, stock, or minimal
  --themeMode       Draw that palette light or dark
  --fontFamily      Font family for all text (serif, sans-serif, monospace, or a named family) [default: serif]
  --showGridlines   Show genomic coordinate gridlines in the output [default: false]
  --trackLabels     Track label position: offset, overlapping, left, or hidden
  --refseq          Show the reference sequence track [default: false]
  --spec            Session-spec JSON (inline, path to .json, or "-" for stdin) describing the view; see urlparams.md. Drives N-way comparative views from a --config
  --help            Show help
  --version         Print version

Examples:
  jb2export ref.fa reads.bam --loc chr1:1-10000 --out out.svg
      Render BAM alignments to SVG; each file is typed by its name
  jb2export ref.fa --vcf variants.txt.gz --loc chr1:1-50000 --out out.png
      Name a file's format with a flag when its name does not say it
  jb2export ref.fa reads.bam height:80 color:strand --loc chr1:1-10000 --out out.svg
      Custom track height and strand coloring
  jb2export --genome hg19 --track hg19-ncbiRefSeqCurated --loc chr1:1-100000 --out out.svg
      Pull the hg19 config from genomes.jbrowse.org and show a hosted track
  jb2export --config jbrowse.json --assembly hg38 --tracks tracks.json --loc chr1:1-100000 --out out.svg
      Render from config with a JSON tracks file
  jb2export ref.fa.gz cytobands:cytobands.bed signal.bw --loc chr1 --out out.svg
      Render BigWig with cytobands

Track options: --bam, --cram, --bigwig, --bigbed, --hic, --vcf, --gff, --bed, --multiwig

Comparative subcommands (run "jb2export dotplot --help"): dotplot, synteny, circular, breakpoint

Whole callsets: "jb2export batch --sites calls.vcf.gz" writes one image per record (run "jb2export batch --help")

Discovery: "jb2export list" lists genomes.jbrowse.org assemblies; "jb2export list <genome> [filter]" lists a genome's tracks

Usage: jb2export dotplot [options]

Options:
  --fasta           Genome FASTA or 2bit, for a name the file does not say; takes aliases: and cytobands: modifiers naming those files
  --chromSizes      Path to a chrom.sizes file (whole-genome assembly, no sequence). Repeat for each assembly in a comparative view
  --assembly        Which of the config's assemblies to open, by name
  --genome          Pull a whole config from genomes.jbrowse.org: a UCSC db name (hg19, mm10) or GenArk accession (GCA_/GCF_...). Gives cytobands, refName aliasing, and hosted trackIds (see --track)
  --track           Show a trackId already in the config (from --genome/--config), e.g. --track hg19-ncbiRefSeqCurated (the hg19- prefix is optional). Repeatable; accepts the same display modifiers as track flags (height:, color:, ...)
  --config          Path to JBrowse config.json (path, URL, or "-" for stdin)
  --session         Path to session JSON (or "-" for stdin)
  --loc             Location to render (e.g., chr1:1-1000 or "all"), or a gene name when the config has a text-search index (e.g. from --genome). Several regions draw side by side
  --view            Settings written on the view, by the names a session spec gives them: path=value or a JSON object, e.g. --view mark.interpolate=bump encoding.opacity=0.3 for a synteny view
  --out             Output file path (SVG, PNG, or PDF by extension). Omit it to write the SVG to stdout, which pipes into rsvg-convert for other formats
  --width           Width of output in pixels [default: 1500]
  --noRasterize     Disable rasterization of pileup/coverage [default: false]
  --defaultSession  Use default session from config [default: false]
  --tracks          Path to JSON file with an array of track configs (or "-" for stdin); added to the config's tracks, replacing any with the same trackId
  --themeName       Palette for rendering: default, stock, or minimal
  --themeMode       Draw that palette light or dark
  --fontFamily      Font family for all text (serif, sans-serif, monospace, or a named family) [default: serif]
  --showGridlines   Show genomic coordinate gridlines in the output [default: false]
  --trackLabels     Track label position: offset, overlapping, left, or hidden
  --refseq          Show the reference sequence track [default: false]
  --spec            Session-spec JSON (inline, path to .json, or "-" for stdin) describing the view; see urlparams.md. Drives N-way comparative views from a --config

Examples:
  jb2export dotplot --fasta a.fa --fasta b.fa --paf a_vs_b.paf --out out.svg
      Whole-genome dotplot of two assemblies via a PAF
  jb2export synteny --fasta a.fa loc:chr1 --paf a_vs_b.paf --fasta b.fa loc:chr1 --out out.svg
      Linear synteny of a region in each assembly (loc: rides on the assembly flag)
  jb2export synteny --chromSizes a.sizes --paf a_b.paf --chromSizes b.sizes --chain b_c.chain --chromSizes c.sizes --out out.svg
      Multi-way (3+) synteny: repeat the assembly flag, put each alignment between the pair it compares
  jb2export synteny --fasta a.fa --paf a_b.paf --fasta b.fa --view mark.interpolate=bump encoding.color.field=query filter.0.field=length filter.0.gte=10000 --out out.svg
      Curved ribbons colored by query chromosome, alignments under 10 kb hidden
  jb2export synteny --config jbrowse.json --spec spec.json --out out.svg
      N-way synteny from a config + session-spec JSON (see urlparams.md)

Comparison track options: --paf, --blasttab, --chain, --delta

Usage: jb2export synteny [options]

Options:
  --fasta           Genome FASTA or 2bit, for a name the file does not say; takes aliases: and cytobands: modifiers naming those files
  --chromSizes      Path to a chrom.sizes file (whole-genome assembly, no sequence). Repeat for each assembly in a comparative view
  --assembly        Which of the config's assemblies to open, by name
  --genome          Pull a whole config from genomes.jbrowse.org: a UCSC db name (hg19, mm10) or GenArk accession (GCA_/GCF_...). Gives cytobands, refName aliasing, and hosted trackIds (see --track)
  --track           Show a trackId already in the config (from --genome/--config), e.g. --track hg19-ncbiRefSeqCurated (the hg19- prefix is optional). Repeatable; accepts the same display modifiers as track flags (height:, color:, ...)
  --config          Path to JBrowse config.json (path, URL, or "-" for stdin)
  --session         Path to session JSON (or "-" for stdin)
  --loc             Location to render (e.g., chr1:1-1000 or "all"), or a gene name when the config has a text-search index (e.g. from --genome). Several regions draw side by side
  --view            Settings written on the view, by the names a session spec gives them: path=value or a JSON object, e.g. --view mark.interpolate=bump encoding.opacity=0.3 for a synteny view
  --out             Output file path (SVG, PNG, or PDF by extension). Omit it to write the SVG to stdout, which pipes into rsvg-convert for other formats
  --width           Width of output in pixels [default: 1500]
  --noRasterize     Disable rasterization of pileup/coverage [default: false]
  --defaultSession  Use default session from config [default: false]
  --tracks          Path to JSON file with an array of track configs (or "-" for stdin); added to the config's tracks, replacing any with the same trackId
  --themeName       Palette for rendering: default, stock, or minimal
  --themeMode       Draw that palette light or dark
  --fontFamily      Font family for all text (serif, sans-serif, monospace, or a named family) [default: serif]
  --showGridlines   Show genomic coordinate gridlines in the output [default: false]
  --trackLabels     Track label position: offset, overlapping, left, or hidden
  --refseq          Show the reference sequence track [default: false]
  --spec            Session-spec JSON (inline, path to .json, or "-" for stdin) describing the view; see urlparams.md. Drives N-way comparative views from a --config

Examples:
  jb2export dotplot --fasta a.fa --fasta b.fa --paf a_vs_b.paf --out out.svg
      Whole-genome dotplot of two assemblies via a PAF
  jb2export synteny --fasta a.fa loc:chr1 --paf a_vs_b.paf --fasta b.fa loc:chr1 --out out.svg
      Linear synteny of a region in each assembly (loc: rides on the assembly flag)
  jb2export synteny --chromSizes a.sizes --paf a_b.paf --chromSizes b.sizes --chain b_c.chain --chromSizes c.sizes --out out.svg
      Multi-way (3+) synteny: repeat the assembly flag, put each alignment between the pair it compares
  jb2export synteny --fasta a.fa --paf a_b.paf --fasta b.fa --view mark.interpolate=bump encoding.color.field=query filter.0.field=length filter.0.gte=10000 --out out.svg
      Curved ribbons colored by query chromosome, alignments under 10 kb hidden
  jb2export synteny --config jbrowse.json --spec spec.json --out out.svg
      N-way synteny from a config + session-spec JSON (see urlparams.md)

Comparison track options: --paf, --blasttab, --chain, --delta

Usage: jb2export circular [options]

Options:
  --fasta           Genome FASTA or 2bit, for a name the file does not say; takes aliases: and cytobands: modifiers naming those files
  --chromSizes      Path to a chrom.sizes file (whole-genome assembly, no sequence). Repeat for each assembly in a comparative view
  --assembly        Which of the config's assemblies to open, by name
  --genome          Pull a whole config from genomes.jbrowse.org: a UCSC db name (hg19, mm10) or GenArk accession (GCA_/GCF_...). Gives cytobands, refName aliasing, and hosted trackIds (see --track)
  --track           Show a trackId already in the config (from --genome/--config), e.g. --track hg19-ncbiRefSeqCurated (the hg19- prefix is optional). Repeatable; accepts the same display modifiers as track flags (height:, color:, ...)
  --config          Path to JBrowse config.json (path, URL, or "-" for stdin)
  --session         Path to session JSON (or "-" for stdin)
  --loc             Location to render (e.g., chr1:1-1000 or "all"), or a gene name when the config has a text-search index (e.g. from --genome). Several regions draw side by side
  --view            Settings written on the view, by the names a session spec gives them: path=value or a JSON object, e.g. --view mark.interpolate=bump encoding.opacity=0.3 for a synteny view
  --out             Output file path (SVG, PNG, or PDF by extension). Omit it to write the SVG to stdout, which pipes into rsvg-convert for other formats
  --width           Width of output in pixels [default: 1500]
  --noRasterize     Disable rasterization of pileup/coverage [default: false]
  --defaultSession  Use default session from config [default: false]
  --tracks          Path to JSON file with an array of track configs (or "-" for stdin); added to the config's tracks, replacing any with the same trackId
  --themeName       Palette for rendering: default, stock, or minimal
  --themeMode       Draw that palette light or dark
  --fontFamily      Font family for all text (serif, sans-serif, monospace, or a named family) [default: serif]
  --showGridlines   Show genomic coordinate gridlines in the output [default: false]
  --trackLabels     Track label position: offset, overlapping, left, or hidden
  --refseq          Show the reference sequence track [default: false]
  --spec            Session-spec JSON (inline, path to .json, or "-" for stdin) describing the view; see urlparams.md. Drives N-way comparative views from a --config

Examples:
  jb2export circular ref.fa sv.vcf.gz --out out.svg
      Circular (chord) view of structural variants

Usage: jb2export breakpoint [options]

Options:
  --fasta           Genome FASTA or 2bit, for a name the file does not say; takes aliases: and cytobands: modifiers naming those files
  --chromSizes      Path to a chrom.sizes file (whole-genome assembly, no sequence). Repeat for each assembly in a comparative view
  --assembly        Which of the config's assemblies to open, by name
  --genome          Pull a whole config from genomes.jbrowse.org: a UCSC db name (hg19, mm10) or GenArk accession (GCA_/GCF_...). Gives cytobands, refName aliasing, and hosted trackIds (see --track)
  --track           Show a trackId already in the config (from --genome/--config), e.g. --track hg19-ncbiRefSeqCurated (the hg19- prefix is optional). Repeatable; accepts the same display modifiers as track flags (height:, color:, ...)
  --config          Path to JBrowse config.json (path, URL, or "-" for stdin)
  --session         Path to session JSON (or "-" for stdin)
  --loc             Location to render (e.g., chr1:1-1000 or "all"), or a gene name when the config has a text-search index (e.g. from --genome). Several regions draw side by side
  --view            Settings written on the view, by the names a session spec gives them: path=value or a JSON object, e.g. --view mark.interpolate=bump encoding.opacity=0.3 for a synteny view
  --out             Output file path (SVG, PNG, or PDF by extension). Omit it to write the SVG to stdout, which pipes into rsvg-convert for other formats
  --width           Width of output in pixels [default: 1500]
  --noRasterize     Disable rasterization of pileup/coverage [default: false]
  --defaultSession  Use default session from config [default: false]
  --tracks          Path to JSON file with an array of track configs (or "-" for stdin); added to the config's tracks, replacing any with the same trackId
  --themeName       Palette for rendering: default, stock, or minimal
  --themeMode       Draw that palette light or dark
  --fontFamily      Font family for all text (serif, sans-serif, monospace, or a named family) [default: serif]
  --showGridlines   Show genomic coordinate gridlines in the output [default: false]
  --trackLabels     Track label position: offset, overlapping, left, or hidden
  --refseq          Show the reference sequence track [default: false]
  --spec            Session-spec JSON (inline, path to .json, or "-" for stdin) describing the view; see urlparams.md. Drives N-way comparative views from a --config

Examples:
  jb2export breakpoint --fasta ref.fa --bam tumor.bam --loc chr1:1,000,000-1,001,000 --loc chr5:2,000,000-2,001,000 --out sv.png
      Both sides of one breakend, with the reads that cross it drawn between
  jb2export breakpoint --genome hg38 --bam tumor.bam --loc chr3:25,358,000-25,361,000 --loc chr10:58,716,500-58,718,500 --loc chr12:72,272,000-72,275,000 --out chain.png
      A multi-hop chain: one panel per locus, in the order the reads cross them
  jb2export breakpoint --fasta ref.fa --bam tumor.bam --loc "chr9:28,030,000-28,032,000 chr9:28,058,000-28,060,000" --loc chr9:28,059,000-28,061,000 --out fb.png
      Quote one --loc to put several windows in a single panel

Usage: jb2export batch --sites <file> [options]

Renders one image per record, a contig a row. Loci on one contig are a
linear view, their windows side by side: the two ends of a deletion, a
duplication or an inversion, or one window where --flank reaches from one
end to the other. Loci on several contigs are a breakpoint split view of
one panel a contig. A row holds four windows at most, and a contig of
more wraps.

The reads joining an image's windows are drawn between them, as arcs in
a linear view and as curves in a breakpoint view, and the manifest counts
them. Each alignments track lays out its SV evidence first: split reads,
then reads with an insertion or deletion of 50 bases or more, then
discordant pairs, unless the track sets arcs: or sort= itself.

Where a record on one contig spells out its alleles, or is a symbolic
<DEL> or <INS>, the manifest also counts the reads with the ALT at its
variant: an SNV at its base, a deletion at its first deleted base, an
insertion at the base after it, and an insertion of 50 bases or more
wherever in the window the aligner placed it. A deletion of 50 bases or
more is a gap of half its length or more. In an image of one window
every alignments track that sets no sort: is sorted there and a
band marks the bases the record changes. Such a track also grows to hold
its pileup, up to 250 px, so rows are the same height on every image and
a deep pileup stops there with the variant reads on top; a height:,
heightMode: or growMaxHeight= set on the track wins.

The module graph loads once for the whole callset, so this is much faster
than a shell loop over "jb2export breakpoint".

Options:
  --fasta           Genome FASTA or 2bit, for a name the file does not say; takes aliases: and cytobands: modifiers naming those files
  --chromSizes      Path to a chrom.sizes file (whole-genome assembly, no sequence). Repeat for each assembly in a comparative view
  --assembly        Which of the config's assemblies to open, by name
  --genome          Pull a whole config from genomes.jbrowse.org: a UCSC db name (hg19, mm10) or GenArk accession (GCA_/GCF_...). Gives cytobands, refName aliasing, and hosted trackIds (see --track)
  --track           Show a trackId already in the config (from --genome/--config), e.g. --track hg19-ncbiRefSeqCurated (the hg19- prefix is optional). Repeatable; accepts the same display modifiers as track flags (height:, color:, ...)
  --config          Path to JBrowse config.json (path, URL, or "-" for stdin)
  --view            Settings written on the view, by the names a session spec gives them: path=value or a JSON object, e.g. --view mark.interpolate=bump encoding.opacity=0.3 for a synteny view
  --width           Width of output in pixels [default: 1500]
  --noRasterize     Disable rasterization of pileup/coverage [default: false]
  --defaultSession  Use default session from config [default: false]
  --tracks          Path to JSON file with an array of track configs (or "-" for stdin); added to the config's tracks, replacing any with the same trackId
  --themeName       Palette for rendering: default, stock, or minimal
  --themeMode       Draw that palette light or dark
  --fontFamily      Font family for all text (serif, sans-serif, monospace, or a named family) [default: serif]
  --showGridlines   Show genomic coordinate gridlines in the output [default: false]
  --trackLabels     Track label position: offset, overlapping, left, or hidden
  --refseq          Show the reference sequence track [default: false]
  --sites           The records to render, one image each: a VCF (plain or bgzipped), or a BEDPE (.bedpe or .bedpe.gz) for anything a VCF cannot express (a LINX TSV reshaped by awk)
  --outDir          Directory to write the images to [default: jb2export-batch]
  --flank           bp of context around each locus [default: 50 for a variant whose alleles are under 50 bp, 500 otherwise]
  --limit           Render only the first N rows
  --format          Output format: png, svg, or pdf [default: png]
  --passOnly        Skip VCF records whose FILTER is neither PASS nor "." [default: false]
  --resume          Skip a record whose image is already in --outDir, so an interrupted run picks up where it stopped [default: false]
  --manifest        Also write manifest.tsv to --outDir: one row per image with its file, loci, name, line in the input, EVENT, the reads joining its windows, the reads with the ALT at its variant, the view as a session spec and status [default: false]
  --dryRun          Print the file and loci each record would render, and render nothing [default: false]
  --jobs            Processes to render in, each about a gigabyte. The default is half the cores, up to 4 and to what memory allows; 1 renders in this process

Examples:
  jb2export batch --sites calls.vcf.gz ref.fa tumor.bam --outDir figs --flank 1000
      A contact sheet of every junction in a callset
  jb2export batch --sites calls.vcf.gz --genome hg38 tumor.bam --limit 20
      The first 20, to check the framing before committing to the whole run
  jb2export batch --sites snvs.vcf.gz --genome hg38 tumor.bam --passOnly
      Small variants at base resolution, reads with each variant sorted to the top
  jb2export batch --sites linx_links.bedpe --genome hg38 tumor.bam
      The same from a BEDPE, for a caller whose output is not a VCF

The ALT grammar is parsed by @gmod/vcf, so inserted sequence at the
junction and upper-cased mate contigs are handled; reciprocal breakend
pairs collapse, so each junction is queued once.

Every track is drawn as if given force:true, since a window is only a flank
wide and a "Region too large" panel cannot be clicked through on an image;
force:false on a track restores its size limit.

Records a caller files under one VCF EVENT are also drawn together, as
event_<n>_<label>, when the event visits more than two loci, its contigs
in the order the VCF header lists them.
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
appears in the FASTA, or give the genome an `aliases:` file to reconcile
differing naming styles (e.g. `1` vs `chr1` vs `NC_000001.10`) across the
assembly and track files. See [Remote files](#remote-files).

### A track renders empty when zoomed far out

Some track types (alignments, genes) refuse to render past a feature-density
limit. Add `force:true` after the track to override it. See
[Force render a large region](#force-render-a-large-region).

## See also

- [@jbrowse/capture](https://www.npmjs.com/package/@jbrowse/capture) drives a
  real browser instead of rendering server-side. It is slower and downloads
  Chromium, but it captures the whole application (canvas and WebGPU displays,
  menus and dialogs) and can click through it.
- [Using JBrowse with AI agents](https://jbrowse.org/jb2/docs/agents/) for the
  loop these tools fit into.
