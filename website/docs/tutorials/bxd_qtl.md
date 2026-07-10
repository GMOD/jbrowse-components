---
title: QTL mapping in the BXD family
description:
  Systems genetics with real GeneNetwork BXD data — a chromosome-painting
  multi-row track and a QTL Manhattan plot from the same mouse
  recombinant-inbred panel
guide_category: Tutorials
---

The [BXD family](https://www.genenetwork.org) is a panel of ~200 mouse
recombinant-inbred (RI) strains bred from a cross of **C57BL/6J** (the "B"
parent) and **DBA/2J** (the "D" parent). After many generations of inbreeding
each strain's genome is a fixed **mosaic of B and D haplotype blocks** — and
because the same strains have been phenotyped for thousands of traits at
[GeneNetwork](https://www.genenetwork.org), the panel is a workhorse for
_systems genetics_: map a trait to the genome by asking which haplotype blocks
track with it.

This tutorial builds two JBrowse tracks from the **same BXD panel**, on mm10:

- a **chromosome-painting** track (the
  [multi-row feature display](/docs/tutorials/chromhmm)) showing each strain's
  B/D mosaic, and
- a **QTL Manhattan** track ([plugins/gwas](/docs/config_guides/gwas_track))
  from a single-marker scan of a real BXD phenotype.

Stacked in one view they show the core systems-genetics move: a trait peak, and
the recombination structure underneath it.

<Figure src="/img/qtl/bxd_overview.png" caption="Whole chr4. Top: the BXD coat-color QTL scan, peaking at ~80 Mb. Bottom: the 198-strain painting (blue = B, red = D, grey = het, blank = unknown), rows sorted by each strain's genotype at the peak. Directly under the peak the strains split into a red block over a blue block — the B/D contrast the scan is scoring — and the split frays with distance as strains recombine."/>

## The data: BXD consensus genotypes

GeneNetwork distributes the consensus BXD genotypes as a plain-text `.geno`
file. Each row is a marker (with an mm10 `Mb` position); each column is a
strain, with a one-letter genotype — `B`, `D`, `H` (heterozygous) or `U`
(unknown):

```
@name:BXD
@mat:B
@pat:D
Chr  Locus         cM    Mb        BXD1  BXD2  BXD5  ...
1    rs31443144    0.11  3.010274  B     B     D     ...
1    rs6269442     0.21  3.492195  B     B     D     ...
```

Download it from
[gn1.genenetwork.org/genotypes/BXD.geno](https://gn1.genenetwork.org/genotypes/BXD.geno)
(please cite
[Wang et al. 2016, _Nat Commun_ 7:10464](https://doi.org/10.1038/ncomms10464)).

## Track 1: chromosome painting

The painting is a [multi-row feature display](/docs/tutorials/chromhmm) — one
row per strain, each block colored by genotype. To make it, walk each strain's
markers along every chromosome and emit one BED interval per run of consecutive
same-genotype markers (run-length encoding), coloring `B`/`D`/`H` and writing
the strain name into an extra `sample` column:

```
#chrom  chromStart  chromEnd   name     score strand thickStart thickEnd itemRgb      sample  genotype
chr1    3001490     20291558   BXD1_B   0     .      3001490    20291558 65,105,225   BXD1    B
chr1    20291558    53451539   BXD1_D   0     .      20291558   53451539 220,60,50    BXD1    D
chr1    53451539    69355875   BXD1_B   0     .      53451539   69355875 65,105,225   BXD1    B
```

`bgzip` and `tabix` it, then configure a `FeatureTrack` whose
`LinearMultiRowFeatureDisplay` partitions on the `sample` column and colors each
block from its `itemRgb` field:

```json
{
  "type": "FeatureTrack",
  "trackId": "bxd_chromosome_painting_mm10",
  "name": "BXD chromosome painting (GeneNetwork, 198 strains)",
  "assemblyNames": ["mm10"],
  "adapter": {
    "type": "BedTabixAdapter",
    "disableGeneHeuristic": true,
    "bedGzLocation": {
      "uri": "https://jbrowse.org/demos/bxd/bxd_painting.bed.gz"
    },
    "index": {
      "location": {
        "uri": "https://jbrowse.org/demos/bxd/bxd_painting.bed.gz.tbi"
      }
    }
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "bxd_chromosome_painting_mm10-LinearMultiRowFeatureDisplay",
      "partitionField": "sample",
      "color": "jexl:'rgb('+get(feature,'itemRgb')+')'",
      "showTree": true
    }
  ]
}
```

- **`partitionField: "sample"`** splits the one file into one labeled row per
  strain.
- **`color`** is a [jexl](/docs/config_guides/jexl) callback turning the BED
  `itemRgb` triple (e.g. `65,105,225`) into a CSS `rgb(...)`, so every block is
  painted with its genotype color straight from the file.
- **`showTree: true`** adds a clustering sidebar that groups strains by genotype
  similarity — related substrains and F1s fall next to each other.
- **`disableGeneHeuristic: true`** keeps the BED adapter from reading each block
  as a gene — the `thickStart`/`thickEnd` columns would otherwise trip its BED12
  transcript detection.

## Track 2: the QTL Manhattan

To map a trait, score every marker for how well its B/D genotype predicts the
phenotype. GeneNetwork uses a mixed model (GEMMA); this demo uses a simpler
**single-marker regression** of the phenotype on the 0/1 (B/D) genotype,
converting each marker's t-statistic to a `-log10(p)`. Those are the same B/D
calls the painting draws, so the peak and the painting come from one genotype
matrix. Real BXD phenotypes and the mm10 marker map are in the
[`rqtl/qtl2data/BXD`](https://github.com/rqtl/qtl2data/tree/master/BXD) dataset.

Write the scan out as a tabix'd BED-like table with a `neg_log_pvalue` column:

```
#chrom  start     end       name        score strand neg_log_pvalue
chr4    80750000  80750001  rs3708061   .     .      51.9
```

A `GWASTrack`/`GWASAdapter` reads that column and renders the Manhattan plot.
Its default [`scoreColumn`](/docs/config/gwasadapter/#slot-scorecolumn) is
`neg_log_pvalue`, read as a pre-computed `-log10(p)`, so a file whose column is
named that needs no extra slots. For a differently-named or raw-p-value column,
set `scoreColumn` and
[`scoreTransform`](/docs/config/gwasadapter/#slot-scoretransform); see the
[GWAS track guide](/docs/config_guides/gwas_track).

```json
{
  "type": "GWASTrack",
  "trackId": "bxd_gwas_coatcolor_mm10",
  "name": "BXD QTL: coat color (peak at Tyrp1, chr4)",
  "assemblyNames": ["mm10"],
  "adapter": {
    "type": "GWASAdapter",
    "bedGzLocation": {
      "uri": "https://jbrowse.org/demos/bxd/bxd_gwas_coatcolor.tsv.gz"
    },
    "index": {
      "location": {
        "uri": "https://jbrowse.org/demos/bxd/bxd_gwas_coatcolor.tsv.gz.tbi"
      }
    }
  },
  "displays": [
    {
      "type": "LinearManhattanDisplay",
      "displayId": "bxd_gwas_coatcolor_mm10-LinearManhattanDisplay"
    }
  ]
}
```

## Reading the result

Scanning ~7,300 markers against BXD **coat color** puts the tallest peak on
chr4, over **_Tyrp1_** (the coat-color gene). The painting is sorted by genotype
at that peak, so the clean B/D split directly beneath it is exactly the contrast
the scan scores — and it breaks up into a recombinant mosaic away from the
locus.

<Figure src="/img/qtl/bxd_tyrp1_locus.png" caption="Zoomed to the Tyrp1 locus (chr4 ~80 Mb, red band). Tyrp1 sits under the top of the association, and the painting resolves the individual B↔D recombination breakpoints that the whole-chromosome view blurs together."/>

A second bundled scan maps **brain weight** to a subtler QTL on chr19.

Open the whole demo live in the
[JBrowse BXD demo](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_bxd.json),
or click **Open this view in JBrowse** under either figure above.

## See also

- [ChromHMM chromatin states](/docs/tutorials/chromhmm) — the same multi-row
  feature display, one row per cell type instead of per strain
- [Phased trio analysis](/docs/tutorials/analyze_trio) — multi-row painting of
  inheritance blocks in a human trio
- [Population genomics](/docs/tutorials/population_genomics) — more variant- and
  cohort-scale visualizations
- [GWAS / Manhattan track](/docs/user_guides/gwas_track) — the same
  `LinearManhattanDisplay` driven by human GWAS summary statistics, with
  LocusZoom-style LD coloring
- [GWAS track configuration](/docs/config_guides/gwas_track) — preparing GWAS
  and LD files, `scoreColumn`/`scoreTransform`, and significance thresholds
- [jexl](/docs/config_guides/jexl) — the color-callback syntax used for the
  painting
