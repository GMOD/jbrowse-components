---
title: GWAS / Manhattan track
description: Visualize genome-wide association study results as an interactive Manhattan plot
guide_category: Track types
---

The GWAS track renders GWAS results as a Manhattan plot — -log₁₀(p-value) on
the Y axis, genomic position on the X axis. Points support LocusZoom-style r²
LD coloring to show linkage to an index SNP.

[Live demo](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_gwas.json)

## Example files

The JBrowse demo data includes ready-to-load files. Paste these URLs directly
into the Add GWAS track workflow:

**GWAS results** (hg19, SLE GWAS, `neg_log_pvalue` column):
```
https://s3.amazonaws.com/jbrowse.org/genomes/hg19/gwas/summary_stats.txt.gz
```

**LD file** (PLINK `.ld`, SLE study, 1000G CEU reference panel):

The LD file is bundled with the demo config. Open the
[live demo](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_gwas.json)
to see an already-configured LD-colored view.

## Public data sources

Most public GWAS repositories use their own TSV column layout rather than the
BED format GWASAdapter requires, so a conversion step is needed before loading.
See the [config guide](/docs/config_guides/gwas_track) for the preprocessing
pipeline.

| Source | Notes |
|--------|-------|
| [GWAS Catalog](https://www.ebi.ac.uk/gwas/downloads/summary-statistics) | Harmonized TSV; needs BED conversion + tabix |
| [Pan-UKB](https://pan.ukbb.broadinstitute.org) | bgzipped TSV; loads directly with `scoreColumn: neglog10_pval_meta_hq` |
| [FinnGen](https://finngen.fi/en/access_results) | TSV with raw `pval`; needs -log₁₀ transform + BED conversion |
| [Open GWAS](https://gwas.mrcieu.ac.uk) | VCF format; not directly compatible |

## LD data

LD data must be in PLINK `--r2` output format. Generate it from:

- **Your own cohort** — `plink --r2 --ld-window-kb 1000 --ld-window-r2 0`
- **Reference panel** — 1000 Genomes phase 3 VCFs at
  `ftp.1000genomes.ebi.ac.uk/vol1/ftp/release/20130502/` (choose EUR, AFR,
  EAS, AMR, or SAS by population)

## Add GWAS track workflow

Open the track selector, click **Add track**, and choose **Add GWAS / Manhattan
track**.

**GWAS data (required)**

- *GWAS file* — the `.bed.gz` or `.txt.gz`
- *GWAS tabix index* — omit if the index is at `<file>.tbi`
- *Score column* — column name for the -log₁₀(p) values (default: `neg_log_pvalue`)

**LD coloring (optional)**

Select a PLINK `.ld` or `.ld.gz` file. For bgzipped files a second field
appears for the tabix index.

Click **Submit**. In LD mode JBrowse auto-picks the highest-scoring loaded SNP
as the index; right-click any point or use the track menu to change it.

## Significance lines

Reference lines mark the conventional GWAS cutoffs (genome-wide 5 × 10⁻⁸,
suggestive 1 × 10⁻⁵). Toggle via **Show significance lines** in the track
menu. Thresholds are configurable — see the
[config guide](/docs/config_guides/gwas_track).
