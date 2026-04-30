#!/usr/bin/env bash
# Phase 0 ad-hoc concordance check between the GfaTabixAdapter `getSubgraph`
# output and a chosen truth backend. Used during development to sanity-check
# changes; the formal CI suite is the Jest test in
# plugins/comparative-adapters/src/GfaTabixAdapter/.
#
# Usage:
#   bash tools/graph-truth-extractor/test-subgraph-concordance.sh \
#     [--prefix <indexPrefix>] [--gfa <gfa>] [--path <pathName>] \
#     [--start <n>] [--end <n>] [--context <k>] [--backend vg|naive|odgi|chunkix]
#
# Defaults: volvox_pangenome_50, ref#0#ctgA:0-1000, context=1, backend=vg.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

PREFIX="$REPO_ROOT/test_data/volvox/volvox_pangenome_50"
GFA="$REPO_ROOT/test_data/volvox/volvox_pangenome_50.gfa"
PATH_NAME="ref#0#ctgA"
START=0
END=1000
CONTEXT=1
BACKEND=vg

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix) PREFIX="$2"; shift 2;;
    --gfa) GFA="$2"; shift 2;;
    --path) PATH_NAME="$2"; shift 2;;
    --start) START="$2"; shift 2;;
    --end) END="$2"; shift 2;;
    --context) CONTEXT="$2"; shift 2;;
    --backend) BACKEND="$2"; shift 2;;
    *) echo "unknown arg: $1"; exit 2;;
  esac
done

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "Truth backend: $BACKEND ($GFA $PATH_NAME:$START-$END c=$CONTEXT)"
node --experimental-strip-types "$REPO_ROOT/tools/graph-truth-extractor/cli.ts" \
  --backend "$BACKEND" \
  --gfa "$GFA" \
  --path "$PATH_NAME" \
  --start "$START" \
  --end "$END" \
  --context "$CONTEXT" \
  --emit canonical \
  --out "$TMP/truth.gfa"

echo "Ours: dump-subgraph from $PREFIX"
node --experimental-strip-types \
  "$REPO_ROOT/plugins/comparative-adapters/scripts/dump-subgraph.ts" \
  "$PREFIX" "$PATH_NAME" "$START" "$END" \
  > "$TMP/ours.raw.gfa"

# Canonicalize our raw output through the shared canonicalize.ts so the diff
# is over canonical forms only.
cat > "$TMP/canon.ts" <<'EOF'
import fs from 'fs'
import { canonicalize } from '__CANON__'
const text = fs.readFileSync(process.argv[2]!, 'utf8')
process.stdout.write(canonicalize(text))
EOF
sed -i "s|__CANON__|$REPO_ROOT/tools/graph-truth-extractor/canonicalize.ts|" "$TMP/canon.ts"
node --experimental-strip-types "$TMP/canon.ts" "$TMP/ours.raw.gfa" > "$TMP/ours.gfa"

echo ""
echo "=== Counts ==="
printf "%-10s S=%s L=%s P=%s\n" \
  "truth:" \
  "$(grep -c '^S' "$TMP/truth.gfa")" \
  "$(grep -c '^L' "$TMP/truth.gfa")" \
  "$(grep -c '^P' "$TMP/truth.gfa")"
printf "%-10s S=%s L=%s P=%s\n" \
  "ours:" \
  "$(grep -c '^S' "$TMP/ours.gfa")" \
  "$(grep -c '^L' "$TMP/ours.gfa")" \
  "$(grep -c '^P' "$TMP/ours.gfa")"

echo ""
echo "=== Diff (truth vs ours, canonical) ==="
if diff -u "$TMP/truth.gfa" "$TMP/ours.gfa" > "$TMP/diff.out"; then
  echo "ISOMORPHIC: canonical forms match exactly"
  exit 0
else
  cat "$TMP/diff.out" | head -60
  echo "..."
  echo "DIVERGENT: see full diff in $TMP/diff.out (kept by re-running with TMP not auto-cleaned)"
  exit 1
fi
