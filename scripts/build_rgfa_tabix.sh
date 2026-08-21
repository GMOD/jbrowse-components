#!/usr/bin/env bash
#
# Build the two tabix indexes RgfaTabixAdapter reads from an rGFA (minigraph, or
# the minigraph stage of Minigraph-Cactus). rGFA tags every segment with SN/SO/SR
# — stable sequence, offset, and rank — so both files are plain BED projections
# of coordinates the file already states. Plain GFA (pggb, odgi, vg, base-level
# Minigraph-Cactus) has no such tags and is not read here, but it states the
# same coordinates in path order, so build_pggb_tabix.sh walks its P/W lines and
# emits this identical pair. The index contract is what makes a graph browsable,
# not the GFA flavour, so pick the producer that matches your file.
#
# The distinction matters and is easy to get backwards: HPRC release 2's
# `hprc-v2.0-mc-grch38.sv.gfa.gz` IS rGFA (it is the minigraph stage), while the
# `hprc-v2.0-mc-grch38.gfa.gz` beside it is base-level and is not.
#
# Requires: gfatools, awk, sort, bgzip, tabix
# Usage:    bash scripts/build_rgfa_tabix.sh <graph.rgfa[.gz]> [out-prefix] [ref-prefix]
#
# Produces <prefix>.segs.bed.gz{,.tbi} and <prefix>.links.bed.gz{,.tbi}. Runs on
# a whole human pangenome: HPRC's hprc-v2.0-mc-grch38.sv.gfa.gz is 751k segments
# and indexes in about 45 seconds, peaking near 3.7 GB.
#
# `ref-prefix` (e.g. GRCh38) additionally writes <prefix>.ref.segs.bed.gz and
# <prefix>.ref.links.bed.gz, the same rows keyed only under stable sequences of
# that PanSN sample. A launch downloads both .tbi files before it can cut
# anything, and on HPRC that fixed cost is 9.18 MB of index against 0.48 MB for
# the small pair (19x), because 195 of that graph's 13,717 indexed sequences are
# GRCh38 and the rest are donor contigs. Rows a reference query returns are
# byte-identical between the two, verified across seven windows including a
# whole chromosome.
#
# **Read what follows before pointing a graph track at it.** The small pair is
# equivalent ONLY at `Graph context: None`, and the view's `subgraphContext`
# defaults to 1 hop. A hop follows an allele's interior segments, which are
# indexed under the DONOR contig the small pair drops, so the graph silently
# comes back as though context were 0 — the two-stubs-in-mid-air picture
# `graph_context.png` exists to explain. Measured on HPRC's C4 window:
#
#   context 0   full 30 nodes / 36 edges   ref-only 30 / 36   same
#   context 1   full 34 / 43               ref-only 30 / 36   DIFFERS
#   context 2   full 34 / 45               ref-only 30 / 36   DIFFERS
#
# So use the small pair for a segments track drawn on the reference, which only
# ever queries the reference refName, and for a session that sets
# `subgraphContext: 0` deliberately. Keep the full pair for the graph cut, and
# for a segments track opened ON a contributing assembly (the E. coli case,
# where every strain is loaded, and HPRC's hs1/CHM13 lane).
#
# These two files also state, between them, every allele the graph holds:
# build_rgfa_alleles.sh derives that inventory from this pair alone, with no
# graph, no assemblies and no VCF.
#
set -euo pipefail

# tabix needs every row of one sequence contiguous, and whether `sort` delivers
# that depends on the caller's locale. UTF-8 collation ignores punctuation at the
# primary level, and `#` is what PanSN is built out of, so two distinct stable
# names can compare EQUAL: the tie then falls to the numeric second key and the
# two sequences interleave by position. bgzip and tabix both accept the result,
# and queries for the later run come back empty. C collation is bytes, which is
# also what rgfaBed.ts sorts the synthesized GFA under, and it is faster on the
# 750k-line files this runs on.
export LC_ALL=C

GFA="${1:?usage: build_rgfa_tabix.sh <graph.rgfa[.gz]> [out-prefix] [ref-prefix]}"
# `${GFA%.gfa*}` does not match `.rgfa`, which is the extension this script's own
# usage line advertises, so the default prefix used to keep it: `graph.rgfa` in,
# `graph.rgfa.segs.bed.gz` out. Strip either spelling, with or without `.gz`.
DEFAULT_PREFIX=${GFA%.gz}
DEFAULT_PREFIX=${DEFAULT_PREFIX%.gfa}
DEFAULT_PREFIX=${DEFAULT_PREFIX%.rgfa}
PREFIX="${2:-$DEFAULT_PREFIX}"
REF_PREFIX="${3:-}"

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

# `gfa2bed -m` projects SN/SO/SR, which only an rGFA carries. Handed a plain GFA
# it has nothing to read and writes NOTHING — measured on gfatools 0.5-r296, not
# assumed: no rows, exit 0, and nothing on stderr either. Every step after it
# then succeeds on that: tabix indexes an empty BED and exits 0 too, the links
# pass finds no segment to join, and the run ends with four well-formed files and
# a track that draws nothing. That is the mistake this script's header spends
# three lines warning about, because HPRC ships both flavours side by side under
# names one character apart, so it is an error here rather than an empty index.
if [ "$(gzip -dc "$PREFIX.segs.bed.gz" | wc -l)" -eq 0 ]; then
  echo "$GFA projected to no segments: gfatools found no SN/SO/SR tags, so this" >&2
  echo "is a plain GFA rather than an rGFA. A plain GFA states the same" >&2
  echo "coordinates in its P/W lines instead. Build the identical pair with" >&2
  echo "  curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_pggb_tabix.sh" >&2
  echo "  bash build_pggb_tabix.sh $GFA $PREFIX" >&2
  exit 1
fi
tabix -f -p bed "$PREFIX.segs.bed.gz"

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
tabix -f -p bed "$PREFIX.links.bed.gz"

# The reference-only pair, derived from the full one rather than rebuilt from
# the graph, so the rows are the same rows by construction and not merely by
# intent. Column 1 is the stable sequence a row is INDEXED under, and PanSN puts
# the sample before the first `#`, so this keeps exactly the rows a reference
# query could return. Both endpoints stay stated in full, so a link into a donor
# allele survives with its far end intact.
if [ -n "$REF_PREFIX" ]; then
  for kind in segs links; do
    gzip -dc "$PREFIX.$kind.bed.gz" |
      awk -F'\t' -v p="$REF_PREFIX#" 'index($1, p) == 1' |
      bgzip > "$PREFIX.ref.$kind.bed.gz"
    tabix -f -p bed "$PREFIX.ref.$kind.bed.gz"
  done
  # An unmatched prefix is a typo, not an empty result. `GRCh38#0`, `GRCh38#`
  # and `chr` all keep zero rows, and both bgzip and tabix succeed on zero rows,
  # so the pair ships as two valid indexes over nothing and the reference lane
  # draws nothing. The argument is a PanSN sample, and the graph states which
  # samples it has, so name them.
  if [ "$(gzip -dc "$PREFIX.ref.segs.bed.gz" | wc -l)" -eq 0 ]; then
    rm -f "$PREFIX".ref.*.bed.gz "$PREFIX".ref.*.bed.gz.tbi
    echo "ref-prefix '$REF_PREFIX' matches no stable sequence in $GFA." >&2
    echo "It is a PanSN sample, the part before the first '#'. This graph has:" >&2
    gzip -dc "$PREFIX.segs.bed.gz" | cut -f1 |
      awk -F'#' '{ print ($0 ~ /#/) ? $1 : $0 }' | sort -u | sed 's/^/  /' >&2
    exit 1
  fi
fi

ls -l "$PREFIX".segs.bed.gz* "$PREFIX".links.bed.gz*
# `if`, not `[ -n "$REF_PREFIX" ] && ls`: an AND-list whose test fails is exempt
# from errexit but still the script's last command, so the whole run exited 1
# with every index written correctly. The tutorial's own invocation omits this
# argument, and build_ecoli_pangenome_graph.sh calls it that way under `set -e`,
# so the E. coli build died here after pggb and minigraph had already run.
if [ -n "$REF_PREFIX" ]; then
  ls -l "$PREFIX".ref.*.bed.gz*
fi
