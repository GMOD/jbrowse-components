#!/usr/bin/env bash
#
# The wide half of the LCT sweep figure: per-site Weir & Cockerham Fst between
# the European panel and the rest of the 1000 Genomes release, across enough of
# chr2 for the lactase block to be a PEAK rather than the whole frame.
#
# WHY THIS EXISTS AS A SECOND FILE. scripts/build_lct_ld.sh computes the same
# statistic over chr2:133.8-137.2 Mb, which is the window the LD triangles need.
# Read at that scale the lane answers "which variant here is the most
# differentiated" and cannot answer "is here differentiated at all", since every
# site in it belongs to the same sweep. Review, twice: "it might be worth
# zooming out even more to see that fst is peaking here", then "we can make wider
# calculations if it results in better figure".
#
# It does. Over the 40 Mb below, rs4988235 is the highest-scoring site of
# 977,763, and the whole of the top ten is inside the block with it. Nothing in
# the other 39 megabases reaches it. That is the claim the narrow file could only
# assert.
#
# PER SITE, AND WINDOWING IS THE ONE THING THAT DESTROYS IT. This script was
# written windowed first, on the reasoning that a 40 Mb scan wants bins the way
# a Manhattan does, and the result says the opposite: at 100 kb bins with
# WEIGHTED_FST the block ranks 58th of 400 windows, under runs at 121.5 and
# 151.7 Mb that have nothing to do with lactase. A sweep differentiates a
# haplotype's own variants and leaves everything else on the same background, so
# a bin holding one sweep variant per few hundred ordinary ones averages down to
# the background. The bin size was not the problem and neither was the contrast:
# the same slice, unbinned, puts the block first outright. Don't re-add
# --fst-window-size here.
#
# AND THE FIGURE READS THIS PER SITE TOO, which took a second round to get to.
# 40 Mb across the capture is ~27 kb a pixel, so the lane was first drawn
# through the file's 40,960 bp zoom bin under `summaryScoreMode: 'max'` -- the
# summarization that at least keeps a peak, where `avg` over the same bin is the
# background. But max over ~950 sites is not the background either: outside the
# block those bins have a median of 0.160 against the 0.0002 of the sites they
# summarize, so half the drawn scatter was the bin rather than the data, and the
# lane's 99th percentile ran to 0.333 against a per-site 0.118. The spec pins
# `resolutionMultiplier: 0.001` and reads all 930k points -- one ~5.5 MB read,
# and only 13,676 of them are above the lane's 0.1 floor to draw.
#
# Same release, same panels, same estimator and same tool as build_lct_ld.sh, so
# the two lanes are one analysis at two scales rather than two datasets.
#
# Requires: bcftools (with libcurl), tabix, plink2, bedGraphToBigWig, curl, awk
# Usage:    bash scripts/build_lct_fst_scan.sh [outdir]
set -euo pipefail

OUTDIR="${1:-lct_fst_scan_build}"
PLINK="${PLINK:-plink2}"
COLLECTION=https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage
CHR2=$COLLECTION/working/20220422_3202_phased_SNV_INDEL_SV/1kGP_high_coverage_Illumina.chr2.filtered.SNV_INDEL_SV_phased_panel.vcf.gz
PED=$COLLECTION/20130606_g1k_3202_samples_ped_population.txt
UNREL=$COLLECTION/1000G_2504_high_coverage.sequence.index

# 40 Mb with LCT at the middle of it, so the background is symmetric and a reader
# is not being shown one flank. rs4988235 is chr2:135,851,076 on hg38.
REGION=chr2:116000000-156000000
PANEL_CODE=EUR
CAUSAL_POS=135851076
CHR2_LEN=242193529

mkdir -p "$OUTDIR"
cd "$OUTDIR"

OUT=lct_1kg38_chr2_fst_${PANEL_CODE,,}_vs_rest_scan.bw
SLICE=scan_pooled.vcf.gz

# ── Samples ──────────────────────────────────────────────────────────────────
# The same derivation build_lct_ld.sh uses, including the trailing-whitespace
# trim on SAMPLE_NAME: without it bcftools -S skips those rows with a warning
# and the comparison is quietly short a few samples.
[ -f ped.txt ] || curl -fsSL -o ped.txt "$PED"
[ -f unrel.txt ] || curl -fsSL -o unrel.txt "$UNREL"

col=$(grep -m1 '^#[^#]' unrel.txt | tr '\t' '\n' | nl | grep -w SAMPLE_NAME | awk '{print $1}')
awk -v c="$col" -F'\t' '!/^#/{gsub(/^[ \t]+|[ \t]+$/,"",$c); if($c!="") print $c}' unrel.txt |
  sort -u > unrelated.samples
awk -v p="$PANEL_CODE" 'NR>1 && $7==p{print $2}' ped.txt | sort > panel_all.samples
comm -12 panel_all.samples unrelated.samples > panel.samples
comm -23 unrelated.samples panel.samples > rest.samples
echo "unrelated: $(wc -l < unrelated.samples)"
echo "panel $PANEL_CODE: $(wc -l < panel.samples); rest: $(wc -l < rest.samples)"

# ── Slice ────────────────────────────────────────────────────────────────────
# Symbolic SV records are dropped for the same reason build_lct_ld.sh drops
# them, plus one this script hits directly: a region query returns every record
# whose START..END overlaps, so a single <INS:ME:SVA> annotated 92 Mb upstream
# comes back with the window and would open the scan's first bin there.
if [ ! -f "$SLICE" ]; then
  bcftools view -r "$REGION" -S unrelated.samples "$CHR2" \
    | bcftools view -e 'ALT[0]~"<"' -Oz -o "$SLICE"
fi
tabix -f -p vcf "$SLICE"
echo "sliced $REGION: $(bcftools index -n "$SLICE") records, $(du -h "$SLICE" | cut -f1)"

# ── Fst ──────────────────────────────────────────────────────────────────────
# plink2 wants the two panels as one categorical phenotype rather than as two
# sample lists, and wants FID beside IID: a #IID-only header is refused with
# "No entries correspond to loaded sample IDs" even when every ID matches.
# method=wc is Weir and Cockerham, which is what the caption names; plink2
# defaults to Hudson, and the two differ (0.165 against 0.183 over this slice).
# Verified against `vcftools --weir-fst-pop`: identical per site, 24480 of them.
{ printf '#FID\tIID\tPOP\n'
  awk '{print $1"\t"$1"\tPANEL"}' panel.samples
  awk '{print $1"\t"$1"\tREST"}' rest.samples; } > fst_pops.txt

# --output-chr chrM keeps the CHROM column spelled chr2 rather than plink2's
# bare 2, which is what the bedGraph and the bigWig need.
[ -f fst_site.PANEL.REST.fst.var ] || "$PLINK" --vcf "$SLICE" --double-id \
  --output-chr chrM --pheno fst_pops.txt \
  --fst POP method=wc report-variants vcols=chrom,pos,fst --out fst_site

# 1-based site -> bedGraph interval; drop the sites reported as nan, and
# floor the negative estimates at 0. Weir & Cockerham's is unbiased and goes
# below zero wherever the between-panel term is under the within-panel one,
# which over 40 Mb is most of the background; the lane is drawn on a 0.1.. axis
# and a negative would only widen the domain under its own floor.
awk 'NR>1 && $4!="nan" {v=$4<0?0:$4; printf "%s\t%d\t%d\t%.5f\n",$1,$2-1,$2,v}' \
  fst_site.PANEL.REST.fst.var | sort -k1,1 -k2,2n | awk '!seen[$2]++' > fst_site.bedgraph
printf 'chr2\t%s\n' "$CHR2_LEN" > hg38.chrom.sizes
bedGraphToBigWig fst_site.bedgraph hg38.chrom.sizes "$OUT"
echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"

# ── Evidence ─────────────────────────────────────────────────────────────────
# The figure's claim is that this locus is the peak of the span, so the RANK is
# what prints. A run that stopped putting it first would make the figure wrong
# rather than merely different.
awk 'NR>1 && $4!="nan"' fst_site.PANEL.REST.fst.var | sort -k4,4gr > fst_ranked.txt
echo
echo "top per-site Fst over $REGION:"
awk 'NR<=10 {printf "  %s:%s  %.4f\n",$1,$2,$4}' fst_ranked.txt
awk -v pos="$CAUSAL_POS" '$2==pos {r=NR} END {
       if (r) printf "  rs4988235 ranks %d of %d scored sites\n", r, NR
       else print "  rs4988235 is not among the scored sites"
     }' fst_ranked.txt
echo
# NR>1 is load-bearing, not defensive: awk compares a string field against a
# number as a STRING, so the header's WC_FST passes `> 0.35` and lands in a bin
# at position 0. Same trap as the sort in build_lct_ld.sh.
echo "how far the top of the axis reaches, in 1 Mb bins (sites over 0.35):"
awk 'NR>1 && $4!="nan" && $4>0.35 {printf "%d\n", int($2/1000000)}' fst_site.PANEL.REST.fst.var |
  sort -n | uniq -c | awk '{printf "  %s Mb: %s sites\n",$2,$1}'

cat <<EOF

Maintainers: the hosted figure reads $OUT, so a change to what this builds needs
it uploaded beside the other popgen demo assets. The bucket has no versioning,
so an overwrite is not recoverable — deploy with scripts/deploy-demo.sh, which
also invalidates the CloudFront path.

  scripts/deploy-demo.sh $(pwd)/$OUT popgen/$OUT
EOF
