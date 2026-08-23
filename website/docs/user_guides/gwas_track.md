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

To try the workflow without preparing anything, paste this hg19 BMI GWAS summary
statistics file (with `neg_log_pvalue` as the score column) into the Add GWAS
track form:

```
https://s3.amazonaws.com/jbrowse.org/genomes/hg19/gwas/summary_stats.txt.gz
```

Its peaks are the ones a BMI scan is known for, FTO at chr16:53.8 Mb first by a
wide margin, then TMEM18, MC4R and SEC16B, so a view that lands on any of them
has something to show.

That file carries no LD of its own. The LD-colored demo below is a second pair,
`gwas_giant-bmi_meta_women-only.gz` with a PLINK table beside it, both under
`jbrowse.org/demos/gwas/`, which is what the demo config wires together.

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

LD data must be in PLINK LD table format, either 1.9's `.ld` or 2.0's `.vcor`,
bgzipped or not. Generate it from:

- Your own cohort - `plink2 --r2-unphased --ld-window-kb 1000 --ld-window-r2 0`,
  or 1.9's `plink --r2 --ld-window-kb 1000 --ld-window-r2 0`
- Reference panel - 1000 Genomes phase 3 at
  `ftp.1000genomes.ebi.ac.uk/vol1/ftp/release/20130502/` (choose EUR, AFR, EAS,
  AMR, or SAS by population). Point `bcftools` at the `.bcf` files under
  `supporting/bcf_files/` rather than the `.vcf.gz` beside them: the BCF and its
  `.csi` answer a remote region query in seconds, while the `.vcf.gz` index
  sends htslib to an offset that fails with "Illegal seek"

## Clumping the peak

A peak is one signal smeared across every variant in LD with the causal one.
`plink2 --clump` writes that down rather than leaving it to be read off the
colors: each clump is an index variant plus the variants whose signal it
accounts for, which loads as an interval track under the Manhattan lane.

The reference panel is a region of 1000 Genomes, fetched over HTTP without
downloading the file:

```bash
BCF=https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/release/20130502/supporting/bcf_files/ALL.chr16.phase3_shapeit2_mvncall_integrated_v5.20130502.genotypes.bcf
curl -fsSLO https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/release/20130502/integrated_call_samples_v3.20130502.ALL.panel
awk 'NR>1 && $3=="EUR"{print $1}' integrated_call_samples_v3.20130502.ALL.panel > eur.samples

# -r is a region request, so 900 kb costs 900 kb rather than the 450 MB chromosome
bcftools view -r 16:53400000-54300000 -S eur.samples -m2 -M2 -v snps \
  -q 0.01:minor -Oz -o fto.vcf.gz "$BCF"

# --set-missing-var-ids is not optional: plink2 refuses a dataset where the ID
# '.' appears twice, and an unnamed variant is common in a reference panel
plink2 --vcf fto.vcf.gz --double-id --set-missing-var-ids @:# \
  --rm-dup force-first --make-bed --out fto
```

`--clump` then reads the summary statistics themselves. The columns are named
rather than positional, and `--clump-log10 input-only` is what says the p-value
column is already -log10, as `neg_log_pvalue` is:

```bash
# plink2 reads the header, so the leading '#' on '#chrom' has to go
gzip -dc summary_stats.txt.gz | sed '1s/^#//' > stats.txt

plink2 --bfile fto --clump stats.txt --clump-log10 input-only \
  --clump-p-field neg_log_pvalue --clump-id-field rsid \
  --clump-log10-p1 7.3 --clump-log10-p2 2 --clump-r2 0.2 --clump-kb 500 --out fto

# clump to BED: SP2 names the members, and the .bim says where each one is, so
# the span is their lowest and highest position
awk 'NR==FNR{pos[$2]=$4; next} FNR>1 {n=split($11,m,","); lo=$2; hi=$2
    for(i=1;i<=n;i++){p=pos[m[i]]; if(p){if(p<lo)lo=p; if(p>hi)hi=p}}
    printf "%s\t%d\t%d\t%s (%d variants)\n", $1, lo-1, hi, $3, $5}' \
  fto.bim fto.clumps | sort -k2,2n > clumps.bed
```

Over the example file that gives three clumps at FTO, and the big one is the
answer to what the peak is tagging: index `rs1121980`, 51 variants, spanning 51
kb of FTO's first intron. Load `clumps.bed` through a
[`BedAdapter`](/docs/config/bedadapter) beside the GWAS track.

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
