#!/bin/bash
# Converts all test datasets to PIF format using make-pif.
# Usage: bash build-pif-files.sh
# Requires: bgzip, tabix, sort (from htslib)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$(dirname "$SCRIPT_DIR")"
CLI="node --experimental-strip-types $(dirname "$SCRIPT_DIR")/../../../products/jbrowse-cli/src/commands/make-pif/index.ts"
PIF_DIR="$DATA_DIR/pif-output"
mkdir -p "$PIF_DIR"

echo "=== Building PIF files ==="

# 1. Synthetic 3-way PAF
echo "1. Synthetic 3-way → PIF"
$CLI "$DATA_DIR/synthetic/synthetic_3way.paf" --out "$PIF_DIR/synthetic_3way.pif.gz"
echo "   → $(ls -lh "$PIF_DIR/synthetic_3way.pif.gz" | awk '{print $5}')"

# 2. Synthetic 8-way PAF
echo "2. Synthetic 8-way → PIF"
$CLI "$DATA_DIR/synthetic/synthetic_8way.paf" --out "$PIF_DIR/synthetic_8way.pif.gz"
echo "   → $(ls -lh "$PIF_DIR/synthetic_8way.pif.gz" | awk '{print $5}')"

# 3. Synthetic all-vs-all
echo "3. Synthetic all-vs-all → multi-pair PIF"
$CLI "$DATA_DIR/synthetic/synthetic_allvsall.paf" --all-vs-all --out "$PIF_DIR/synthetic_allvsall.pif.gz" --session
echo "   → $(ls -lh "$PIF_DIR/synthetic_allvsall.pif.gz" | awk '{print $5}')"

# 4. GFA pangenome (chrM)
if [ -f "$DATA_DIR/pggb-chrM/chrM.pan.4.gfa" ]; then
  echo "4. PGGB chrM GFA → PIF"
  $CLI "$DATA_DIR/pggb-chrM/chrM.pan.4.gfa" --format rgfa --pairs all --out "$PIF_DIR/chrM_pangenome.pif.gz"
  echo "   → $(ls -lh "$PIF_DIR/chrM_pangenome.pif.gz" | awk '{print $5}')"
fi

# 5. Synthetic GFA
echo "5. Synthetic GFA → PIF"
$CLI "$DATA_DIR/synthetic/synthetic_4genome.gfa" --format rgfa --pairs all --out "$PIF_DIR/synthetic_gfa.pif.gz"
echo "   → $(ls -lh "$PIF_DIR/synthetic_gfa.pif.gz" | awk '{print $5}')"

echo ""
echo "=== All PIF files ==="
ls -lh "$PIF_DIR/"*.pif.gz
echo ""
echo "Done."
