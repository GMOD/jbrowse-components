#!/usr/bin/env bash
#
# Make a plain (pggb / odgi / vg / Minigraph-Cactus base-level) GFA browsable by
# locus in JBrowse, by building the same two tabix indexes RgfaTabixAdapter
# already reads for rGFA. build_rgfa_tabix.sh does this with `gfatools gfa2bed
# -m`, which only works because rGFA states SN/SO/SR per segment. A plain GFA
# states the same information in its P or W lines instead, so the walk in
# pggb_gfa_to_bed.py stands in for the tags and everything downstream is
# unchanged.
#
# What that buys, against the `odgi extract` route the pangenome tutorial used
# to require: no per-window extraction step, so the graph opens at any locus from
# the track menu, the launch menus and hover sync work, and the segments draw as
# a linear track on the reference.
#
# Requires: python3, sort, bgzip, tabix
# Usage:    bash scripts/build_pggb_tabix.sh <graph.gfa[.gz|.zst]> [out-prefix] [reference-sample]
#
# Produces <prefix>.segs.bed.gz{,.tbi} and <prefix>.links.bed.gz{,.tbi}.
#
# Scale is the thing to check before reaching for this on a new graph, and the
# ceiling is lower than it looks. A pggb graph runs ~17 bp per segment, so the
# index grows with total sequence rather than with variation: the five-strain
# E. coli graph here is 606k segments and 814k links and builds in about a
# minute.
#
# A human chromosome does not merely take longer — it does not finish. Measured
# on HPRC release 2's per-chromosome pggb graph for chrY, which is the SMALLEST
# of the 25 (343 MB zstd against chr21's 2.4 GB): 4.12M segments and 7.69M
# links, and pggb_gfa_to_bed.py reached 15.2 GB resident after 93 s still in the
# load phase, having written nothing. It holds every segment length, every link
# and every path step in memory at once, so the requirement scales with the
# whole graph rather than with the window you wanted.
#
# So for anything human-scale, cut a window offline with `odgi extract` first,
# or browse the minigraph rGFA, which is SV-resolution and small enough to index
# whole. Making this streaming would move the ceiling, but a 4M-segment lane is
# not a thing the graph view can usefully draw either, so the window is the
# answer at both ends.
set -euo pipefail

GFA="${1:?usage: build_pggb_tabix.sh <graph.gfa[.gz|.zst]> [out-prefix] [reference-sample]}"
PREFIX="${2:-${GFA%.gfa*}}"
REFERENCE="${3:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Sibling helpers this script runs, fetched next to it when absent, so a bare
# `curl -fO` of this one file behaves the same as a repo checkout.
HELPERS=(pggb_gfa_to_bed.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

python3 "$SCRIPT_DIR/pggb_gfa_to_bed.py" "$GFA" "$PREFIX" \
  ${REFERENCE:+--reference "$REFERENCE"}

for kind in segs links; do
  sort -k1,1 -k2,2n "$PREFIX.$kind.bed" | bgzip >"$PREFIX.$kind.bed.gz"
  tabix -f -p bed "$PREFIX.$kind.bed.gz"
  rm -f "$PREFIX.$kind.bed"
done

ls -l "$PREFIX".segs.bed.gz* "$PREFIX".links.bed.gz*
