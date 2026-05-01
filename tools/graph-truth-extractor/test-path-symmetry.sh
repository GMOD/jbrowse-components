#!/usr/bin/env bash
# C3 path-symmetry harness. Picks a (refPath, start, end) viewport, finds
# equivalent ranges in N other reference paths, dumps + fingerprints a
# subgraph from each path's perspective, and asserts all fingerprints match.
# Per agent-docs/GRAPH_PLAN.md § C3.
#
# Thin wrapper around the single-process TS runner at
# plugins/comparative-adapters/scripts/path-symmetry.ts (one Node process
# total — the previous bash version spawned 1 + 2N).
#
# Usage:
#   bash tools/graph-truth-extractor/test-path-symmetry.sh \
#     [--prefix <indexPrefix>] [--path <refPathName>] \
#     [--start <n>] [--end <n>] [--context <k>]
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

exec node --experimental-strip-types \
  "$REPO_ROOT/plugins/comparative-adapters/scripts/path-symmetry.ts" \
  "$PREFIX" "$REF_PATH" "$START" "$END" --context "$CONTEXT"
