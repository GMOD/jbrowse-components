# @jbrowse/img

Static exports of JBrowse 2 rendering.

## Prerequisites

You don't need to have JBrowse 2 installed to use this tool. The tool can
generate images using files on your hard drive or from remote files. So, all you
need to run this tool is

- NodeJS v23+

## Setup

You can install the `@jbrowse/img` package from npm, which, if your node is
configured in a typical configuration, will then have a command `jb2export` in
your path

```bash
npm install -g @jbrowse/img
```

If you are a developer and want to modify the code, see the
[source on GitHub](https://github.com/GMOD/jbrowse-components/tree/main/products/jbrowse-img)

## Quickstart

A multi-track human (hg19) view at the IFFO2 / ALDH4A1 locus — NCBI RefSeq
genes, ClinGen gene–disease mapping, phyloP conservation, and SKBR3 nanopore
reads — rendered straight from public files in a single command (`--aliases`
reconciles the `1` / `chr1` / `NC_000001.10` refname styles across the files):

![A multi-track hg19 view: NCBI RefSeq genes, ClinGen gene-disease mapping, phyloP conservation, and SKBR3 nanopore reads](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/1.png)

```bash
jb2export \
  --fasta https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz \
  --aliases https://jbrowse.org/genomes/hg19/hg19_aliases.txt \
  --gffgz https://s3.amazonaws.com/jbrowse.org/genomes/hg19/ncbi_refseq/GRCh37_latest_genomic.sort.gff.gz \
  --bigbed https://hgdownload.soe.ucsc.edu/gbdb/hg19/bbi/clinGen/clinGenGeneDisease.bb \
  --bigwig https://hgdownload.cse.ucsc.edu/goldenpath/hg19/phyloP100way/hg19.100way.phyloP100way.bw \
  --cram https://s3.amazonaws.com/jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.cram \
  --loc 1:19,197,000-19,233,000 --width 1200 --out overview.png
```

## Basic usage

### Local files

We can call this script on local files, and it doesn't require a web browser,
not even a headless webbrowser, it just runs a node script and React SSR is used
to create the SVG

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

This example shows using remote files, e.g. with human hg19 and several tracks

Note the use of --aliases, which smoothes over refname differences e.g. fasta
contains 1 for chr1, and bigbed contains chr1, gff contains NC_000001.10

```bash
jb2export --fasta https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz \
  --aliases https://jbrowse.org/genomes/hg19/hg19_aliases.txt  \
  --bigbed https://hgdownload.soe.ucsc.edu/gbdb/hg19/bbi/clinvar/clinvarMain.bb \
  --gffgz https://jbrowse.org/genomes/hg19/ncbi_refseq/GRCh37_latest_genomic.sort.gff.gz \
  --bigwig https://jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.regions.bw \
  --loc 1:48,683,542..48,907,531
```

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

Each track type renders as you'd expect from JBrowse 2. The examples below are
reproducible with the bundled volvox data (and a couple of public remote files);
see [Track modifiers](#track-modifiers) for the full list of per-track options
used here.

### Alignments tracks

A `--bam`/`--cram` track renders a coverage histogram over a read pileup, with
mismatches highlighted. Reproducible with the bundled volvox alignments:

```bash
jb2export --fasta data/volvox/volvox.fa --bam data/volvox/volvox-sorted.bam \
  --loc ctgA:1-20000 --width 1200 --out pileup.png
```

![A coverage histogram over a read pileup, with mismatches highlighted](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/alignments_pileup.png)

Track modifiers color, sort, and group the reads. Here the reads are colored and
sorted by their read-group (`RG`) tag:

```bash
jb2export --fasta data/volvox/volvox.fa \
  --bam data/volvox/volvox-rg.bam color:tag:RG sort:tag:RG height:300 \
  --loc ctgA:1000-2000 --width 1200 --out readgroup.png
```

![Reads colored and sorted by their read-group tag](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/alignments_readgroup.png)

`group:tag:HP` splits the pileup into one stacked sub-track per haplotype. This
HG002 ultralong-ONT example (hg19, streamed from the GIAB FTP) groups and colors
by the `HP` tag — the heterozygous deletion shows in one haplotype and not the
other:

```bash
jb2export --fasta https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz \
  --bam https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/data/AshkenazimTrio/HG002_NA24385_son/Ultralong_OxfordNanopore/combined_2018-08-10/HG002_ONTrel2_16x_RG_HP10xtrioRTG.cram.bam \
  group:tag:HP color:tag:HP height:400 \
  --loc 1:63,005,675-63,007,432 --width 1200 --out haplotype.png
```

![Reads grouped and colored by haplotype (HP tag), showing a heterozygous deletion in one haplotype](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/alignments_haplotype.png)

`color:methylation` paints per-base CpG methylation calls from a modified-base
(`MM`/`ML`) BAM/CRAM — methylated cytosines red, unmethylated blue. This COLO829
nanopore CRAM (hg38, streamed from the ONT open-data S3) over a CpG island shows
the methylated-to-unmethylated transition:

```bash
jb2export \
  --fasta https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz \
  --aliases https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt \
  --cram https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829_tumor.ht.cram color:methylation height:350 \
  --loc 20:18,500,750-18,503,250 --width 1200 --out methylation.png
```

![COLO829 nanopore reads colored by per-base CpG methylation over a CpG island](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/methylation.png)

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

## samplot-style SV view — samplot overlays the coverage band, so use
## coverageHeight to make the panel tall (NOT readConnectionsHeight, which only sizes
## the regular up/down arcs panel). Samplot disappears if coverage:false.
jb2export --fasta ref.fa --bam reads.bam arcs:samplot coverageHeight:300 \
  readConnectionsLineWidth:2 height:600 --loc chr1:1-50000

## read-connection arcs above reads
jb2export --fasta ref.fa --bam reads.bam arcs:up --loc chr1:1-10000

## 10x linked-read chains (bezier mode)
jb2export --fasta ref.fa --bam linked.bam linkedReads:bezier --loc chr1:1-50000

## sashimi splice-junction arcs over an RNA-seq pileup
jb2export --fasta ref.fa --bam rnaseq.bam sashimi:up --loc chr1:1-50000
```

### BigWig / quantitative tracks

The special flag `--loc all` shows the full assembly, and there are a number of
custom bigwig plotting options that can help draw the bigwig genome wide.

This logscale, manual-minmax example plots the SKBR3 breast-cancer cell line's
read coverage genome-wide (hg19, public bigwig), where the amplifications and
deletions of the cancer karyotype stand out:

```bash
jb2export --loc all \
  --fasta https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz \
  --bigwig https://jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.regions.bw scaletype:log fill:false resolution:superfine height:400 color:purple minmax:1:1024 \
  --width 1400 --out skbr3_coverage.png
```

![SKBR3 cell-line read coverage genome-wide, log scale, showing cancer amplifications and deletions](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/skbr3_cov.png)

The score scaling can also autoscale — here to "localsd" (mean plus/minus three
standard deviations) on a linear scale:

```bash
jb2export --loc all \
  --bigwig coverage.bw autoscale:localsd fill:false resolution:superfine height:400 color:purple \
  --assembly hg19 \
  --config data/config.json
```

### Variant tracks

A `--vcfgz` track draws each variant with its reference-to-alternate change.
Reproducible with the bundled volvox VCF:

```bash
jb2export --fasta data/volvox/volvox.fa --vcfgz data/volvox/volvox.filtered.vcf.gz \
  --loc ctgA:1-20000 --width 1200 --out variants.png
```

![A variant track drawing each SNV with its reference-to-alternate change](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/variants.png)

### Multi-sample variant matrix

A VCF with many samples can render as a genotype matrix — one column per
variant, one row per sample — with the `display:multivariant` modifier (the
`LinearMultiSampleVariantDisplay`). `display:multivariantmatrix` selects the
index-spaced matrix variant. Reproducible with the bundled 1094-sample volvox
VCF (`--aliases` reconciles its `contigA` refname with the FASTA's `ctgA`):

```bash
jb2export --fasta data/volvox/volvox.fa --aliases data/volvox/volvox.aliases.txt \
  --vcfgz data/volvox/volvox.test.vcf.gz display:multivariant height:500 force:true \
  --loc ctgA:2900-3300 --width 1200 --out multisample.png
```

![A multi-sample variant genotype matrix: variants on x, samples on y, alt genotypes painted over the reference background](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/multisample_variants.png)

### Hi-C tracks

A `--hic` track draws the contact matrix as a triangular heatmap. This example
streams the public hg19 demo `.hic` and shows the TAD structure along chr1:

```bash
jb2export --fasta https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz \
  --hic https://jbrowse.org/genomes/hg19/intra_nofrag_30.hic height:400 \
  --loc 1:2,500,000-12,500,000 --width 1200 --out hic.png
```

![Hi-C contact matrix as a triangular heatmap showing TAD structure along hg19 chr1](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/hic.png)

### Gene / feature tracks

Feature tracks (`--gffgz`, `--bigbed`, `--bedgz`) render their glyphs with
labels. Reproducible with the bundled volvox annotations:

```bash
jb2export --fasta data/volvox/volvox.fa --gffgz data/volvox/volvox.sort.gff3.gz \
  --loc ctgA:1-50000 --width 1200 --out genes.png
```

![A gene/feature track rendered with glyphs and labels (volvox annotations)](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/gene_track.png)

### Reference sequence track

`--refseq` adds the assembly's reference-sequence track. Zoomed in to base level
it shows the DNA bases and the six-frame translation (green start codons, red
stops):

```bash
jb2export --fasta data/volvox/volvox.fa --loc ctgA:108-208 --refseq \
  --width 1500 --out sequence.png
```

![The reference sequence track at base level, showing DNA bases and the six-frame translation](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/sequence.png)

### Themes

`--themeName` selects a built-in theme: `default`, `lightStock`, `lightMinimal`,
`darkStock`, or `darkMinimal`. (Plain `dark`/`light` are not theme names — use
the keys above.)

```bash
jb2export --fasta data/volvox/volvox.fa \
  --bigwig data/volvox/volvox-sorted.bam.coverage.bw \
  --gffgz data/volvox/volvox.sort.gff3.gz \
  --loc ctgA:1-20000 --themeName darkStock --width 1200 --out dark.png
```

![A coverage and gene track rendered with the darkStock theme](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/dark_theme.png)

## Track modifiers

Instead of extra `--flags`, per-track settings use a colon-based syntax that
follows the track file argument, e.g. `--bam reads.bam color:tag:RG height:400`.
This is the full list of available modifiers.

**All tracks**

| Modifier     | Example      | Description                        |
| ------------ | ------------ | ---------------------------------- |
| `height:N`   | `height:400` | Track height in pixels             |
| `force:true` | `force:true` | Render even if region is too large |

**Alignment tracks (BAM/CRAM)**

Reads & coloring:

| Modifier                         | Example                        | Description                                                                                                                                         |
| -------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color:type` or `color:type:tag` | `color:strand`, `color:tag:XS` | Color scheme (see types below)                                                                                                                      |
| `sort:type` or `sort:type:tag`   | `sort:strand`, `sort:tag:RG`   | Sort reads (`position`, `strand`, `basePair`, or `tag:<TAG>`)                                                                                       |
| `group:type` or `group:type:tag` | `group:strand`, `group:tag:HP` | Group reads into in-track stacked sections (`strand`, `firstOfPairStrand`, `pairOrientation`, `supplementary`, `duplicate`, `mapq`, or `tag:<TAG>`) |
| `softClipping:true\|false`       | `softClipping:true`            | Show soft-clipped bases                                                                                                                             |

Overlays & subtracks:

| Modifier               | Example              | Description                                                           |
| ---------------------- | -------------------- | --------------------------------------------------------------------- |
| `arcs:mode`            | `arcs:samplot`       | Read-connection arcs / samplot panel (`off`, `up`, `down`, `samplot`) |
| `linkedReads:mode`     | `linkedReads:normal` | Linked-read chains (`off`, `normal`, `bezier`)                        |
| `sashimi:mode`         | `sashimi:up`         | Sashimi splice-junction arcs (`off`, `up`, `down`, `auto`)            |
| `coverage:true\|false` | `coverage:false`     | Toggle coverage subtrack                                              |
| `snpcov`               | `snpcov`             | Coverage-only view — resizes the coverage band to fill the track      |

Layout & sizing:

| Modifier                     | Example                                          | Description                                                                      |
| ---------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `featureHeight:preset\|N`    | `featureHeight:super-compact`, `featureHeight:4` | Per-read height. Presets: `normal` (7px), `compact` (3px), `super-compact` (1px) |
| `noSpacing:true\|false`      | `noSpacing:true`                                 | Remove gap between reads                                                         |
| `coverageHeight:N`           | `coverageHeight:200`                             | Height of the coverage subtrack (also the height of the samplot overlay)         |
| `readConnectionsHeight:N`    | `readConnectionsHeight:120`                      | Height of the paired-arcs panel — only applies to `arcs:up` / `arcs:down`        |
| `readConnectionsLineWidth:N` | `readConnectionsLineWidth:2`                     | Stroke width for read-connection arcs/lines in pixels                            |

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

**BigWig tracks**

| Modifier                 | Example                | Description                                               |
| ------------------------ | ---------------------- | --------------------------------------------------------- |
| `autoscale:mode`         | `autoscale:localsd`    | Autoscale mode (`local`, `global`, `localsd`)             |
| `minmax:min:max`         | `minmax:0:100`         | Manual score range                                        |
| `scaletype:type`         | `scaletype:log`        | Scale type (`linear` or `log`)                            |
| `fill:true\|false`       | `fill:false`           | Fill under curve                                          |
| `crosshatch:true\|false` | `crosshatch:true`      | Draw crosshatches                                         |
| `resolution:value`       | `resolution:superfine` | BigWig resolution (`fine`, `superfine`, or a multiplier)  |
| `color:value`            | `color:purple`         | Fill color (any CSS color — `tag:` form is BAM/CRAM only) |

### Raw display settings (JSON)

Any track modifier that starts with `{` is parsed as JSON and merged into the
display's settings — an escape hatch for settings without a dedicated modifier
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

A whole-genome dotplot — every query contig on x, every target contig on y.
`--autoDiagonalize` reorders the target contigs so the main alignment forms a
clean diagonal instead of a staircase:

```bash
jb2export dotplot \
  --fasta https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/yjm1447.fa \
  --fasta2 https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/r64.fa \
  --paf https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/r64_vs_yjm1447.paf \
  --autoDiagonalize --out dotplot.png
```

![Whole-genome dotplot of two yeast assemblies (R64 vs the YJM1447 strain)](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/yeast_dotplot.png)

A linear synteny ribbon between one chromosome in each assembly (here YJM1447
chr `I` vs R64 chr `I`, accession `NC_001133.9`). `--drawCurves` renders the
ribbon as a smooth bezier instead of straight trapezoids:

```bash
jb2export synteny \
  --fasta https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/yjm1447.fa --loc I \
  --fasta2 https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/r64.fa --loc2 NC_001133.9 \
  --paf https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/r64_vs_yjm1447.paf \
  --drawCurves --out synteny.png
```

![Linear synteny ribbon between YJM1447 chr I and R64 chr I](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/yeast_synteny.png)

Omitting `--loc`/`--loc2` shows the whole assembly on that axis (note: `dotplot`
ignores `--loc` and always shows the whole genome). `--autoDiagonalize` and
`--drawCurves` are the CLI shortcuts for the busiest-comparison knobs; the full
set is available via `--spec` (see the table below). Run
`jb2export dotplot --help` for the full list of comparative options.

### Multi-way synteny (three or more assemblies)

The `--fasta2`/`--loc2` shortcut covers the common two-assembly case. To stack
three or more assemblies (one synteny ribbon per adjacent pair), describe the
view with a session-spec JSON and pass it with `--spec`, supplying the
assemblies and comparison tracks via a `--config`. The spec is the same shape
used by the JBrowse Web URL `&session=spec-` parameter, so JSON copied out of a
browser URL works directly — see
[URL query parameter API](https://jbrowse.org/jb2/docs/urlparams/#linear-synteny-view-multi-way)
for the full format.

```bash
jb2export --config jbrowse.json --spec spec.json --out synteny.svg
```

where `spec.json` is, for example:

```json
{
  "views": [
    {
      "type": "LinearSyntenyView",
      "tracks": [["a_vs_b.paf"], ["b_vs_c.paf"]],
      "views": [
        { "assembly": "a", "loc": "chr1" },
        { "assembly": "b", "loc": "chr1" },
        { "assembly": "c", "loc": "chr1" }
      ]
    }
  ]
}
```

`tracks` is one sub-array per level (the gap between adjacent `views`). The
subcommand is optional here — the render mode is taken from the spec's view
`type` (`LinearSyntenyView`, `DotplotView`, or `CircularView`).

The spec also accepts the same view-level fields the web app uses, which are
what make a busy whole-genome comparison legible:

| Field                | Effect                                                          |
| -------------------- | --------------------------------------------------------------- |
| `autoDiagonalize`    | Reorders the second assembly's chromosomes for least overlap    |
| `minAlignmentLength` | Hides alignments shorter than N bp — the main de-spaghetti knob |
| `colorBy`            | `query` tints each ribbon by its query chromosome               |
| `alpha`              | Ribbon opacity (0–1); lower values reveal overlap density       |
| `drawCurves`         | Bezier ribbons instead of straight trapezoids                   |
| `levelHeights`       | Per-level pixel height between adjacent assemblies              |

A whole-genome example (peach vs grape, the chrom.sizes come from this repo and
the alignment PAF from S3). Config and spec are checked in under
[`data/comparative`](data/comparative):

```bash
jb2export \
  --config data/comparative/grape_peach.config.json \
  --spec data/comparative/grape_peach.spec.json \
  --width 1400 --out grape_peach.png
```

![Whole-genome synteny, grape vs peach, with autoDiagonalize and colorBy query](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/grape_peach_synteny.png)

A mammalian-scale test — human (hs1/T2T) vs mouse (mm39) liftOver — where the
`minAlignmentLength: 500000` filter is what keeps the plot from turning into
spaghetti. The assemblies use `ChromSizesAdapter` (whole-genome synteny draws no
sequence, so no multi-GB 2bit is needed); the chrom.sizes are committed and the
`.pif` alignment streams from S3, so this reproduces with only the public PAF:

```bash
jb2export \
  --config data/comparative/hs1_mm39.config.json \
  --spec data/comparative/hs1_mm39.spec.json \
  --width 1400 --out hs1_mm39.png
```

![Mammalian-scale synteny, human (hs1) vs mouse (mm39)](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/hs1_mm39_synteny.png)

A three-level stack — hg38, hs1 (T2T), and mm39 — with one ribbon per adjacent
pair: the conserved hg38↔hs1 build liftover on top (near-vertical bands) and the
diverged hs1↔mm39 human–mouse synteny below. `tracks` is one sub-array per level
(a UCSC liftOver `.chain` for the first, the `.pif` for the second):

```bash
jb2export \
  --config data/comparative/hg38_hs1_mm39.config.json \
  --spec data/comparative/hg38_hs1_mm39.spec.json \
  --width 1400 --out hg38_hs1_mm39.png
```

![Three-level synteny stack: hg38, hs1, and mm39](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/hg38_hs1_mm39_synteny.png)

All the example images in this README (including the comparative ones above) are
regenerated by `pnpm generate-screenshots --filter jbrowse-img` from the repo
root — see the `CliSpec` entries in
[`website/scripts/screenshot-specs.ts`](https://github.com/GMOD/jbrowse-components/blob/main/website/scripts/screenshot-specs.ts).

### Circular view (chord plot)

The `circular` subcommand renders one assembly's chord tracks — e.g. a VCF of
structural variants — as a circular ideogram with chords drawn between the two
breakends of each rearrangement. It is single-assembly and shows the whole
genome (no `--loc`); each track picks its chord display automatically.

```bash
jb2export circular --fasta ref.fa --vcfgz sv.vcf.gz --out circular.svg
```

Reproducible with the bundled volvox structural-variant VCF:

```bash
jb2export circular \
  --fasta data/volvox/volvox.fa --vcfgz data/volvox/volvox.dup.vcf.gz \
  --width 800 --out circular.png
```

![Circular chord plot of structural variants (volvox SV VCF)](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/circular_chords.png)

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

Then you can call it like above

```bash
jb2export --config data/volvox/config.json \
  --assembly volvox \
  --loc ctgA:1-50,000
```

The localPaths will be resolved relative to the file that is supplied so in this
example we would resolve data/volvox/volvox.dup.vcf.gz if "localPath":
"volvox.dup.vcf.gz" is used, and `--config data/volvox/config.json` is passed

See data/volvox/config.json for a config that contains localPaths, or
data/config.json for a config that just contains URLs

### Use a session file exported from jbrowse

If you use jbrowse-web, you can select File->Export session which produces a
session.json file, and then use the --session parameter. Make sure to specify
the assembly also, it currently does not infer the assembly from the session

```bash
jb2export --config data/skbr3/config.json \
  --session session.json \
  --assembly hg19
```

### Respects the order of the files you input

Example:

```
jb2export --bam file1.bam --bigwig file.bw --bam file2.bam
```

This will respect the order of the tracks and list file1.bam, file.bw, and
file2.bam in that order. This requires us to use a custom command line parser
instead of an off-the-shelf one like yargs

## Advanced

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

```bash
jb2export --fasta data/volvox/volvox.fa --bam data/volvox/volvox-sorted.bam \
  snpcov height:200 --loc ctgA:1-20000 --width 1200 --out snpcov.png
```

![Coverage-only render of an alignments track (snpcov), the SNP-coverage histogram filling the whole track with no read pileup](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/alignments_snpcov.png)

## Parameters

### Assembly params

- `--fasta` — path or http(s) URL to an indexed FASTA (`.fa`, `.fa.gz`)
- `--aliases` — tab-separated refname aliases; column 1 matches the FASTA, other
  columns are aliases (e.g. maps `1` → `chr1`)
- `--cytobands` — path or URL to a cytoband BED file for the assembly

### Track params

Specify a filename (local) or http(s) URL. Can be repeated for multiple tracks
of the same type, e.g. `--bam file1.bam --bam file2.bam`

- `--bam`
- `--cram`
- `--bigwig`
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
- `--config` — path to a full JBrowse 2 config.json (e.g.
  [data/config.json](data/config.json))
- `--defaultSession` — use the `defaultSession` embedded in `--config`

### Output params

- `--loc` — location string to render, e.g. `chr1:1-10000` or `all`
- `--out` — output file path; `.svg`, `.png`, or `.pdf`
- `--width` — view width in pixels (default: 1500)
- `--noRasterize` — render everything as SVG vectors instead of rasterizing
  canvas layers (pileup, coverage, hic); results in larger files

### Appearance params

- `--themeName` — theme to use for rendering: `default`, `lightStock`,
  `lightMinimal`, `darkStock`, or `darkMinimal`
- `--showGridlines` — draw genomic coordinate gridlines
- `--trackLabels` — label position: `offset`, `overlay`, `left`, or `none`

## Use --help

Run `jb2export --help` for the full option list, or
`jb2export <subcommand> --help` (e.g. `jb2export dotplot --help`) for a
subcommand's options. The complete output:

<!-- INJECT_HELP START: auto-filled from buildFullHelp() by website/scripts/generate-img-doc.ts; run `pnpm gen-img-doc` to refresh -->

```
Usage: jb2export [options]
       jb2export <dotplot|synteny|circular> [options]

Options:
  --fasta           Path to indexed FASTA file
  --aliases         Path to reference name aliases file
  --assembly        Path to assembly JSON or name in config
  --config          Path to JBrowse config.json
  --session         Path to session JSON
  --loc             Location to render (e.g., chr1:1-1000 or "all")
  --out             Output file path (SVG or PNG)
  --width           Width of output in pixels [default: 1500]
  --noRasterize     Disable rasterization of pileup/coverage [default: false]
  --defaultSession  Use default session from config [default: false]
  --tracks          Path to JSON file with an array of track configs
  --cytobands       Path to cytoband file for the assembly
  --themeName       Theme for rendering: default, lightStock, lightMinimal, darkStock, or darkMinimal
  --showGridlines   Show genomic coordinate gridlines in the output [default: false]
  --trackLabels     Track label position: offset, overlay, left, or none
  --refseq          Show the reference sequence track [default: false]
  --spec            Session-spec JSON (inline or path to .json) describing the view; see urlparams.md. Drives N-way comparative views from a --config
  --help            Show help
  --version         Print version

Examples:
  jb2export --fasta ref.fa --bam reads.bam --loc chr1:1-10000 --out out.svg
      Render BAM alignments to SVG
  jb2export --fasta ref.fa --vcfgz variants.vcf.gz --loc chr1:1-50000 --out out.png
      Render VCF variants to PNG
  jb2export --fasta ref.fa --bam reads.bam height:80 color:strand --loc chr1:1-10000 --out out.svg
      Custom track height and strand coloring
  jb2export --config jbrowse.json --assembly hg38 --tracks tracks.json --loc chr1:1-100000 --out out.svg
      Render from config with a JSON tracks file
  jb2export --fasta ref.fa.gz --cytobands cytobands.bed --bigwig signal.bw --loc chr1 --out out.svg
      Render BigWig with cytobands

Track options: --bam, --cram, --bigwig, --vcfgz, --gffgz, --hic, --bigbed, --bedgz

Comparative subcommands (run "jb2export dotplot --help"): dotplot, synteny, circular

Usage: jb2export dotplot [options]

Options:
  --fasta            Path to indexed FASTA file
  --aliases          Path to reference name aliases file
  --assembly         Path to assembly JSON or name in config
  --config           Path to JBrowse config.json
  --session          Path to session JSON
  --loc              Location to render (e.g., chr1:1-1000 or "all")
  --out              Output file path (SVG or PNG)
  --width            Width of output in pixels [default: 1500]
  --noRasterize      Disable rasterization of pileup/coverage [default: false]
  --defaultSession   Use default session from config [default: false]
  --tracks           Path to JSON file with an array of track configs
  --cytobands        Path to cytoband file for the assembly
  --themeName        Theme for rendering: default, lightStock, lightMinimal, darkStock, or darkMinimal
  --showGridlines    Show genomic coordinate gridlines in the output [default: false]
  --trackLabels      Track label position: offset, overlay, left, or none
  --refseq           Show the reference sequence track [default: false]
  --spec             Session-spec JSON (inline or path to .json) describing the view; see urlparams.md. Drives N-way comparative views from a --config
  --fasta2           Second assembly indexed FASTA
  --aliases2         Reference name aliases for fasta2
  --assembly2        Second assembly name in config
  --loc2             Location on the second assembly
  --autoDiagonalize  Reorder the second assembly's chromosomes for least overlap (a clean diagonal) [default: false]
  --drawCurves       Draw synteny ribbons as bezier curves instead of trapezoids [default: false]

Examples:
  jb2export dotplot --fasta a.fa --fasta2 b.fa --paf a_vs_b.paf --out out.svg
      Whole-genome dotplot of two assemblies via a PAF
  jb2export synteny --fasta a.fa --fasta2 b.fa --paf a_vs_b.paf --loc chr1 --loc2 chr1 --out out.svg
      Linear synteny view of a region in each assembly
  jb2export synteny --config jbrowse.json --spec spec.json --out out.svg
      N-way synteny from a config + session-spec JSON (see urlparams.md)

Comparison track options: --paf, --delta, --chain, --blasttab

Usage: jb2export synteny [options]

Options:
  --fasta            Path to indexed FASTA file
  --aliases          Path to reference name aliases file
  --assembly         Path to assembly JSON or name in config
  --config           Path to JBrowse config.json
  --session          Path to session JSON
  --loc              Location to render (e.g., chr1:1-1000 or "all")
  --out              Output file path (SVG or PNG)
  --width            Width of output in pixels [default: 1500]
  --noRasterize      Disable rasterization of pileup/coverage [default: false]
  --defaultSession   Use default session from config [default: false]
  --tracks           Path to JSON file with an array of track configs
  --cytobands        Path to cytoband file for the assembly
  --themeName        Theme for rendering: default, lightStock, lightMinimal, darkStock, or darkMinimal
  --showGridlines    Show genomic coordinate gridlines in the output [default: false]
  --trackLabels      Track label position: offset, overlay, left, or none
  --refseq           Show the reference sequence track [default: false]
  --spec             Session-spec JSON (inline or path to .json) describing the view; see urlparams.md. Drives N-way comparative views from a --config
  --fasta2           Second assembly indexed FASTA
  --aliases2         Reference name aliases for fasta2
  --assembly2        Second assembly name in config
  --loc2             Location on the second assembly
  --autoDiagonalize  Reorder the second assembly's chromosomes for least overlap (a clean diagonal) [default: false]
  --drawCurves       Draw synteny ribbons as bezier curves instead of trapezoids [default: false]

Examples:
  jb2export dotplot --fasta a.fa --fasta2 b.fa --paf a_vs_b.paf --out out.svg
      Whole-genome dotplot of two assemblies via a PAF
  jb2export synteny --fasta a.fa --fasta2 b.fa --paf a_vs_b.paf --loc chr1 --loc2 chr1 --out out.svg
      Linear synteny view of a region in each assembly
  jb2export synteny --config jbrowse.json --spec spec.json --out out.svg
      N-way synteny from a config + session-spec JSON (see urlparams.md)

Comparison track options: --paf, --delta, --chain, --blasttab

Usage: jb2export circular [options]

Options:
  --fasta           Path to indexed FASTA file
  --aliases         Path to reference name aliases file
  --assembly        Path to assembly JSON or name in config
  --config          Path to JBrowse config.json
  --session         Path to session JSON
  --loc             Location to render (e.g., chr1:1-1000 or "all")
  --out             Output file path (SVG or PNG)
  --width           Width of output in pixels [default: 1500]
  --noRasterize     Disable rasterization of pileup/coverage [default: false]
  --defaultSession  Use default session from config [default: false]
  --tracks          Path to JSON file with an array of track configs
  --cytobands       Path to cytoband file for the assembly
  --themeName       Theme for rendering: default, lightStock, lightMinimal, darkStock, or darkMinimal
  --showGridlines   Show genomic coordinate gridlines in the output [default: false]
  --trackLabels     Track label position: offset, overlay, left, or none
  --refseq          Show the reference sequence track [default: false]
  --spec            Session-spec JSON (inline or path to .json) describing the view; see urlparams.md. Drives N-way comparative views from a --config

Examples:
  jb2export circular --fasta ref.fa --vcfgz sv.vcf.gz --out out.svg
      Circular (chord) view of structural variants
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
(e.g. `1` vs `chr1` vs `NC_000001.10`) across the assembly and track files — see
[Remote files](#remote-files).

### A track renders empty when zoomed far out

Some track types (alignments, genes) refuse to render past a feature-density
limit. Add `force:true` after the track to override it — see
[Force render a large region](#force-render-a-large-region).
