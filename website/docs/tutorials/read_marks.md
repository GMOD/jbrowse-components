---
title: A grammar of graphics over a BAM (NA12878 insert size)
sidebar_label: Marks over a BAM (insert size)
description:
  Declare a read's depth, insert size and mapping quality as the channels of a
  plot, with no variant caller in between, and scan a chromosome for a deletion
guide_category: Tutorials
tutorial_category: Grammar of graphics
---

A read pair that straddles a deletion maps with a long insert, and a
heterozygous deletion halves the read depth. We plot those two fields straight
from NA12878's reads to find a deletion on chromosome 20 without a variant
caller, scan the whole chromosome for the same signature, and check the hits
against the 1000 Genomes callset. The plots come from JBrowse's mark display, a
grammar of graphics over a track: each entry in `marks` names a mark type, a
`transform` list and an `encoding` from feature fields to channels, as in the
[Alu tutorial](/docs/tutorials/alu_age). The mark display is experimental, and
its config shape may change.

## Prerequisites

- a JBrowse to open the figures' sessions in ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop))
- [samtools](https://www.htslib.org/) and htslib (`bgzip`, `tabix`), for cutting
  the pairs out of the file and for checking a window by hand
- [bcftools](https://www.htslib.org/), for reading the callset at the end
- [Node.js](https://nodejs.org/) and the [JBrowse CLI](/docs/cli), for the build
  script

## Where the data comes from

1000 Genomes high-coverage release
([Byrska-Bishop et al. 2022](https://doi.org/10.1016/j.cell.2022.08.004)),
GRCh38:

- NA12878's 30x CRAM, index beside it:
  https://s3.amazonaws.com/1000genomes/1000G_2504_high_coverage/data/ERR3239334/NA12878.final.cram
- its chromosome 20 pairs with an insert over 1 kb, cut out below and rehosted:
  https://jbrowse.org/demos/read_marks/NA12878.chr20.discordant_pairs.bed.gz
- the release's structural-variant callset:
  https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20210124.SV_Illumina_Integration/1KGP_3202.gatksv_svtools_novelins.freeze_V3.wAF.vcf.gz
- UCSC's GRCh38 cytoband table, rehosted:
  https://jbrowse.org/genomes/GRCh38/cytoBand.txt
- a hosted config with the reference, RefSeq genes and the tracks below:
  https://jbrowse.org/demos/read_marks/config.json

## The genome

The CRAM decodes against the assembly the track is added to, so the assembly
must be the GRCh38 sequence the reads were aligned to. The cytoband table draws
each chromosome's banding in the view's overview.

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

## Depth as a coverage step

The window covers 30 kb of an _EFCAB8_ intron on chromosome 20, where the
callset says NA12878 carries one copy of a 3.9 kb deletion. A `bar` mark over a
`coverage` transform draws the reads as runs of constant depth.

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "na12878_read_depth",
  "name": "NA12878 depth (1000 Genomes, 30x)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "CramAdapter",
    "uri": "https://s3.amazonaws.com/1000genomes/1000G_2504_high_coverage/data/ERR3239334/NA12878.final.cram"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "scales": { "y": { "title": "Read depth" } },
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

<Figure src="/img/read_marks/depth.png" caption="Thirty kilobases of an EFCAB8 intron in NA12878, the read depth as bars. Between 32,937,500 and 32,941,500 the depth runs at about half of what it is on either side." />

## Insert size as a point per pair

A mark display draws one y axis. Depth runs in the tens and an insert size in
the thousands, so the insert goes on a second track over the same file:

- a `point` mark plots `template_length` per pair
- a `filter` keeps the leftmost mate, where the template length is positive, so
  each pair counts once, and drops the few over 8 kb
- the colour is mapping quality on a ramp pinned to 0 to 60

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "na12878_read_marks",
  "name": "NA12878 insert size (1000 Genomes, 30x)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "CramAdapter",
    "uri": "https://s3.amazonaws.com/1000genomes/1000G_2504_high_coverage/data/ERR3239334/NA12878.final.cram"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "scales": { "y": { "title": "Insert size (bp)" } },
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
              "scale": "linear",
              "domainMin": 0,
              "domainMax": 60,
              "range": ["#bdbdbd", "#1f4e9a"],
              "title": "Mapping quality"
            }
          }
        }
      ]
    }
  ]
}
```

Open it under the depth track, on the same window.

<Figure src="/img/read_marks/insert_size.png" caption="The same window, the depth as bars above and each pair's insert size as a point below, each track with a separate y axis. The pairs sit in a low band, and over the left edge of the dip a second group appears well above it, in the full blue of a mapping quality of 60." />

Each pair in the upper group straddles the missing 3.9 kb. On an alignments
track `score` is the mapping quality. Hover a point for its values, or click it
to open the read.

## Which reads carry the long inserts

A `span` mark over a `pileup` transform stacks the reads. A `formula` step
writes the unsigned insert as `insert`, so both mates of a pair take one colour,
and a ramp pinned at 5 kb paints a spanning pair red.

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "na12878_read_pileup",
  "name": "NA12878 reads (1000 Genomes, 30x)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "CramAdapter",
    "uri": "https://s3.amazonaws.com/1000genomes/1000G_2504_high_coverage/data/ERR3239334/NA12878.final.cram"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "marks": [
        {
          "mark": "span",
          "transform": [
            {
              "type": "formula",
              "expr": "jexl:abs(feature.template_length)",
              "as": "insert"
            },
            { "type": "pileup" }
          ],
          "encoding": {
            "row": "row",
            "color": {
              "field": "insert",
              "scale": "linear",
              "domainMin": 0,
              "domainMax": 5000,
              "range": ["#c8d8ee", "#d62728"],
              "title": "Insert size (bp)"
            }
          }
        }
      ]
    }
  ]
}
```

Open the track at the left edge of the dip, `chr20:32,936,200-32,939,200`.

<Figure src="/img/read_marks/pileup.png" caption="The left breakpoint at 3 kb, the reads stacked and coloured by their pair's insert. The red reads end together at 32,937,680, where their mates lie across the deletion to the right; the pale reads run across it, and thin out on the far side." />

An unpinned ramp spans the values on screen, so in a window with no spanning
pair it would paint the longest ordinary insert red. Pinning `domainMin` and
`domainMax` keeps red for the long inserts.

## Scanning the chromosome for the same signature

Fetching every read of a chromosome overruns the byte budget, so cut the long
pairs out once, one row per pair, into a BED with a header naming its columns.

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

The BED holds few enough rows to fetch whole at any zoom. Two tracks read it:

- a `point` per pair at the middle of its insert, `tlen` on y, coloured by
  `score`; a `filter` under 20 kb keeps the centromere's megabase inserts off
  the axis
- a `bar` per bin counting pairs of 2 to 10 kb, on an axis pinned at 60 so the
  centromere saturates and a deletion's few dozen pairs stand up

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "na12878_chr20_pairs",
  "name": "NA12878 chr20, pairs over 1 kb",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/read_marks/NA12878.chr20.discordant_pairs.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "scales": { "y": { "title": "Insert size (bp)" } },
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
              "scale": "linear",
              "domainMin": 0,
              "domainMax": 60,
              "range": ["#bdbdbd", "#1f4e9a"],
              "title": "Mapping quality"
            }
          }
        }
      ]
    }
  ]
}
```

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "na12878_chr20_pair_counts",
  "name": "NA12878 chr20, pairs of 2 to 10 kb per bin",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/read_marks/NA12878.chr20.discordant_pairs.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "scales": {
        "y": { "domainMin": 0, "domainMax": 60, "title": "Pairs per bin" }
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

<Figure src="/img/read_marks/chromosome.png" caption="Chromosome 20 end to end. Every pair with an insert under 20 kb is a point at its insert size, and the red bars on the track under it count the pairs between 2 and 10 kb per bin. The centromere, pinched in the banding above the ruler, and the repeats flanking it saturate both; outside them the bars rise in a handful of places, each under a short stack of dark points." />

The bar at 34.2 Mb is a homozygous deletion, and the one at 32.9 Mb is the
_EFCAB8_ intron above.

## Checking the bars against the callset

`bcftools` lists every deletion over 2 kb that the callset gives NA12878 on the
chromosome:

<!-- from: scripts/build_read_marks.sh -->

```bash
# -s keeps one sample's genotypes; -i then keeps the rows where that sample
#   carries the allele
bcftools view -s NA12878 1KGP_3202.gatksv_svtools_novelins.freeze_V3.wAF.vcf.gz chr20 |
  bcftools query -i 'GT="alt" && INFO/SVTYPE="DEL" && INFO/SVLEN<-2000' \
    -f '%CHROM\t%POS\t%END\t%INFO/SVLEN\t[%GT]\t%INFO/AF\t%INFO/EVIDENCE\n'
```

Pairs of 2 to 10 kb in the 100 kb window around each call:

| position, chr20 |    size | genotype | pairs 2 to 10 kb in the window |
| --------------- | ------: | -------- | -----------------------------: |
| 1.58 Mb         | 33.1 kb | 0/1      |                   not in range |
| 32.94 Mb        |  3.9 kb | 0/1      |                             18 |
| 34.23 Mb        |  3.3 kb | 1/1      |                             46 |
| 43.64 Mb        |  2.7 kb | 0/1      |                             10 |
| 43.85 Mb        |  2.6 kb | 0/1      |                             25 |
| 52.14 Mb        |  2.1 kb | 1/1      |                             32 |
| 54.03 Mb        | 10.9 kb | 0/1      |                   not in range |
| 55.86 Mb        |  6.0 kb | 0/1      |                             16 |

Every callset deletion in range is a bar, and the two homozygous ones are
tallest. Other windows hold ten or more such pairs with no call: the chromosome
start and 1.4, 2.8, 32.7 and 48.5 Mb.

To check the _EFCAB8_ deletion against the reads, compare the depth inside the
call with the depth beside it, and count the long pairs around it:

```bash
samtools coverage -r chr20:32937680-32941583 NA12878.final.cram | cut -f 1-3,7
samtools coverage -r chr20:32930000-32937000 NA12878.final.cram | cut -f 1-3,7
samtools view -q 20 NA12878.final.cram chr20:32935000-32944000 |
  awk '{ t = $9 < 0 ? -$9 : $9; if (t > 2000) big++; else if (t > 0) norm++ }
    END { print norm " pairs at the library insert, " big " over 2 kb" }'
```

| window                      | mean depth |
| --------------------------- | ---------: |
| chr20:32,937,680-32,941,583 |      15.6x |
| chr20:32,930,000-32,937,000 |      34.1x |

Around the call, almost every pair sits at the library insert, and a few dozen
exceed 2 kb.

## Reproduce it end to end

[`build_read_marks.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_read_marks.sh)
runs the commands above:

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
- [](/docs/tutorials/methylation#declaring-the-split-in-a-config)
- [](/docs/tutorials/alu_age)
- [](/docs/tutorials/mappability_qc)
- [](/docs/tutorials/sv_multisamples)
- [](/docs/quickstart_web)

## References

- Byrska-Bishop M, et al.
  [High-coverage whole-genome sequencing of the expanded 1000 Genomes Project cohort including 602 trios](https://doi.org/10.1016/j.cell.2022.08.004).
  _Cell_ 185:3426-3440 (2022), the reads and the structural-variant callset.
- Li H, et al.
  [The Sequence Alignment/Map format and SAMtools](https://doi.org/10.1093/bioinformatics/btp352).
  _Bioinformatics_ 25:2078-2079 (2009), where the template length and mapping
  quality fields are defined.
