#!/usr/bin/env bash
# The six scenarios agent-docs/ideas/wiggle-instance-records-carry-per-row-constants.md
# quotes, one node process each, sequential so no two contend.
#   SCRNA=/path/CD4_T.bw FST=/path/fst_scan.bw bash plugins/wiggle/benches/runInstanceBufferScenarios.sh out/
set -euo pipefail
out=${1:-.}
mkdir -p "$out"
bench() {
  local name=$1
  shift
  node --experimental-transform-types --expose-gc --no-warnings \
    plugins/wiggle/benches/instanceBuffer.bench.ts --json "$@" >"$out/$name.json"
  echo "$name done"
}
PHYLOP=demos/phylop/hg38.phyloP100way.brca1.bw
bench scrna-raw-positive --file="$SCRNA" --refName=chr1 --start=150000000 --bpPerPx=151 --rounds=15
bench scrna-raw-signed --file="$SCRNA" --refName=chr1 --start=150000000 --bpPerPx=151 --rounds=15 --sign=signed
bench scrna-1mb-positive --file="$SCRNA" --refName=chr1 --start=150000000 --bpPerPx=667 --rounds=15
bench phylop-summary-signed --file=$PHYLOP --refName=chr17 --start=42900000 --bpPerPx=79 --rounds=15
bench phylop-summary-positive --file=$PHYLOP --refName=chr17 --start=42900000 --bpPerPx=79 --rounds=15 --sign=positive
bench fst-raw-ceiling --file="$FST" --refName=chr2 --start=130000000 --bpPerPx=319 --rounds=15 --paintSources=30
