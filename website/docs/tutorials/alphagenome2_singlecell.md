---
title: AlphaGenome 2 predictions by cell type
description:
  View AlphaGenome 2's predicted effect of each IBD credible-set SNP at ETS2
  separately for each immune cell type
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

An inflammatory bowel disease association on chromosome 21 fine-maps to seven
SNPs in 1.2 kb of gene desert, 289 kb from the _ETS2_ promoter. AlphaGenome 2
predicts a variant's effect on expression and on chromatin accessibility
separately for each cell type it was trained on. Drawn per cell type along the
chromosome, those predictions show which SNP has an effect, on which gene, and
in which cell types, following DeepMind's own worked example. At _ETS2_ and the
enhancer between _ETS2_ and _PSMG1_, we:

- load the credible set as a variant track
- load each SNP's predicted effect on each gene from one BED, faceted into a
  section per ileum immune cell type, then per SNP in macrophages
- load the input gradient of _ETS2_ expression along the megabase around it
- open the enhancer and load predicted single-cell ATAC (scATAC) per cell type
  for the change the protective allele makes, over the measured blood monocyte
  rows
- load the predicted effect of every base change at the enhancer as a heatmap

:::caution Predictions

Every track on this page except the credible set and the genes is a model's
output. The tracks follow DeepMind's
[fine-mapping notebook](https://www.alphagenomedocs.com/colabs/v2/finemapping_ets2.html)
for this locus.

:::

## Prerequisites

- nothing beyond a web browser to follow the page
- to make the tracks for your own variants, an
  [AlphaGenome API key](https://www.alphagenomedocs.com/installation.html) and
  Python 3.10 or later with `pip install "alphagenome==2.0.*" pyBigWig pysam`

## The data

You don't need these files to follow the page: every track reads a hosted
result. The predictions come from the AlphaGenome API, which the
[build script](#reproduce-it-end-to-end) calls with your key, and the credible
set is the seven SNPs SuSiE kept from the IBD GWAS (study GCST004133) in Stankey
et al. (2024).

## Loading GRCh38

AlphaGenome 2 predicts from GRCh38 sequence, and the files below use its
`chr21`-style chromosome names:

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

The genes are NCBI's curated RefSeq set from the
[hg38 page on genomes.jbrowse.org](https://genomes.jbrowse.org/ucsc/hg38/):

```json addtrack
{
  "trackId": "hg38-ncbiRefSeqCurated",
  "name": "NCBI RefSeq - RefSeq Curated",
  "uri": "https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz",
  "csi": true,
  "assemblyNames": ["hg38"]
}
```

## The credible set as a variant track

The credible set is a VCF with each SNP's posterior inclusion probability (PIP)
and GWAS effect in `INFO`, so clicking a SNP shows both. The reference allele is
the risk allele at every SNP, and the alternate is protective:

```json addtrack loc=chr21:39,093,000..39,095,400
{
  "trackId": "ets2_ibd_credible_set",
  "name": "IBD credible set at chr21q22",
  "uri": "https://jbrowse.org/demos/alphagenome2_singlecell/ets2/credible_set.vcf.gz",
  "assemblyNames": ["hg38"]
}
```

## Predicted expression effects as a BED

`score_variants` predicts each SNP's effect on every gene within half a
megabase, once per cell type. The ileum conditions are the seven immune cell
types the notebook uses, and each is a tissue and Cell Ontology pair such as
`UBERON:0002116_CL:0000235` for ileum macrophages:

<!-- from: scripts/build_alphagenome2_singlecell.sh -->

```python
scores = variant_scorers.tidy_scores(
    model.score_variants(
        intervals=intervals,
        variants=variants,
        variant_scorers=[variant_scorers.RECOMMENDED_VARIANT_SCORERS['SC_GENE_EXPRESSION']],
        conditions=conds,
    ),
    filter_protein_coding=True,
)
```

A score is one log fold change per gene, so the script writes one BED line per
gene, SNP and cell type, over the gene's span in the model's own annotation. A
`#` header names the columns, and every column becomes a field JBrowse can
filter, facet and color by (tab-separated, shown space-aligned):

```text
#chrom  chromStart  chromEnd  name   score    strand  cell_type   snp
chr21   38805182    38824955  ETS2   -0.2327  +       Macrophage  rs2836882
chr21   38805182    38824955  ETS2   -0.2832  +       Monocyte    rs2836882
chr21   38805182    38824955  ETS2   -0.0023  +       B cell      rs2836882
```

## rs2836882's effect on expression in each cell type

The track draws the notebook's heatmap along the chromosome: a section per cell
type, each gene a rectangle colored by its score. `filter` keeps rs2836882's
lines, `facet` makes the sections, and the facet's `pileup` packs overlapping
genes into separate lanes:

```json addtrack loc=chr21:38,700,000..39,330,000
{
  "type": "FeatureTrack",
  "trackId": "ag2_ets2_expression_by_cell_type",
  "name": "rs2836882 predicted expression effect per gene, by ileum cell type",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/alphagenome2_singlecell/ets2/expression_effects.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "ag2_ets2_expression_by_cell_type-LinearMarkDisplay",
      "height": 300,
      "filter": [{ "field": "snp", "equal": "rs2836882" }],
      "facet": {
        "field": "cell_type",
        "sort": [
          "Macrophage",
          "Monocyte",
          "B cell",
          "CD4 T",
          "CD8 T",
          "Treg",
          "NK"
        ],
        "transform": [{ "type": "pileup" }]
      },
      "encoding": {
        "color": {
          "field": "score",
          "scale": {
            "type": "linear",
            "scheme": "redblue",
            "domainMin": -0.3,
            "domainMax": 0.3,
            "domainMid": 0
          },
          "legend": { "title": "log fold change" }
        }
      },
      "marks": [{ "mark": "rect" }],
      "tooltip": "name"
    }
  ]
}
```

The pinned `domainMin`, `domainMax` and `domainMid` put no effect at white in
every section, as the notebook's color scale does. Hovering a rectangle names
its gene, and the RefSeq track above names them all.

The second track reads the same BED filtered to macrophages and faceted by SNP,
a section per credible-set SNP in genomic order:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "ag2_ets2_macrophage_by_snp",
  "name": "Macrophage predicted expression effect per gene, by credible-set SNP",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/alphagenome2_singlecell/ets2/expression_effects.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "ag2_ets2_macrophage_by_snp-LinearMarkDisplay",
      "height": 300,
      "filter": [{ "field": "cell_type", "equal": "Macrophage" }],
      "facet": {
        "field": "snp",
        "sort": [
          "rs4817986",
          "rs2836878",
          "rs4817987",
          "rs2836881",
          "rs9808651",
          "rs2836882",
          "rs2836883"
        ],
        "transform": [{ "type": "pileup" }]
      },
      "encoding": {
        "color": {
          "field": "score",
          "scale": {
            "type": "linear",
            "scheme": "redblue",
            "domainMin": -0.3,
            "domainMax": 0.3,
            "domainMid": 0
          },
          "legend": { "title": "log fold change" }
        }
      },
      "marks": [{ "mark": "rect" }],
      "tooltip": "name"
    }
  ]
}
```

Open both over the span from _ETS2_ to _BRWD1_:

```text
chr21:38,700,000-39,330,000
```

<Figure caption="Predicted expression effects from ETS2 to BRWD1: rs2836882 in each ileum cell type, each credible-set SNP in macrophages, and the input gradient of ETS2 in macrophages." src="/img/alphagenome2/ets2_expression_effects.png" />

_ETS2_ is red in the macrophage and monocyte sections and white in the lymphoid
ones. Of the genes nearer the SNPs, _PSMG1_ is pale in the myeloid sections and
_BRWD1_ stays white. In the second track rs2836882 colors _ETS2_ deep red,
rs9808651 pale pink and the other five not at all, although rs2836878 has the
highest PIP.

## Which bases the ETS2 prediction reads

`predict_interval_gradients` takes the gradient of one gene's predicted
expression with respect to each base of the megabase centered on its
transcription start site, multiplied by the reference sequence, which gives one
value per base. Positive values mark bases that raise the prediction:

<!-- from: scripts/build_alphagenome2_singlecell.sh -->

```python
gradient = model.predict_interval_gradients(
    genes.at['ETS2', 'gene_id'],
    requested_output=dna_client.OutputType.SC_GENE_EXPRESSION,
    condition=ileum['Macrophage'],
)
per_base = gradient.gradients.sum(axis=1)
```

The script writes `per_base` as a BigWig, which loads as a quantitative track
with a symmetric axis:

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "ag2_ets2_gradient",
  "name": "Input gradient of ETS2 expression in ileum macrophage",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "https://jbrowse.org/demos/alphagenome2_singlecell/ets2/gradient_ETS2_Macrophage.bw"
  },
  "displayDefaults": {
    "mark": "bar",
    "height": 100,
    "encoding": {
      "y": {
        "scale": { "domainMin": -0.15, "domainMax": 0.15 },
        "axis": { "title": "gradient × input" }
      }
    }
  }
}
```

It is the bottom track of the figure above. Its tallest bar in the whole
megabase is at rs2836882, 289 kb from _ETS2_, taller than any at the _ETS2_
promoter.

## Predicted accessibility at the enhancer

The variant prediction behind the BigWigs below is `predict_variants` with
`OutputType.SC_ATAC`, one call per cell type, which returns the predicted scATAC
for the reference and the alternate sequence. The script keeps the 10x Cell
Ranger track, as the notebook does, and writes the reference and the alternate
minus the reference as two BigWigs per cell type.

AlphaGenome 2 was trained on single-cell expression from these ileum cell types
but on no scATAC from them. `supported_conditions()` lists the mode of each cell
type's prediction for each output, and for ileum scATAC it is
`imputed_supported`, which the track names carry. The change track pins a
symmetric axis so zero sits mid-row; the fence lists three of its seven rows:

```json addtrack loc=chr21:39,094,144..39,095,144
{
  "type": "MultiQuantitativeTrack",
  "trackId": "ag2_ets2_atac_change",
  "name": "Predicted scATAC change, protective minus risk (imputed_supported)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BigWigAdapter",
        "name": "Macrophage",
        "group": "Myeloid",
        "color": "#d62728",
        "uri": "https://jbrowse.org/demos/alphagenome2_singlecell/ets2/atac_change_Macrophage.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "Monocyte",
        "group": "Myeloid",
        "color": "#ff7f0e",
        "uri": "https://jbrowse.org/demos/alphagenome2_singlecell/ets2/atac_change_Monocyte.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "B cell",
        "group": "Lymphoid",
        "color": "#1f77b4",
        "uri": "https://jbrowse.org/demos/alphagenome2_singlecell/ets2/atac_change_B_cell.bw"
      }
    ]
  },
  "displayDefaults": {
    "mark": "bar",
    "height": 240,
    "encoding": {
      "y": {
        "scale": { "domainMin": -14, "domainMax": 14 },
        "axis": { "title": "scATAC change" }
      }
    }
  }
}
```

`ag2_ets2_atac_reference` in the hosted config holds the risk allele's predicted
scATAC the same way, from `atac_reference_<Cell_type>.bw`, with an axis from
zero. Under both goes measured scATAC from blood: the monocyte rows of the 10x
PBMC pseudobulk track of [](/docs/tutorials/scrna_pseudobulk), whose hosted
config has all twelve rows. Its cells are unstimulated blood monocytes, not
ileum macrophages, so it shows whether monocytes open this enhancer, not whether
the ileum predictions are right:

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "pbmc5k_scatac_pseudobulk_hg38",
  "name": "Single-cell ATAC pseudobulk by cell type (10x 5k PBMC, SnapATAC2)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BigWigAdapter",
        "name": "CD14 Mono",
        "group": "Myeloid",
        "color": "#aa40fc",
        "uri": "https://jbrowse.org/demos/scatac_pbmc5k/CD14_Mono.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "CD16 Mono",
        "group": "Myeloid",
        "color": "#8c564b",
        "uri": "https://jbrowse.org/demos/scatac_pbmc5k/CD16_Mono.bw"
      }
    ]
  },
  "displayDefaults": { "mark": "bar", "height": 100 }
}
```

Open the kilobase around rs2836882:

```text
chr21:39,094,144-39,095,144
```

<Figure caption="Predicted scATAC around rs2836882 in each ileum cell type for the risk allele and for the protective allele minus the risk allele, over measured scATAC from blood CD14 and CD16 monocytes." src="/img/alphagenome2/ets2_enhancer_atac.png" />

Accessibility is predicted in the macrophage and monocyte rows only, and the
protective allele lowers it across the enhancer in those rows. Stankey et al.
measured the same direction in primary macrophages, where the risk allele has
higher accessibility and PU.1 binding.

## Every base change at the enhancer

In silico mutagenesis (ISM) scores every single-base change in a window, here
the 64 bases around rs2836882, for its effect on _ETS2_ in macrophages:

<!-- from: scripts/build_alphagenome2_singlecell.sh -->

```python
ism = model.score_ism_variants(
    interval=window,
    ism_interval=ism_interval,
    condition=ileum['Macrophage'],
    variant_scorers=[variant_scorers.RECOMMENDED_VARIANT_SCORERS['SC_GENE_EXPRESSION']],
)
```

The script writes one BigWig per base mutated to, `ism_A.bw` to `ism_T.bw`, and
a `MultiQuantitativeTrack` draws them as a heatmap of four rows. A base's own
row stays empty, since changing a base to itself has no effect. The figure shows
the forward strand of the Reference sequence track, `hg38-refseq`, above it:

```json addtrack loc=chr21:39,094,602..39,094,686
{
  "type": "MultiQuantitativeTrack",
  "trackId": "ag2_ets2_ism",
  "name": "rs2836882 ISM, ETS2 expression in ileum macrophage, by base mutated to",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BigWigAdapter",
        "name": "A",
        "uri": "https://jbrowse.org/demos/alphagenome2_singlecell/ets2/ism_A.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "C",
        "uri": "https://jbrowse.org/demos/alphagenome2_singlecell/ets2/ism_C.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "G",
        "uri": "https://jbrowse.org/demos/alphagenome2_singlecell/ets2/ism_G.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "T",
        "uri": "https://jbrowse.org/demos/alphagenome2_singlecell/ets2/ism_T.bw"
      }
    ]
  },
  "displayDefaults": {
    "mark": "rect",
    "height": 80,
    "encoding": {
      "y": { "scale": { "domainMin": -0.35, "domainMax": 0.35 } },
      "color": {
        "scale": { "type": "linear", "scheme": "redblue", "domainMid": 0 }
      }
    }
  }
}
```

<Figure caption="The predicted effect on ETS2 expression in ileum macrophages of each base change in the 64 bases around rs2836882, one row per base mutated to, under the reference sequence." src="/img/alphagenome2/ets2_enhancer_ism.png" />

Every change at the seven bases `TGCGTCA`, rs2836882's G the fourth of them,
lowers _ETS2_. That is the AP-1-like motif the notebook reads off the same
scores.

## Reproduce it end to end

[`build_alphagenome2_singlecell.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_alphagenome2_singlecell.sh)
writes every track on this page with your API key. It:

1. scores the seven credible-set SNPs against the seven ileum cell types and
   writes one BED line per gene, SNP and cell type
2. predicts scATAC around rs2836882 for both alleles in each cell type, every
   base change around it, and the input gradient of _ETS2_
3. predicts scATAC at six PBMC marker loci for the cell types of
   [](/docs/tutorials/scrna_pseudobulk), to set beside the measured rows there
4. writes `config.json` over hg38 and the RefSeq genes, opening on _ETS2_

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_alphagenome2_singlecell.sh
# BASE=. writes track URIs relative to config.json, for a local copy
ALPHAGENOME_API_KEY=your_key BASE=. bash build_alphagenome2_singlecell.sh
```

Open `alphagenome2_singlecell_build/config.json` in
[JBrowse Desktop](/docs/quickstart_desktop) to browse the result. For other
variants, replace the credible set and the cell types at the top of the script's
Python block.

## See also

- [](/docs/tutorials/alphagenome)
- [](/docs/tutorials/scrna_pseudobulk)
- [](/docs/config/multiwiggleadapter)
- [](/docs/models/linearwiggledisplay)

## External links

- [AlphaGenome 2 announcement](https://deepmind.google/blog/alphagenome-2-deciphering-how-cells-read-dna-to-better-understand-disease/)
- [Fine-mapping the ETS2 locus](https://www.alphagenomedocs.com/colabs/v2/finemapping_ets2.html),
  the notebook this page follows
- [AlphaGenome API documentation](https://www.alphagenomedocs.com/)

## Citations

- Stankey et al. (2024).
  [A disease-associated gene desert directs macrophage inflammation through ETS2](https://doi.org/10.1038/s41586-024-07501-1)
- de Lange et al. (2017).
  [Genome-wide association study implicates immune activation of multiple integrin genes in inflammatory bowel disease](https://doi.org/10.1038/ng.3760)
