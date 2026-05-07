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
USE_SEQUENCE=1  # default to sequence-based canonicalization (Phase 1+);
                # disable with --no-sequence for placeholder S-line fixtures.

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix) PREFIX="$2"; shift 2;;
    --gfa) GFA="$2"; shift 2;;
    --path) PATH_NAME="$2"; shift 2;;
    --start) START="$2"; shift 2;;
    --end) END="$2"; shift 2;;
    --context) CONTEXT="$2"; shift 2;;
    --backend) BACKEND="$2"; shift 2;;
    --no-sequence) USE_SEQUENCE=0; shift;;
    *) echo "unknown arg: $1"; exit 2;;
  esac
done

USE_SEQ_FLAG=""
if [[ "$USE_SEQUENCE" == "1" ]]; then
  USE_SEQ_FLAG="--use-sequence"
fi

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
  $USE_SEQ_FLAG \
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
const useSeq = process.argv[3] === '1'
process.stdout.write(canonicalize(text, { useSequence: useSeq }))
EOF
sed -i "s|__CANON__|$REPO_ROOT/tools/graph-truth-extractor/canonicalize.ts|" "$TMP/canon.ts"
node --experimental-strip-types "$TMP/canon.ts" "$TMP/ours.raw.gfa" "$USE_SEQUENCE" > "$TMP/ours.gfa"

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
fi

# Line-wise canonical diff failed. At chr20 scale this is expected when
# WL-equivalent SNV nodes have the same length+sequence+context — the
# canonical-id tiebreaker is arbitrary across truth and ours. Fall back to
# the automorphism-tolerant structural fingerprint.
cat > "$TMP/struct.ts" <<EOF
import fs from 'fs'
import { structuralFingerprint } from '__CANON__'
const useSeq = process.argv[3] === '1'
const fp = structuralFingerprint(fs.readFileSync(process.argv[2], 'utf8'), { useSequence: useSeq })
console.log(JSON.stringify(fp, null, 2))
EOF
sed -i "s|__CANON__|$REPO_ROOT/tools/graph-truth-extractor/canonicalize.ts|" "$TMP/struct.ts"
TRUTH_FP_JSON=$(node --experimental-strip-types "$TMP/struct.ts" "$TMP/truth.gfa" "$USE_SEQUENCE")
OURS_FP_JSON=$(node --experimental-strip-types "$TMP/struct.ts" "$TMP/ours.gfa" "$USE_SEQUENCE")
TRUTH_COMBINED=$(echo "$TRUTH_FP_JSON" | grep -oE '"combined": *"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/')
OURS_COMBINED=$(echo "$OURS_FP_JSON" | grep -oE '"combined": *"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/')

echo ""
echo "=== Structural fingerprint (automorphism-tolerant) ==="
echo "  truth: $TRUTH_FP_JSON"
echo "  ours:  $OURS_FP_JSON"
if [[ "$TRUTH_COMBINED" == "$OURS_COMBINED" ]]; then
  echo "STRUCTURALLY ISOMORPHIC: line-wise diff differs but combined fingerprint matches"
  echo "(seq+link+path multisets identical; canonical-id tiebreaks and per-node"
  echo " edge distribution across symmetry classes may differ — both are valid"
  echo " representations of the same physical graph.)"
  exit 0
else
  cat "$TMP/diff.out" | head -60
  echo "..."
  echo "DIVERGENT: structural fingerprints disagree."
  echo "  full diff: $TMP/diff.out"
  exit 1
fi
