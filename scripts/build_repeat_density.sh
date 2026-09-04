#!/usr/bin/env bash
#
# Per-repeat-class density tracks for GRCh38 and T2T-CHM13v2.0, as one bigWig
# per class per assembly, for the multi-wiggle lanes in
# website/docs/tutorials/pangenome_hprc.md.
#
# WHY PER CLASS AND NOT ONE DENSITY LINE. Over the last 650 kb of each
# assembly's chr17, total repeat density says nothing at all: 37.22% against
# 36.48%, the same sequence by the only measure a single density lane can draw.
# Split by class it says the composition moved, in opposite directions:
#
#   class            GRCh38     CHM13
#   LINE             13.71%     16.51%     <- up
#   SINE             13.58%      9.00%     <- down
#   LTR               6.10%      5.83%
#   DNA               2.29%      3.01%
#   all (merged)     37.22%     36.48%     <- flat
#
# The larger version of that is the insertion allele itself, the 142 kb of CHM13
# chr17 that GRCh38 has no coordinates for. It runs LINE 23.70%
# against 14.18% and 14.47% in its own two flanks, and SINE 8.57% against
# 13.57% on the left flank — so the sequence the older reference was missing is
# L1-dense and Alu-poor against the sequence it sits between, which is the
# mechanism the tutorial asserts (long L1 is what a BAC-and-Sanger reference had
# no way to place) at the scale where it is actually true. It is a 1.7x
# enrichment, not a transformation: the 650 kb window dilutes it to 1.2x, which
# is why the allele gets its own report below.
#
# The two assemblies are measured over their own last 650 kb rather than over a
# lifted-over interval, because there is no lift-over for sequence one of them
# does not have — the comparison is between what each assembly ends its
# chromosome with.
#
# THESE NUMBERS REPLACE AN EARLIER SET THAT WAS AN ARTIFACT (LINE 13.71% ->
# 70.05%, all 37.22% -> 76.37%, "5.1x"). See the normalizing step for what
# produced it; anything quoting the old table is quoting the bug.
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
# its own column ($12) and one row per RepeatMasker .out line, so its
# genoStart/genoEnd are already the aligned interval.
#
# THE BIGBED IS NOT THAT, AND TAKING ITS chromStart/chromEnd IS THE ONE TRAP
# HERE. `chm13v2.0_rmsk.bb` is a bigRmskBed, whose own autoSql calls those two
# fields "position of VISUALIZATION on chromosome" and thickStart/thickEnd
# "position of ALIGNED sequence": one record is a whole fragmented element
# JOINED back together, and its outer span covers everything that interrupted
# it, which is usually a younger element of another class. So the outer spans
# overlap ACROSS classes, and summing them counts the same base as LINE and as
# SINE at once. Measured on chr17 the four class fractions then sum over 1.0 in
# 71% of bins (max 3.14), and LINE reads 72.5% of the chromosome against the
# 14.7% hg38's per-fragment table gives -- an impossible number that lands in a
# figure as a solid red field. In the last 650 kb it turned "LINE 13.71% ->
# 16.51%" into "13.71% -> 70.05%", i.e. it invented the result.
#
# The aligned pieces are the BLOCKS whose blockStart is not -1 (-1 marks the
# unaligned filler between fragments, and those carry junk sizes including
# negatives and zero). Expanded that way, one bigBed record reproduces exactly
# the .out lines its own `description` field lists, which is what the hg38 table
# rows are -- so the two assemblies are then measured the same way, which is the
# entire point of comparing them.
echo "== normalizing =="
if [[ ! -s rmsk_hg38.bed ]]; then
  gzip -dc rmsk_hg38.txt.gz |
    awk -F'\t' '$6 ~ /^chr[0-9XY]+$/ {print $6"\t"$7"\t"$8"\t"$12}' |
    sort -k1,1 -k2,2n > rmsk_hg38.bed
fi
if [[ ! -s rmsk_hs1.bed ]]; then
  bigBedToBed chm13v2.0_rmsk.bb stdout |
    awk -F'\t' '$1 ~ /^chr[0-9XY]+$/ {
      split($4, a, "#"); split(a[2], b, "/"); cls = b[1]
      n = split($11, sizes, ","); split($12, starts, ",")
      for (i = 1; i <= n; i++) {
        if (starts[i] == "" || starts[i] == -1 || sizes[i] + 0 <= 0) continue
        print $1"\t"($2 + starts[i])"\t"($2 + starts[i] + sizes[i])"\t"cls
      }
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

# The insertion allele on its own, against the CHM13 sequence on either side of
# it. This is where the contrast lives: the 650 kb windows above are mostly
# flank, so they average it away. Bounds are the graph node's own span, the same
# one website/scripts/specs/graph.ts highlights as CHM13_ALLELE.
echo
echo "== the 142 kb CHM13 insertion allele, against its own flanks =="
report rmsk_hs1.bed chr17 83599576 83899576 "CHM13 left flank"
report rmsk_hs1.bed chr17 83899576 84041803 "CHM13 allele"
report rmsk_hs1.bed chr17 84041803 "$hs1_end" "CHM13 right flank"

# IS THAT A LOT? The flank comparison above cannot answer it, and the three
# scopes below are here to show that nothing else can either (review: "what
# would convince user this is like an abnormal number of L1 compared to an even
# larger e.g. megabase scale region"). Rank the allele against every window of
# its own size in CHM13 and the answer moves with the scope: near the top within
# 5 Mb, mid-pack across chr17, ordinary genome-wide. A figure drawn at any one
# of them is measuring its own window, which is why the tutorial reads these
# lanes for composition and not for amount.
#
# 20 kb step rather than tiling, so the ranking does not depend on where a tile
# boundary happens to fall relative to the allele.
echo
echo "== is that a lot? the allele against same-size windows of CHM13 =="
allele_len=$((84041803 - 83899576))
awk -F'\t' '$4=="LINE"' rmsk_hs1.bed | bedtools merge -i - > tmp_line.bed
bedtools makewindows -g hs1.main.sizes -w $allele_len -s 20000 |
  sort -k1,1 -k2,2n > tmp_win.bed
bedtools coverage -a tmp_win.bed -b tmp_line.bed -sorted -g hs1.main.sizes |
  awk -v l=$allele_len -F'\t' '$3-$2==l {printf "%s\t%s\t%s\t%.5f\n", $1, $2, $3, $NF}' \
    > tmp_frac.bed
allele_line=$(awk -F'\t' \
  '$1=="chr17" && $3>83899576 && $2<84041803 {
     st=($2<83899576?83899576:$2); en=($3>84041803?84041803:$3); t+=en-st
   } END {printf "%.4f", t/(84041803-83899576)}' tmp_line.bed)
printf '  allele LINE fraction: %s over %d bp\n' "$allele_line" "$allele_len"
rank() {
  awk -v a="$allele_line" -v scope="$1" -v label="$2" -F'\t' '
    scope != "genome" && $1 != "chr17" { next }
    scope == "local" {
      m = ($2 + $3) / 2
      if (m < 83970689 - 5000000 || m > 83970689 + 5000000) next
    }
    { v[++n] = $4; if ($4 > a + 0) above++ }
    END {
      asort(v)
      printf "  %-10s n=%-6d median %.3f   windows above the allele: %d (%.1f%%)\n",
        label, n, v[int(n/2)], above+0, 100*(above+0)/n
    }' tmp_frac.bed
}
rank genome "genome"
rank chr17 "chr17"
rank local "+/-5 Mb"
rm -f tmp_line.bed tmp_win.bed tmp_frac.bed

echo
echo "Done. bigWigs in $PWD:"
ls -1 ./*_repeat_density_*.bw
