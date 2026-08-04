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
#   bash build_1000g_cnv_zarr.sh                              # the tutorial's window
#   bash build_1000g_cnv_zarr.sh --whole-genome               # every main contig
#
# Runs either from a checkout or on its own: downloaded by itself it fetches the
# converter beside its output and installs the converter's two npm packages
# there, so no clone of this repository is needed.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
RAW=https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts
TRACKDB=https://raw.githubusercontent.com/KiddLab/kmer_1KG/master/kmer-1kg.trackDb.txt
BW_BASE=https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv

# Downloaded on its own this fetches the converter beside itself; in a checkout
# both are already there.
HELPERS=(build_signal_zarr.ts)
for h in "${HELPERS[@]}"; do
  [ -f "$HERE/$h" ] || curl -fsSL -o "$HERE/$h" "$RAW/$h"
done

# The converter imports two npm packages and nothing else. A checkout resolves
# them from the workspace; on its own it needs them installed next to it.
(cd "$HERE" && node --input-type=module -e 'await import("@gmod/bbi")') 2>/dev/null ||
  npm install --silent --no-save --prefix "$HERE" @gmod/bbi generic-filehandle2

# In a checkout the default output is the store this repository commits;
# standalone it is a build directory under the working directory.
if [ -d "$(dirname "$HERE")/test_data/1000g_cnv" ]; then
  OUT=${OUT:-test_data/1000g_cnv/qm2_cn_1kb.zarr}
  SAMPLES=${SAMPLES:-test_data/1000g_cnv/samples.tsv}
else
  OUT=${OUT:-1000g_cnv_build/qm2_cn_1kb.zarr}
  SAMPLES=${SAMPLES:-1000g_cnv_build/samples.tsv}
fi

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

node "$HERE/build_signal_zarr.ts" \
  --samples "$SAMPLES" \
  --out "$OUT" \
  "${REGIONS[@]}" \
  --levels 1000,10000 \
  --concurrency 32

du -sh "$OUT"
