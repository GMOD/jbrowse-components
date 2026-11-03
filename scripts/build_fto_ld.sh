#!/usr/bin/env bash
# The all-pairs LD table the LocusZoom example's triangle draws: r2 and D'
# between every pair of common SNVs across the FTO window, over the 1000
# Genomes phase 3 European samples, on hg19 as the GIANT BMI scan is.
#
# The example's other LD file, plink.ld.tab.gz, lists each SNP's r2 to the
# index SNP only, which colors the Manhattan points and leaves a triangle one
# row deep.
#
# Usage: scripts/build_fto_ld.sh [outdir]
#   then scripts/deploy-demo.sh <outdir>/fto_eur.ld.gz gwas/fto_eur.ld.gz
#   and  scripts/deploy-demo.sh <outdir>/fto_eur.ld.gz.csi gwas/fto_eur.ld.gz.csi
set -euo pipefail

out="${1:-fto_ld}"
mkdir -p "$out"
cd "$out"

release=https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/release/20130502

curl -fsSL -o all.panel \
  "$release/integrated_call_samples_v3.20130502.ALL.panel"
awk '$3 == "EUR" { print $1 }' all.panel > eur.samples

# the BCF and its .csi answer a region query by range request; the .vcf.gz
# index beside them sends htslib to an offset that fails
bcftools view -r 16:53600000-54000000 -S eur.samples -m2 -M2 -v snps \
  -Oz -o eur.snvs.vcf.gz \
  "$release/supporting/bcf_files/ALL.chr16.phase3_shapeit2_mvncall_integrated_v5.20130502.genotypes.bcf"

# 0.05 keeps the common variants, the ones a GWAS scan reports
plink --vcf eur.snvs.vcf.gz --double-id --set-missing-var-ids @:# --maf 0.05 \
  --r2 dprime --ld-window 999999 --ld-window-kb 1000 --ld-window-r2 0 \
  --out fto_eur

# tabix needs tab-separated columns and a commented header; plink pads with
# spaces
awk 'NR==1{$1=$1; print "#" $0; next} {$1=$1; print}' OFS='\t' \
  fto_eur.ld | bgzip > fto_eur.ld.gz
tabix -C -s 1 -b 2 -e 2 -f fto_eur.ld.gz
