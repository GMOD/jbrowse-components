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

# Parsed up front rather than where it is used: an unrecognized flag is
# otherwise indistinguishable from no flag, and the run reaches that test only
# after the trackDb download and the npm probe.
case "${1:-}" in
  --whole-genome) WHOLE_GENOME=1 ;;
  '') WHOLE_GENOME=0 ;;
  *)
    echo "unknown argument: $1" >&2
    echo "usage: $0 [--whole-genome]" >&2
    exit 1
    ;;
esac

HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(dirname "$HERE")
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

# In a checkout the default output is the store this repository commits, named
# from $REPO so the run does not depend on the working directory: the checkout
# test is absolute, so a relative default would resolve against the caller
# instead and write a second test_data/1000g_cnv tree there. Standalone there is
# no checkout to anchor to, so the build directory is relative to the caller,
# which is what the tutorial documents.
if [ -d "$REPO/test_data/1000g_cnv" ]; then
  OUT=${OUT:-$REPO/test_data/1000g_cnv/qm2_cn_1kb.zarr}
  SAMPLES=${SAMPLES:-$REPO/test_data/1000g_cnv/samples.tsv}
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
if [ "$WHOLE_GENOME" = 1 ]; then
  REGIONS=()
else
  # The windows the figures visit: CCL3L1/CCL4L1 and UGT2B17 for the CNV
  # tutorial, and RHD for the SV-multisamples one, where the panel's copy
  # number is read beside the same cohort's ensemble SV calls.
  REGIONS=(
    --region chr17:35000000-37500000
    --region chr4:68000000-69000000
    --region chr1:25150000-25450000
  )
fi

node "$HERE/build_signal_zarr.ts" \
  --samples "$SAMPLES" \
  --out "$OUT" \
  "${REGIONS[@]}" \
  --levels 1000,10000 \
  --concurrency 32

du -sh "$OUT"
