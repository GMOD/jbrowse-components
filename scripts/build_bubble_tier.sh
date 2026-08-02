#!/usr/bin/env bash
#
# Build a coarse level-of-detail tier from a graph's bubble BED, as the same two
# tabix indexes RgfaTabixAdapter already reads. The fine tier draws one node per
# GFA segment, so a window past ~100 kb is undrawable. This draws one node per
# bubble, with the invariant reference between bubbles as backbone, so a whole
# chromosome fits in a few hundred nodes.
#
# Measured on HPRC release 2's hosted bubble file (130,510 bubbles), nodes
# returned for a whole 249 Mb chr1:
#
#   --min-content       0   18,888 nodes    2.9 MB + 5.5 MB
#   --min-content    1000    3,342 nodes    582 kB + 1.1 MB
#   --min-content   10000      474 nodes     99 kB + 172 kB
#
# against ~751k segments for the fine tier over the same span. A tier is browsed
# by pointing a track at its prefix, so choosing a level of detail is choosing a
# file, and the tiers are meant to be built and hosted together.
#
# Requires: python3, sort, bgzip, tabix
# Usage:    bash scripts/build_bubble_tier.sh <bubbles.bed[.gz]> [out-prefix] [min-content]
#
# The bubble BED is what `gfatools bubble` writes, which for HPRC is published
# at jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.bubbles.bed.gz.
set -euo pipefail

BUBBLES="${1:?usage: build_bubble_tier.sh <bubbles.bed[.gz]> [out-prefix] [min-content]}"
PREFIX="${2:-${BUBBLES%.bubbles.bed*}.tier}"
MIN_CONTENT="${3:-10000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Sibling helpers this script runs, fetched next to it when absent, so a bare
# `curl -fO` of this one file behaves the same as a repo checkout.
HELPERS=(bubbles_to_tier_bed.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

python3 "$SCRIPT_DIR/bubbles_to_tier_bed.py" "$BUBBLES" "$PREFIX" \
  --min-content "$MIN_CONTENT"

for kind in segs links; do
  sort -k1,1 -k2,2n "$PREFIX.$kind.bed" | bgzip >"$PREFIX.$kind.bed.gz"
  tabix -f -p bed "$PREFIX.$kind.bed.gz"
  rm -f "$PREFIX.$kind.bed"
done

ls -l "$PREFIX".segs.bed.gz* "$PREFIX".links.bed.gz*
