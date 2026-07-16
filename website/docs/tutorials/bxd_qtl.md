---
title: QTL mapping in the BXD family
description:
  Chromosome-painting and a QTL Manhattan plot from GeneNetwork BXD data
guide_category: Tutorials
tutorial_category: Population genomics
---

The [BXD family](https://www.genenetwork.org) is a panel of ~200 mouse
recombinant-inbred (RI) strains bred from a cross of C57BL/6J (the "B" parent)
and DBA/2J (the "D" parent). Each strain's genome is a fixed pattern of B and D
blocks, and the same strains have been phenotyped for thousands of traits at
[GeneNetwork](https://www.genenetwork.org). That combination is what this
tutorial visualizes: a trait scan on top, and the B/D blocks underneath it.

This tutorial builds two JBrowse tracks from the same BXD panel, on mm10:

- a chromosome-painting track (the
  [multi-row feature display](/docs/tutorials/chromhmm)) showing each strain's B
  and D blocks, and
- a QTL Manhattan track ([plugins/gwas](/docs/config_guides/gwas_track)) from a
  single-marker scan of a real BXD phenotype.

Stack them in one view and you see the trait peak on top with the B/D blocks
that drive it directly underneath.

Working in a notebook? The GWAS/Manhattan and multi-row feature tracks shown
here also render inline through the
[JBrowse Jupyter / anywidget interface](/docs/jbrowse_jupyter) (or
[JBrowseR](/docs/jbrowser) in R), so you can run the scan and view the peak in
one Python or R session.

<Figure src="/img/qtl/bxd_overview.png" caption="Whole chr4. Top: the BXD coat-color QTL scan, peaking at ~80 Mb. Bottom: the 198-strain painting (blue = B, red = D, grey = het, blank = unknown), rows sorted by each strain's genotype at the peak. Directly under the peak the strains split into a red block over a blue block, the B/D contrast the scan is scoring."/>

## The data: BXD consensus genotypes

GeneNetwork distributes the consensus BXD genotypes as a plain-text `.geno`
file. Each row is a marker (with a `cM` genetic-map and an mm10 `Mb` physical
position, we use `Mb`); each column is a strain, with a one-letter genotype,
`B`, `D`, `H` (heterozygous) or `U` (unknown):

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

The two Python scripts used below live in the JBrowse repo. Clone
[jbrowse-components](https://github.com/GMOD/jbrowse-components), or just
download the linked `bxd_geno_to_painting_bed.py` and `bxd_qtl_scan.py`, and run
them from where you saved them. You'll also need Python 3 (with `pandas` for the
phenotype step and `numpy`/`scipy` for the scan) and htslib for `bgzip`/`tabix`.
On JBrowse Desktop, add the `.bed.gz`/`.tsv.gz` files you build through **Add
track** by choosing the local files, with no hosting step needed
([desktop quickstart](/docs/quickstart_desktop)).

## Track 1: chromosome painting

The painting is a [multi-row feature display](/docs/tutorials/chromhmm): one row
per strain, each block colored by genotype. To make it, walk each strain's
markers along every chromosome and emit one BED interval per run of consecutive
same-genotype markers (run-length encoding), coloring `B`/`D`/`H` and writing
the strain name into an extra `sample` column:

```
#chrom  chromStart  chromEnd   name     score strand thickStart thickEnd itemRgb      sample  genotype
chr1    3001490     20291558   BXD1_B   0     .      3001490    20291558 65,105,225   BXD1    B
chr1    20291558    53451539   BXD1_D   0     .      20291558   53451539 220,60,50    BXD1    D
chr1    53451539    69355875   BXD1_B   0     .      53451539   69355875 65,105,225   BXD1    B
```

The
[`bxd_geno_to_painting_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/bxd_geno_to_painting_bed.py)
script does exactly this run-length encoding. Run it on the downloaded `.geno`,
then sort, `bgzip`, and `tabix` the result (the `#`-header line names the
columns for the adapter):

```bash
python3 scripts/bxd_geno_to_painting_bed.py BXD.geno bxd_painting.bed
(head -1 bxd_painting.bed; tail -n +2 bxd_painting.bed | sort -k1,1 -k2,2n) \
  | bgzip > bxd_painting.bed.gz
tabix -p bed bxd_painting.bed.gz
```

Then configure a `FeatureTrack` whose `LinearMultiRowFeatureDisplay` partitions
on the `sample` column and colors each block from its `itemRgb` field. Both
tracks reference the `mm10` assembly, so set that up first if you haven't. See
the [assemblies configuration guide](/docs/config_guides/assemblies).

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
      "showTree": true
    }
  ]
}
```

- `partitionField: "sample"` splits the one file into one labeled row per
  strain.
- No color setting is needed: a BED carrying `itemRgb` is painted with it
  automatically, so every block gets its genotype color straight from the file.
- `showTree: true` adds a clustering sidebar that groups strains by genotype
  similarity, and related substrains and F1s fall next to each other.
- `disableGeneHeuristic: true` keeps the BED adapter from reading each block as
  a gene, since the `thickStart`/`thickEnd` columns would otherwise trip its
  BED12 transcript detection.

## Track 2: the QTL Manhattan

To map a trait, score every marker for how well its B/D genotype predicts the
phenotype. GeneNetwork uses a linear mixed model (GEMMA, Genome-wide Efficient
Mixed Model Association); this demo uses a simpler single-marker regression of
the phenotype on the 0/1 (B/D) genotype, converting each marker's t-statistic to
a `-log10(p)`. Those are the same B/D calls the painting draws, so the peak and
the painting come from one genotype matrix. Real BXD phenotypes and the mm10
marker map are in the
[`rqtl/qtl2data/BXD`](https://github.com/rqtl/qtl2data/tree/master/BXD) dataset.

Write the scan out as a tabix'd BED-like table with a `neg_log_pvalue` column:

```
#chrom  start     end       name        score strand neg_log_pvalue
chr4    80750000  80750001  rs3708061   .     .      51.9
```

The
[`bxd_qtl_scan.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/bxd_qtl_scan.py)
script runs the regression on the same `.geno` plus a two-column `strain,value`
phenotype file. Build that file by pulling one trait column out of the qtl2data
[`bxd_pheno.csv`](https://github.com/rqtl/qtl2data/tree/master/BXD): its columns
are GeneNetwork trait IDs (described in `bxd_phenocovar.csv`, where ID `10678`
is "Hair coat color"), and its first column, `id`, holds the strain names:

```bash
python3 - <<'PY'
import pandas as pd
df = pd.read_csv('bxd_pheno.csv', comment='#')  # skips the leading # metadata lines
df[['id', '10678']].dropna().to_csv(
    'coat_color.pheno.csv', index=False, header=['strain', 'value'])
PY
```

Then run the scan (the phenotype file's header line is skipped automatically):

```bash
python3 scripts/bxd_qtl_scan.py BXD.geno coat_color.pheno.csv bxd_gwas_coatcolor.tsv
(head -1 bxd_gwas_coatcolor.tsv; tail -n +2 bxd_gwas_coatcolor.tsv | sort -k1,1 -k2,2n) \
  | bgzip > bxd_gwas_coatcolor.tsv.gz
tabix -p bed bxd_gwas_coatcolor.tsv.gz
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

Scanning ~7,300 markers against BXD coat color puts the tallest peak on chr4,
over _Tyrp1_ (the coat-color gene). We sort the painting by genotype at that
peak, so the clean B/D split directly beneath it is exactly the contrast the
scan scores, and it breaks up into mixed B/D blocks away from the locus.

<Figure src="/img/qtl/bxd_sort_before_after.png" links="Input order=qtl/bxd_painting_input_order,Sorted at peak=qtl/bxd_painting_sorted" caption="The same whole-chr4 view with the painting's row sort toggled. Top: strains in default (alphabetical) order, salt-and-pepper under the peak. Bottom: sorted by genotype at the peak, resolving into a clean, wide red-over-blue split directly beneath the Manhattan peak."/>

<Figure src="/img/qtl/bxd_tyrp1_locus.png" caption="The whole of chr4 (~156 Mb): the coat-color association rises to a sharp peak at ~80 Mb over Tyrp1, and the haplotype painting (sorted by genotype at that peak) resolves into a clean B (red) over D (blue) split at the gene."/>

A second scan in the demo config maps brain weight to a subtler QTL on chr19.

Open the whole demo live in the
[JBrowse BXD demo](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_bxd.json),
or click the **Open in JBrowse** link under any figure above.

## See also

- [ChromHMM chromatin states](/docs/tutorials/chromhmm) - the same multi-row
  feature display, one row per cell type instead of per strain
- [Phased trio analysis](/docs/tutorials/analyze_trio) - multi-row painting of
  inheritance blocks in a human trio
- [Population genomics](/docs/tutorials/population_genomics) - more variant- and
  cohort-scale visualizations
- [GWAS / Manhattan track](/docs/user_guides/gwas_track) - the same
  `LinearManhattanDisplay` driven by human GWAS summary statistics, with
  LocusZoom-style LD coloring
- [GWAS track configuration](/docs/config_guides/gwas_track) - preparing GWAS
  and LD files, `scoreColumn`/`scoreTransform`, and significance thresholds
- [jexl](/docs/config_guides/jexl) - the color-callback syntax used for the
  painting
