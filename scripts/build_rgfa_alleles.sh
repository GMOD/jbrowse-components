#!/usr/bin/env bash
#
# Derive an allele inventory from the two BEDs build_rgfa_tabix.sh emits, with
# no assemblies, no VCF and no re-mapping: one row per allele the graph holds,
# anchored on the reference. This is the fallback for a graph you cannot run
# `minigraph --call` against (scripts/build_minigraph_paths.sh), which needs the
# haplotype assemblies. When you do have them, prefer that one: it reports what
# each haplotype actually carries, while this reports what the graph contains.
#
# Requires: awk, sort, bgzip, tabix
# Usage:    bash scripts/build_rgfa_alleles.sh <prefix>
#
# Reads <prefix>.segs.bed.gz and <prefix>.links.bed.gz, writes
# <prefix>.alleles.bed.gz{,.tbi}. The inputs are the only thing it needs, so a
# hosted pair works without the graph: HPRC's are 6.7 MB and 34 MB against a
# 2.6 GB GFA.
#
# Header, which is the contract:
#
#   #chrom start end name score strand thickStart thickEnd itemRgb \
#     class delta altLen refLen CIGAR discoveryRank firstSeenIn nested segments
#
#   name     the length change, for the label ("+58,175", "-1,349")
#   itemRgb  class color, matching build_minigraph_paths.sh so the two tracks
#            read as one
#   class    ins | del | sub, from the sign of `delta`
#   delta    altLen - refLen
#   altLen   bp the allele's own path spans (0 for a clean backbone skip)
#   refLen   bp of reference between the two anchors (0 at a pure-insertion site)
#   CIGAR    the allele as an alignment against the reference it replaces
#            (`2062M63348I`). This is what makes the track legible rather than a
#            row of ticks: an insertion consumes NO reference, so its start/end
#            cannot state its size, and a plain feature track would draw a 63 kb
#            allele 1 bp wide with the number only in its label. An
#            `AlignmentsTrack` reading this BED walks the CIGAR and draws the
#            insertion marker at its real magnitude — the same glyph
#            plugins/alignments draws for a read.
#   discoveryRank
#            lowest SR on the allele's path: the build order of the first
#            assembly to contribute it. A weak rarity bound, and weaker than it
#            reads: SR is construction order, so a haplotype earlier in that
#            order may lack the sequence, may have had its copy merged into an
#            existing path, or may simply not have aligned here. It bounds
#            discovery, and it proves nothing about absence.
#   firstSeenIn
#            PanSN sample of that segment. Named for what it is, because the
#            obvious misreading is expensive: minigraph COLLAPSES, so an allele
#            several haplotypes share is attributed to whichever was added
#            first. It is discovery order, never carriage, and rows keyed on it
#            would read as a haplotype pileup — in the HPRC MHC window one rank
#            absorbs 41 of 78 alleles purely by being added first. Carriage
#            comes from build_minigraph_paths.sh, which re-maps the assemblies.
#   nested   1 when the walk passed a branch point, so this length is one route
#            through a nested bubble rather than the only one
#   segments the traversed ids, e.g. `>s2650>s1949`, `<` for reverse. Same ids
#            the graph view draws, which ties the two panels together.
#
# chrom drops a PanSN `sample#hap#` prefix so the rows sit on the reference
# assembly's own refNames (`GRCh38#0#chr1` -> `chr1`), unlike segs/links, which
# keep the graph's spelling because RgfaTabixAdapter maps it.
#
# How an allele is read out of the links index, which states both endpoints of
# every L-line in full:
#
#   - a link between two backbone (rank 0) segments whose coordinates leave a
#     GAP is a deletion. A reverse-orientation pair states the same skip
#     backwards, so order the two anchors rather than requiring tgt > src: 4 of
#     the 98 deletions in the five-strain E. coli graph are written that way,
#     including IAI39's at 1,072,931.
#   - a link from a backbone segment to a rank>0 one enters an allele. Walk the
#     graph bidirected from there — state is (segment, orientation), and each
#     L-line also yields its reverse complement — until the walk arrives back on
#     a rank-0 segment, which is the exit. Test the ARRIVAL, not a lookup table
#     of departures keyed on (segment, orientation): succ is bidirected, so the
#     walk reaches the backbone from either side, but the file states only one of
#     the two equivalent L-line directions. Keying on departures made an exit
#     invisible whenever the other direction was the one written, and the walk
#     then stepped onto the backbone and ran off down it — 237 of the HPRC
#     graph's walks reached the end of a chromosome that way and were dropped,
#     AMY1's 41 kb insertion at chr1:103,676,921 among them. Arrival-tested, all
#     745 E. coli entries and every HPRC entry resolve. Pairing entry to exit by
#     donor contig instead gets the branchy ones wrong.
#   - the two anchors give refLen, the walked segments give altLen, and the sign
#     of the difference classifies it. No bubble caller needed.
#
# What it costs against `minigraph --call` on the same graph: 747 of that
# caller's 842 alleles come back with the identical delta inside the same
# bubble. The 95 that don't are compound routes at 69 nested bubbles, where the
# caller reports one sample's whole traversal and this reports the individual
# alleles it is built from. Every one of them sits at a bubble this file does
# describe, so nesting costs exact compound lengths, never a whole site.
#
set -euo pipefail

# Byte order, not the caller's collation: see the note in build_rgfa_tabix.sh.
# A UTF-8 locale can rank two distinct PanSN names equal, which interleaves their
# rows and leaves tabix unable to find the second sequence, with no error.
export LC_ALL=C

PREFIX="${1:?usage: build_rgfa_alleles.sh <prefix>}"
SEGS="$PREFIX.segs.bed.gz"
LINKS="$PREFIX.links.bed.gz"
for f in "$SEGS" "$LINKS"; do
  [ -s "$f" ] || { echo "missing $f — run build_rgfa_tabix.sh first" >&2; exit 1; }
done

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/alleles.awk" <<'AWK'
function flip(o) { return (o == "+") ? "-" : "+" }
function commify(n, s, sign) {
  sign = ""
  if (n < 0) { sign = "-"; n = -n }
  s = n ""
  while (length(s) > 3 && match(s, /[0-9][0-9][0-9][0-9]($|,)/)) {
    s = substr(s, 1, RSTART) "," substr(s, RSTART + 1)
  }
  return sign s
}
function sample(name, f) {
  return (split(name, f, "#") == 3) ? f[1] : name
}
function refName(name) {
  sub(/^[^#]+#[^#]+#/, "", name)
  return name
}
BEGIN {
  OFS = "\t"
  rgb["ins"] = "192,0,192"
  rgb["del"] = "128,128,128"
  rgb["sub"] = "0,154,138"
}
# The allele as an alignment against the reference span it replaces: the shared
# prefix matches, the excess is inserted or deleted. That is all a bubble states
# — where inside the span the indel sits is not knowable from the graph, so it
# is written at the end rather than invented in the middle.
function cigar(altLen, refLen,  s) {
  s = ""
  if (altLen > refLen) {
    if (refLen > 0) { s = refLen "M" }
    return s (altLen - refLen) "I"
  }
  if (altLen < refLen) {
    if (altLen > 0) { s = altLen "M" }
    return s (refLen - altLen) "D"
  }
  return refLen "M"
}
# segs.bed: chrom start end id rank
NR == FNR {
  sn[$4] = $1; sstart[$4] = $2; send[$4] = $3; slen[$4] = $3 - $2; rank[$4] = $5
  next
}
# links.bed: chrom start end srcId± tgtId± srcChrom srcStart srcEnd srcRank \
#            tgtChrom tgtStart tgtEnd tgtRank
{
  sid = substr($4, 1, length($4) - 1); so = substr($4, length($4))
  tid = substr($5, 1, length($5) - 1); to = substr($5, length($5))
  # every L-line is written under both of its endpoints
  if (seen[$4 $5]++) { next }
  succ[sid so] = succ[sid so] " " tid to
  succ[tid flip(to)] = succ[tid flip(to)] " " sid flip(so)
  # where a traversal leaves one segment and arrives at the next, flipped when
  # the segment is traversed in reverse
  scoord = (so == "+") ? $8 : $7
  tcoord = (to == "+") ? $11 : $12
  if (rank[sid] == 0 && rank[tid] == 0) {
    lo = (scoord < tcoord) ? scoord : tcoord
    hi = (scoord < tcoord) ? tcoord : scoord
    # a mixed-orientation backbone pair is an inversion breakpoint, not a skip
    if ($6 == $10 && so == to && hi > lo) {
      dchrom[++nd] = $6; dstart[nd] = lo; dend[nd] = hi
    }
  } else if (rank[sid] == 0 && rank[tid] > 0) {
    entryState[++ns] = tid to; entryChrom[ns] = $6; entryAt[ns] = scoord
  }
}
END {
  for (i = 1; i <= nd; i++) {
    reflen = dend[i] - dstart[i]
    print refName(dchrom[i]), dstart[i], dend[i], commify(-reflen), 0, ".", \
      dstart[i], dend[i], rgb["del"], "del", -reflen, 0, reflen, \
      cigar(0, reflen), ".", ".", 0, "."
  }
  for (i = 1; i <= ns; i++) {
    cur = entryState[i]
    delete visited
    segments = ""; altLen = 0; minRank = ""; donor = ""; nested = 0; exitAt = ""
    while (!(cur in visited)) {
      visited[cur] = 1
      seg = substr(cur, 1, length(cur) - 1); o = substr(cur, length(cur))
      segments = segments (o == "+" ? ">" : "<") seg
      altLen += slen[seg]
      if (minRank == "" || rank[seg] < minRank) { minRank = rank[seg]; donor = sn[seg] }
      pick = ""; nout = 0
      n = split(succ[cur], nx, " ")
      for (j = 1; j <= n; j++) {
        if (nx[j] == "") { continue }
        nout++
        nseg = substr(nx[j], 1, length(nx[j]) - 1)
        no = substr(nx[j], length(nx[j]))
        # arriving back on the backbone is the exit, whichever of the two
        # equivalent L-line directions the file happened to state it in. Testing
        # the arrival rather than looking up the departure is what keeps a
        # reverse-orientation rejoin from being missed: succ is bidirected, so
        # the walk reaches rank 0 either way, but only one direction is written.
        if (rank[nseg] == 0) {
          if (exitAt == "" || sn[nseg] == entryChrom[i]) {
            exitAt = (no == "+") ? sstart[nseg] : send[nseg]
          }
          continue
        }
        # at a branch, stay on the contig the allele came in on so a nested
        # bubble does not switch the walk onto another haplotype's route
        if (pick == "" || (sn[nseg] == sn[seg] && sn[substr(pick, 1, length(pick) - 1)] != sn[seg])) {
          pick = nx[j]
        }
      }
      if (nout > 1) { nested = 1 }
      if (exitAt != "") { break }
      if (pick == "") { break }
      cur = pick
    }
    if (exitAt == "") { dangling++; continue }
    start = entryAt[i]; end = exitAt
    if (end < start) { t = start; start = end; end = t }
    refLen = end - start
    delta = altLen - refLen
    cls = (delta > 0) ? "ins" : (delta < 0 ? "del" : "sub")
    label = (delta > 0) ? "+" commify(delta) : (delta < 0 ? commify(delta) : commify(altLen) " sub")
    # a pure-insertion site anchors at a single point; widen it to one base so
    # it is drawable, the convention a VCF insertion record already uses
    drawEnd = (end > start) ? end : start + 1
    print refName(entryChrom[i]), start, drawEnd, label, 0, substr(entryState[i], length(entryState[i])), \
      start, drawEnd, rgb[cls], cls, delta, altLen, refLen, cigar(altLen, refLen), \
      minRank, sample(donor), nested, segments
  }
  if (dangling) {
    print "note: " dangling " walk(s) reached no backbone link and were dropped" > "/dev/stderr"
  }
}
AWK

{
  printf '#chrom\tstart\tend\tname\tscore\tstrand\tthickStart\tthickEnd\titemRgb'
  printf '\tclass\tdelta\taltLen\trefLen\tCIGAR\tdiscoveryRank\tfirstSeenIn\tnested\tsegments\n'
  awk -F'\t' -f "$TMP/alleles.awk" \
    <(gzip -dc "$SEGS") <(gzip -dc "$LINKS") |
    sort -k1,1 -k2,2n
} | bgzip > "$PREFIX.alleles.bed.gz"
tabix -f -p bed "$PREFIX.alleles.bed.gz"

echo "== $PREFIX.alleles.bed.gz"
gzip -dc "$PREFIX.alleles.bed.gz" |
  awk -F'\t' 'NR > 1 { c[$10]++; if ($17 == 1) nested++ }
    END { for (k in c) print "   " c[k], k; print "   " nested + 0, "nested (one route among several)" }'
