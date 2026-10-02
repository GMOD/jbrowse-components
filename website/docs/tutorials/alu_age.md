---
title: A grammar of graphics over a BED (RepeatMasker Alu age)
sidebar_label: Marks over a BED (Alu age)
description:
  Declare a BED column as the height of a bar and another as its colour, count
  features per bin zoomed out, and read a density sidecar past the fetch budget
guide_category: Tutorials
tutorial_category: Grammar of graphics
---

RepeatMasker's `milliDiv` column records each Alu copy's divergence from its
subfamily consensus, in tenths of a percent, and divergence grows with time, so
the column is an age. We plot it per copy, count copies per bin when zoomed out,
and ask where the young copies sit along chromosome 1. `LinearMarkDisplay` turns
the columns of a feature file into plots from a JSON `marks` list; it is
experimental, and its config shape may change.

## Prerequisites

- a JBrowse to open the figures' sessions in ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop))
- htslib (`bgzip`, `tabix`)
- [Node.js](https://nodejs.org/) and the [JBrowse CLI](/docs/cli), for
  `jbrowse make-density`
- `python3`, standard library only, for the per-megabase counts
- `bedGraphToBigWig` from the
  [UCSC utilities](https://hgdownload.soe.ucsc.edu/admin/exe/), which
  `make-density` runs

## Where the data comes from

UCSC's hg38 RepeatMasker table, rehosted by
[genomes.jbrowse.org's hg38](https://genomes.jbrowse.org/ucsc/hg38/) with the
Alu rows cut out:

- RepeatMasker, UCSC's `rmsk` table as BED with a column header:
  https://jbrowse.org/ucsc/hg38/rmsk.bed.gz
- the Alu rows the figures open, with `.tbi` and `.density.bw` beside it:
  https://jbrowse.org/demos/gene_density/Alu.bed.gz
- the per-megabase counts and shares, with `.tbi` beside it:
  https://jbrowse.org/code/jb2/main/test_data/alu_age/Alu.young_share.bed.gz
- reference lengths, for the sidecar's bigWig header:
  https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.chrom.sizes
- the sequence:
  https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.2bit

## Each copy's divergence at a locus

We'll load hg38, the assembly the RepeatMasker coordinates are on.

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

The track reads any BED-like file, bgzipped and tabix-indexed, with a `#` header
line naming the columns; a mark refers to a column by its name in that header.
The track below lists three marks. The first draws a `bar` per copy with
`milliDiv` as the height, below `maxBpPerPx`. Its `formula` step writes the
first four characters of the name into a `lineage` field (AluJ, then AluS, then
AluY, which is still inserting), and a categorical `domain` fixes the legend
order and colours. The adapter's `densityAdapter` names a density sidecar, built
in [Zooming out](#zooming-out).

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "alu_age",
  "name": "Alu copies",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.gz",
    "densityAdapter": {
      "type": "BigWigAdapter",
      "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.density.bw"
    }
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "marks": [
        {
          "mark": "bar",
          "transform": [
            {
              "type": "formula",
              "expr": "jexl:substring(feature.name, 0, 4)",
              "as": "lineage"
            }
          ],
          "encoding": {
            "y": "milliDiv",
            "color": {
              "field": "lineage",
              "scale": "categorical",
              "domain": ["AluJ", "AluS", "AluY", "FLAM", "FRAM"],
              "range": ["#4575b4", "#fdae61", "#d73027", "#8c8c8c", "#8c8c8c"],
              "title": "Alu lineage"
            }
          },
          "maxBpPerPx": 100
        },
        {
          "mark": "bar",
          "source": "density",
          "transform": [
            { "type": "bin", "step": "auto" },
            {
              "type": "aggregate",
              "groupby": ["start", "end"],
              "ops": [{ "op": "count" }]
            }
          ],
          "encoding": { "color": { "value": "#c0c0c0" } },
          "minBpPerPx": 100
        },
        {
          "mark": "bar",
          "transform": [
            {
              "type": "filter",
              "expr": "jexl:startsWith(feature.name, 'AluY')"
            },
            { "type": "bin", "step": "auto" },
            {
              "type": "aggregate",
              "groupby": ["start", "end"],
              "ops": [{ "op": "count" }]
            }
          ],
          "encoding": { "color": { "value": "#d73027" } },
          "minBpPerPx": 100
        }
      ]
    }
  ]
}
```

Open it on `chr1:151,000,000-151,030,000`, 30 kb of 1q21. Hover a bar for its
values; click it to open the row.

<Figure src="/img/alu_age/locus.png" caption="Alu copies over a window of 1q21, one bar per copy with its divergence from its consensus as the height and its lineage as the colour. The AluY bars are the shortest in the window and the AluJ bars the tallest, with AluS between; the fossil monomers are as tall as AluJ." />

## Zooming out

From `minBpPerPx` the other two marks take over. Each snaps copies to bins with
`{ "type": "bin", "step": "auto" }`, counts them with an `aggregate`, and draws
the count as a bar: one over every copy in grey, one over the AluY copies a
`filter` admits in red.

Zoomed out to a whole chromosome, the track would fetch more features than its
budget allows. The grey mark carries `"source": "density"`, so past the budget
it draws the bins of a density sidecar, a bigWig of feature starts per kilobase:

<!-- from: scripts/build_alu_age.sh -->

```bash
# writes Alu.bed.density.bw beside the input, in 1 kb bins
# --assembly reads the reference lengths off the FASTA's .fai;
#   --chrom-sizes takes a two-column name and length table instead
jbrowse make-density Alu.bed.gz --assembly hg38.fa
```

The track menu's **Density band** entry holds or forces the swap.

## The young share per megabase

The red AluY count is too thin to read against a total that swings several fold,
so a script writes the share per megabase as a BED with two log2 columns: the
AluY share against the genome-wide share, and, as the control, the plus-strand
share against a half.

Fetch the helper, then run it:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/alu_young_share.py
```

<!-- from: scripts/build_alu_age.sh -->

```bash
# columns: copies, young, plus, youngShare, youngLog2, strandLog2, one row per
# 1 Mb bin holding at least 50 copies; prints the rank correlation of each share
# against copies per bin
python3 alu_young_share.py Alu.bed.gz Alu.young_share.bed AluY
bgzip -f Alu.young_share.bed
tabix -f -p bed Alu.young_share.bed.gz
```

The track below plots the young share on a symmetric pinned axis, coloured by a
threshold at 0. **Edit plot...** in the track menu sets the same cut, colours
and key names on an open track.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "alu_young_share",
  "name": "AluY share per Mb, against the genome",
  "uri": "https://jbrowse.org/code/jb2/main/test_data/alu_age/Alu.young_share.bed.gz",
  "assemblyNames": ["hg38"],
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "scales": {
        "y": {
          "domainMin": -1.5,
          "domainMax": 1.5,
          "title": "AluY share, log2"
        }
      },
      "marks": [
        {
          "mark": "bar",
          "encoding": {
            "y": "youngLog2",
            "color": {
              "field": "youngLog2",
              "scale": "threshold",
              "domain": [0],
              "range": ["#4575b4", "#d73027"],
              "labels": ["below the genome-wide share", "above it"],
              "title": "AluY share"
            }
          }
        }
      ]
    }
  ]
}
```

<Figure src="/img/alu_age/young_share.png" caption="Top, chromosome 1 end to end: Alu copies from the density sidecar and the AluY share per megabase against the genome-wide share. Under the wedge, the same two tracks over a stretch where Alu-sparse megabases meet Alu-dense ones, with the copies now counted per bin in grey and AluY in red." links="Chromosome 1=alu_age/chromosome,The stretch under the wedge=alu_age/binned" />

Where Alu is sparse the young share runs red, and where it is dense it turns
blue.

## Correlation across the genome

The script prints the Spearman rank correlation of each share against copies per
megabase:

| share, per megabase | bins | Spearman rho |        p |
| ------------------- | ---: | -----------: | -------: |
| AluY share          | 2873 |       -0.688 | < 1e-300 |
| plus-strand share   | 2873 |        0.003 |     0.87 |

The young share falls as the copies rise, and the plus-strand control shows no
trend.[^perbin]

## Checking the bars against the file

Read the first figure's window out of the file, one line per lineage:

```bash
tabix https://jbrowse.org/demos/gene_density/Alu.bed.gz chr1:151,000,000-151,030,000 |
  awk -F'\t' '{ l = substr($4, 1, 4); n[l]++; s[l] += $12 }
    END { for (l in n) printf "%s\t%d copies\tmean milliDiv %.0f\n", l, n[l], s[l] / n[l] }'
```

| lineage | copies | mean milliDiv |
| ------- | -----: | ------------: |
| AluY    |      3 |            57 |
| AluS    |     30 |           100 |
| FLAM    |      4 |           140 |
| AluJ    |     12 |           150 |

Then count the copies in one red megabase and one blue one:

```bash
tabix https://jbrowse.org/demos/gene_density/Alu.bed.gz chr1:191,000,001-192,000,000 |
  awk -F'\t' '$2 >= 191000000 && $4 ~ /^Alu[JSY]/ { n++; y += ($4 ~ /^AluY/) }
    END { print n " copies, " y " AluY" }'
```

| megabase, chr1 | Alu copies | AluY |
| -------------- | ---------: | ---: |
| 191 to 192 Mb  |        161 |   55 |
| 203 to 204 Mb  |        690 |   47 |

The AluY count barely moves between the two megabases. The difference is the
older copies, which pile up in the dense one, so the young share is lower there
and its bar is blue: the share tracks where old Alu has accumulated.

## Reproduce it end to end

[`build_alu_age.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_alu_age.sh)
runs every step above:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_alu_age.sh
bash build_alu_age.sh                     # builds ./alu_age_build/jbrowse2
npx --yes serve alu_age_build/jbrowse2    # then open the printed URL
```

With no arguments it builds the tracks over UCSC's table.
`bash build_alu_age.sh rmsk.bed.gz genome.fa` builds them over your own
RepeatMasker BED, and `FAMILY` and `YOUNG` pick another family and its youngest
lineage.

## See also

- [](/docs/config_guides/mark_display)
- [](/docs/tutorials/gene_density)
- [](/docs/tutorials/repeatmasker_classes)
- [](/docs/quickstart_web)

## References

- Batzer MA, Deininger PL.
  [Alu repeats and human genomic diversity](https://doi.org/10.1038/nrg798).
  _Nature Reviews Genetics_ 3:370-379 (2002), the subfamily lineages and their
  ages.
- Lander et al. (2001).
  [Initial sequencing and analysis of the human genome](https://doi.org/10.1038/35057062),
  where the distribution of young against old Alu copies along the genome was
  first described.
- Smit, Hubley and Green (2013-2015).
  [RepeatMasker Open-4.0](https://www.repeatmasker.org)

[^perbin]:
    Insertions cluster, so the copies per megabase scatter several times more
    widely than independent copies would. A per-megabase test that assumed
    independence would flag most of the genome, so the page reports the
    genome-wide correlation.
