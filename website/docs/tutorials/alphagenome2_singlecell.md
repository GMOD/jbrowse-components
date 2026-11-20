---
title: AlphaGenome 2 predictions by cell type
description:
  View AlphaGenome 2's predicted effect of each IBD credible-set SNP at ETS2 as
  one row per immune cell type
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

An inflammatory bowel disease association on chromosome 21 fine-maps to seven
SNPs in 1.2 kb of gene desert, 289 kb from the _ETS2_ promoter. AlphaGenome 2
predicts a variant's effect on expression and on chromatin accessibility
separately for each cell type it was trained on. Drawn as one row per cell type
along the chromosome, those predictions show which SNP has an effect, on which
gene, and in which cell types, following DeepMind's own worked example. At
_ETS2_ and the enhancer between _ETS2_ and _PSMG1_, we:

- load the credible set as a variant track
- load each SNP's predicted effect on expression as a multi-wiggle track, one
  row per ileum immune cell type
- compare the seven SNPs in macrophages in a second multi-wiggle track
- open the enhancer and load predicted single-cell ATAC (scATAC) per cell type,
  for the risk allele and for the change the protective allele makes

:::caution Predictions

Every track on this page except the credible set and the genes is a model's
output. The rows follow DeepMind's
[fine-mapping notebook](https://www.alphagenomedocs.com/colabs/v2/finemapping_ets2.html)
for this locus.

:::

## Prerequisites

- nothing beyond a web browser to follow the page
- to make the tracks for your own variants, an
  [AlphaGenome API key](https://www.alphagenomedocs.com/installation.html) and
  Python 3.10 or later with `pip install alphagenome pyBigWig`

## The data

You don't need these files to follow the page: every track reads a hosted
result. The predictions come from the AlphaGenome API, which the
[build script](#reproduce-it-end-to-end) calls with your key, and the credible
set is the seven SNPs SuSiE kept from the IBD GWAS (study GCST004133) in Stankey
et al. (2024).

## Loading GRCh38

AlphaGenome 2 predicts from GRCh38 sequence, and the BigWigs below use its
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
the common risk allele at every SNP, and the alternate is protective:

```json addtrack loc=chr21:39,093,000..39,095,400
{
  "trackId": "ets2_ibd_credible_set",
  "name": "IBD credible set at chr21q22",
  "uri": "https://jbrowse.org/demos/alphagenome2_singlecell/ets2/credible_set.vcf.gz",
  "assemblyNames": ["hg38"]
}
```

## Predicted expression effects as BigWigs

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

A score is one log fold change per gene, and a BigWig holds a value per base, so
the script paints each gene's span with that gene's score. One BigWig per cell
type then draws as one row:

<!-- from: scripts/build_alphagenome2_singlecell.sh -->

```python
def paint_genes(frame):
    per_gene = frame.groupby('gene_name')['raw_score'].mean()
    per_gene = per_gene[per_gene.index.isin(genes.index)]
    painted = np.zeros(window.end - window.start)
    # where two genes overlap, the larger effect is painted last and shows
    for gene in per_gene.abs().sort_values().index:
        lo = max(int(genes.at[gene, 'Start']) - window.start, 0)
        hi = min(int(genes.at[gene, 'End']) - window.start, len(painted))
        painted[lo:hi] = per_gene[gene]
    return [(window.chromosome, window.start, painted)]
```

## rs2836882's effect on expression in each cell type

One `MultiQuantitativeTrack` holds the seven cell types, myeloid rows first. The
fence lists three; the hosted config,
https://jbrowse.org/demos/alphagenome2_singlecell/config.json, has all seven as
`ag2_ets2_expression_by_cell_type`:

```json addtrack loc=chr21:38,790,000..39,330,000
{
  "type": "MultiQuantitativeTrack",
  "trackId": "ag2_ets2_expression_by_cell_type",
  "name": "rs2836882 effect on expression, by ileum cell type",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BigWigAdapter",
        "name": "Macrophage",
        "group": "Myeloid",
        "color": "#d62728",
        "uri": "https://jbrowse.org/demos/alphagenome2_singlecell/ets2/expression_effect_Macrophage.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "Monocyte",
        "group": "Myeloid",
        "color": "#ff7f0e",
        "uri": "https://jbrowse.org/demos/alphagenome2_singlecell/ets2/expression_effect_Monocyte.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "B cell",
        "group": "Lymphoid",
        "color": "#1f77b4",
        "uri": "https://jbrowse.org/demos/alphagenome2_singlecell/ets2/expression_effect_B_cell.bw"
      }
    ]
  },
  "displayDefaults": {
    "mark": "bar",
    "height": 240,
    "encoding": {
      "y": {
        "scale": { "domainMin": -0.3, "domainMax": 0.3 },
        "axis": { "title": "log fold change" }
      }
    }
  }
}
```

A pinned symmetric `domainMin` and `domainMax` keep zero at the middle of every
row, so a row with no effect draws as a flat line.

The second track, `ag2_ets2_macrophage_by_snp` in the hosted config, has one row
per credible-set SNP, each the SNP's effect in macrophages. Open both over the
span from _ETS2_ to _BRWD1_:

```text
chr21:38,790,000-39,330,000
```

<Figure caption="Predicted expression effects from ETS2 to BRWD1: rs2836882 in each ileum cell type, then each credible-set SNP in macrophages." src="/img/alphagenome2/ets2_expression_effects.png" />

The macrophage and monocyte rows fall below zero over _ETS2_, and the lymphoid
rows stay flat. _PSMG1_ and _BRWD1_, the genes nearer the SNPs, barely move. In
the second track only rs2836882 has an effect, although rs2836878 has the higher
PIP.

## Predicted accessibility at the enhancer

The variant prediction behind the BigWigs below is `predict_variants` with
`OutputType.SC_ATAC`, one call per cell type, which returns the predicted scATAC
for the reference and the alternate sequence. The script keeps the 10x Cell
Ranger track, as the notebook does, and writes the reference and the alternate
minus the reference as two BigWigs per cell type.

AlphaGenome 2 was trained on single-cell expression from these ileum cell types
but on no scATAC from them, so its scATAC for them is imputed, and the track
names say so. `supported_conditions()` lists, per cell type and output, whether
a prediction is `observed` or imputed.

Load the two tracks the same way as the expression track, from
`atac_reference_<Cell_type>.bw` and `atac_change_<Cell_type>.bw`; the hosted
config has them as `ag2_ets2_atac_reference` and `ag2_ets2_atac_change`. Then
open the kilobase around rs2836882:

```text
chr21:39,094,144-39,095,144
```

<Figure caption="Predicted scATAC around rs2836882 in each ileum cell type, for the risk allele and for the protective allele minus the risk allele." src="/img/alphagenome2/ets2_enhancer_atac.png" />

Accessibility is predicted in the macrophage and monocyte rows only, and the
protective allele lowers it across the enhancer in those rows. Stankey et al.
measured the same direction in primary macrophages, where the risk allele has
higher accessibility and PU.1 binding.

## Reproduce it end to end

[`build_alphagenome2_singlecell.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_alphagenome2_singlecell.sh)
writes every track on this page with your API key. It:

1. scores the seven credible-set SNPs against the seven ileum cell types and
   paints each cell type's gene scores into a BigWig
2. predicts scATAC around rs2836882 for both alleles in each cell type
3. predicts scATAC at six PBMC marker loci for the cell types of
   [](/docs/tutorials/scrna_pseudobulk), to set beside the measured rows there
4. writes `config.json` over hg38 and the RefSeq genes

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
