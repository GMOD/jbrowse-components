#!/usr/bin/env bash
#
# Build the MAF zoom-out tier (`summaryAdapter`) for a taffy-indexed alignment:
# one row per haplotype per aligned run, with an identity score and no sequence.
# The alignment tier of a deep MAF is unreadable past a gene — HPRC release 2 is
# 354 Mb of TAF for chr6 alone against a 5 Mb budget — so without this file a
# zoomed-out view is the too-large prompt and nothing else.
#
# Built for HPRC release 2, whole genome, 2026-08-14:
#
#   464 haplotypes, 152 of the index's 195 contigs, 375,888 rows, 1.63 MB
#   whole-chromosome read: 828 bytes (chrM) to 127 kB (chr1), vs a 5 MB budget
#   whole chr6 through the app: 354 Mb refused -> 250 kB drawn, 464 rows
#
# Requires: taffy, maf2bed >= 0.6.0, sort, bgzip, tabix, curl
# Usage:    bash scripts/build_hprc_maf_summary.sh <alignment.taf.gz> <ref-name> <out-prefix>
#   e.g.    bash scripts/build_hprc_maf_summary.sh hprc.taf.gz GRCh38 hprc-v2.0-mc-grch38.summary
#
# The `.tai` must sit beside the alignment as <alignment>.tai — `taffy view -r`
# does the indexed extraction, so only the queried contig's bytes are read and
# the MAF is never materialized (the HPRC genome is ~1.5 TB of it).
#
# THREE THINGS THAT WILL BITE YOU, all of them measured rather than guessed.
#
# 1. `taffy view -r` FAILS SILENTLY ON A RANGE PAST THE CONTIG'S END. It writes
#    "Region ... not found in taffy index" to stderr and an empty MAF to stdout,
#    exit 0. A first pass here ended every range at last-index-entry + 10 Mb,
#    which is past the real end of every small contig, and lost 93 of 195
#    contigs INCLUDING chr1, chr2 and chrY. The harness reported all 93 as "ok"
#    because it discarded stderr and tested `[ -s file ]`, which is true for a
#    summary holding only its header. So: real lengths from chrom.sizes, stderr
#    kept, and the test is "did it write DATA rows".
#
# 2. `--merge-gap` IS NOT THE LEVER FOR ROW COUNT. In segmental-duplication
#    territory a haplotype aligns to the same reference interval more than once,
#    so `maf2bed --summary` emits overlapping runs for it and there is no gap to
#    close. Measured on chr14:18-20 Mb, the worst region in this genome: raising
#    the gap from 500 to 50,000 removed 0.04% of 854,467 rows.
#
#    What works is collapsing each haplotype's OVERLAPPING runs into their union,
#    which this script does. Overlapping presence bands paint on top of each
#    other, so the picture is unchanged; the score becomes a length-weighted mean
#    over the merged runs, which is sub-pixel at any zoom this tier is drawn at
#    (it only renders above 20 kb of span). chr14 goes 900,414 rows / 2.9 MB ->
#    9,089 / 43 kB, genome-wide 4,824,912 -> 375,888, and GRCh38's own covered
#    bases come out identical to the byte. This belongs upstream in maf2bed —
#    overlapping presence rows are redundant by construction for what the slot
#    feeds — and the union here is the workaround, not the fix.
#
# 3. A contig with a SINGLE `.tai` entry cannot be extracted by region at all;
#    taffy refuses even a 500 bp query on one. That is what leaves 43 contigs out
#    of the HPRC file. All 43 are chrUn_* unplaced scaffolds of 970 bp - 15 kb,
#    and every primary chromosome is present. Note this is a taffy extraction
#    limit, NOT evidence the alignment lacks them.
set -euo pipefail
export LC_ALL=C

if [ "$#" -ne 3 ]; then
  echo "usage: $0 <alignment.taf.gz> <ref-name> <out-prefix>" >&2
  exit 1
fi
taf="$1"
ref="$2"
prefix="$3"
work="${prefix}.work"
mkdir -p "$work/parts"

[ -f "$taf.tai" ] || { echo "no index beside the alignment: $taf.tai" >&2; exit 1; }

sizes="$work/chrom.sizes"
if [ ! -s "$sizes" ]; then
  curl -fsS https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.chrom.sizes -o "$sizes"
fi

# contigs the index actually holds, as `<assembly>.<contig>` source tokens
cut -f1 "$taf.tai" | grep -v '^\*' | sed "s/^$ref\.//" | sort -u > "$work/contigs.txt"
echo "index holds $(wc -l < "$work/contigs.txt") contigs"

extract() {
  local chr="$1" out="$work/parts/$1.bed" len
  [ -s "$out" ] && [ "$(tail -n +2 "$out" | wc -l)" -gt 0 ] && return 0
  len=$(awk -v c="$chr" '$1==c{print $2}' "$sizes")
  [ -n "$len" ] || { echo "SKIP $chr (no length in chrom.sizes)"; return 0; }
  taffy view -i "$taf" -r "$ref.$chr:0-$len" -m 2>"$work/parts/$chr.err" \
    | maf2bed "$ref" --summary "$out.tmp" > /dev/null 2>&1
  # the validity check: DATA rows, not file non-emptiness (see note 1)
  if [ -s "$out.tmp" ] && [ "$(tail -n +2 "$out.tmp" | wc -l)" -gt 0 ]; then
    mv "$out.tmp" "$out"
    rm -f "$work/parts/$chr.err"
    echo "ok $chr $(tail -n +2 "$out" | wc -l)"
  else
    rm -f "$out.tmp"
    echo "FAIL $chr $(head -c 100 "$work/parts/$chr.err" 2>/dev/null)"
  fi
}
export -f extract
export work taf ref sizes

xargs -P "${JOBS:-6}" -I{} bash -c 'extract {}' < "$work/contigs.txt"

# collapse each haplotype's overlapping runs (see note 2)
union() {
  sort -k4,4 -k1,1 -k2,2n | awk -F'\t' -v OFS='\t' '
    function flush() { if (n>0) printf "%s\t%d\t%d\t%s\t%.3f\n", c, s, e, k, w/(e-s) }
    {
      key=$4 SUBSEP $1
      if (key != prev) { flush(); prev=key; c=$1; k=$4; s=$2; e=$3; w=($3-$2)*$5; n=1; next }
      if ($2 <= e) { if ($3 > e) { w += ($3 - e) * $5; e = $3 } }
      else { flush(); c=$1; k=$4; s=$2; e=$3; w=($3-$2)*$5 }
      n=1
    }
    END { flush() }'
}

printf '#chrom\tchromStart\tchromEnd\tsrc\tscore\n' > "$work/genome.bed"
cat "$work"/parts/*.bed | grep -v '^#' | union | sort -k1,1 -k2,2n >> "$work/genome.bed"
bgzip -f -c "$work/genome.bed" > "$prefix.bed.gz"
tabix -f -p bed "$prefix.bed.gz"

# coverage audit: a missing contig must not pass as a small number
tail -n +2 "$work/genome.bed" | cut -f1 | sort -u > "$work/have.txt"
absent=$(comm -13 "$work/have.txt" "$work/contigs.txt" | wc -l)
echo
echo "rows=$(tail -n +2 "$work/genome.bed" | wc -l) haplotypes=$(tail -n +2 "$work/genome.bed" | cut -f4 | sort -u | wc -l)"
echo "contigs: $(wc -l < "$work/have.txt") of $(wc -l < "$work/contigs.txt") ($absent absent)"
comm -13 "$work/have.txt" "$work/contigs.txt" | grep -vE '^chrUn_' | sed 's/^/  ABSENT NON-chrUn: /' || true
ls -l "$prefix.bed.gz" "$prefix.bed.gz.tbi"
