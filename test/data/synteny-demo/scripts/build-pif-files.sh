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

# 1. Plotsr PAF (single pair, Arabidopsis chr4)
echo "1. plotsr PAF → PIF"
$CLI "$DATA_DIR/plotsr/out.paf" --out "$PIF_DIR/arabidopsis_chr4.pif.gz"
echo "   → $(ls -lh "$PIF_DIR/arabidopsis_chr4.pif.gz" | awk '{print $5}')"

# 2. Plotsr SyRI output (Col-0 vs Ler, all chromosomes)
echo "2. SyRI output → PIF"
$CLI "$DATA_DIR/plotsr/col_lersyri.filtered.out" --format syri --out "$PIF_DIR/col_vs_ler.pif.gz"
echo "   → $(ls -lh "$PIF_DIR/col_vs_ler.pif.gz" | awk '{print $5}')"

# 3. 4-way Arabidopsis multi-pair PIF (requires custom script)
echo "3. 4-way Arabidopsis multi-pair PIF"
node --experimental-strip-types -e "
import { parseSyriOutput } from '$DATA_DIR/../../products/jbrowse-cli/src/commands/make-pif/parsers/syri-parser.ts'
import { recordsToPafLines } from '$DATA_DIR/../../products/jbrowse-cli/src/commands/make-pif/parsers/to-paf.ts'
import { createMultiPairPIF, spawnSortProcess, waitForProcessClose } from '$DATA_DIR/../../products/jbrowse-cli/src/commands/make-pif/pif-generator.ts'

const pairs = [
  { file: '$DATA_DIR/plotsr/col_lersyri.filtered.out', names: ['col-0', 'ler'] },
  { file: '$DATA_DIR/plotsr/ler_cvisyri.filtered.out', names: ['ler', 'cvi'] },
  { file: '$DATA_DIR/plotsr/cvi_erisyri.filtered.out', names: ['cvi', 'eri'] },
]
const pairData = []
for (const p of pairs) {
  const records = await parseSyriOutput(p.file)
  pairData.push({ lines: recordsToPafLines(records), assemblyNames: p.names })
}
const child = spawnSortProcess('$PIF_DIR/arabidopsis_4way.pif.gz', false)
await createMultiPairPIF(pairData, child.stdin)
child.stdin.end()
await waitForProcessClose(child)
"
echo "   → $(ls -lh "$PIF_DIR/arabidopsis_4way.pif.gz" | awk '{print $5}')"

# 4. Synthetic 3-way PAF
echo "4. Synthetic 3-way → PIF"
$CLI "$DATA_DIR/synthetic/synthetic_3way.paf" --out "$PIF_DIR/synthetic_3way.pif.gz"
echo "   → $(ls -lh "$PIF_DIR/synthetic_3way.pif.gz" | awk '{print $5}')"

# 5. Synthetic 8-way PAF
echo "5. Synthetic 8-way → PIF"
$CLI "$DATA_DIR/synthetic/synthetic_8way.paf" --out "$PIF_DIR/synthetic_8way.pif.gz"
echo "   → $(ls -lh "$PIF_DIR/synthetic_8way.pif.gz" | awk '{print $5}')"

# 6. Synthetic all-vs-all
echo "6. Synthetic all-vs-all → multi-pair PIF"
$CLI "$DATA_DIR/synthetic/synthetic_allvsall.paf" --all-vs-all --out "$PIF_DIR/synthetic_allvsall.pif.gz" --session
echo "   → $(ls -lh "$PIF_DIR/synthetic_allvsall.pif.gz" | awk '{print $5}')"

# 7. GFA pangenome (chrM)
if [ -f "$DATA_DIR/pggb-chrM/chrM.pan.4.gfa" ]; then
  echo "7. PGGB chrM GFA → PIF"
  $CLI "$DATA_DIR/pggb-chrM/chrM.pan.4.gfa" --format rgfa --pairs all --out "$PIF_DIR/chrM_pangenome.pif.gz"
  echo "   → $(ls -lh "$PIF_DIR/chrM_pangenome.pif.gz" | awk '{print $5}')"
fi

# 8. Synthetic GFA
echo "8. Synthetic GFA → PIF"
$CLI "$DATA_DIR/synthetic/synthetic_4genome.gfa" --format rgfa --pairs all --out "$PIF_DIR/synthetic_gfa.pif.gz"
echo "   → $(ls -lh "$PIF_DIR/synthetic_gfa.pif.gz" | awk '{print $5}')"

echo ""
echo "=== All PIF files ==="
ls -lh "$PIF_DIR/"*.pif.gz
echo ""
echo "Done."
