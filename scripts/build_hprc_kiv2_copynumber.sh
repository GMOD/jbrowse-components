#!/usr/bin/env bash
# Copy number at the LPA KIV-2 array, for the HPRC release 2 samples that also
# carry a 1000 Genomes read-depth track.
#
# THIS IS A NEGATIVE RESULT, kept because the route is an obvious one to try
# again. The graph cannot give a copy count -- rGFA tags and `gfatools bubble`
# state the distinct sequence a bubble can hold, never how many times one
# haplotype repeats it -- so read depth looks like the way to get one, and 100
# of the 231 release 2 samples have a depth track, which makes the join look
# solid. It is not: over this array the depth values do not measure copy number.
#
# Checked against copy counts derived from the assemblies themselves (map the
# KIV-2 consensus back onto a haplotype's own chr6; the tandem run is the
# contiguous stretch of hits one period apart), 11 haplotypes give
# Spearman rho = +0.19. Depth CN 5 lands on 8 and 9 copies where depth CN 2
# lands on 17 to 23. The mechanism is in the raw bins this script prints: every
# sample gets ONE flat value spanning exactly chr6:160,611,363-160,646,996, the
# same breakpoints in all of them, which is what a k-mer depth method does over
# a region where no k-mer is unique. The array is emitted as one collapsed
# segment and the number attached to it is not a count of anything.
#
# So do not build a copy-number figure on this. The assembled sequence is the
# only thing that gets the array right, and one copy per row against a consensus
# unit is how to draw it.
#
# Two published panels, neither built here:
#   - HPRC release 2's wave VCF, whose sample columns are the assembled cohort
#   - the Kidd lab's QuicK-mer2 1kb copy number for the 2504-sample 1000 Genomes
#     panel, mirrored on jbrowse.org, sample list derived from the lab's own
#     UCSC trackDb the same way scripts/build_1000g_cnv_zarr.sh derives it
#
# Needs: htslib (tabix), curl, and UCSC's bigWigToBedGraph
# (https://hgdownload.soe.ucsc.edu/admin/exe/, one binary, no install):
#   curl -fO https://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64/bigWigToBedGraph
#   chmod +x bigWigToBedGraph && sudo mv bigWigToBedGraph /usr/local/bin/
#
# Usage:
#   bash build_hprc_kiv2_copynumber.sh [outdir]
set -euo pipefail

OUT=${1:-hprc_kiv2_cn}
mkdir -p "$OUT/bw"

WAVE_VCF=https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/hprc-v2.0-mc-grch38.wave.vcf.gz
TRACKDB=https://raw.githubusercontent.com/KiddLab/kmer_1KG/master/kmer-1kg.trackDb.txt
BW_BASE=https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv

# The KIV-2 array itself, not the whole of LPA. LPA spans
# chr6:160,531,482-160,664,275 and most of it is single copy in everyone, so a
# mean over the gene washes the array out; this is the interval over which the
# depth panel actually varies, and it sits inside the bubble the graph reports.
KIV2_CHROM=chr6
KIV2_START=160611363
KIV2_END=160646996

# --- the two sample lists, each from its own publisher -----------------------

if [ ! -s "$OUT/hprc_samples.txt" ]; then
  echo "reading the HPRC cohort from the wave VCF header"
  tabix -H "$WAVE_VCF" | tail -1 | tr '\t' '\n' |
    grep -E '^(HG|NA)[0-9]+$' | sort -u >"$OUT/hprc_samples.txt"
fi
echo "HPRC release 2: $(wc -l <"$OUT/hprc_samples.txt") assembled samples"

if [ ! -s "$OUT/cnv_samples.tsv" ]; then
  echo "deriving the copy-number panel from $TRACKDB"
  curl -sfL "$TRACKDB" |
    sed -n 's#^bigDataUrl kmer-1kg/\([A-Z]*\)/\([^.]*\)\..*#\2\t\1#p' \
      >"$OUT/cnv_samples.tsv"
fi
echo "1000 Genomes depth panel: $(wc -l <"$OUT/cnv_samples.tsv") samples"

# --- the join ----------------------------------------------------------------

awk -F'\t' 'NR==FNR{h[$1]=1;next} ($1 in h)' \
  "$OUT/hprc_samples.txt" "$OUT/cnv_samples.tsv" >"$OUT/join.tsv"
JOINT=$(wc -l <"$OUT/join.tsv")
echo "in both: $JOINT samples with haplotypes in the graph AND a depth track"

# --- measure -----------------------------------------------------------------

echo "fetching $JOINT bigWigs (~0.5 MB each, skipping any already here)"
while IFS=$'\t' read -r s pop; do
  [ -s "$OUT/bw/$s.bw" ] || printf '%s\t%s\n' "$s" "$pop"
done <"$OUT/join.tsv" |
  xargs -r -P 12 -n2 sh -c 'curl -sf -m 120 -o '"$OUT"'/bw/$0.bw "'"$BW_BASE"'/$1/$0.qm2.CN.1k.bw" || echo "  no bigWig for $0" >&2'

: >"$OUT/kiv2_cn.tsv"
while IFS=$'\t' read -r s pop; do
  [ -s "$OUT/bw/$s.bw" ] || continue
  bigWigToBedGraph -chrom="$KIV2_CHROM" -start="$KIV2_START" -end="$KIV2_END" \
    "$OUT/bw/$s.bw" "$OUT/.win.bg" 2>/dev/null || continue
  # Length-weighted, since bedGraph runs are variable width. Rounded to the
  # nearest integer only for the histogram: QuicK-mer2 emits a continuous
  # estimate and the integers are the interpretation, not the measurement.
  awk -F'\t' -v s="$s" -v p="$pop" \
    '{v+=$4*($3-$2); w+=$3-$2} END{if(w) printf "%s\t%s\t%.2f\n", s, p, v/w}' \
    "$OUT/.win.bg" >>"$OUT/kiv2_cn.tsv"
done <"$OUT/join.tsv"
rm -f "$OUT/.win.bg"

sort -k3,3gr "$OUT/kiv2_cn.tsv" -o "$OUT/kiv2_cn.tsv"

# --- what the tutorial quotes ------------------------------------------------

echo
echo "KIV-2 copy number over $KIV2_CHROM:$KIV2_START-$KIV2_END"
echo "measured in $(wc -l <"$OUT/kiv2_cn.tsv") samples that are in both panels"
echo
awk -F'\t' '{printf "%d\n", $3+0.5}' "$OUT/kiv2_cn.tsv" | sort -n | uniq -c |
  awk '{printf "  %2s copies  %3s samples  ", $2, $1;
        for(i=0;i<$1;i++) printf "#"; print ""}'
echo
echo "the ladder the figure draws, one sample per level, highest first:"
for lvl in 8 7 5 4 2 1; do
  awk -F'\t' -v L="$lvl" \
    '($3+0.5)>=L && ($3+0.5)<L+1 {printf "  %-9s %-4s %s copies\n", $1, $2, L; exit}' \
    "$OUT/kiv2_cn.tsv"
done
echo
echo "full table: $OUT/kiv2_cn.tsv"
