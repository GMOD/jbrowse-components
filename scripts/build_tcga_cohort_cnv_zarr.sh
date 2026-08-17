#!/usr/bin/env bash
#
# Turn the TCGA cohort segment BED that build_tcga_cohort_cnv.sh writes into a
# samples-by-bins Zarr v3 store, the format jbrowse-plugin-zarr's
# MultiWiggleZarrAdapter reads. Same tumors, same segment means, binned instead
# of stored as intervals.
#
# Split out from build_tcga_cohort_cnv.sh rather than run at the end of it,
# because it needs nothing that script needed: its only inputs are that script's
# BED and clinical table, both of which are hosted. So it runs against the
# hosted copies in well under a minute, where rebuilding the BED is a 15-25
# minute download of one file per tumor from the GDC.
#
# What the store buys, measured on the hosted 1104-tumor TCGA-BRCA cohort with
# bytes counted through the real tabix reader:
#
#                          BED+tabix      Zarr    requests
#   ERBB2 200kb window        411 KB   14.4 KB     2 -> 1
#   chr17 whole               411 KB    237 KB     2 -> 12
#   whole genome             5843 KB   1176 KB    24 -> 4
#
# The locus row is the large one and it is mostly not about binning: TCGA
# segments average 2.6 Mb, so tabix's linear index scans back to the start of
# the chromosome and a 200 kb query reads the same bytes a whole-chromosome one
# does. Against that, the store costs 29 MB on disk as du counts it over 1752
# files, 25 MB as bytes, to the BED's 5.9 MB. It is a second representation
# worth having for the zoomed-out views, not a replacement.
#
# Requires: curl, node >= 22 (for its own TypeScript stripping; no npm install)
# Output:   tcga_<project>_cnv.zarr/
# Runtime:  ~1 min for BRCA (1104 tumors), plus the download if run standalone
#
# Usage: build_tcga_cohort_cnv_zarr.sh [PROJECT] [GROUPBY]
#   PROJECT  TCGA project id (default TCGA-BRCA)
#   GROUPBY  clinical column each tumor is grouped by (default subtype), which
#            is what the clustering sidebar groups rows on and what "color by"
#            keys on

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAW=https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts
DEMOS=https://jbrowse.org/demos/tcga
S3=s3://jbrowse.org/demos/tcga

# The converter this runs, fetched next to it when absent, so a bare `curl -fO`
# of this one file behaves the same as a repo checkout. It imports @gmod/bbi
# only on the --samples path, so --bed mode below needs no npm install.
HELPERS=(build_signal_zarr.ts)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" "$RAW/$h"
done

PROJECT=${1:-TCGA-BRCA}
GROUPBY=${2:-subtype}
SLUG=$(echo "$PROJECT" | tr '[:upper:]-' '[:lower:]_')
OUT=${SLUG}_cnv
BED=$OUT.bed.gz
CLINICAL=${SLUG}_clinical.tsv
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# Built locally a moment ago, or hosted. Only BRCA is hosted today; another
# project means running build_tcga_cohort_cnv.sh first, which is what the
# message says rather than leaving a 404 to explain itself.
for f in "$BED" "$CLINICAL"; do
  if [ ! -f "$f" ]; then
    echo "== downloading $f"
    curl -fsSL -o "$f" "$DEMOS/$f" || {
      echo "no local $f and none hosted for $PROJECT" >&2
      echo "run build_tcga_cohort_cnv.sh $PROJECT 0 $GROUPBY first" >&2
      exit 1
    }
  fi
done

# --samples is only a name<TAB>group table here (no URLs, which is the BigWig
# path): it fixes the row order and hands each tumor its clinical group. A
# GROUPBY naming no column yields an empty table, and the converter says so.
awk -F'\t' -v col="$GROUPBY" '
  NR==1 { for (i = 1; i <= NF; i++) if ($i == col) c = i; next }
  c     { print $1 "\t" $c }' "$CLINICAL" >"$WORK/samples_group.tsv"

# Levels ~3x apart, not 10x. The adapter reads the coarsest level whose bins are
# still no wider than a screen pixel, so a 10x gap leaves a view that lands just
# under a level's bin size fetching up to 10x more bins than it can draw — which
# on the chr17 view above was the difference between 382 KB and 237 KB.
#
# The base level is held in memory whole while every coarser one is derived from
# it: 1104 tumors x 10 kb bins is ~1.3 GB, past the default heap.
echo "== binning $BED into $OUT.zarr"
node --max-old-space-size=6144 "$SCRIPT_DIR/build_signal_zarr.ts" \
  --bed "$BED" \
  --sample-column sample \
  --value-column segmean \
  --samples "$WORK/samples_group.tsv" \
  --out "$OUT.zarr" \
  --levels 10000,30000,100000,300000,1000000,3000000

echo "== done: $OUT.zarr ($(du -sh "$OUT.zarr" | cut -f1))"
echo "   upload with: aws s3 cp --recursive $OUT.zarr $S3/$OUT.zarr"
echo "   the track this feeds needs the Zarr plugin:"
echo "     https://jbrowse.org/demos/zarr/jbrowse-plugin-zarr.umd.production.min.js"
