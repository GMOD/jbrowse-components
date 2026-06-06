# SV-GWAS demo data

Structural-variant GWAS summary statistics for the JBrowse Manhattan display
(`plugins/gwas`). Unlike SNP GWAS, each association covers a genomic **range**
(deletions/duplications), which the `LinearManhattanDisplay` draws as a bar
spanning start→end rather than a point.

## Source

From "Genome-wide associations of structural variants with human traits through
imputation from long-read assemblies" (Yang Lab, Nat Genet 2026,
s41588-026-02612-z). Public, no auth:

- Per-phenotype GCTA fastGWA stats:
  `https://lab-storage.oss-cn-hangzhou.aliyuncs.com/pheweb_data/SV_data/{Binary,Continuous}/<trait>.SV.EUR.maf0.01.chrAuto.fastGWA.gz`
  - Continuous traits have 11 columns (`P`=10, `BETA`=8, `MAF`=11). Binary
    traits add SPA columns (15 total, `P`=13) — `convert_svgwas.awk` targets the
    Continuous layout.
  - `POS` is a single anchor; the SV range/type is **not** in this file.
- SV coordinates + type via AnnotSV:
  `https://lab-storage.oss-cn-hangzhou.aliyuncs.com/pheweb_data/SV_data/SV_annotation_by_AnnotSV.tsv`
  - Join key: fastGWA `SNP` == AnnotSV `ID` (e.g. `chr16_HQA241SV_53`).

## Hosted demo file

`test_data/config_svgwas.json` points at the prebuilt result (hg38, numeric
refNames resolved via the assembly alias file):

- `https://jbrowse.org/demos/svgwas/UKB_MCV_SV_GWAS.bed.gz` (+ `.tbi`)

Trait: Mean corpuscular volume (UKB 30040). Real signals include the chr16
HBA/alpha-globin deletion cluster, chr22 TMPRSS6, and chr6 HFE.

## Regenerating (any trait)

```sh
# 1. AnnotSV id -> chrom,start,end,type,len,gene (full-mode rows only)
awk -F'\t' 'NR>1 && $8=="full"{print $7"\t"$2"\t"$3"\t"$4"\t"$6"\t"$5"\t"$10}' \
  SV_annotation_by_AnnotSV.tsv > sv_map.tsv

# 2. join fastGWA -> ranged BED (cols: chrom start end name svtype svlen gene
#    neg_log_pvalue beta maf; neg_log_pvalue = -log10(P), P==0 capped at 350)
awk -f convert_svgwas.awk sv_map.tsv <(zcat <trait>.fastGWA.gz) > out.bed

# 3. header + sort + bgzip + tabix
printf '#chrom\tchromStart\tchromEnd\tname\tsvtype\tsvlen\tgene\tneg_log_pvalue\tbeta\tmaf\n' > final.bed
sort -k1,1V -k2,2n out.bed >> final.bed
bgzip final.bed && tabix -p bed final.bed.gz
```

Load with `GWASAdapter` (or `BedTabixAdapter` with
`scoreColumn: "neg_log_pvalue"`).
