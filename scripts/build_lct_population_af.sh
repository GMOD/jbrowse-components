#!/usr/bin/env bash
#
# Build one bigWig per population of each variant's alt allele frequency across
# the LCT slice, for the per-population rows in
# website/docs/tutorials/ld_human.md.
#
# The output is hosted at jbrowse.org/demos/popgen/ and drives the
# ld/lct_population_af figure. It reads the pooled slice scripts/build_lct_ld.sh
# built, the release's 2504 unrelated samples, so every population's frequency
# is over all of its unrelated samples rather than the 25 the haplotype matrix
# subsamples.
#
# The populations are the haplotype matrix's six, which span rs4988235's
# frequency from common to absent; the script prints that variant's row so the
# drawn bars can be checked against it.
#
# Requires: bcftools (>= 1.17), bedGraphToBigWig, curl, awk
# Usage:    bash scripts/build_lct_population_af.sh [outdir]
set -euo pipefail

OUTDIR="${1:-lct_population_af_build}"
POOLED=https://jbrowse.org/demos/popgen/lct_1kg38_chr2_pooled_wide.vcf.gz
PED=https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/20130606_g1k_3202_samples_ped_population.txt

POPS="CEU FIN PJL TSI YRI CHB"
# rs4988235, the lactase-persistence enhancer variant, chr2:135,851,076 on hg38
CAUSAL_POS=135851076

mkdir -p "$OUTDIR"
cd "$OUTDIR"

[ -f ped.txt ] || curl -fsSL -o ped.txt "$PED"
# a local copy: htslib's libcurl can fail on HTTP/2 framing against the CDN
[ -f pooled.vcf.gz ] || curl -fsSL -o pooled.vcf.gz "$POOLED"

# sample and population, tab-separated, for the unrelated samples of the six:
# the table bcftools +fill-tags -S reads
bcftools query -l pooled.vcf.gz > available.samples
awk -v pops="$POPS" '
  BEGIN { n = split(pops, p, " "); for (i = 1; i <= n; i++) keep[p[i]] = 1 }
  NR == FNR { have[$1] = 1; next }
  FNR > 1 && ($6 in keep) && ($2 in have) { print $2 "\t" $6 }
' available.samples ped.txt > pops.txt

# -S gives fill-tags the groups, and -t AF writes AF_<group> for each
# norm -d both keeps one record per position, so no two bedGraph intervals
# overlap
bcftools view -m2 -M2 -v snps -Ou pooled.vcf.gz |
  bcftools norm -d both -Ou |
  bcftools +fill-tags -Ou -- -S pops.txt -t AF |
  bcftools query \
    -f '%CHROM\t%POS0\t%END\t%AF_CEU\t%AF_FIN\t%AF_PJL\t%AF_TSI\t%AF_YRI\t%AF_CHB\n' \
    > af.tsv

# one bedGraph per population, columns 4 to 9 of af.tsv, then a bigWig each
printf 'chr2\t242193529\n' > hg38.chrom.sizes
column=4
for pop in CEU FIN PJL TSI YRI CHB; do
  cut -f 1-3,$column af.tsv > "af_$pop.bedgraph"
  bedGraphToBigWig "af_$pop.bedgraph" hg38.chrom.sizes "lct_1kg38_chr2_af_$pop.bw"
  column=$((column + 1))
done

echo "rs4988235 alt allele frequency, from the bigWigs' input:"
awk -v pos="$CAUSAL_POS" -v pops="$POPS" '
  $3 == pos { n = split(pops, p, " "); for (i = 1; i <= n; i++) printf "  %-4s %.3f\n", p[i], $(i + 3) }
' af.tsv
