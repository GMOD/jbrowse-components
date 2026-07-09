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
allele) and **DBA/2J** (the "D" allele). After many generations of inbreeding
each strain's genome is a fixed **mosaic of B and D haplotype blocks** — and
because the same strains have been phenotyped for thousands of traits at
[GeneNetwork](https://www.genenetwork.org), the panel is a workhorse for
_systems genetics_: map a trait to the genome by asking which haplotype blocks
track with it.

This tutorial builds two JBrowse tracks from the **same** BXD data, on mm10:

- a **chromosome-painting** track (the
  [multi-row feature display](/docs/tutorials/chromhmm)) showing each strain's
  B/D mosaic, and
- a **QTL Manhattan** track ([plugins/gwas](/docs/config_guides/gwas_track))
  from a single-marker scan of a real BXD phenotype.

Stacked in one view they show the core systems-genetics move: a trait peak, and
the recombination structure that produced it.

<Figure src="/img/qtl/bxd_overview.png" caption="Whole-chromosome-4 view. Top: a QTL scan of BXD coat color, peaking near 80 Mb. Bottom: the BXD chromosome painting — one row per strain, blue = C57BL/6J (B), red = DBA/2J (D), grey = heterozygous, blank = unknown. The peak sits over the region where B/D ancestry best predicts the trait."/>

## The data: one genotype file

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

## Track 2: the QTL Manhattan

To map a trait, score every marker for how well its B/D genotype predicts the
phenotype. GeneNetwork uses a linear mixed model (GEMMA); the simplest form is a
**single-marker regression** of the phenotype on the 0/1 (B/D) genotype across
strains, converting each marker's t-statistic to a `-log10(p)`. Real BXD
phenotypes (and the mm10 marker map) are available as the
[`rqtl/qtl2data/BXD`](https://github.com/rqtl/qtl2data/tree/master/BXD) dataset.

Write the scan out as a tabix'd BED-like table with a `neg_log_pvalue` column:

```
#chrom  start     end       name        score strand neg_log_pvalue
chr4    80750000  80750001  rs3708061   .     .      51.9
```

A `GWASTrack` with a `GWASAdapter` reads that column and renders a Manhattan
plot. `GWASAdapter` already defaults to a `neg_log_pvalue` column that it treats
as pre-computed `-log10(p)`, so this file — whose column is named exactly that —
needs no extra slots. For a file with a differently-named or raw-p-value column,
set [`scoreColumn`](/docs/config/gwasadapter/#slot-scorecolumn) and
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
chromosome 4 — right over **_Tyrp1_**, the classic brown-coat-color gene.
Zooming in, the QTL apex lines up with the gene, and the painting below shows
the strain-by-strain recombination breakpoints that flip B↔D through the locus.

<Figure src="/img/qtl/bxd_tyrp1_locus.png" caption="The Tyrp1 locus (chr4 ~80 Mb). The coat-color QTL peak sits over the Tyrp1 gene, and the painting shows where individual strains recombine between the B and D haplotypes across the region."/>

A second bundled scan maps **brain weight** to a subtler, real QTL on chromosome
19 — a reminder that most quantitative traits map far less dramatically than a
near-Mendelian pigment gene.

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
