#!/usr/bin/env bash
# Build a fixture whose reference is bigger than one RemoteFileWithRangeCache
# chunk (256 KiB), so that panning misses that cache and actually issues a
# reference read. The 255 KB hg19mod.fa does not: the first query caches the
# whole genome and every later one is free, which is what stopped
# seqfetch-timing-probe.ts from being able to A/B the prefetch.
#
# The trick is tiling rather than simulating. chr22_mask's 250001 bp is repeated
# TILES times into one long contig, and each read is emitted once per tile with
# POS shifted by the same stride — so every copy still aligns against identical
# sequence and the mismatches stay real, with no read simulator involved.
set -euo pipefail

SRC_BAM=$1        # an MD-less BAM over chr22_mask
SRC_FA=$2         # hg19mod.fa
OUT_DIR=$3
TILES=${TILES:-20}

CONTIG=chr22_mask
LEN=250001
BIG=chr22_big
BIGLEN=$((LEN * TILES))

mkdir -p "$OUT_DIR"

echo "reference: $TILES x $LEN = $BIGLEN bp"
{
  echo ">$BIG"
  # strip the header and re-wrap, repeated TILES times. fold keeps the line
  # length samtools faidx needs to be uniform.
  for _ in $(seq 1 "$TILES"); do
    grep -v '^>' "$SRC_FA" | tr -d '\n'
  done
  echo
} | awk 'NR==1{print;next}{print}' | fold -w 60 > "$OUT_DIR/$BIG.fa.tmp"
# fold also wrapped the header, so rebuild it cleanly
{
  echo ">$BIG"
  grep -v '^>' "$OUT_DIR/$BIG.fa.tmp" | tr -d '\n' | fold -w 60
} > "$OUT_DIR/$BIG.fa"
rm "$OUT_DIR/$BIG.fa.tmp"
samtools faidx "$OUT_DIR/$BIG.fa"

echo "reads: shifting each by k x $LEN for k in 0..$((TILES - 1))"
{
  samtools view -H "$SRC_BAM" | sed "s/SN:$CONTIG\tLN:$LEN/SN:$BIG\tLN:$BIGLEN/"
  for k in $(seq 0 $((TILES - 1))); do
    samtools view "$SRC_BAM" |
      awk -v OFS='\t' -v shift=$((k * LEN)) -v big="$BIG" \
        '{ $1 = $1 "_t" shift; $3 = big; $4 = $4 + shift; print }'
  done
} | samtools sort -@ 4 -o "$OUT_DIR/tiled.bam" -
samtools index "$OUT_DIR/tiled.bam"

ls -la "$OUT_DIR"
echo "--- contig ---"
cat "$OUT_DIR/$BIG.fa.fai"
echo "--- reads at the far end (should be non-empty) ---"
samtools view -c "$OUT_DIR/tiled.bam" "$BIG:$((BIGLEN - 100000))-$BIGLEN"
