---
title: Transposon age from a scored BED (RepeatMasker Alu)
sidebar_label: Transposon age (RepeatMasker Alu)
description:
  Plot a numeric column of a BED as a bar per feature coloured by another
  column, count the features per bin zoomed out, and read a features-per-bin
  sidecar past the fetch budget, over the divergence of every Alu copy on a
  chromosome
guide_category: Tutorials
tutorial_category: Configuration & embedding
data: hosted
---

**TL;DR:** we look at how old each Alu copy on human chromosome 1 is and where
the young ones sit. RepeatMasker writes each copy's divergence from its
subfamily consensus into a column of its annotation, and divergence accumulates
with time, so the column is an age. One track plots that column as a bar per
copy coloured by subfamily, counts the copies per bin once the view is too wide
to show them, and draws a features-per-bin sidecar where the chromosome is too
wide to fetch. The track is a mark display: a numeric column of any feature file
becomes a plot with a JSON entry and no code, and the counting runs in the
browser.

## Prerequisites

- a JBrowse to open the figures' sessions in ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop)); every file here is a URL, so nothing
  needs hosting to read along
- htslib (`bgzip`, `tabix`), for the check at the end and for preparing your own
  file
- [Node.js](https://nodejs.org/) and the [JBrowse CLI](/docs/cli), for
  `jbrowse make-density`
- `bedGraphToBigWig` from the
  [UCSC utilities](https://hgdownload.soe.ucsc.edu/admin/exe/), which
  `make-density` runs

## Where the data comes from

The figures read UCSC's hg38 RepeatMasker table, rehosted on jbrowse.org with
the Alu rows cut out and a density sidecar beside them.

- RepeatMasker, UCSC's `rmsk` table as BED with a column header:
  https://jbrowse.org/ucsc/hg38/rmsk.bed.gz
- the Alu rows the figures open, with `.tbi` and `.density.bw` beside it:
  https://jbrowse.org/demos/gene_density/Alu.bed.gz
- reference lengths, for the sidecar's bigWig header:
  https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.chrom.sizes
- the sequence:
  https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.2bit

## A column that is an age

Alu is the commonest repeat in the human genome, a million-odd copies of a ~300
bp element that spread in waves: the AluJ subfamilies first, then AluS, then
AluY, which is still inserting. RepeatMasker names each copy by the subfamily
consensus it matches best and, in its `milliDiv` column, records how far the
copy has drifted from that consensus, in tenths of a percent. Copies accumulate
mutations at about the neutral rate once they land, so a copy's divergence is
its age, and the subfamily name is a second, coarser reading of the same thing.

Nothing about the file is specific to repeats. What the track below needs from
any file is:

- BED-like rows, bgzipped and tabix-indexed ([quickstart](/docs/quickstart_web)
  covers the prep)
- a `#` header line naming the columns, so `milliDiv` is a field name and not
  "column twelve"
- a numeric column to plot, and optionally a second column to colour by

## Each copy's divergence at a locus

The track is a `FeatureTrack` over the BED whose display is a
`LinearMarkDisplay` with one mark: a `bar` per feature, `milliDiv` on the
y-axis. The colour is a categorical scale over the lineage, which the file does
not carry as a column: a `formula` step in the mark's `transform` list writes
the first four characters of the name into a `lineage` field, so `AluSx1` and
`AluSz6` both read `AluS`. Listing the three lineages in `domain` fixes their
legend order and their colours; FLAM and FRAM, the fossil monomers Alu descends
from, get a grey.

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

Open it on a few tens of kilobases of 1q21. Each bar is one copy, its width the
copy's extent and its height the divergence, and the legend is the colour scale
read back.

<Figure src="/img/alu_age/locus.png" caption="Alu copies over a window of 1q21, one bar per copy with its divergence from its consensus as the height and its lineage as the colour. The AluY bars are the shortest in the window and the AluJ bars the tallest, with AluS between; the fossil monomers stand with AluJ." />

The name and the divergence are two columns, the colour reads one and the height
the other, and each colour groups by height.

`maxBpPerPx` is the last key, and the next step is what it is for: the mark
draws only while the view is narrower than that many base pairs per pixel.
Hovering a bar reads out its value and its lineage, and clicking one opens the
row.

## Zooming out: copies per bin

Ten megabases of the same arm holds thousands of copies, and a bar per copy is a
pixel or less wide. A second mark takes over at that width. Its `transform`
snaps each copy to a bin, then folds each bin's copies into one feature carrying
their count, and its `encoding` plots that count. `"step": "auto"` picks the bin
width from the zoom, so the bars stay a few pixels wide however far you zoom
out, and `minBpPerPx` hands the view over from the first mark at exactly the
width where that one switches off.

The question the first figure raised, where the young copies sit, is a third
mark: the same bin and count, over only the copies a `filter` step admits, drawn
over the total in AluY's colour.

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

The three marks share one fetch per region and one y-axis. At a given zoom only
the marks in range draw, so the axis reads divergence zoomed in and counts
zoomed out, and the legend is gone at the wide zoom because the marks drawing
there have constant colours.

<Figure src="/img/alu_age/binned.png" caption="Ten megabases of 1q21 to 1q23, the Alu copies per bin in grey with the AluY copies per bin over them in red. The grey rises and falls by several fold across the window; the red band under it stays close to level." />

Alu copies pile up in the gene-rich, GC-rich stretches of the arm, and the grey
follows them. The red does not, so the young copies sit more evenly along the
arm than the old ones.

## The whole chromosome: past the fetch budget

Zoom out to all of chromosome 1 and the fetch is over budget: the track would
have to download every row to count them, and a feature track stops at the
estimate and shows a banner. A density sidecar is the way through, a bigWig of
feature starts per kilobase that `jbrowse make-density` writes beside the file,
once:

<!-- from: scripts/build_alu_age.sh -->

```bash
# writes Alu.bed.density.bw beside the input, in 1 kb bins
# --assembly reads the reference lengths off the FASTA's .fai;
#   --chrom-sizes takes a two-column name and length table instead
jbrowse make-density Alu.bed.gz --assembly hg38.fa
```

Two additions attach it. The adapter gains a `densityAdapter` over the sidecar,
and the count mark gains `"source": "density"`: past the budget that mark draws
the sidecar's bins in place of the count it can no longer compute, over the same
axis and with the same hover. The AluY mark has no sidecar and draws nothing
there.

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

<Figure src="/img/alu_age/chromosome.png" caption="Chromosome 1 end to end. The count mark draws the sidecar's bins, and the chip in the corner says so; the gap is the centromere, and the AluY mark is off." />

A track with a sidecar carries a **Density band** entry in its track menu, with
**Automatic**, **Features only** and **Density only**, so the swap can be held
or forced by hand.

## Checking the bars against the rows

The first figure is a claim about a window, so read the same window out of the
file. `tabix` returns the rows, and the name's first four characters and the
`milliDiv` column are what the track drew:

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

The lineages order by mean divergence the way their bars ordered by height, and
the fossil monomers sit with the oldest Alu lineage.

The second figure's claim is that the red band is flatter than the grey, so take
a megabase under a grey peak and one under a trough and count both:

```bash
tabix https://jbrowse.org/demos/gene_density/Alu.bed.gz chr1:154,000,000-155,000,000 | wc -l
tabix https://jbrowse.org/demos/gene_density/Alu.bed.gz chr1:154,000,000-155,000,000 | awk -F'\t' '$4 ~ /^AluY/' | wc -l
```

| window, chr1  | all Alu | AluY |
| ------------- | ------: | ---: |
| 154 to 155 Mb |     986 |   94 |
| 157 to 158 Mb |     237 |   35 |

The total falls by about four fold between the two windows and the AluY count by
less than three, so the AluY band is the flatter of the two.

## Reproduce it end to end

Every step above is wrapped in one script,
[`build_alu_age.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_alu_age.sh):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_alu_age.sh
bash build_alu_age.sh                     # builds ./alu_age_build/jbrowse2
npx --yes serve alu_age_build/jbrowse2    # then open the printed URL
```

With no arguments it fetches UCSC's hg38 RepeatMasker table, cuts the Alu rows
out of it, indexes them, builds the sidecar and writes a JBrowse with the track
above. Given your own RepeatMasker BED and the FASTA it was masked against,
`bash build_alu_age.sh rmsk.bed.gz genome.fa`, it builds the same track over
your file; `FAMILY` and `YOUNG` in the environment pick another family and its
youngest lineage. The tools it needs are the ones under
[Prerequisites](#prerequisites).

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
