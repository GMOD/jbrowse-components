#!/usr/bin/env bash
# Build the 1000 Genomes QuicK-mer2 copy-number Zarr store used by
# website/docs/tutorials/population_cnv.md.
#
# The sample list is derived from the Kidd lab's own UCSC trackDb rather than
# hand-written, so it stays the full 2504-sample panel with each sample's
# population attached. The BigWigs themselves are the jbrowse.org mirror of the
# lab's per-sample copy-number estimates.
#
# Usage:
#   bash scripts/build_1000g_cnv_zarr.sh                      # the tutorial's window
#   bash scripts/build_1000g_cnv_zarr.sh --whole-genome       # every main contig
set -euo pipefail

TRACKDB=https://raw.githubusercontent.com/KiddLab/kmer_1KG/master/kmer-1kg.trackDb.txt
BW_BASE=https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv
OUT=${OUT:-test_data/1000g_cnv/qm2_cn_1kb.zarr}
SAMPLES=${SAMPLES:-test_data/1000g_cnv/samples.tsv}

mkdir -p "$(dirname "$SAMPLES")"

# Each sample appears in the trackDb as
# `bigDataUrl kmer-1kg/<POP>/<SAMPLE>.qm2.CN.1k.bed.browserbedColor.bb`; the raw
# values live beside them under the same population directory. Three columns,
# so the population rides along as the subtrack's `group`: it labels the rows,
# groups them in the clustering sidebar, and is what "color by" keys on.
echo "deriving sample list from $TRACKDB"
curl -sfL "$TRACKDB" |
  sed -n 's#^bigDataUrl kmer-1kg/\([A-Z]*\)/\([^.]*\)\..*#\2\t\1\t'"${BW_BASE//\//\\/}"'\/\1\/\2.qm2.CN.1k.bw#p' \
    >"$SAMPLES"
echo "$(wc -l <"$SAMPLES") samples -> $SAMPLES"

# The tutorial's store covers the two loci its figures visit. Whole genomes work
# the same way but hold the full base-resolution matrix in memory while
# building, which at panel scale wants a machine with room for it.
if [ "${1:-}" = "--whole-genome" ]; then
  REGIONS=()
else
  REGIONS=(--region chr17:35000000-37500000 --region chr4:68000000-69000000)
fi

node scripts/build_signal_zarr.ts \
  --samples "$SAMPLES" \
  --out "$OUT" \
  "${REGIONS[@]}" \
  --levels 1000,10000 \
  --concurrency 32

du -sh "$OUT"
