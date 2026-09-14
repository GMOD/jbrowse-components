---
title: Transposon age from a scored BED (RepeatMasker Alu)
sidebar_label: Transposon age (RepeatMasker Alu)
description:
  Plot a numeric column of a BED as a bar per feature coloured by another
  column, count the features per bin zoomed out, read a features-per-bin sidecar
  past the fetch budget, and test whether the youngest Alu copies follow the
  family's density
guide_category: Tutorials
tutorial_category: Configuration & embedding
---

We look at how old each Alu copy on human chromosome 1 is and where the young
ones sit. RepeatMasker writes each copy's divergence from its subfamily
consensus into a column of its annotation, and divergence accumulates with time,
so the column is an age. One track plots that column as a bar per copy coloured
by subfamily, counts the copies per bin once the view is too wide to show them,
and draws a features-per-bin sidecar where the chromosome is too wide to fetch.
A per-megabase count of the young copies then asks whether they follow the
family's density, with a strand split beside it as the control. Every track is a
mark display: a numeric column of any feature file becomes a plot with a JSON
entry and no code.

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

The figures read UCSC's hg38 RepeatMasker table, rehosted on jbrowse.org with
the Alu rows cut out, a density sidecar beside them, and the per-megabase counts
built from those rows.

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

Alu is the commonest repeat in the human genome, a million-odd copies of a ~300
bp element that spread in waves: the AluJ subfamilies first, then AluS, then
AluY, which is still inserting. RepeatMasker names each copy by the subfamily
consensus it matches best and, in its `milliDiv` column, records how far the
copy has drifted from that consensus, in tenths of a percent. Copies accumulate
mutations at about the neutral rate once they land, so a copy's divergence is
its age, and the subfamily name is a second, coarser reading of the same thing.

What the track below needs from any file, not just repeats, is:

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

`maxBpPerPx` is the last key: the mark draws only while the view is narrower
than that many base pairs per pixel, and the next section covers what happens
once it isn't. Hovering a bar reads out its value and its lineage, and clicking
one opens the row.

## Zooming out: copies per bin

Ten megabases of the same arm holds thousands of copies, and a bar per copy is a
pixel or less wide. A second mark takes over at that width. Its `transform`
snaps each copy to a bin, then folds each bin's copies into one feature carrying
their count, and its `encoding` plots that count. `"step": "auto"` picks the bin
width from the zoom, so the bars stay a few pixels wide however far you zoom
out, and `minBpPerPx` hands the view over from the first mark at exactly the
width where that one switches off.

The question the first figure raised, where the young copies sit, starts as a
third mark: the same bin and count, over only the copies a `filter` step admits,
drawn over the total in AluY's colour.

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

The AluY count is a thin red strip under a grey total that swings by several
fold, and whether the strip follows the swings is not something an eye can
settle from two counts on one axis. The share of copies that are young can, and
the next two sections build it.

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

A track with a sidecar carries a **Density band** entry in its track menu, with
**Automatic**, **Features only** and **Density only**, so the swap can be held
or forced by hand.

## The young share per megabase

The share is a ratio of two counts, and the sidecar only carries one of them, so
a short script computes it for the whole genome: per megabase, the copies of the
three Alu lineages, the AluY copies among them, and the copies on the plus
strand. It writes them as a BED, one row per megabase, with two log2 columns:
the megabase's young share against the genome-wide young share, and its
plus-strand share against a half. The strand split is the control. Nothing about
where Alu is dense should tilt which strand a copy landed on, so that column
ought to come out flat wherever the young share does not.

<!-- from: scripts/build_alu_age.sh -->

```bash
# columns: copies, young, plus, youngShare, youngLog2, strandLog2, one row per
# 1 Mb bin holding at least 50 copies; prints the rank correlation of each share
# against copies per bin
python3 alu_young_share.py Alu.bed.gz Alu.young_share.bed AluY
bgzip -f Alu.young_share.bed
tabix -f -p bed Alu.young_share.bed.gz
```

Each column is one mark track over that file. The bar grows from zero, so
`youngLog2` above the axis is a megabase richer in young copies than the genome
and below it one poorer, and a jexl colour paints the two directions apart. Both
tracks pin the same `domain`, so the strand lane's flatness reads against the
young share's swing on one scale.

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
      "marks": [
        {
          "shape": "bar",
          "encoding": {
            "y": { "field": "youngLog2", "domain": ["-1.5", "1.5"] },
            "color": "jexl:feature.youngLog2 > 0 ? '#d73027' : '#4575b4'"
          }
        }
      ]
    }
  ]
}
```

The strand track is the same config with `strandLog2` in both places.

<Figure src="/img/alu_age/young_share.png" caption="Top, chromosome 1 end to end: Alu copies from the density sidecar, the AluY share per megabase against the genome-wide share, and the plus-strand share against a half. Under the wedge, the same three tracks over a stretch where Alu-sparse megabases meet Alu-dense ones, with the copies now counted per bin in grey and AluY in red." links="Chromosome 1=alu_age/chromosome,The stretch under the wedge=alu_age/binned" />

Where the grey is low the young share runs red, and where the grey piles up it
turns blue; under the wedge the switch happens where the Alu-sparse megabases
give way to the dense ones. The strand lane stays level across both. Older Alu
copies are known to concentrate in GC-rich, gene-rich DNA, and the youngest have
had the least time to.

## Is the pattern more than noise

One megabase's young share can swing by chance, so no single bar is the test.
The test is the trend across every megabase of the genome, which
`alu_young_share.py` prints as a Spearman rank correlation between each share
and the copies per megabase:

| share, per megabase | bins | Spearman rho |        p |
| ------------------- | ---: | -----------: | -------: |
| AluY share          | 2873 |       -0.688 | < 1e-300 |
| plus-strand share   | 2873 |        0.003 |     0.87 |

The young share falls as the copies rise, across the genome and not only on the
arm in the figure, and the control split shows no trend at all over the same
bins.[^perbin]

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

The share bars under the wedge are counts of the same rows, so count one red
megabase and one blue one straight out of the Alu file, keeping the copies that
start inside it:

```bash
tabix https://jbrowse.org/demos/gene_density/Alu.bed.gz chr1:191,000,001-192,000,000 |
  awk -F'\t' '$2 >= 191000000 && $4 ~ /^Alu[JSY]/ { n++; y += ($4 ~ /^AluY/) }
    END { print n " copies, " y " AluY" }'
```

| megabase, chr1 | Alu copies | AluY |
| -------------- | ---------: | ---: |
| 191 to 192 Mb  |        161 |   55 |
| 203 to 204 Mb  |        690 |   47 |

The dense megabase holds several times the copies and still fewer AluY copies,
which is the blue bar.

## Reproduce it end to end

Every step above is wrapped in one script,
[`build_alu_age.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_alu_age.sh):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_alu_age.sh
bash build_alu_age.sh                     # builds ./alu_age_build/jbrowse2
npx --yes serve alu_age_build/jbrowse2    # then open the printed URL
```

With no arguments it fetches UCSC's hg38 RepeatMasker table, cuts the Alu rows
out of it, indexes them, builds the sidecar and the per-megabase shares, prints
the two correlations, and writes a JBrowse with the tracks above. Given your own
RepeatMasker BED and the FASTA it was masked against,
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

[^perbin]:
    The page does not call individual megabases significant. Insertions cluster,
    so the copies per megabase scatter several times more widely than
    independent copies would, and a per-megabase test that assumed independence
    would flag most of the genome.
