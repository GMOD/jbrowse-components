---
title: A grammar of graphics over a BED (RepeatMasker Alu age)
sidebar_label: Marks over a BED (Alu age)
description:
  Declare a BED column as the height of a bar and another as its colour, count
  features per bin zoomed out, and read a density sidecar past the fetch budget
guide_category: Tutorials
tutorial_category: Grammar of graphics
---

`LinearMarkDisplay` is a grammar of graphics over a track: each entry in `marks`
names a shape, a `transform` list and an `encoding` from feature fields to
channels, so a numeric column of any feature file becomes a plot with a JSON
entry and no code. Here the file is RepeatMasker's Alu rows, whose divergence
column is an age, and the plots ask where the young copies sit. The mark display
is experimental, and its config shape may change.

## Prerequisites

- a JBrowse to open the figures' sessions in ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop)); every file here is a URL, so nothing
  needs hosting to read along
- htslib (`bgzip`, `tabix`), for the check at the end and for preparing your own
  file
- [Node.js](https://nodejs.org/) and the [JBrowse CLI](/docs/cli), for
  `jbrowse make-density`
- `python3`, standard library only, for the per-megabase counts
- `bedGraphToBigWig` from the
  [UCSC utilities](https://hgdownload.soe.ucsc.edu/admin/exe/), which
  `make-density` runs

## Where the data comes from

UCSC's hg38 RepeatMasker table, rehosted with the Alu rows cut out:

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

## A column that is an age

RepeatMasker's `milliDiv` column is a copy's divergence from its subfamily
consensus in tenths of a percent, which grows with time, so it is an age. The
subfamily name (AluJ, then AluS, then AluY, still inserting) is a coarser
reading of the same thing. Any file works given BED-like rows, bgzipped and
tabix-indexed, with a `#` header naming the columns.

## Each copy's divergence at a locus

A `bar` per feature with `milliDiv` on y. A `formula` step writes the name's
first four characters into a `lineage` field, and a categorical `domain` fixes
the legend order and colours.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "alu_age",
  "name": "Alu copies",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "alu_age-LinearMarkDisplay",
      "marks": [
        {
          "shape": "bar",
          "transform": [
            {
              "type": "formula",
              "expr": "jexl:substring(feature.name, 0, 4)",
              "as": ["lineage"]
            }
          ],
          "encoding": {
            "y": "milliDiv",
            "color": {
              "field": "lineage",
              "scale": "categorical",
              "domain": ["AluJ", "AluS", "AluY", "FLAM", "FRAM"],
              "palette": ["#4575b4", "#fdae61", "#d73027", "#8c8c8c", "#8c8c8c"]
            }
          },
          "maxBpPerPx": 100
        }
      ]
    }
  ]
}
```

Open it on a few tens of kilobases of 1q21.

<Figure src="/img/alu_age/locus.png" caption="Alu copies over a window of 1q21, one bar per copy with its divergence from its consensus as the height and its lineage as the colour. The AluY bars are the shortest in the window and the AluJ bars the tallest, with AluS between; the fossil monomers are as tall as AluJ." />

`maxBpPerPx` stops the mark drawing once the view is wider than that. Hover a
bar for its values; click it to open the row.

## Zooming out: copies per bin

Zoomed out a bar per copy is under a pixel wide, so a second mark takes over at
`minBpPerPx`: a `bin` step with `"step": "auto"` snaps each copy to a bin, an
`aggregate` counts them, and the bar plots the count. A third mark does the same
over the copies a `filter` admits, in AluY's colour.

```json
"marks": [
  {
    "shape": "bar",
    "transform": [
      { "type": "formula", "expr": "jexl:substring(feature.name, 0, 4)", "as": ["lineage"] }
    ],
    "encoding": {
      "y": "milliDiv",
      "color": { "field": "lineage", "scale": "categorical" }
    },
    "maxBpPerPx": 100
  },
  {
    "shape": "bar",
    "transform": [
      { "type": "bin", "step": "auto" },
      { "type": "aggregate", "groupby": ["start", "end"], "ops": [{ "op": "count" }] }
    ],
    "encoding": { "y": "count", "color": "#c0c0c0" },
    "minBpPerPx": 100
  },
  {
    "shape": "bar",
    "transform": [
      { "type": "filter", "expr": "jexl:startsWith(feature.name, 'AluY')" },
      { "type": "bin", "step": "auto" },
      { "type": "aggregate", "groupby": ["start", "end"], "ops": [{ "op": "count" }] }
    ],
    "encoding": { "y": "count", "color": "#d73027" },
    "minBpPerPx": 100
  }
]
```

The three marks share one fetch and one y-axis; only the marks in range draw.
The AluY strip is too thin to read against a total that swings several fold, so
the next sections plot the share instead.

## The whole chromosome: past the fetch budget

Zoomed to the whole chromosome the fetch is over budget. A density sidecar, a
bigWig of feature starts per kilobase, takes over:

<!-- from: scripts/build_alu_age.sh -->

```bash
# writes Alu.bed.density.bw beside the input, in 1 kb bins
# --assembly reads the reference lengths off the FASTA's .fai;
#   --chrom-sizes takes a two-column name and length table instead
jbrowse make-density Alu.bed.gz --assembly hg38.fa
```

The adapter gains a `densityAdapter` and the count mark gains
`"source": "density"`, so past the budget it draws the sidecar's bins instead.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "alu_age",
  "name": "Alu copies",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "bedGzLocation": {
      "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.gz"
    },
    "index": {
      "location": {
        "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.gz.tbi"
      }
    },
    "densityAdapter": {
      "type": "BigWigAdapter",
      "bigWigLocation": {
        "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.density.bw"
      }
    }
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "alu_age-LinearMarkDisplay",
      "marks": [
        {
          "shape": "bar",
          "transform": [
            {
              "type": "formula",
              "expr": "jexl:substring(feature.name, 0, 4)",
              "as": ["lineage"]
            }
          ],
          "encoding": {
            "y": "milliDiv",
            "color": {
              "field": "lineage",
              "scale": "categorical",
              "domain": ["AluJ", "AluS", "AluY", "FLAM", "FRAM"],
              "palette": ["#4575b4", "#fdae61", "#d73027", "#8c8c8c", "#8c8c8c"]
            }
          },
          "maxBpPerPx": 100
        },
        {
          "shape": "bar",
          "source": "density",
          "transform": [
            { "type": "bin", "step": "auto" },
            {
              "type": "aggregate",
              "groupby": ["start", "end"],
              "ops": [{ "op": "count" }]
            }
          ],
          "encoding": { "y": "count", "color": "#c0c0c0" },
          "minBpPerPx": 100
        },
        {
          "shape": "bar",
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
          "encoding": { "y": "count", "color": "#d73027" },
          "minBpPerPx": 100
        }
      ]
    }
  ]
}
```

The track menu's **Density band** entry holds or forces the swap.

## The young share per megabase

A script computes the share per megabase and writes it as a BED with two log2
columns: the young share against the genome-wide share, and the plus-strand
share against a half, as the control.

<!-- from: scripts/build_alu_age.sh -->

```bash
# columns: copies, young, plus, youngShare, youngLog2, strandLog2, one row per
# 1 Mb bin holding at least 50 copies; prints the rank correlation of each share
# against copies per bin
python3 alu_young_share.py Alu.bed.gz Alu.young_share.bed AluY
bgzip -f Alu.young_share.bed
tabix -f -p bed Alu.young_share.bed.gz
```

Each column is one mark track. A jexl colour paints the two directions apart,
and both tracks pin the same `scales.y`, so the strand lane's flatness reads
against the young share's swing.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "alu_young_share",
  "name": "AluY share per Mb, against the genome",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/code/jb2/main/test_data/alu_age/Alu.young_share.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "alu_young_share-LinearMarkDisplay",
      "scales": { "y": { "domainMin": -1.5, "domainMax": 1.5 } },
      "marks": [
        {
          "shape": "bar",
          "encoding": {
            "y": "youngLog2",
            "color": "jexl:feature.youngLog2 > 0 ? '#d73027' : '#4575b4'"
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

## Is the pattern more than noise

The script prints the Spearman rank correlation of each share against copies per
megabase, across the genome:

| share, per megabase | bins | Spearman rho |        p |
| ------------------- | ---: | -----------: | -------: |
| AluY share          | 2873 |       -0.688 | < 1e-300 |
| plus-strand share   | 2873 |        0.003 |     0.87 |

The young share falls as the copies rise, and the control shows no
trend.[^perbin]

## Checking the bars against the rows

Read the first figure's window out of the file:

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

And count one red megabase and one blue one:

```bash
tabix https://jbrowse.org/demos/gene_density/Alu.bed.gz chr1:191,000,001-192,000,000 |
  awk -F'\t' '$2 >= 191000000 && $4 ~ /^Alu[JSY]/ { n++; y += ($4 ~ /^AluY/) }
    END { print n " copies, " y " AluY" }'
```

| megabase, chr1 | Alu copies | AluY |
| -------------- | ---------: | ---: |
| 191 to 192 Mb  |        161 |   55 |
| 203 to 204 Mb  |        690 |   47 |

The dense megabase holds several times the copies and fewer AluY, so its young
share is lower and its bar is blue.

## Reproduce it end to end

Every step above is wrapped in one script,
[`build_alu_age.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_alu_age.sh):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_alu_age.sh
bash build_alu_age.sh                     # builds ./alu_age_build/jbrowse2
npx --yes serve alu_age_build/jbrowse2    # then open the printed URL
```

With no arguments it builds the tracks above over UCSC's table. Given your own
RepeatMasker BED, `bash build_alu_age.sh rmsk.bed.gz genome.fa` builds them over
your file, and `FAMILY` and `YOUNG` pick another family and its youngest
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
    The page does not call individual megabases significant. Insertions cluster,
    so the copies per megabase scatter several times more widely than
    independent copies would, and a per-megabase test that assumed independence
    would flag most of the genome.
