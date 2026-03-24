#!/bin/bash
# Downloads real-world synteny test datasets.
# Usage: bash download-real-data.sh [output-dir]
#
# Datasets:
# 1. PGGB chrM pangenome GFA (4 human genomes) - small GFA with P-lines
# 2. ntSynt-viz great apes data
# 3. HPRC minigraph rGFA (whole-genome, 850MB) - large-scale test (optional)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="${1:-$(dirname "$SCRIPT_DIR")}"

echo "=== Downloading PGGB chrM pangenome GFA ==="
GFA_DIR="$OUT_DIR/pggb-chrM"
mkdir -p "$GFA_DIR"
[ -f "$GFA_DIR/chrM.pan.4.gfa" ] || \
  curl -sL "https://raw.githubusercontent.com/pangenome/pggb/master/data/chrM.pan.4.gfa" \
    -o "$GFA_DIR/chrM.pan.4.gfa"
echo "  chrM GFA: $(du -sh "$GFA_DIR" | cut -f1)"

echo "=== Downloading ntSynt-viz great apes data ==="
NTSYNT_DIR="$OUT_DIR/ntsynt"
mkdir -p "$NTSYNT_DIR"
NTSYNT_BASE="https://raw.githubusercontent.com/BirolLab/ntSynt-viz/main/tests"
for f in great-apes.ntSynt.synteny_blocks.tsv great-apes.name-conversions.tsv; do
  [ -f "$NTSYNT_DIR/$f" ] || curl -sL "$NTSYNT_BASE/$f" -o "$NTSYNT_DIR/$f"
done
echo "  ntSynt data: $(du -sh "$NTSYNT_DIR" | cut -f1)"

echo ""
echo "=== Optional: HPRC minigraph rGFA (850MB, skipped by default) ==="
echo "To download: curl -L -o $OUT_DIR/hprc/hprc-v1.0-minigraph-grch38.gfa.gz \\"
echo "  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/freeze1/minigraph/hprc-v1.0-minigraph-grch38.gfa.gz"

echo ""
echo "Done. Total: $(du -sh "$OUT_DIR" | cut -f1)"
