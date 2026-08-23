---
title: GWAS / Manhattan track
description:
  Visualize genome-wide association study results as an interactive Manhattan
  plot
guide_category: Track types
---

**TL;DR:** The GWAS track renders results as a Manhattan plot: -log₁₀(p-value)
on the Y axis, genomic position on the X axis. Points support LocusZoom-style r²
LD coloring to show linkage to an index SNP.

<Figure caption="A GWAS track rendered as a Manhattan plot: each point is a variant, plotted by genomic position (X) and -log₁₀(p-value) (Y), so association peaks rise above the background." src="/img/gwas/manhattan.png" />

For a genome-wide example, the embedded
[Pan-UKB GWAS example](https://jbrowse.org/storybook/lgv/pan-ukb-gwas) browses
the full Pan-UK Biobank catalog of ~7,200 phenotypes, loading each trait's
summary statistics straight from the Pan-UKBB public S3 bucket.

## Example file

To try the workflow without preparing anything, paste this hg19 SLE GWAS summary
statistics file (with `neg_log_pvalue` as the score column) into the Add GWAS
track form:

```
https://s3.amazonaws.com/jbrowse.org/genomes/hg19/gwas/summary_stats.txt.gz
```

Its matching PLINK `.ld` file (1000G CEU reference panel) is already wired up in
the demo config, so the LD-colored view below opens ready to explore.

## Public data sources

Most public GWAS repositories use their own TSV column layout rather than the
BED format GWASAdapter requires, so a conversion step is needed before loading.
See the [config guide](/docs/config_guides/gwas_track) for the preprocessing
pipeline.

| Source                                                                  | Notes                                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [GWAS Catalog](https://www.ebi.ac.uk/gwas/downloads/summary-statistics) | Harmonized TSV; needs BED conversion + tabix                           |
| [Pan-UKB](https://pan.ukbb.broadinstitute.org)                          | bgzipped TSV; loads directly with `scoreColumn: neglog10_pval_meta_hq` |
| [FinnGen](https://finngen.fi/en/access_results)                         | TSV with raw `pval`; needs -log₁₀ transform + BED conversion           |
| [Open GWAS](https://gwas.mrcieu.ac.uk)                                  | VCF format; not directly compatible                                    |

## LD data

With an LD file loaded, points are colored by r² to an index SNP, revealing
which nearby variants are in linkage with the lead signal (see
[Add GWAS track workflow](#add-gwas-track-workflow) for how the index is
chosen).

<Figure caption="LD coloring at the STAT4 locus: the lead SNP is purple, and surrounding points shade by their r² to it, so the association signal and its linked variants stand out from the background." src="/img/gwas/locuszoom_ld.png" />

The embedded
[LocusZoom-style LD example](https://jbrowse.org/storybook/lgv/locus-zoom-ld)
shows this r² coloring running live in a React app.

The LD triangle is a separate feature: it draws r² between every pair of nearby
variants as a heatmap, and can compute it live from phased genotypes. See the
[linkage disequilibrium tutorial](/docs/tutorials/ld_human).

LD data must be in PLINK `--r2` output format (`.ld` or `.ld.gz`). Generate it
from:

- Your own cohort - `plink --r2 --ld-window-kb 1000 --ld-window-r2 0`
- Reference panel - 1000 Genomes phase 3 VCFs at
  `ftp.1000genomes.ebi.ac.uk/vol1/ftp/release/20130502/` (choose EUR, AFR, EAS,
  AMR, or SAS by population)

## Add GWAS track workflow

Open the track selector, click **Add track**, and choose **Add GWAS / Manhattan
track**.

**GWAS data (required)**

- _GWAS file_ - the `.bed.gz` or `.txt.gz`
- _GWAS tabix index_ - omit if the index is at `<file>.tbi`
- _Score column_ - column name for the -log₁₀(p) values (the
  [`scoreColumn`](/docs/config/gwasadapter/#slot-scorecolumn) slot)

**LD coloring (optional)**

Select a PLINK `.ld` or `.ld.gz` file. For bgzipped files a second field appears
for the tabix index.

Click **Submit**. In LD mode JBrowse auto-picks the highest-scoring loaded SNP
as the index; right-click any point or use the track menu to change it.

## See also

- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/variant_track)
- [Linkage disequilibrium tutorial](/docs/tutorials/ld_human)
- [](/docs/tutorials/bxd_qtl)
- [GWAS track configuration](/docs/config_guides/gwas_track)
- [GWASAdapter config schema](/docs/config/gwasadapter)
- [Gallery: variants and populations](/gallery/#variants)
