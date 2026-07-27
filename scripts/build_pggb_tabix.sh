#!/usr/bin/env bash
#
# Make a plain (pggb / odgi / Minigraph-Cactus base-level) GFA browsable by locus
# in JBrowse, by building the same two tabix indexes RgfaTabixAdapter already
# reads for rGFA. build_rgfa_tabix.sh does this with `gfatools gfa2bed -m`, which
# only works because rGFA states SN/SO/SR per segment; a plain GFA states the
# same information in its P lines instead, so the walk in pggb_gfa_to_bed.py
# stands in for the tags and everything downstream is unchanged.
#
# What that buys, against the `odgi extract` route the pangenome tutorial used
# to require: no per-window extraction step, so the graph opens at any locus from
# the track menu, the launch menus and hover sync work, and the segments draw as
# a linear track on the reference.
#
# Requires: python3, sort, bgzip, tabix
# Usage:    bash scripts/build_pggb_tabix.sh <graph.gfa[.gz]> [out-prefix] [reference-sample]
#
# Produces <prefix>.segs.bed.gz{,.tbi} and <prefix>.links.bed.gz{,.tbi}.
#
# Scale is the thing to check before reaching for this on a new graph. A pggb
# graph runs ~17 bp per segment, so the index grows with total sequence rather
# than with variation: the five-strain E. coli graph here is 606k segments and
# 814k links, which builds in about a minute. A human pangenome at base level is
# three orders of magnitude past that, and there the answer is still to cut a
# window offline with `odgi extract` (or to browse the minigraph rGFA, which is
# SV-resolution and small enough to index whole).
set -euo pipefail

GFA="${1:?usage: build_pggb_tabix.sh <graph.gfa[.gz]> [out-prefix] [reference-sample]}"
PREFIX="${2:-${GFA%.gfa*}}"
REFERENCE="${3:-}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

python3 "$HERE/pggb_gfa_to_bed.py" "$GFA" "$PREFIX" \
  ${REFERENCE:+--reference "$REFERENCE"}

for kind in segs links; do
  sort -k1,1 -k2,2n "$PREFIX.$kind.bed" | bgzip >"$PREFIX.$kind.bed.gz"
  tabix -f -p bed "$PREFIX.$kind.bed.gz"
  rm -f "$PREFIX.$kind.bed"
done

ls -l "$PREFIX".segs.bed.gz* "$PREFIX".links.bed.gz*
