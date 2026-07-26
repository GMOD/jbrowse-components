#!/usr/bin/env bash
#
# Project each sample's path through every bubble of a graph into one
# tabix-indexed BED, long format: one row per (bubble x sample). Rows are the
# samples, so a LinearMultiRowFeatureDisplay partitioned on `strain` draws one
# lane per haplotype and each block is that haplotype's allele at that bubble,
# sized by the reference span it replaces and labelled with its length change.
#
# Requires: minigraph, gfatools is NOT needed, bgzip, tabix
# Usage:    bash scripts/build_minigraph_paths.sh <graph.rgfa[.gz]> <out-prefix> \
#             <ref.fa> [sample.fa ...]
#
# The FIRST fasta is the reference, matching `minigraph -cxggs ref.fa other.fa
# ...`: its path through a bubble IS the reference allele, so it is what every
# other sample's path is compared against. Row names come from the fasta
# basenames with a `.pansn`/`.fa`/`.fasta`(`.gz`) suffix stripped.
#
# Produces <prefix>.bed.gz{,.tbi} with this header, which is the contract other
# producers can also fill (see "Other producers" below):
#
#   #chrom start end name score strand thickStart thickEnd itemRgb \
#     strain class delta pathLen refLen alleles nonRef path
#
#   name     the length change, for the on-block label ("+113,174", "-3,217",
#            "ref", "no call")
#   strand   the orientation this sample's contig aligned in over the bubble.
#            `-` is the graph recording an INVERSION: reverse-aligned calls come
#            in long contiguous runs, which is what a large inversion looks like
#            bubble by bubble. Orthogonal to `class` on purpose (in the
#            five-strain E. coli graph IAI39's 169 reverse calls split 60 ref /
#            57 del / 52 ins), so it is its own field rather than a class value.
#   itemRgb  the class color, so the track draws correctly with no color config
#            at all. A `color` jexl on `class` or `strand` overrides it.
#   strain   the row (partitionField)
#   class    ref | ins | del | sub | nocall
#   delta    pathLen - refLen, the bp gained or lost against the reference
#   pathLen  length of this sample's path through the bubble, in bp
#   refLen   reference span the bubble covers (0 at a pure-insertion site)
#   alleles  distinct paths OBSERVED at this bubble across the samples given.
#            `gfatools bubble` also reports a path count, but that one counts
#            routes combinatorially and saturates at 2147483647 on a real
#            pangenome; this one counts alleles someone actually carries, so it
#            is the number to filter multi-allelic sites on
#            (`jexl:get(feature,'alleles')>2`).
#   nonRef   how many samples leave the reference path at this bubble, i.e. the
#            allele count behind that site's frequency. Distinct from the
#            `odgi depth`/`pav` projections, which answer whether a haplotype is
#            *present*, not whether it differs.
#   path     the segment ids the sample traverses, e.g. `>s2650>s1949`. `<`
#            means that segment is traversed in reverse. These are the same ids
#            the graph view draws, which is what ties the two panels together.
#
# `alleles` and `nonRef` are per-bubble, so they repeat down a bubble's rows.
# That keeps every row self-describing, which is what lets one jexl filter cut
# the track to the sites worth looking at.
#
# Colors match what the alignments vocabulary already uses for the same two
# things, so the panels read as one: insertion purple is `INSERTION_COLOR` from
# `@jbrowse/alignments-core` (the same value the display's indel glyph draws in,
# so a block and the marker over it agree), deletion grey the theme's, reference
# the variant displays' own `#ccc`, and no-call their muted yellow.
#
# Other producers of the same schema, since not every graph can use this one:
#
#   - A graph that already carries its haplotypes as W/P lines (pggb, odgi, the
#     base-level Minigraph-Cactus graph) does not need the assemblies at all,
#     but it also does not need this: `vg deconstruct` / `pggb -V` turns those
#     walks into a VCF, which a multi-sample variant track reads directly.
#   - An rGFA with neither paths nor the assemblies to re-map still yields an
#     allele inventory from the links index (`build_rgfa_tabix.sh`), but the
#     only haplotype label there is the one that first contributed each allele,
#     which is build order rather than carriage. One lane, not rows.
#
set -euo pipefail

GFA="${1:?usage: build_minigraph_paths.sh <graph.rgfa[.gz]> <out-prefix> <ref.fa> [sample.fa ...]}"
PREFIX="${2:?missing out-prefix}"
shift 2
[ "$#" -ge 1 ] || { echo "need at least the reference fasta" >&2; exit 1; }

sample_name() {
  basename "$1" | sed -E 's/\.(pansn\.)?(fa|fasta|fna)(\.gz)?$//'
}

REF_FA="$1"
REF_NAME=$(sample_name "$REF_FA")
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# One call file per sample. minigraph emits exactly one line per `gfatools
# bubble` line, in the same order for every sample, so the reference's line N and
# a sample's line N describe the same bubble and FNR joins them.
for fa in "$@"; do
  minigraph -cxasm --call -t"$(nproc)" "$GFA" "$fa" > "$TMP/$(sample_name "$fa").call.bed"
done

# The last field of a call line is
# `path:pathLen:strand:contig:contigStart:contigEnd`, or a bare `.` when the
# sample has no alignment over the bubble at all. That bare `.` is the trap: read
# as colon-separated it yields pathLen 0, which scores as a deletion of the whole
# reference span rather than as missing data.
#
# `*` is an empty path, and whether that is a deletion depends on the bubble: at
# a bubble with reference span it means the sample skips that span, but 72 of the
# 601 bubbles in the five-strain E. coli graph have NO reference span (they are
# pure insertion sites), and there `*` is the reference allele. Classifying on
# `delta` rather than on the `*` handles both without a special case.

# Per-bubble context, one line per bubble: the reference path plus the two
# aggregates that need every sample in hand at once. Every call file has the same
# line count in the same bubble order, so FNR is the join key across all of them
# regardless of how many files are passed.
cat > "$TMP/context.awk" <<'AWK'
NR == FNR {
  if ($6 == ".") { refpath[FNR] = "." } else { split($6, f, ":"); refpath[FNR] = f[1] }
  if (FNR > n) { n = FNR }
  next
}
{
  split($6, f, ":")
  p = f[1]
  if (p != ".") {
    key = FNR SUBSEP p
    if (!(key in seen)) { seen[key] = 1; alleles[FNR]++ }
    if (p != refpath[FNR]) { nonref[FNR]++ }
  }
}
END { for (i = 1; i <= n; i++) print refpath[i] "\t" alleles[i] + 0 "\t" nonref[i] + 0 }
AWK

cat > "$TMP/derive.awk" <<'AWK'
function commify(n, s, sign) {
  sign = ""
  if (n < 0) { sign = "-"; n = -n }
  s = n ""
  while (length(s) > 3 && match(s, /[0-9][0-9][0-9][0-9]($|,)/)) {
    s = substr(s, 1, RSTART) "," substr(s, RSTART + 1)
  }
  return sign s
}
BEGIN {
  OFS = "\t"
  rgb["ref"]    = "204,204,204"
  rgb["ins"]    = "192,0,192"
  rgb["del"]    = "128,128,128"
  rgb["sub"]    = "0,154,138"
  rgb["nocall"] = "191,170,64"
}
# first input is the per-bubble context from context.awk
NR == FNR { refpath[FNR] = $1; alleles[FNR] = $2; nonref[FNR] = $3; next }
{
  refspan = $3 - $2
  split($6, sf, ":")
  strand = ($6 == "." || sf[3] == "") ? "." : sf[3]
  if ($6 == ".") {
    cls = "nocall"; path = "."; pathlen = -1; delta = 0; label = "no call"
  } else {
    split($6, f, ":")
    path = f[1]
    pathlen = f[2] + 0
    delta = pathlen - refspan
    if (path == refpath[FNR]) { cls = "ref";  label = "ref" }
    else if (delta > 0)       { cls = "ins";  label = "+" commify(delta) }
    else if (delta < 0)       { cls = "del";  label = commify(delta) }
    else                      { cls = "sub";  label = commify(pathlen) " sub" }
  }
  chrom = $1
  sub("^" ref "#[^#]*#", "", chrom)
  # A pure-insertion bubble has start == end. Widen it to one base so it is
  # drawable, the convention a VCF insertion record already uses; refLen stays
  # truthful at 0.
  end = ($3 > $2 ? $3 : $2 + 1)
  print chrom, $2, end, label, 0, strand, $2, end, rgb[cls], strain, cls, delta, \
    pathlen, refspan, alleles[FNR], nonref[FNR], path
}
AWK

CALLS=""
for fa in "$@"; do CALLS="$CALLS $TMP/$(sample_name "$fa").call.bed"; done
# shellcheck disable=SC2086
awk -f "$TMP/context.awk" "$TMP/$REF_NAME.call.bed" $CALLS > "$TMP/context.tsv"

{
  printf '#chrom\tstart\tend\tname\tscore\tstrand\tthickStart\tthickEnd\titemRgb'
  printf '\tstrain\tclass\tdelta\tpathLen\trefLen\talleles\tnonRef\tpath\n'
  for fa in "$@"; do
    name=$(sample_name "$fa")
    awk -f "$TMP/derive.awk" -v ref="$REF_NAME" -v strain="$name" \
      "$TMP/context.tsv" "$TMP/$name.call.bed"
  done | sort -k1,1 -k2,2n
} | bgzip > "$PREFIX.bed.gz"
tabix -f -p bed "$PREFIX.bed.gz"

echo "== $PREFIX.bed.gz"
zcat "$PREFIX.bed.gz" | awk -F'\t' 'NR > 1 { c[$10 " " $11]++ }
  END { for (k in c) print "   " c[k], k }' | sort -k2,2 -k1,1rn
