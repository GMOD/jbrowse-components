#!/usr/bin/env bash
#
# Build the six-population subsample of the LCT slice that a haplotype-block
# figure at LCT needs: one row per haplotype, columns of variants, the swept
# haplotype a solid slab.
#
# NO FIGURE READS THIS YET: the output is not hosted, and website/scripts/specs
# gates its live links on assets that resolve. Build it, upload it (the command
# is printed at the end), and the spec can then be added. Everything else the
# figure needs has been verified against a local build.
#
# WHY A SUBSAMPLE EXISTS AT ALL. The figure was first attempted against the
# hosted full-release slices and never rendered (removed in 7dd1e36ece). The
# arithmetic says why, and is the thing to check BEFORE rendering anything:
#
#   2504 samples x 2 = 5008 haplotype rows. In a 900 px lane that is 0.18 px a
#   row, so every row is averaged into its neighbours and the lane is a flat
#   wash. 150 samples -> 300 rows -> 3.0 px a row, which is the proportion
#   dog10k-igf1-haplotype (167 rows) already reads at.
#
# Weight followed the same ratio: the pooled slice is 16.6 MB over 2504 samples
# and never reached ready inside 600 s; this is 2.7 MB and clusters in seconds.
#
# WHAT THE FIGURE THEN SHOWS, and why it needs no polarised or reordered file.
# Raw ALT/REF colouring is NOT a haplotype block — a block is a set of alleles
# travelling together, and which of them is the ALT allele varies site to site,
# so an unordered matrix of common variants is a plaid whatever the row count.
# What makes the block appear is ORDERING: the display's own "cluster by
# genotype" run puts near-identical haplotypes adjacent, and the lactase
# persistence haplotype is young and therefore internally uniform, so it lands
# as one solid slab. Clustering is given no knowledge of rs4988235 and recovers
# its carriers anyway, which is the figure's whole claim. Nothing here rewrites
# a genotype or an allele; the file is a plain sample subset.
#
# WHICH SIX POPULATIONS, and why not all 26: the claim is that the block is
# carried at very different frequencies, so the set has to span the range rather
# than sample it evenly. rs4988235-A frequencies in the full release, which this
# script re-prints from the data rather than asserting:
#
#   CEU 73.7%  FIN 59.1%  PJL 26.0%  TSI 8.9%  YRI 0.0%  CHB 0.0%
#
# TSI against CEU is the load-bearing pair — both European, 8.9% against 73.7% —
# because it stops the figure being read as "Europeans have it". PJL says it is
# not a European allele at all. YRI and CHB are two independent zeroes, so the
# absence cannot be one population's quirk.
#
# EQUAL N PER POPULATION, 25 each. `sortSourcesByAttribute` orders groups by
# size (largest first, ties alphabetical), so equal groups give a stable
# alphabetical band order — and equal band heights are what let a reader compare
# the slab fractions between bands by eye. Unequal N would let the band ORDER
# encode frequency, which reads better as a staircase but silently makes band
# height mean nothing.
#
# Sampling is the first 25 sample ids in sorted order, not a random draw, so the
# file is reproducible with no seed to record. n=25 costs some precision: the
# subsample's CEU comes out 82% against the release's 73.7% (a ~6% standard
# error on 50 haplotypes). The figure's claim is the ordering of the bands, not
# the exact heights, and the script prints both so the gap is visible.
#
# Data: 1000 Genomes phase 3 (20130502) phased integrated callset, hg19. Cut
# from the pooled LCT slice that scripts/build_lct_ld.sh already built and
# uploaded, not from the EBI release, so this is a seconds-long run against an
# asset whose provenance that script documents.
#
#   1000 Genomes Project Consortium. A global reference for human genetic
#   variation. Nature 2015;526:68-74.
#
# THE SETTINGS THE PICTURE NEEDS are `renderingMode: 'phased'` (two-tone, one row
# per chromosome, so a het is not averaged into one row) and `runClustering: true`
# over this window. That pair used to draw nothing — no dendrogram, rows in
# adapter order — because `applyClusterOrder` re-appended every sample on top of
# its own haplotypes and the layout then expanded twice: 300 haplotypes became
# 450 layout rows and 600 drawn rows against a 300-leaf tree. Fixed, with the
# measurement, in the commit that added this line's neighbour.
#
# Requires: bcftools (>= 1.17, with libcurl), tabix, curl, awk
# Usage:    bash scripts/build_lct_haploblock.sh [outdir]
set -euo pipefail

OUTDIR="${1:-lct_haploblock_build}"
POOLED=https://jbrowse.org/demos/popgen/lct_1kg_chr2_pooled_wide.vcf.gz
PANEL=https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/release/20130502/integrated_call_samples_v3.20130502.ALL.panel

POPS="CEU FIN TSI PJL YRI CHB"
PER_POP=25
# rs4988235, the lactase-persistence enhancer variant, hg19. Named chr:pos
# because the release carries no rs IDs here.
CAUSAL=2:136608646
OUT=lct_1kg_chr2_6pop.vcf.gz

# The figure's own geometry, so the arithmetic below is against the real lane
# rather than a guess. Keep in step with the spec in website/scripts/specs/ld.ts.
LANE_H=800
LANE_W=1080
MAF=0.35
WINDOW=2:135500000-137000000

mkdir -p "$OUTDIR"
cd "$OUTDIR"

[ -f panel.txt ] || curl -fsSL -o panel.txt "$PANEL"

# ── Samples ──────────────────────────────────────────────────────────────────
: > sub.samples
for p in $POPS; do
  n=$(awk -v p="$p" 'NR>1 && $2==p{print $1}' panel.txt | sort | tee >(head -"$PER_POP" >> sub.samples) | wc -l)
  echo "  $p: $n in the release, taking first $PER_POP"
done
echo "subsample: $(wc -l < sub.samples) samples, $(( $(wc -l < sub.samples) * 2 )) haplotype rows"

# ── Slice ────────────────────────────────────────────────────────────────────
# -S never reorders: the output keeps the callset's own sample order whatever
# order the id list is in, so the population bands come from groupBy at display
# time and not from this file.
if [ ! -f "$OUT" ]; then
  bcftools view -S sub.samples --force-samples -Oz -o "$OUT" "$POOLED"
fi
tabix -f -p vcf "$OUT"
echo "wrote $OUT ($(bcftools index -n "$OUT") records, $(du -h "$OUT" | cut -f1))"

# ── The arithmetic that decides whether this can render at all ───────────────
COLS=$(bcftools view -m2 -M2 -v snps -q "$MAF:minor" -H -r "$WINDOW" "$OUT" | wc -l)
ROWS=$(( $(wc -l < sub.samples) * 2 ))
echo
echo "geometry, against the ${LANE_W}x${LANE_H} px lane the figure draws:"
awk -v r="$ROWS" -v c="$COLS" -v h="$LANE_H" -v w="$LANE_W" 'BEGIN{
  printf "  %d haplotype rows / %d px  = %.2f px per row\n", r, h, h/r
  printf "  %d columns / %d px = %.2f px per column\n", c, w, w/c
  if (h/r < 1 || w/c < 1)
    print "  SUB-PIXEL: this cannot render as a block. Cut samples or narrow the window."
  else print "  both above 1 px, so rows and columns are individually visible"
}'

# ── The claim, as numbers ────────────────────────────────────────────────────
# rs4988235 itself is MAF 0.30 here and so sits BELOW the figure's 0.35 filter:
# it is not one of the columns drawn. That is the point rather than a problem —
# the clustering never sees the causal variant and recovers its carriers from
# the surrounding haplotype alone.
echo
echo "rs4988235-A frequency, release vs this subsample:"
for src in ALL SUB; do
  if [ "$src" = ALL ]; then
    curl -fsSL "https://jbrowse.org/demos/popgen/lct_1kg_chr2_pooled_wide.vcf.gz" -o /dev/null 2>/dev/null || true
    bcftools query -r "$CAUSAL" -f '[%SAMPLE=%GT\n]' "$POOLED" > gt.$src
  else
    bcftools query -r "$CAUSAL" -f '[%SAMPLE=%GT\n]' "$OUT" > gt.$src
  fi
done
awk -v pops="$POPS" '
  NR==FNR { if (FNR>1) pop[$1]=$2; next }
  { split($0,a,"="); s=a[1]; gt=a[2]; p=pop[s]; if (p=="") next
    n=split(gt,al,/[|\/]/)
    for (i=1;i<=n;i++) { if (al[i]==".") continue; d[FILENAME][p]++; if (al[i]!="0") c[FILENAME][p]++ } }
  END {
    split(pops,P," ")
    printf "  %-5s %10s %12s\n", "pop", "release", "subsample"
    for (j=1;j<=6;j++) { p=P[j]
      printf "  %-5s %9.1f%% %11.1f%%\n", p, 100*c["gt.ALL"][p]/d["gt.ALL"][p], 100*c["gt.SUB"][p]/d["gt.SUB"][p] }
  }' <(awk 'NR>1{print $1"\t"$2}' panel.txt) gt.ALL gt.SUB

cat <<EOF

Done. Nothing reads $OUT yet (see the header). When a figure does, upload it and
its .tbi beside the other popgen demo assets:

  aws s3 cp $OUT s3://jbrowse.org/demos/popgen/
  aws s3 cp $OUT.tbi s3://jbrowse.org/demos/popgen/

Both files are new names, so this adds rather than overwrites.
EOF
