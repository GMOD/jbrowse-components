# @jbrowse/img

Static exports of JBrowse 2 rendering.

## Prerequisites

You don't need to have JBrowse 2 installed to use this tool. The tool can
generate images using files on your hard drive or from remote files. So, all you
need to run this tool is

- NodeJS v23+

## Screenshot

![](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/1.png)

More examples [EXAMPLES.md](EXAMPLES.md)

## Setup

You can install the `@jbrowse/img` package from npm, which, if your node is
configured in a typical configuration, will then have a command `jb2export` in
your path

```bash
npm install -g @jbrowse/img
```

If you are a developer and want to modify the code, see
[developer guide](DEVELOPER.md) for details

## Example usages

### Use with local files

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

### Generate PNG instead of SVG

Supply a file with the png extension to `--out`, uses rsvg-convert so you will
need to install rsvg-convert to your system e.g. with
`sudo apt install librsvg2-bin`

```bash
jb2export --fasta yourfile.fa --bam yourfile.bam --loc chr1:1,000,000-1,001,000 --out file.png
```

### Generate PDF instead of SVG

Supply a file with the pdf extension to `--out`, uses rsvg-convert so you will
need to install rsvg-convert to your system e.g. with
`sudo apt install librsvg2-bin`

```bash
jb2export --fasta yourfile.fa --bam yourfile.bam --loc chr1:1,000,000-1,001,000 --out file.pdf
```

### Use with remote files

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

### Customizing track

In addition to possibly specifying custom track configuration files, sometimes
specializing specifically track state is helpful. This example helps color and
sort by the read group (RG) tag

```bash
jb2export --fasta data/volvox/volvox.fa \
  --bam data/volvox/volvox-rg.bam color:tag:RG sort:tag:RG height:400 \
  --loc ctgA:609..968
```

Other common alignment recipes:

```bash
## color by splice strand (XS tag), sort by haplotype (HP tag)
jb2export --fasta ref.fa --bam reads.bam color:tag:XS sort:tag:HP --loc chr1:1-10000

## color by base modifications (MM/ML tags) in super-compact layout
jb2export --fasta ref.fa --bam reads.bam color:modifications featureHeight:super-compact \
  --loc chr1:1-10000

## color by insert size + orientation to highlight structural variants
jb2export --fasta ref.fa --bam reads.bam color:insertSizeAndOrientation --loc chr1:1-10000

## samplot-style SV view — samplot overlays the coverage band, so use
## coverageHeight to make the panel tall (NOT pairedConnectionsHeight, which only sizes
## the regular up/down arcs panel). Samplot disappears if coverage:false.
jb2export --fasta ref.fa --bam reads.bam arcs:samplot coverageHeight:300 \
  pairedConnectionsLineWidth:2 height:600 --loc chr1:1-50000

## paired-end arcs above reads
jb2export --fasta ref.fa --bam reads.bam arcs:up --loc chr1:1-10000

## 10x linked-read chains (bezier mode)
jb2export --fasta ref.fa --bam linked.bam linkedReads:bezier --loc chr1:1-50000

## sashimi splice-junction arcs over an RNA-seq pileup
jb2export --fasta ref.fa --bam rnaseq.bam sashimi:up --loc chr1:1-50000
```

Instead of extra `--flags`, track modifiers use a colon-based syntax that
follows the track file argument. Full list of available modifiers:

**All tracks**

| Modifier     | Example      | Description                        |
| ------------ | ------------ | ---------------------------------- |
| `height:N`   | `height:400` | Track height in pixels             |
| `force:true` | `force:true` | Render even if region is too large |

**Alignment tracks (BAM/CRAM)**

Reads & coloring:

| Modifier                         | Example                        | Description                                                   |
| -------------------------------- | ------------------------------ | ------------------------------------------------------------- |
| `color:type` or `color:type:tag` | `color:strand`, `color:tag:XS` | Color scheme (see types below)                                |
| `sort:type` or `sort:type:tag`   | `sort:strand`, `sort:tag:RG`   | Sort reads (`position`, `strand`, `basePair`, or `tag:<TAG>`) |
| `softClipping:true\|false`       | `softClipping:true`            | Show soft-clipped bases                                       |

Overlays & subtracks:

| Modifier               | Example              | Description                                                      |
| ---------------------- | -------------------- | ---------------------------------------------------------------- |
| `arcs:mode`            | `arcs:samplot`       | Paired-end arcs / samplot panel (`off`, `up`, `down`, `samplot`) |
| `linkedReads:mode`     | `linkedReads:normal` | Linked-read chains (`off`, `normal`, `bezier`)                   |
| `sashimi:mode`         | `sashimi:up`         | Sashimi splice-junction arcs (`off`, `up`, `down`)               |
| `coverage:true\|false` | `coverage:false`     | Toggle coverage subtrack                                         |
| `snpcov`               | `snpcov`             | Coverage-only view — resizes the coverage band to fill the track |

Layout & sizing:

| Modifier                  | Example                                          | Description                                                                      |
| ------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `featureHeight:preset\|N` | `featureHeight:super-compact`, `featureHeight:4` | Per-read height. Presets: `normal` (7px), `compact` (3px), `super-compact` (1px) |
| `noSpacing:true\|false`   | `noSpacing:true`                                 | Remove gap between reads                                                         |
| `coverageHeight:N`        | `coverageHeight:200`                             | Height of the coverage subtrack (also the height of the samplot overlay)         |
| `pairedConnectionsHeight:N`            | `pairedConnectionsHeight:120`                                 | Height of the paired-arcs panel — only applies to `arcs:up` / `arcs:down`        |
| `pairedConnectionsLineWidth:N`          | `pairedConnectionsLineWidth:2`                                 | Stroke width for paired-read arcs in pixels                                      |

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

### Force render a large region

Some jbrowse track types (alignments, gene tracks, etc) will not display if
zoomed too far out. Add force:true to make it render

```bash
jb2export --bam file.bam force:true --loc 1:1,100,000-1,200,000 --fasta hg19.fa
```

### Render only the SNPCoverage track of an alignments track

`snpcov` collapses the alignments display down to coverage-only by sizing the
coverage band to fill the whole track. Combine with `height:N` (overall track
height) to get a coverage-only render at the size you want.

```bash
jb2export --bam file.bam snpcov height:200 --fasta hg19.fa
```

### Use with a jbrowse config.json (remote files in the config.json)

A config.json can be specified with extra tracks supplied outside the config
e.g. with `--bam`

```bash
jb2export --config data/config.json \
  --assembly hg19 \
  --bam custom_bam.bam \
  --loc 1:1,000,000-1,100,000
```

### Respects the order of the files you input

Example:

```
jb2export --bam file1.bam --bigwig file.bw --bam file2.bam
```

This will respect the order of the tracks and list file1.bam, file.bw, and
file2.bam in that order. This requires us to use a custom command line parser
instead of an off-the-shelf one like yargs

### Use a session file exported from jbrowse

If you use jbrowse-web, you can select File->Export session which produces a
session.json file, and then use the --session parameter. Make sure to specify
the assembly also, it currently does not infer the assembly from the session

```bash
jb2export --config data/skbr3/config.json \
  --session session.json \
  --assembly hg19
```

### Plot whole-genome overview of bigwig

The special flag --loc all shows the full assembly, and there are a number of
custom bigwig plotting options that can help draw the bigwig genome wide

Example with logscale, manual setting of minmax score

```bash
jb2export --loc all \
  --bigwig coverage.bw scaletype:log fill:false resolution:superfine height:400 color:purple minmax:1:1024 \
  --assembly hg19 \
  --config data/config.json
```

Example with linearscale, autoscore adjusted to "localsd" or mean plus/minus
three standard deviations

```bash
jb2export --loc all \
  --bigwig coverage.bw autoscale:localsd fill:false resolution:superfine height:400 color:purple \
  --assembly hg19 \
  --config data/config.json
```

### Use with a jbrowse config.json (local files in the config.json)

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

- `--themeName` — theme to use for rendering (`default` or `dark`)
- `--showGridlines` — draw genomic coordinate gridlines
- `--trackLabels` — label position: `offset` (default), `overlapping`, or
  `hidden`

## Use --help

Run `jb2export --help` for the full option list.

## Convert to PNG

The tool will automatically try to run rsvg-convert and convert to PNG if a
filename with png extension is supplied to --out

Alternatively, you can do so manually with commands like this

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

## Troubleshooting

### I don't get any outputted svg and no message

The error reporting from the app is not very good at the moment so often has
silent failures. Confirm that your fasta file to your pass to --fasta is indexed
in this case e.g. `samtools faidx yourfile.fa` so that your have a
yourfile.fa.fai alongside yourfile.fa

### I get a lot of warnings during npm install -g @jbrowse/img

There are some new features in the latest NPM (2021, v7) related to
peerDependencies that may produce some warnings. It should work even despite
making warnings, but you can use yarn to install or use legacy peer dependencies
if you want to avoid install time warningsvg
