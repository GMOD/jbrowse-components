#!/usr/bin/env bash
#
# Build the two tabix indexes RgfaTabixAdapter reads from an rGFA (minigraph, or
# the minigraph stage of Minigraph-Cactus). rGFA tags every segment with SN/SO/SR
# — stable sequence, offset, and rank — so both files are plain BED projections
# of coordinates the file already states. Plain GFA (pggb, odgi, full
# Minigraph-Cactus) has no such tags and is NOT supported here; use `odgi
# extract` to cut a window offline instead.
#
# The distinction matters and is easy to get backwards: HPRC release 2's
# `hprc-v2.0-mc-grch38.sv.gfa.gz` IS rGFA (it is the minigraph stage), while the
# `hprc-v2.0-mc-grch38.gfa.gz` beside it is base-level and is not.
#
# Requires: gfatools, awk, sort, bgzip, tabix
# Usage:    bash scripts/build_rgfa_tabix.sh <graph.rgfa[.gz]> [out-prefix]
#
# Produces <prefix>.segs.bed.gz{,.tbi} and <prefix>.links.bed.gz{,.tbi}. Runs on
# a whole human pangenome: HPRC's hprc-v2.0-mc-grch38.sv.gfa.gz is 751k segments
# and indexes in about 45 seconds, peaking near 3.7 GB.
#
set -euo pipefail

GFA="${1:?usage: build_rgfa_tabix.sh <graph.rgfa[.gz]> [out-prefix]}"
PREFIX="${2:-${GFA%.gfa*}}"

# HPRC ships its minigraph graphs gzipped, so read through a decompressor when
# needed rather than making the user stage a 2.6 GB plain copy. The graph is
# read twice (once per output), so this is a function, not a temp file.
case "$GFA" in
  *.gz) gfa() { gzip -dc "$GFA"; } ;;
  *)    gfa() { cat "$GFA"; } ;;
esac

# segs.bed.gz — one row per segment, straight from gfatools:
#   stableName  start  end  segmentId  rank
gfatools gfa2bed -m <(gfa) | sort -k1,1 -k2,2n | bgzip > "$PREFIX.segs.bed.gz"
tabix -p bed "$PREFIX.segs.bed.gz"

# links.bed.gz — one row per L-line *per endpoint*, so a region query finds an
# edge whether the region covers its source or its target. Each row carries both
# endpoints in full, because the neighbour of an in-region segment is usually a
# rank>0 segment sitting on a different stable sequence: tabix cannot look it up
# by segment id, so the row states its coordinates rather than pointing at them.
#
#   chrom start end  srcId±  tgtId±  srcChrom srcStart srcEnd srcRank \
#                            tgtChrom tgtStart tgtEnd tgtRank
#
# chrom/start/end are the endpoint this row is indexed under, and repeat one of
# the two endpoint records.
awk -F'\t' '
  NR == FNR { c[$4] = $1; s[$4] = $2; e[$4] = $3; r[$4] = $5; next }
  $1 == "L" && ($2 in c) && ($4 in c) {
    rec = $2 $3 "\t" $4 $5 \
      "\t" c[$2] "\t" s[$2] "\t" e[$2] "\t" r[$2] \
      "\t" c[$4] "\t" s[$4] "\t" e[$4] "\t" r[$4]
    print c[$2] "\t" s[$2] "\t" e[$2] "\t" rec
    print c[$4] "\t" s[$4] "\t" e[$4] "\t" rec
  }
' <(gzip -dc "$PREFIX.segs.bed.gz") <(gfa) |
  sort -k1,1 -k2,2n | bgzip > "$PREFIX.links.bed.gz"
tabix -p bed "$PREFIX.links.bed.gz"

ls -l "$PREFIX".segs.bed.gz* "$PREFIX".links.bed.gz*
