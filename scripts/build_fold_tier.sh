#!/usr/bin/env bash
#
# Build a graph track's coarse tier: the graph with every variant under N bp
# folded into the reference, as the same two tabix indexes RgfaTabixAdapter
# reads. The graph track folds each cut it draws the same way, at ten of the
# linear view's pixels (FOLD_PX in jbrowse-plugin-graphgenomeviewer), and
# folding a fold again at a larger size folds the original at that size. So a
# tier folded at N and handed over at N / 10 bp per pixel draws what the fine
# cut drew just below the handover, and zooming across it changes nothing on
# screen.
#
# The fold keeps the backbone, every allele whose own length or the reference
# it replaces reaches N, and the shortest way from each one's ends back to the
# backbone; the reference between kept alleles is one segment.
#
# Requires: node (for npx), gfa-to-tabix (https://github.com/GMOD/gfa-to-tabix)
# Usage:    bash scripts/build_fold_tier.sh <graph.gfa[.gz] | -> <out-prefix> [N]
#             [--reference SAMPLE] [--layout anchored|contig]
#
# --reference names a plain GFA's backbone path; an rGFA states its own.
# --layout is the fine pair's, so a tier window returns what a fine window
# does: an anchored window inside a large bubble returns the whole bubble, a
# contig one only what links reach from it.
set -euo pipefail

USAGE="usage: build_fold_tier.sh <graph.gfa[.gz] | -> <out-prefix> [N] [--reference SAMPLE] [--layout anchored|contig]"
GRAPH="${1:?$USAGE}"
PREFIX="${2:?$USAGE}"
shift 2
BELOW=10000
if [ $# -gt 0 ] && [ "${1#--}" = "$1" ]; then
  BELOW="$1"
  shift
fi
FOLD_ARGS=()
LAYOUT_ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --reference) FOLD_ARGS+=(--reference "$2"); shift 2 ;;
    --layout) LAYOUT_ARGS+=(--layout "$2"); shift 2 ;;
    *) echo "$USAGE" >&2; exit 1 ;;
  esac
done

npx -y -p @jbrowse/bandage-core@^9.2.0 bandage-fold "$GRAPH" --below "$BELOW" ${FOLD_ARGS[@]+"${FOLD_ARGS[@]}"} |
  gfa-to-tabix - ${LAYOUT_ARGS[@]+"${LAYOUT_ARGS[@]}"} -o "$PREFIX"

ls -l "$PREFIX".segs.bed.gz* "$PREFIX".links.bed.gz*
