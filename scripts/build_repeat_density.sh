#!/usr/bin/env bash
#
# Per-repeat-class density tracks for GRCh38 and T2T-CHM13v2.0, as one bigWig
# per class per assembly, for the multi-wiggle lanes in
# website/docs/tutorials/pangenome_hprc.md.
#
# WHY PER CLASS AND NOT ONE DENSITY LINE. The claim the figure needs to show is
# that the megabase CHM13 adds to chr17q is repeat-dense in a way GRCh38's own
# subtelomere is not. Total repeat density says that much (37% -> 76%) and stops
# there. Split by class, over the last 650 kb of each assembly's chr17, it says
# what KIND, and the answer is one class:
#
#   class            GRCh38     CHM13
#   LINE             13.71%     70.05%     <- 5.1x
#   SINE             13.58%     10.53%     <- goes DOWN
#   LTR               6.10%      9.81%
#   DNA               2.29%      8.17%
#   all (merged)     37.22%     76.37%
#
# and within LINE it is L1 specifically: 13.35% -> 66.70%, with L2 0.28% ->
# 7.32%. So the added sequence is not "more repetitive" in the generic way a
# single density line would draw it — it is an L1 field, and it is depleted of
# Alu relative to the reference sequence it continues. That is also the
# mechanism the tutorial already asserts in prose (long L1 is what a
# BAC-and-Sanger reference had no way to place), which this makes visible.
#
# The two assemblies are measured over their own last 650 kb rather than over a
# lifted-over interval, because there is no lift-over for sequence one of them
# does not have — the comparison is between what each assembly ends its
# chromosome with.
#
# Bin width is the figure's real constraint. The panes that show this contrast
# are ~650 kb wide, so a 5 kb bin is ~8 screen px: wide enough to smooth single
# elements into a density, narrow enough that a 13 kb L1 is not a whole bar.
#
# Requires: curl, bedtools, awk, sort, and two kentUtils binaries.
#
#   apt install bedtools          # or: brew install bedtools
#
# bedGraphToBigWig and bigBedToBed are not packaged; UCSC ships them as static
# binaries, which is one curl each and needs no build:
#
#   base=https://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64
#   for t in bedGraphToBigWig bigBedToBed; do
#     curl -fL -o ~/.local/bin/$t $base/$t && chmod +x ~/.local/bin/$t
#   done
#
# (macOS: swap linux.x86_64 for macOSX.x86_64 or macOSX.arm64.) Conda works too:
# `conda install -c bioconda ucsc-bedgraphtobigwig ucsc-bigbedtobed`.
#
# Downloads ~500 MB of RepeatMasker annotation the first time and needs ~2 GB
# free in the output directory. Re-running skips anything already there, so an
# interrupted run resumes.
#
# Usage:    bash scripts/build_repeat_density.sh [outdir]
set -euo pipefail

OUTDIR="${1:-repeat_density_build}"
UCSC=https://hgdownload.soe.ucsc.edu

# hg38 has no RepeatMasker bigBed under gbdb (only the MySQL table dump);
# CHM13's is published as a bigBed. Two source shapes, one normalized BED below.
HG38_RMSK=$UCSC/goldenPath/hg38/database/rmsk.txt.gz
HS1_RMSK=$UCSC/gbdb/hs1/t2tRepeatMasker/chm13v2.0_rmsk.bb

BIN=5000

# The classes worth a lane. RepeatMasker emits ~15, and the tail (scRNA, snRNA,
# tRNA, Unknown) is under 0.02% everywhere in this window — a lane per one of
# those is a flat zero the reader has to scan past. Satellite stays despite
# being small here because it is the class that would dominate if the window
# ever moved onto a centromere.
CLASSES="LINE SINE LTR DNA Satellite Simple_repeat"

mkdir -p "$OUTDIR"
cd "$OUTDIR"

fetch() {
  local url=$1 out=$2
  if [[ -s $out ]]; then
    echo "  have $out"
  else
    echo "  fetching $out"
    curl -fsSL --retry 3 -o "$out.part" "$url"
    mv "$out.part" "$out"
  fi
}

echo "== sources =="
fetch "$UCSC/goldenPath/hg38/bigZips/hg38.chrom.sizes" hg38.chrom.sizes
fetch "$UCSC/goldenPath/hs1/bigZips/hs1.chrom.sizes" hs1.chrom.sizes
fetch "$HG38_RMSK" rmsk_hg38.txt.gz
fetch "$HS1_RMSK" chm13v2.0_rmsk.bb

# Normalize both sources to chrom/start/end/class. The UCSC table has class in
# its own column ($12); the bigBed packs `repName#Class/Family` into name, which
# is also what the FeatureTrack lanes in the figure color off.
echo "== normalizing =="
if [[ ! -s rmsk_hg38.bed ]]; then
  zcat rmsk_hg38.txt.gz |
    awk -F'\t' '$6 ~ /^chr[0-9XY]+$/ {print $6"\t"$7"\t"$8"\t"$12}' |
    sort -k1,1 -k2,2n > rmsk_hg38.bed
fi
if [[ ! -s rmsk_hs1.bed ]]; then
  bigBedToBed chm13v2.0_rmsk.bb stdout |
    awk -F'\t' '$1 ~ /^chr[0-9XY]+$/ {
      split($4, a, "#"); split(a[2], b, "/"); print $1"\t"$2"\t"$3"\t"b[1]
    }' |
    sort -k1,1 -k2,2n > rmsk_hs1.bed
fi
wc -l rmsk_hg38.bed rmsk_hs1.bed

# Only the chroms the rmsk BED actually covers, so bedtools doesn't emit windows
# over scaffolds that will never carry a value.
main_sizes() {
  awk -F'\t' '$1 ~ /^chr[0-9XY]+$/' "$1" | sort -k1,1
}

echo "== binning =="
for asm in hg38 hs1; do
  main_sizes "$asm.chrom.sizes" > "$asm.main.sizes"
  bedtools makewindows -g "$asm.main.sizes" -w $BIN |
    sort -k1,1 -k2,2n > "$asm.windows.bed"
  for cls in $CLASSES; do
    out="${asm}_repeat_density_${cls}.bw"
    if [[ -s $out ]]; then
      echo "  have $out"
      continue
    fi
    # Merge first: RepeatMasker annotations of the same class overlap (a
    # fragmented L1 is several records), and an unmerged coverage would count
    # the shared bp twice and report over 100%.
    awk -v k="$cls" -F'\t' '$4==k' "rmsk_$asm.bed" |
      bedtools merge -i - > "tmp_${asm}_${cls}.bed"
    # -a windows -b class gives fraction-of-window-covered in the last column.
    bedtools coverage -a "$asm.windows.bed" -b "tmp_${asm}_${cls}.bed" -sorted \
      -g "$asm.main.sizes" |
      awk -F'\t' '{printf "%s\t%s\t%s\t%.5f\n", $1, $2, $3, $NF}' \
        > "tmp_${asm}_${cls}.bg"
    bedGraphToBigWig "tmp_${asm}_${cls}.bg" "$asm.main.sizes" "$out"
    rm -f "tmp_${asm}_${cls}.bed" "tmp_${asm}_${cls}.bg"
    echo "  wrote $out"
  done
done

# The table in this script's header, recomputed rather than remembered. Any
# number the tutorial states about this comparison should come from here.
echo
echo "== chr17 subtelomere, last 650 kb of each assembly =="
report() {
  local bed=$1 chrom=$2 start=$3 end=$4 label=$5
  local span=$((end - start))
  printf '\n%s  %s:%d-%d (%d bp)\n' "$label" "$chrom" "$start" "$end" "$span"
  awk -v c="$chrom" -v s="$start" -v e="$end" -F'\t' \
    '$1==c && $3>s && $2<e {st=($2<s?s:$2); en=($3>e?e:$3); print $4"\t"st"\t"en}' \
    "$bed" | sort -k1,1 -k2,2n > tmp_report.bed
  for cls in $(cut -f1 tmp_report.bed | sort -u); do
    bp=$(awk -v k="$cls" -F'\t' '$1==k {print "x\t"$2"\t"$3}' tmp_report.bed |
      sort -k2,2n | bedtools merge -i - | awk '{t += $3 - $2} END {print t+0}')
    awk -v c="$cls" -v b="$bp" -v s="$span" \
      'BEGIN {printf "  %-16s %9d bp  %6.2f%%\n", c, b, 100*b/s}'
  done
  bp=$(awk -F'\t' '{print "x\t"$2"\t"$3}' tmp_report.bed | sort -k2,2n |
    bedtools merge -i - | awk '{t += $3 - $2} END {print t+0}')
  awk -v b="$bp" -v s="$span" \
    'BEGIN {printf "  %-16s %9d bp  %6.2f%%\n", "all (merged)", b, 100*b/s}'
  rm -f tmp_report.bed
}
hg38_end=$(awk -F'\t' '$1=="chr17"{print $2}' hg38.chrom.sizes)
hs1_end=$(awk -F'\t' '$1=="chr17"{print $2}' hs1.chrom.sizes)
report rmsk_hg38.bed chr17 $((hg38_end - 650000)) "$hg38_end" "GRCh38"
report rmsk_hs1.bed chr17 $((hs1_end - 650000)) "$hs1_end" "CHM13"

echo
echo "Done. bigWigs in $PWD:"
ls -1 ./*_repeat_density_*.bw
