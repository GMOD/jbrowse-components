---
title: Mark display examples
description:
  One `marks` config per idea, each over a hosted file with the picture it draws
  and a link to open it live
guide_category: Track types
---

Each section below is one complete track config for `LinearMarkDisplay`, the
picture it draws over a hosted file, and a link that opens the same view live.
The first ten read one file, UCSC's RepeatMasker Alu rows for hg38, whose
`milliDiv` column is a copy's divergence from its consensus; the rest read a BED
of read pairs, a set of copy-number BigWigs and two PAF files of genome
alignments. Copy the config whose shape matches your file and change the field
names. [](/docs/config_guides/mark_display) explains each slot.

## Bars from a column

`y` names the column, and the axis autoscales to what is on screen.

```json addtrack config=https://jbrowse.org/demos/gene_density/config.json loc=chr1:151,000,000-151,030,000
{
  "type": "FeatureTrack",
  "trackId": "alu_bars",
  "name": "Alu divergence",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "alu_bars-LinearMarkDisplay",
      "marks": [{ "mark": "bar", "encoding": { "y": "milliDiv" } }]
    }
  ]
}
```

<Figure src="/img/mark_display_examples/bars.png" caption="One bar per Alu copy over 30 kb of 1q21, its height the copy's divergence from its consensus." />

## Points, coloured and shaped by a category

Each point stands at the middle of its copy. The colour and the shape each take
a categorical scale over `strand`, whose values are `1` and `-1`, so `domain`
names the levels and `labels` what the key calls them.

```json addtrack config=https://jbrowse.org/demos/gene_density/config.json loc=chr1:151,000,000-151,030,000
{
  "type": "FeatureTrack",
  "trackId": "alu_points",
  "name": "Alu divergence by strand",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "alu_points-LinearMarkDisplay",
      "marks": [
        {
          "mark": "point",
          "encoding": {
            "y": "milliDiv",
            "size": 8,
            "color": {
              "field": "strand",
              "domain": ["1", "-1"],
              "labels": ["+", "-"],
              "title": "Strand"
            },
            "shape": {
              "field": "strand",
              "domain": ["1", "-1"],
              "range": ["circle", "triangle-down"],
              "labels": ["+", "-"],
              "title": ""
            }
          }
        }
      ]
    }
  ]
}
```

<Figure src="/img/mark_display_examples/points.png" caption="The same copies as points, plus-strand copies as red circles and minus-strand copies as blue triangles." />

## A colour ramp

A `linear` scale over the plotted column, pinned at both ends so the colours
mean the same in every window. `scheme` names the ramp.

```json addtrack config=https://jbrowse.org/demos/gene_density/config.json loc=chr1:151,000,000-151,030,000
{
  "type": "FeatureTrack",
  "trackId": "alu_ramp",
  "name": "Alu divergence, viridis",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "alu_ramp-LinearMarkDisplay",
      "marks": [
        {
          "mark": "bar",
          "encoding": {
            "y": "milliDiv",
            "color": {
              "field": "milliDiv",
              "scale": "linear",
              "scheme": "viridis",
              "domainMin": 0,
              "domainMax": 300,
              "title": "Divergence"
            }
          }
        }
      ]
    }
  ]
}
```

<Figure src="/img/mark_display_examples/ramp.png" caption="Each bar coloured by its own height through viridis, pinned from 0 to 300, with the ramp as the key." />

## A colour per interval

A `threshold` scale cuts the column at the values in `domain` and paints one
`range` colour per interval, so a divergence reads as young, middle or old.

```json addtrack config=https://jbrowse.org/demos/gene_density/config.json loc=chr1:151,000,000-151,030,000
{
  "type": "FeatureTrack",
  "trackId": "alu_threshold",
  "name": "Alu age classes",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "alu_threshold-LinearMarkDisplay",
      "marks": [
        {
          "mark": "bar",
          "encoding": {
            "y": "milliDiv",
            "color": {
              "field": "milliDiv",
              "scale": "threshold",
              "domain": [80, 150],
              "range": ["#d73027", "#fdae61", "#4575b4"],
              "title": "Divergence"
            }
          }
        }
      ]
    }
  ]
}
```

<Figure src="/img/mark_display_examples/threshold.png" caption="Bars under 80 in red, 80 to 150 in orange and 150 and over in blue, with the three intervals in the key." />

## A histogram

A `bin` step snaps each copy to a bin four pixels wide at any zoom, and an
`aggregate` counts the copies in each. The bar plots the count without naming
it.

```json addtrack config=https://jbrowse.org/demos/gene_density/config.json loc=chr1:150,000,000-153,000,000
{
  "type": "FeatureTrack",
  "trackId": "alu_histogram",
  "name": "Alu copies per bin",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "alu_histogram-LinearMarkDisplay",
      "scales": { "y": { "title": "Copies per bin" } },
      "marks": [
        {
          "mark": "bar",
          "transform": [
            { "type": "bin", "step": "auto" },
            { "type": "aggregate", "ops": [{ "op": "count" }] }
          ],
          "encoding": { "color": { "value": "#7f7f7f" } }
        }
      ]
    }
  ]
}
```

<Figure src="/img/mark_display_examples/histogram.png" caption="Alu copies per bin across 3 Mb of 1q21, one grey bar per bin." />

## A summary per bin

The same bins, with `mean` over the column in place of the count.

```json addtrack config=https://jbrowse.org/demos/gene_density/config.json loc=chr1:150,000,000-153,000,000
{
  "type": "FeatureTrack",
  "trackId": "alu_mean",
  "name": "Mean Alu divergence per bin",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "alu_mean-LinearMarkDisplay",
      "scales": { "y": { "title": "Mean divergence" } },
      "marks": [
        {
          "mark": "bar",
          "transform": [
            { "type": "bin", "step": "auto" },
            {
              "type": "aggregate",
              "ops": [{ "op": "mean", "field": "milliDiv" }]
            }
          ],
          "encoding": { "color": { "value": "#7f7f7f" } }
        }
      ]
    }
  ]
}
```

<Figure src="/img/mark_display_examples/mean.png" caption="The mean divergence of the copies in each bin across the same 3 Mb." />

## A pileup

A `pileup` step writes each copy's row in a first-fit packing, and a `span`
draws the packing, coloured by strand.

```json addtrack config=https://jbrowse.org/demos/gene_density/config.json loc=chr1:151,000,000-151,030,000
{
  "type": "FeatureTrack",
  "trackId": "alu_pileup",
  "name": "Alu copies, packed",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "alu_pileup-LinearMarkDisplay",
      "marks": [
        {
          "mark": "span",
          "transform": [{ "type": "pileup", "padding": 200 }],
          "encoding": {
            "color": {
              "field": "strand",
              "domain": ["1", "-1"],
              "labels": ["+", "-"],
              "title": "Strand"
            }
          }
        }
      ]
    }
  ]
}
```

<Figure src="/img/mark_display_examples/pileup.png" caption="The copies stacked into rows with 200 bp between neighbours, plus strand in red and minus strand in blue." />

## A facet

`facet` splits the copies on a field and stacks one section per value under a
chip. A `pileup` in the facet's own `transform` packs each section on its own.

```json addtrack config=https://jbrowse.org/demos/gene_density/config.json loc=chr1:151,000,000-151,030,000
{
  "type": "FeatureTrack",
  "trackId": "alu_facet",
  "name": "Alu copies by strand",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "alu_facet-LinearMarkDisplay",
      "facet": { "field": "strand", "transform": [{ "type": "pileup" }] },
      "marks": [
        { "mark": "span", "encoding": { "color": { "value": "#4575b4" } } }
      ]
    }
  ]
}
```

<Figure src="/img/mark_display_examples/facet.png" caption="Plus-strand copies packed in one section and minus-strand copies in another, each under a chip naming its strand." />

## Labels

A `text` mark prints a field over each feature, culled where two labels would
overlap. `maxBpPerPx` stops the labels once the view is too wide to read them.

```json addtrack config=https://jbrowse.org/demos/gene_density/config.json loc=chr1:151,000,000-151,030,000
{
  "type": "FeatureTrack",
  "trackId": "alu_labels",
  "name": "Alu divergence, labelled",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "alu_labels-LinearMarkDisplay",
      "marks": [
        {
          "mark": "bar",
          "encoding": { "y": "milliDiv", "color": { "value": "#c8d8ee" } }
        },
        {
          "mark": "text",
          "encoding": { "y": "milliDiv", "text": "name" },
          "maxBpPerPx": 50
        }
      ]
    }
  ]
}
```

<Figure src="/img/mark_display_examples/labels.png" caption="Each bar with its subfamily name over it, the names that would overlap a neighbour left out." />

## Reference lines and an axis title

`scales.y` holds the guides a reader checks a plot against: `rules`, lines at
chosen values, and `title`, the caption beside the axis.

```json addtrack config=https://jbrowse.org/demos/gene_density/config.json loc=chr1:151,000,000-151,030,000
{
  "type": "FeatureTrack",
  "trackId": "alu_rules",
  "name": "Alu divergence, with rules",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "alu_rules-LinearMarkDisplay",
      "scales": {
        "y": {
          "title": "Divergence, per mille",
          "rules": [{ "value": 80, "color": "#d73027", "label": "young" }, 150]
        }
      },
      "marks": [{ "mark": "bar", "encoding": { "y": "milliDiv" } }]
    }
  ]
}
```

<Figure src="/img/mark_display_examples/rules.png" caption="The bars under a labelled red rule at 80 and a grey one at 150, with the axis captioned." />

## Links

A `link` draws a curve from `x` to `x2`. Over a BED of read pairs, each row
running from the leftmost read to the far end of its insert, that is one arc per
pair, stroked by its mapping quality.

```json addtrack config=https://jbrowse.org/demos/read_marks/config.json loc=chr20:32,925,000-32,955,000
{
  "type": "FeatureTrack",
  "trackId": "pair_links",
  "name": "NA12878 pairs over 1 kb, as arcs",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/read_marks/NA12878.chr20.discordant_pairs.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "pair_links-LinearMarkDisplay",
      "marks": [
        {
          "mark": "link",
          "transform": [
            { "type": "filter", "expr": "jexl:feature.tlen < 20000" }
          ],
          "encoding": {
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

<Figure src="/img/mark_display_examples/links.png" caption="The pairs across a deletion on chromosome 20, each an arc from its leftmost read to the end of its insert, stroked by its mapping quality." />

## One row per file

Over a multi-BigWig, `rows: "source"` gives each file a row on one shared axis,
with the row labels, **Sort rows by value here** and **Cluster rows by
similarity...** in the track menu.

```json addtrack config=https://jbrowse.org/demos/gene_density/config.json loc=chr17:36,193,000-36,198,000
{
  "type": "MultiQuantitativeTrack",
  "trackId": "pur_cnv_rows",
  "name": "Copy number, six PUR individuals",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "bigWigs": [
      "https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR/HG01177.qm2.CN.1k.bw",
      "https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR/HG01083.qm2.CN.1k.bw",
      "https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR/HG01070.qm2.CN.1k.bw",
      "https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR/HG01395.qm2.CN.1k.bw",
      "https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR/HG00731.qm2.CN.1k.bw",
      "https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR/HG00553.qm2.CN.1k.bw"
    ]
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "pur_cnv_rows-LinearMarkDisplay",
      "rows": "source",
      "scales": { "y": { "domainMin": 0, "domainMax": 10, "title": "Copies" } },
      "marks": [
        {
          "mark": "bar",
          "encoding": { "y": "score", "color": { "value": "#4575b4" } }
        }
      ]
    }
  ]
}
```

<Figure src="/img/mark_display_examples/rows.png" caption="Six individuals' copy number over CCL3L1, one row per file on a shared axis, stepping down from the top row to the bottom." />

## Percent identity along an alignment

A PAF's `SyntenyTrack` takes the mark display too. Each alignment's `identity`
comes from minimap2's `de` divergence tag, or from its match count over its
alignment length in a PAF without one. A `rule` at that value across each
alignment is a percent identity plot, the picture
[PipMaker](https://doi.org/10.1101/gr.10.4.577) drew for a pair of genomes.
Stretches with no rule are where nothing aligned.

```json addtrack config=https://jbrowse.org/demos/hpylori/config.json loc=NC_018939.1
{
  "type": "SyntenyTrack",
  "trackId": "hpylori_identity",
  "name": "26695 against J99, percent identity",
  "assemblyNames": ["GCF_000982695.1", "GCF_000307795.1"],
  "adapter": {
    "type": "PairwiseIndexedPAFAdapter",
    "uri": "https://jbrowse.org/demos/hpylori/26695_vs_j99.pif.gz",
    "assemblyNames": ["GCF_000982695.1", "GCF_000307795.1"]
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "hpylori_identity-LinearMarkDisplay",
      "transform": [
        {
          "type": "formula",
          "expr": "jexl:feature.identity * 100",
          "as": "pid"
        }
      ],
      "scales": {
        "y": { "domainMin": 50, "domainMax": 100, "title": "Percent identity" }
      },
      "marks": [{ "mark": "rule", "encoding": { "y": "pid", "size": 2 } }]
    }
  ]
}
```

<Figure src="/img/mark_display_examples/identity.png" caption="H. pylori 26695 against J99 across the whole chromosome, one line per alignment at its percent identity." />

A PAF line carries one identity for the whole alignment, so a long alignment
draws as one flat line however its identity varies along its length.

## Percent identity, one row per genome

An all-vs-all PAF aligns the reference to several genomes at once, and each
alignment names the other genome in `mate.assemblyName`. The first `formula`
copies that into a field `rows` can split on, which gives each strain a row
beside the others. The `filter` drops K12's alignments to itself, and it runs
first because a step after the one writing the rows field runs inside each row.

```json addtrack config=https://jbrowse.org/demos/ecoli_pangenome/config.json loc=chr
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_identity",
  "name": "K12 against four strains, percent identity",
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"],
  "adapter": {
    "type": "MultiGenomePAFAdapter",
    "uri": "https://jbrowse.org/demos/ecoli_pangenome/all_vs_all.paf.gz",
    "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"]
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "ecoli_identity-LinearMarkDisplay",
      "transform": [
        { "type": "filter", "expr": "jexl:feature.mate.assemblyName != 'K12'" },
        {
          "type": "formula",
          "expr": "jexl:feature.mate.assemblyName",
          "as": "strain"
        },
        {
          "type": "formula",
          "expr": "jexl:feature.identity * 100",
          "as": "pid"
        }
      ],
      "rows": "strain",
      "scales": {
        "y": { "domainMin": 80, "domainMax": 100, "title": "Percent identity" }
      },
      "marks": [{ "mark": "rule", "encoding": { "y": "pid", "size": 2 } }]
    }
  ]
}
```

<Figure src="/img/mark_display_examples/identity_rows.png" caption="E. coli K12 against Sakai, CFT073, NCTC86 and IAI39, one row per strain, each alignment a line at its percent identity." />

## More

[](/docs/config_guides/mark_display) shows a density and the raw features in one
track across zooms, a facet over a BAM's haplotype tag, and a density sidecar
past the fetch budget; [](/docs/tutorials/alu_age) and
[](/docs/tutorials/read_marks) each take one file through a question.
