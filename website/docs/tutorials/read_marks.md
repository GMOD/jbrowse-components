---
title: A grammar of graphics over a BAM (NA12878 insert size)
sidebar_label: Marks over a BAM (insert size)
description:
  Declare a read's depth, insert size and mapping quality as the channels of a
  plot, with no variant caller in between, and scan a chromosome for a deletion
guide_category: Tutorials
tutorial_category: Grammar of graphics
---

A read pair that straddles a deletion maps with a long insert (the distance
between its reads), and a heterozygous deletion halves the read depth. In
NA12878's reads on chromosome 20 we:

- load hg38 and the reads as an alignments track
- plot read depth as bars over the _EFCAB8_ deletion, and insert size as one
  point per read pair, so the deletion shows without a variant caller
- bin the long-insert pairs to scan the whole chromosome for clusters

The plots use JBrowse's mark display, which maps feature fields to plot
channels. In [grammar-of-graphics](/docs/config_guides/mark_display) terms, a
`mark` is the shape drawn and `encoding.y` the y scale. The mark display is
experimental and its config shape may change.

## Prerequisites

- a JBrowse to open the figures' sessions in ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop))
- [samtools](https://www.htslib.org/) and htslib (`bgzip`, `tabix`), for cutting
  the pairs out
- [Node.js](https://nodejs.org/) and the [JBrowse CLI](/docs/cli), for the build
  script

<!-- TUTORIAL_INSTALL samtools,htslib,node,jbrowse-cli START -->

```bash
# Debian/Ubuntu
sudo apt install samtools tabix nodejs
# or conda, which has every tool above
conda install -c bioconda -c conda-forge samtools htslib nodejs
# any platform
npm install -g @jbrowse/cli
```

<!-- TUTORIAL_INSTALL samtools,htslib,node,jbrowse-cli END -->

## The data

1000 Genomes high-coverage release
([Byrska-Bishop et al. 2022](https://doi.org/10.1016/j.cell.2022.08.004)),
GRCh38.

You don't need these files to follow the page: the track configs below read the
hosted results. The [build script](#reproduce-it-end-to-end) fetches them to
rebuild those results. The marks and the scan step take your own CRAM or BAM.

| What it is                             | File                                                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| NA12878's 30x CRAM, index beside it    | [NA12878.final.cram](https://s3.amazonaws.com/1000genomes/1000G_2504_high_coverage/data/ERR3239334/NA12878.final.cram) |
| UCSC's GRCh38 cytoband table, rehosted | [cytoBand.txt](https://jbrowse.org/genomes/GRCh38/cytoBand.txt)                                                        |

## Loading hg38

The CRAM decodes against the assembly the track is added to, so the assembly
must be the GRCh38 sequence the reads were aligned to.

```json addassembly
{
  "name": "hg38",
  "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz",
  "refNameAliases": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt"
  },
  "cytobands": "https://jbrowse.org/genomes/GRCh38/cytoBand.txt"
}
```

## Plotting read depth as bars over the EFCAB8 deletion

The window covers 30 kb of an _EFCAB8_ intron on chromosome 20, where the
callset records one copy of a 3.9 kb deletion in NA12878.

```json addtrack loc=chr20:32,925,000-32,955,000
{
  "type": "AlignmentsTrack",
  "trackId": "na12878_read_depth",
  "name": "NA12878 depth (1000 Genomes, 30x)",
  "uri": "https://s3.amazonaws.com/1000genomes/1000G_2504_high_coverage/data/ERR3239334/NA12878.final.cram",
  "assemblyNames": ["hg38"],
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "encoding": { "y": { "axis": { "title": "Read depth" } } },
      "marks": [
        {
          "mark": "bar",
          "transform": [{ "type": "coverage" }],
          "encoding": { "color": { "value": "#c8d8ee" } }
        }
      ]
    }
  ]
}
```

Open the track at `chr20:32,925,000-32,955,000`.

<Figure src="/img/read_marks/depth.png" caption="An EFCAB8 intron in NA12878, the read depth as bars." />

## Plotting insert size as one point per read pair

A mark display draws one y axis. Depth runs in the tens and an insert size in
the thousands, so the insert goes on a second track over the same file. Its
`filter` keeps the leftmost mate, where the template length is positive, so each
pair counts once, and drops the few over 8 kb. On an alignments track `score` is
the mapping quality, which colors the points.

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "na12878_read_marks",
  "name": "NA12878 insert size (1000 Genomes, 30x)",
  "uri": "https://s3.amazonaws.com/1000genomes/1000G_2504_high_coverage/data/ERR3239334/NA12878.final.cram",
  "assemblyNames": ["hg38"],
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "encoding": { "y": { "axis": { "title": "Insert size (bp)" } } },
      "marks": [
        {
          "mark": "point",
          "transform": [
            {
              "type": "filter",
              "expr": "jexl:feature.template_length > 0 && feature.template_length < 8000"
            }
          ],
          "encoding": {
            "y": "template_length",
            "color": {
              "field": "score",
              "scale": {
                "type": "linear",
                "domainMin": 0,
                "domainMax": 60,
                "range": ["#bdbdbd", "#1f4e9a"]
              },
              "legend": { "title": "Mapping quality" }
            }
          }
        }
      ]
    }
  ]
}
```

Open it under the depth track in the same window.

<Figure src="/img/read_marks/insert_size.png" caption="The same window, depth as bars above and each pair's insert size as a point below." />

Each pair in the upper group straddles the missing 3.9 kb. Click a point to open
its read.

## Scanning chromosome 20 for clusters of long-insert pairs

Fetching every read of a chromosome overruns the track's size limit, so we cut
the long pairs out once, one row per pair, into a BED with a header naming its
columns.

<!-- from: scripts/build_read_marks.sh -->

```bash
# one row per pair with an insert over 1 kb, from the leftmost mate to the
# end of the insert, with the mapping quality in the score column
# -q 20 drops reads the aligner could not place; -F 0x904 drops unmapped,
#   secondary and supplementary records
# REF_PATH lets htslib fetch each reference sequence the CRAM names by MD5
export REF_PATH='https://www.ebi.ac.uk/ena/cram/md5/%s'
samtools view -q 20 -F 0x904 --input-fmt-option required_fields=0x1DF NA12878.final.cram chr20 |
  awk 'BEGIN { OFS = "\t"; print "#chrom", "chromStart", "chromEnd", "name", "score", "strand", "tlen" }
    $7 == "=" && $9 > 1000 { print $3, $4 - 1, $4 - 1 + $9, $1, $5, "+", $9 }' |
  bgzip > NA12878.chr20.discordant_pairs.bed.gz
tabix -p bed NA12878.chr20.discordant_pairs.bed.gz
```

The BED holds few enough rows to fetch whole at any zoom, and two tracks read
it:

- the point track's `filter` under 20 kb keeps the centromere's megabase inserts
  off the axis
- the count track's axis, pinned at 60, lets the centromere saturate so a
  deletion's few dozen pairs stand up

```json addtrack loc=chr20
{
  "type": "FeatureTrack",
  "trackId": "na12878_chr20_pairs",
  "name": "NA12878 chr20, pairs over 1 kb",
  "uri": "https://jbrowse.org/demos/read_marks/NA12878.chr20.discordant_pairs.bed.gz",
  "assemblyNames": ["hg38"],
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "encoding": { "y": { "axis": { "title": "Insert size (bp)" } } },
      "marks": [
        {
          "mark": "point",
          "transform": [
            { "type": "filter", "expr": "jexl:feature.tlen < 20000" }
          ],
          "encoding": {
            "y": "tlen",
            "color": {
              "field": "score",
              "scale": {
                "type": "linear",
                "domainMin": 0,
                "domainMax": 60,
                "range": ["#bdbdbd", "#1f4e9a"]
              },
              "legend": { "title": "Mapping quality" }
            }
          }
        }
      ]
    }
  ]
}
```

```json addtrack loc=chr20
{
  "type": "FeatureTrack",
  "trackId": "na12878_chr20_pair_counts",
  "name": "NA12878 chr20, pairs of 2 to 10 kb per bin",
  "uri": "https://jbrowse.org/demos/read_marks/NA12878.chr20.discordant_pairs.bed.gz",
  "assemblyNames": ["hg38"],
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "encoding": {
        "y": {
          "scale": { "domainMin": 0, "domainMax": 60 },
          "axis": { "title": "Pairs per bin" }
        }
      },
      "marks": [
        {
          "mark": "bar",
          "transform": [
            {
              "type": "filter",
              "expr": "jexl:feature.tlen > 2000 && feature.tlen < 10000"
            },
            { "type": "bin", "step": "auto" },
            { "type": "aggregate", "ops": [{ "op": "count" }] }
          ],
          "encoding": { "color": { "value": "#d62728" } }
        }
      ]
    }
  ]
}
```

In the counts track the `aggregate` step names no `groupby`, so it groups by the
edges the `bin` step above it wrote.

Open both tracks on the whole of `chr20`.

<Figure src="/img/read_marks/chromosome.png" caption="Chromosome 20: every pair with an insert under 20 kb as a point, and red bars counting the 2 to 10 kb pairs per bin." />

The bar at 34.2 Mb is a homozygous deletion, and the one at 32.9 Mb is the
_EFCAB8_ deletion.

## Reproduce it end to end

[`build_read_marks.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_read_marks.sh)
runs the commands above. The script:

1. Reads NA12878's CRAM from the 1000 Genomes release over HTTP, or the BAM or
   CRAM and FASTA you pass it.
2. Cuts every pair with a large insert into a BED, then bgzips and indexes it.
3. Downloads JBrowse and writes a `config.json` with the reads track and the BED
   track on the mark display.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_read_marks.sh
bash build_read_marks.sh                     # builds ./read_marks_build/jbrowse2
npx --yes serve read_marks_build/jbrowse2    # then open the printed URL
```

With no arguments the script builds the depth, insert-size and chromosome-scan
tracks over NA12878. Given your own reads,
`bash build_read_marks.sh reads.cram genome.fa` builds them over your file, and
`CHROM` picks the chromosome to scan.

## See also

- [](/docs/config_guides/mark_display)
- [](/docs/tutorials/methylation)
- [](/docs/tutorials/alu_age)
- [](/docs/tutorials/mappability_qc)
- [](/docs/tutorials/sv_multisamples)
- [](/docs/quickstart_web)

## Citations

- Byrska-Bishop et al. (2022).
  [High-coverage whole-genome sequencing of the expanded 1000 Genomes Project cohort including 602 trios](https://doi.org/10.1016/j.cell.2022.08.004),
  the reads and the structural-variant callset.
- Li et al. (2009).
  [The Sequence Alignment/Map format and SAMtools](https://doi.org/10.1093/bioinformatics/btp352),
  where the template length and mapping quality fields are defined.
