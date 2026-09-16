#!/usr/bin/env bash
#
# Build the MAF zoom-out tier (`summaryAdapter`) for a bgzipped alignment: one
# row per haplotype per aligned run, with an identity score and no sequence. The
# alignment tier of a deep MAF is unreadable past a gene — HPRC release 2.1 is
# 3.2 GB of MAF for chr6 alone against a 5 MB budget — so without this file a
# zoomed-out view is the too-large prompt and nothing else.
#
# Built for HPRC release 2.1, whole genome, 2026-09-16:
#
#   464 haplotypes, all 195 contigs, 11,068,425 raw runs -> 396,363 rows, 1.72 MB
#   1 h 41 m wall clock, 53 GB read, 434 MB the largest thing on disk
#   whole-chromosome read: 73 kB (chrM) to 212 kB (chr1), vs a 5 MB budget
#   the alignment tier it stands in for asks 3.19 GB for chr6 alone
#
# The v2.0 TAF build of this file had 152 of 195 contigs and 375,888 rows; the
# 43 it was missing are the `chrUn_*` scaffolds the note below explains.
#
# Requires: maf2bed >= 0.6.0, sort, bgzip, tabix, curl
# Usage:    bash scripts/build_hprc_maf_summary.sh <alignment.maf.gz|URL> <ref-name> <out-prefix>
#   e.g.    bash scripts/build_hprc_maf_summary.sh https://…/hprc-v2.1-mc-grch38.full.maf.gz GRCh38 hprc-v2.1-mc-grch38.summary
#
# ONE STREAMING PASS, AND A URL IS A FIRST-CLASS INPUT. The alignment is read
# front to back through `curl | bgzip -dc | maf2bed --summary` and never lands on
# disk: v2.1's MAF is 53 GB compressed and 1.3 TB expanded, so a local copy is
# not a thing this machine has room for. maf2bed sustains ~10 MB/s of compressed
# input, which is the whole budget — the download overlaps it and is not the
# bottleneck.
#
# THIS REPLACED A PER-CONTIG `taffy view -r` ROUTE, and retires two of its three
# failure modes rather than re-clearing them (they are written up in
# agent-docs/reference/HPRC_RELEASE2.md § "Three things the build has to get
# right"): a region past a contig's end silently emitting an empty MAF, and a
# contig with a single `.tai` entry being unextractable at all, which left 43
# `chrUn_*` scaffolds out of the v2.0 file. A sequential read asks the index for
# nothing and so can miss nothing. What survives is the third, below.
#
# `--merge-gap` IS NOT THE LEVER FOR ROW COUNT. In segmental-duplication
# territory a haplotype aligns to the same reference interval more than once, so
# `maf2bed --summary` emits overlapping runs for it and there is no gap to close.
# Measured on chr14:18-20 Mb, the worst region in this genome: raising the gap
# from 500 to 50,000 removed 0.04% of 854,467 rows.
#
# What works is collapsing each haplotype's OVERLAPPING runs into their union,
# which this script does. Overlapping presence bands paint on top of each other,
# so the picture is unchanged; the score becomes a length-weighted mean over the
# merged runs, which is sub-pixel at any zoom this tier is drawn at (it only
# renders above 20 kb of span). chr14 goes 900,414 rows / 2.9 MB -> 9,089 /
# 43 kB, and GRCh38's own covered bases come out identical to the byte. This
# belongs upstream in maf2bed — overlapping presence rows are redundant by
# construction for what the slot feeds — and the union here is the workaround,
# not the fix.
set -uo pipefail
export LC_ALL=C

if [ "$#" -ne 3 ]; then
  echo "usage: $0 <alignment.maf.gz|URL> <ref-name> <out-prefix>" >&2
  exit 1
fi
aln="$1"
ref="$2"
prefix="$3"
work="${prefix}.work"
mkdir -p "$work"

# sort spills for a genome-sized row count, and the disk this runs on is the
# constraint the streaming read exists to respect
export TMPDIR="${TMPDIR:-$work/tmp}"
mkdir -p "$TMPDIR"
sort_opts=(-T "$TMPDIR" --compress-program=gzip -S 1G)

raw="$work/raw.bed"
if [ ! -s "$raw" ]; then
  case "$aln" in
    http://* | https://*) read_cmd=(curl -fsS "$aln") ;;
    *) read_cmd=(cat "$aln") ;;
  esac
  echo "streaming $aln -> $raw"
  # `seen` drops any partial first record; maf2bed reads the rest as blocks
  "${read_cmd[@]}" |
    bgzip -dc 2>/dev/null |
    awk 'seen||/^a/{seen=1;print}' |
    maf2bed "$ref" --summary "$raw.tmp" > /dev/null 2>"$work/maf2bed.err"
  # the validity check: DATA rows, not file non-emptiness
  if [ -s "$raw.tmp" ] && [ "$(tail -n +2 "$raw.tmp" | wc -l)" -gt 0 ]; then
    mv "$raw.tmp" "$raw"
  else
    echo "FAILED: $(head -c 400 "$work/maf2bed.err")" >&2
    exit 1
  fi
fi

# collapse each haplotype's overlapping runs
union() {
  sort "${sort_opts[@]}" -k4,4 -k1,1 -k2,2n | awk -F'\t' -v OFS='\t' '
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
tail -n +2 "$raw" | union | sort "${sort_opts[@]}" -k1,1 -k2,2n >> "$work/genome.bed"
bgzip -f -c "$work/genome.bed" > "$prefix.bed.gz"
tabix -f -p bed "$prefix.bed.gz"

echo
echo "raw rows=$(tail -n +2 "$raw" | wc -l)"
echo "rows=$(tail -n +2 "$work/genome.bed" | wc -l) haplotypes=$(tail -n +2 "$work/genome.bed" | cut -f4 | sort -u | wc -l)"
echo "contigs=$(tail -n +2 "$work/genome.bed" | cut -f1 | sort -u | wc -l)"
ls -l "$prefix.bed.gz" "$prefix.bed.gz.tbi"
