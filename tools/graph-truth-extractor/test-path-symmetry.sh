#!/usr/bin/env bash
# C3 path-symmetry harness. Picks a (refPath, start, end) viewport, finds
# equivalent ranges in N other reference paths via equivalent-ranges.ts,
# then dumps + canonicalizes a subgraph from each path's perspective and
# asserts all structural fingerprints match. Per agent-docs/GRAPH_PLAN.md
# § C3.
#
# Usage:
#   bash tools/graph-truth-extractor/test-path-symmetry.sh \
#     [--prefix <indexPrefix>] [--path <refPathName>] \
#     [--start <n>] [--end <n>]
#
# Defaults: HPRC chrM control region, GRCh38#0#chrM:5000-5500.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

PREFIX="$REPO_ROOT/test/data/synteny-demo/hprc/hprc-v1.1-mc-grch38-chrM"
REF_PATH="GRCh38#0#chrM"
START=5000
END=5500
CONTEXT=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix) PREFIX="$2"; shift 2;;
    --path) REF_PATH="$2"; shift 2;;
    --start) START="$2"; shift 2;;
    --end) END="$2"; shift 2;;
    --context) CONTEXT="$2"; shift 2;;
    *) echo "unknown arg: $1"; exit 2;;
  esac
done

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "Path-symmetry: $PREFIX $REF_PATH:$START-$END"
echo ""

node --experimental-strip-types \
  "$REPO_ROOT/plugins/comparative-adapters/scripts/equivalent-ranges.ts" \
  "$PREFIX" "$REF_PATH" "$START" "$END" > "$TMP/ranges.tsv"

if [[ ! -s "$TMP/ranges.tsv" ]]; then
  echo "No equivalent ranges found — region empty?"
  exit 1
fi

echo "=== Equivalent ranges ==="
cat "$TMP/ranges.tsv"
echo ""

# For each equivalent path, dump-subgraph + structural fingerprint.
cat > "$TMP/fingerprint.ts" <<'EOF'
import fs from 'fs'
import { canonicalize, structuralFingerprint } from '__CANON__'
const text = fs.readFileSync(process.argv[2]!, 'utf8')
const fp = structuralFingerprint(canonicalize(text, { useSequence: true }), { useSequence: true })
process.stdout.write(fp.combined + '\n')
EOF
sed -i "s|__CANON__|$REPO_ROOT/tools/graph-truth-extractor/canonicalize.ts|" "$TMP/fingerprint.ts"

declare -a NAMES=()
declare -a FPS=()

while IFS=$'\t' read -r NAME PSTART PEND; do
  node --experimental-strip-types \
    "$REPO_ROOT/plugins/comparative-adapters/scripts/dump-subgraph.ts" \
    "$PREFIX" "$NAME" "$PSTART" "$PEND" --context "$CONTEXT" > "$TMP/$NAME.gfa"
  FP=$(node --experimental-strip-types "$TMP/fingerprint.ts" "$TMP/$NAME.gfa")
  printf "%-40s %s:%s-%s  fp=%s\n" "$NAME" "$NAME" "$PSTART" "$PEND" "$FP"
  NAMES+=("$NAME")
  FPS+=("$FP")
done < "$TMP/ranges.tsv"

echo ""
echo "=== Result ==="
FIRST_FP="${FPS[0]}"
ALL_MATCH=1
for i in "${!FPS[@]}"; do
  if [[ "${FPS[i]}" != "$FIRST_FP" ]]; then
    ALL_MATCH=0
    echo "MISMATCH: ${NAMES[i]} fingerprint differs"
  fi
done

if [[ "$ALL_MATCH" == "1" ]]; then
  echo "ISOMORPHIC: all ${#FPS[@]} paths produce the same structural fingerprint"
  exit 0
fi
echo "DIVERGENT: path-symmetry violated"
exit 1
