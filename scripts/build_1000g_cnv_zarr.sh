#!/usr/bin/env bash
# Build the 1000 Genomes QuicK-mer2 copy-number Zarr store used by
# website/docs/tutorials/population_cnv.md.
#
# The sample list is derived from the Kidd lab's own UCSC trackDb rather than
# hand-written, so it stays the full 2504-sample panel with each sample's
# population attached. The BigWigs themselves are the jbrowse.org mirror of the
# lab's per-sample copy-number estimates.
#
# Usage, one store each and neither a superset of the other:
#   bash build_1000g_cnv_zarr.sh                # the tutorial's windows, 1kb bins
#   bash build_1000g_cnv_zarr.sh --whole-genome # every main contig, 10kb bins up
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

# Only the finest level is held whole in memory, so the two modes differ in
# their pyramid as much as in their extent: over hg38 this panel is ~31 GB of
# matrix at the BigWigs' own 1kb bins, which no machine here has, and a few GB
# at 10kb. Whole-genome therefore starts the pyramid coarse and spends the
# levels it saves on depth instead, ~3x apart as build_signal_zarr.ts asks
# (10x leaves a view just under a level fetching 10x the bins it can draw).
#
# The two are separate stores rather than two builds of one, and the name each
# publishes under carries its base bin for that reason. They answer different
# questions: 10kb bins are 1px at 14Mb and wider, so the whole-genome store is
# an overview and cannot draw the 30-50kb paralogous blocks the tutorial's
# figures are about, which is what the 1kb windowed store is for. Syncing one
# over the other would also strand chunks, since only the windowed store has a
# bin1000 level and the bucket has no versioning.
if [ "$WHOLE_GENOME" = 1 ]; then
  REGIONS=()
  LEVELS=10000,30000,100000,300000,1000000
  STORE_NAME=qm2_cn_wg_10kb.zarr
else
  # The windows the figures visit: CCL3L1/CCL4L1 and UGT2B17 for the CNV
  # tutorial, and RHD for the SV-multisamples one, where the panel's copy
  # number is read beside the same cohort's ensemble SV calls.
  REGIONS=(
    --region chr17:35000000-37500000
    --region chr4:68000000-69000000
    --region chr1:25150000-25450000
  )
  LEVELS=1000,10000
  STORE_NAME=qm2_cn_1kb.zarr
fi

HERE=$(cd "$(dirname "$0")" && pwd)
RAW=https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts
STORE_URL=https://jbrowse.org/demos/1000g/$STORE_NAME
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

# The store this repository *reads* is the hosted one at $STORE_URL, not a tree
# in the checkout — 1.7 MB of undeltifiable chunks that every clone pays for.
# So the build always writes beside the caller, in a checkout or not, and
# publishing is the explicit `aws s3 sync` below rather than a `git add`.
OUT=${OUT:-1000g_cnv_build/$STORE_NAME}
SAMPLES=${SAMPLES:-1000g_cnv_build/samples.tsv}

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

# QuicK-mer2 reports copy number to more digits than it can distinguish: the
# panel is 87% exactly 2, and the rest is an estimate whose last few decimals
# are counting noise, not copies. Storing two of them costs nothing anyone can
# see on a heatmap pinned to 0-4, and it roughly halves the store, because gzip
# on this layout is matching repeated values rather than modelling a
# distribution. `decimals` is recorded in the store metadata so the precision
# stays an answerable question.
node "$HERE/build_signal_zarr.ts" \
  --samples "$SAMPLES" \
  --out "$OUT" \
  "${REGIONS[@]}" \
  --levels "$LEVELS" \
  --decimals 2 \
  --concurrency 32

du -sh "$OUT"

# What test_data/1000g_cnv/config.json points at. A zarr chunk key is named from
# its position, not its content, so a rebuild that changes a chunk overwrites
# it — and the bucket has no versioning. Read the diff before you sync.
echo
echo "to publish: aws s3 sync $OUT s3://jbrowse.org/demos/1000g/qm2_cn_1kb.zarr"
echo "  (serves as $STORE_URL)"
