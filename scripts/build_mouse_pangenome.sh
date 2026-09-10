#!/usr/bin/env bash
#
# Reproducibly rebuild the mouse strain pangenome demo hosted at
# https://jbrowse.org/demos/mouse_pangenome/ — a minigraph graph BUILT HERE from
# published assemblies, plus the five tabix-indexed BED projections that let
# JBrowse query a locus without downloading the graph.
#
# Unlike the bovine set beside it, no pangenome graph was ever published for
# these assemblies: the 2025 mouse pangenome paper (Cell Genomics
# S2666-979X(25)00330-1) released ENA assemblies and an Ensembl browser and no
# graph or VCF, so this constructs one. The 2022 Minigraph-Cactus mouse graph in
# cactus's own mc-pangenomes list is a different panel and carries an upstream
# warning that it is "nearly 40% Ns due, apparently, to gappy input assemblies";
# it is not what this builds on.
#
# 19 sequence sets, UCSC mm39 (GRCm39) as the backbone plus 18 inbred and
# wild-derived strain assemblies, all fetched from UCSC hgdownload — the Mouse
# Genomes Project / Ensembl strain assemblies as rehosted in GenArk. Cite the
# assemblies, not this graph.
#
# THE ONE THING TO KNOW: minigraph emits rGFA natively, so SN/SO/SR are read
# from the graph rather than reconstructed — the difference from the bovine set.
# But minigraph writes NO P or W lines, so this graph cannot say which strain
# carries which allele. A line census of the finished rGFA finds H, S and L
# only. `firstSeenIn`/`discoveryRank` in the allele file is minigraph's
# construction order, NOT carriage, and there is no argument that recovers
# carriage from this file — the information is not in it. Getting carriage for
# mouse means either `minigraph --call` per assembly (bubble resolution, and it
# also yields a VCF via misc/mgutils.js merge) or rebuilding with
# minigraph-cactus, which writes per-haplotype walks. See the foot of this file.
#
# Requires: curl, samtools, bgzip (htslib), minigraph, gfatools, gawk (as
#           `awk`), sort, flock, python3
# Usage:    bash scripts/build_mouse_pangenome.sh [outdir]
#           THREADS=8 JOBS=2 MEM_FLOOR_GB=30 bash scripts/build_mouse_pangenome.sh
#
# Expensive and long: 27.4 h of minigraph wall time over the 21 chromosomes when
# run two at a time at 8 threads, chrX longest at 3 h 50 m and chr19 shortest at
# 22 m, plus ~30 GB of downloads and ~50 GB of extracted per-chromosome FASTA.
# Every stage is skipped when its output exists and each chromosome takes a lock,
# so a re-run resumes and two runners can share the work.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

HELPERS=(build_rgfa_tabix.sh build_rgfa_alleles.sh build_bubble_tier.sh
  bubbles_to_tier_bed.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

OUTDIR="${1:-mouse_pangenome_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

export LC_ALL=C
export TMPDIR="${TMPDIR:-$PWD/tmp}"
mkdir -p "$TMPDIR" fasta chrom graph logs locks

THREADS="${THREADS:-8}"
JOBS="${JOBS:-2}"
MEM_FLOOR_GB="${MEM_FLOOR_GB:-30}"
PREFIX=mouse-mm39-minigraph

# chrY is kept even though only mm39 has one, so the graph covers the whole
# reference; it comes out as a bare thread, one segment and zero links, and is
# deliberately not offered as a whole-chromosome view in JBrowse.
CHROMS=(chr1 chr2 chr3 chr4 chr5 chr6 chr7 chr8 chr9 chr10 chr11 chr12 chr13
  chr14 chr15 chr16 chr17 chr18 chr19 chrX chrY)

# THE REFERENCE MUST BE FIRST. minigraph is incremental: the first input becomes
# rank 0 and every later one is aligned onto the graph so far, so this order is
# the graph's construction order and what SR records. Strain names become PanSN
# sample prefixes, so no '#', '/' or whitespace.
STRAINS=(
  "mm39         https://hgdownload.soe.ucsc.edu/goldenPath/mm39/bigZips/mm39.fa.gz"
  "C57BL_6J_T2T https://hgdownload.soe.ucsc.edu/hubs/GCA/964/188/535/GCA_964188535.1/GCA_964188535.1.fa.gz"
  "CAST_EiJ_T2T https://hgdownload.soe.ucsc.edu/hubs/GCA/964/188/545/GCA_964188545.1/GCA_964188545.1.fa.gz"
  "C57BL_6NJ    https://hgdownload.soe.ucsc.edu/hubs/GCA/921/999/865/GCA_921999865.2/GCA_921999865.2.fa.gz"
  "NZO_HlLtJ    https://hgdownload.soe.ucsc.edu/hubs/GCA/947/593/165/GCA_947593165.1/GCA_947593165.1.fa.gz"
  "BALB_cJ      https://hgdownload.soe.ucsc.edu/hubs/GCA/921/997/145/GCA_921997145.2/GCA_921997145.2.fa.gz"
  "FVB_NJ       https://hgdownload.soe.ucsc.edu/hubs/GCA/921/998/635/GCA_921998635.2/GCA_921998635.2.fa.gz"
  "129S1_SvImJ  https://hgdownload.soe.ucsc.edu/hubs/GCA/921/998/555/GCA_921998555.2/GCA_921998555.2.fa.gz"
  "C3H_HeJ      https://hgdownload.soe.ucsc.edu/hubs/GCA/921/997/125/GCA_921997125.2/GCA_921997125.2.fa.gz"
  "AKR_J        https://hgdownload.soe.ucsc.edu/hubs/GCA/922/000/895/GCA_922000895.2/GCA_922000895.2.fa.gz"
  "DBA_2J       https://hgdownload.soe.ucsc.edu/hubs/GCA/921/998/315/GCA_921998315.2/GCA_921998315.2.fa.gz"
  "A_J          https://hgdownload.soe.ucsc.edu/hubs/GCA/921/998/355/GCA_921998355.2/GCA_921998355.2.fa.gz"
  "LP_J         https://hgdownload.soe.ucsc.edu/hubs/GCA/947/599/735/GCA_947599735.1/GCA_947599735.1.fa.gz"
  "NOD_ShiLtJ   https://hgdownload.soe.ucsc.edu/hubs/GCA/921/998/325/GCA_921998325.2/GCA_921998325.2.fa.gz"
  "CBA_J        https://hgdownload.soe.ucsc.edu/hubs/GCA/921/998/905/GCA_921998905.2/GCA_921998905.2.fa.gz"
  "CAST_EiJ     https://hgdownload.soe.ucsc.edu/hubs/GCA/921/999/005/GCA_921999005.2/GCA_921999005.2.fa.gz"
  "WSB_EiJ      https://hgdownload.soe.ucsc.edu/hubs/GCA/921/998/345/GCA_921998345.2/GCA_921998345.2.fa.gz"
  "JF1_MsJ      https://hgdownload.soe.ucsc.edu/hubs/GCA/921/999/095/GCA_921999095.2/GCA_921999095.2.fa.gz"
  "PWK_PhJ      https://hgdownload.soe.ucsc.edu/hubs/GCA/921/998/335/GCA_921998335.2/GCA_921998335.2.fa.gz"
)
ORDER=()
for entry in "${STRAINS[@]}"; do ORDER+=("$(echo "$entry" | awk '{print $1}')"); done

echo "=== download assemblies, chromAlias and chrom.sizes ==="
for entry in "${STRAINS[@]}"; do
  strain=$(echo "$entry" | awk '{print $1}')
  url=$(echo "$entry" | awk '{print $2}')
  dest="fasta/${strain}.fa.gz"
  if [ -s "$dest" ]; then
    echo "  have $strain"
  else
    echo "  fetching $strain"
    curl -fsSL --retry 5 --retry-delay 10 -o "$dest.tmp" "$url"
    mv "$dest.tmp" "$dest"
  fi
  # A GenArk assembly names its contigs by accession, so its chromAlias is the
  # only thing that says which contig is chr7. mm39 already uses UCSC names.
  case "$url" in
  */hubs/*)
    [ -s "fasta/${strain}.chromAlias.txt" ] || curl -fsSL --retry 5 \
      -o "fasta/${strain}.chromAlias.txt" "${url%.fa.gz}.chromAlias.txt"
    ;;
  esac
done
[ -s fasta/mm39.chrom.sizes ] || curl -fsSL --retry 5 -o fasta/mm39.chrom.sizes \
  https://hgdownload.soe.ucsc.edu/goldenPath/mm39/bigZips/mm39.chrom.sizes

echo "=== recompress to BGZF and index ==="
# hgdownload serves plain gzip, which samtools faidx cannot seek into, and one
# sequence at a time is exactly what the next stage needs from a 2.7 GB file.
for strain in "${ORDER[@]}"; do
  out="fasta/${strain}.bgz.fa.gz"
  if [ -s "$out.fai" ] && [ -s "$out.gzi" ]; then
    echo "  have $strain"
  else
    echo "  bgzip $strain"
    zcat "fasta/${strain}.fa.gz" | bgzip -@ 4 -c > "$out.tmp"
    mv "$out.tmp" "$out"
    samtools faidx "$out"
  fi
done

echo "=== map each assembly's contigs onto mm39 chromosome names ==="
: > chrom/mm39.chrommap.tsv
for c in "${CHROMS[@]}"; do printf '%s\t%s\n' "$c" "$c" >> chrom/mm39.chrommap.tsv; done
for strain in "${ORDER[@]:1}"; do
  alias_file="fasta/${strain}.chromAlias.txt"
  if [ ! -s "$alias_file" ]; then
    echo "  WARN no chromAlias for $strain" >&2
    : > "chrom/${strain}.chrommap.tsv"
    continue
  fi
  # Any column may hold the UCSC-style name, and a PanSN-prefixed cell has to
  # have its prefix stripped before it can match. First match per chromosome
  # wins, so a scaffold naming chr7 later cannot displace chr7 itself.
  awk -F'\t' '
    /^#/ { next }
    {
      chrom = ""
      for (i = 1; i <= NF; i++) {
        cell = $i
        sub(/^.*#/, "", cell)
        if (cell ~ /^chr([1-9]|1[0-9]|X|Y)$/) { chrom = cell; break }
      }
      if (chrom != "" && !(chrom in seen)) { seen[chrom] = 1; print chrom "\t" $1 }
    }
  ' "$alias_file" > "chrom/${strain}.chrommap.tsv"
done
for f in chrom/*.chrommap.tsv; do
  printf '  %-14s %2d chroms\n' "$(basename "$f" .chrommap.tsv)" "$(wc -l < "$f")"
done

echo "=== extract one sequence per chromosome, renamed to PanSN ==="
# Coverage is NOT uniform, and it is a property of the assemblies rather than a
# failure here: every autosome carries all 19, chrX carries 18 (C57BL_6J_T2T's
# chromAlias names 238 sequences and none is an X or a Y, so there is nothing to
# extract — it was not dropped for quality), and chrY carries mm39 alone.
for c in "${CHROMS[@]}"; do
  mkdir -p "chrom/$c"
  : > "chrom/$c/order.txt"
  for strain in "${ORDER[@]}"; do
    seq=$(awk -F'\t' -v c="$c" '$1==c{print $2; exit}' "chrom/${strain}.chrommap.tsv")
    out="chrom/$c/${strain}.${c}.fa"
    [ -n "$seq" ] || continue
    if [ "$strain" = mm39 ]; then pansn="mm39#0#${c}"; else pansn="${strain}#1#${c}"; fi
    if [ ! -s "$out" ]; then
      samtools faidx "fasta/${strain}.bgz.fa.gz" "$seq" |
        awk -v h=">$pansn" 'NR==1{print h; next} {print}' > "$out.tmp"
      # A faidx miss exits 0 having written nothing, so check the shape rather
      # than the status: an empty file here would silently drop an assembly from
      # the graph.
      if [ -s "$out.tmp" ] && head -c1 "$out.tmp" | grep -q '>'; then
        mv "$out.tmp" "$out"
      else
        echo "  FAIL $strain $c <- $seq" >&2
        rm -f "$out.tmp"
        continue
      fi
    fi
    echo "$out" >> "chrom/$c/order.txt"
  done
  printf '  %-6s %2d assemblies\n' "$c" "$(wc -l < "chrom/$c/order.txt")"
done

echo "=== minigraph, per chromosome ==="
# Per chromosome rather than whole-genome because minigraph's peak RSS scales
# with the graph it is extending, and 19 mouse genomes at once does not fit.
# Each job takes a flock so concurrent runners share the work, and waits for
# available memory to hold above the floor across three probes 20 s apart — a
# job launched into a transient dip that another job is about to reclaim gets
# OOM-killed after hours of work. `ulimit -v` is the backstop.
build_one() {
  c=$1
  out="graph/${c}.gfa"
  log="logs/minigraph.${c}.log"
  exec 9>"locks/${c}.lock"
  flock -n 9 || { echo "  $c locked by another runner"; return 0; }
  if [ -s "$out" ] && grep -q MINIGRAPH_DONE "$log" 2>/dev/null; then
    echo "  $c already built"
    return 0
  fi
  ok=0
  while [ "$ok" -lt 3 ]; do
    avail=$(free -g | awk '/^Mem:/ {print $7}')
    if [ "$avail" -ge "$MEM_FLOOR_GB" ]; then ok=$((ok + 1)); else ok=0; fi
    sleep 20
  done
  echo "  $c launching (${avail}GB available)"
  start=$(date +%s)
  {
    echo "== $c start $(date -u +%FT%TZ) threads=$THREADS =="
    cat "chrom/$c/order.txt"
    # shellcheck disable=SC2046
    (ulimit -v 20000000
      minigraph -cxggs -t "$THREADS" $(tr '\n' ' ' < "chrom/$c/order.txt") > "$out.tmp.$$")
    mv "$out.tmp.$$" "$out"
    echo "== $c elapsed $(($(date +%s) - start)) s, $(grep -c '^S' "$out") segments, $(grep -c '^L' "$out") links =="
    echo MINIGRAPH_DONE
  } > "$log" 2>&1
}
export -f build_one
export THREADS MEM_FLOOR_GB
# Longest first, so the tail of the run is short jobs rather than chrX alone.
printf '%s\n' "${CHROMS[@]}" | xargs -P "$JOBS" -I{} bash -c 'build_one {}'

echo "=== renumber and concatenate into one rGFA ==="
# Ids are shifted by chromosomeIndex * 10,000,000, well clear of the 1,321,274
# segments the whole graph holds. Without it the 21 files, whose ids each start
# at 1, would cross-wire: the link index joins the segment index by id.
if [ ! -s "$PREFIX.rgfa" ]; then
  for c in "${CHROMS[@]}"; do
    [ -s "graph/${c}.gfa" ] || { echo "MISSING graph/${c}.gfa" >&2; exit 1; }
  done
  printf 'H\tVN:Z:1.0\n' > "$PREFIX.rgfa.tmp"
  k=0
  for c in "${CHROMS[@]}"; do
    k=$((k + 1))
    awk -v off=$((k * 10000000)) -v c="$c" '
      BEGIN { FS = OFS = "\t" }
      $1 == "H" { next }
      $1 == "S" {
        id = $2; sub(/^s/, "", id)
        if (id !~ /^[0-9]+$/) { print "unexpected segment id " $2 " in " c > "/dev/stderr"; exit 2 }
        $2 = sprintf("s%d", id + off); print; next
      }
      $1 == "L" {
        a = $2; sub(/^s/, "", a); b = $4; sub(/^s/, "", b)
        if (a !~ /^[0-9]+$/ || b !~ /^[0-9]+$/) { print "unexpected link id in " c > "/dev/stderr"; exit 2 }
        $2 = sprintf("s%d", a + off); $4 = sprintf("s%d", b + off); print; next
      }
      { print }
    ' "graph/${c}.gfa" >> "$PREFIX.rgfa.tmp"
  done
  mv "$PREFIX.rgfa.tmp" "$PREFIX.rgfa"
fi
[ -s "$PREFIX.rgfa.gz" ] || bgzip -@ 8 -k "$PREFIX.rgfa"

echo "=== audits (both fatal: either one silently corrupts every projection) ==="
gfatools stat "$PREFIX.rgfa" | tee "$PREFIX.stat.txt"
# rank-0 total must be GRCm39's own length, which is the check that the
# reference thread is intact after renumbering and concatenation.
awk '$1=="S"' "$PREFIX.rgfa" | grep -oP 'SN:Z:\K\S+' | sort | uniq -c |
  sort -k2,2 > "$PREFIX.sn.counts.txt"
bad=$(awk '{print $NF}' "$PREFIX.sn.counts.txt" |
  grep -vcE '^(mm39#0#chr([1-9]|1[0-9]|X|Y)|[A-Za-z0-9_]+#1#chr([1-9]|1[0-9]|X|Y))$' || true)
echo "  SN values not matching mm39#0#chr* or <strain>#1#chr*: $bad"
[ "$bad" -eq 0 ] || { echo "refusing: unexpected SN tags" >&2; exit 1; }
dups=$(awk '$1=="S"{print $2}' "$PREFIX.rgfa" | sort | uniq -d | awk 'NR<=5')
[ -z "$dups" ] || { echo "duplicate segment ids after renumbering: $dups" >&2; exit 1; }
echo "  no duplicate segment ids"

echo "=== segments + links ==="
[ -s "$PREFIX.segs.bed.gz" ] ||
  bash "$SCRIPT_DIR/build_rgfa_tabix.sh" "$PREFIX.rgfa.gz" "$PREFIX"

echo "=== allele inventory ==="
[ -s "$PREFIX.alleles.bed.gz" ] ||
  bash "$SCRIPT_DIR/build_rgfa_alleles.sh" "$PREFIX"

echo "=== bubbles ==="
if [ ! -s "$PREFIX.bubbles.bed.gz" ]; then
  gzip -dc "$PREFIX.rgfa.gz" | gfatools bubble - | sort -k1,1 -k2,2n |
    bgzip > "$PREFIX.bubbles.bed.gz.tmp"
  mv "$PREFIX.bubbles.bed.gz.tmp" "$PREFIX.bubbles.bed.gz"
  tabix -f -p bed "$PREFIX.bubbles.bed.gz"
fi

echo "=== coarse tier ==="
[ -s "$PREFIX.tier10000.segs.bed.gz" ] ||
  bash "$SCRIPT_DIR/build_bubble_tier.sh" "$PREFIX.bubbles.bed.gz" \
    "$PREFIX.tier10000" 10000

echo
echo "Built in $PWD:"
find . -maxdepth 1 -name "$PREFIX.*" -printf '  %f\n' | sort
cat <<'NOTES'

Publish with scripts/deploy-demo.sh, never a bare `aws s3 cp` — the bucket has
no versioning. Target prefix demos/mouse_pangenome/. A README.txt carrying this
provenance ships beside the data; see agent-docs/reference/HOSTING.md.

Serving it: website/pangenome-config/mouse-mm39.json in GMOD/jb2hubs is the
config that names these files, with assemblyNameToPanSN: { "mm39": "mm39" }.

Note the bgzip toolchain. htslib linked against libz emits ~6% larger output
than the same version linked against libdeflate and the decompressed content is
identical, so a rebuilt .gz can differ in every byte with nothing wrong — which
re-uploads the corpus and, if the .gz and its index are synced in separate
passes, leaves fresh data against a stale index in the bucket. Rebuild the
indexes alongside the data, always.

GETTING CARRIAGE, which this graph cannot express. Two routes, and they are not
equivalent:

  minigraph --call, against the graph that already exists. Per assembly:
    minigraph -cxasm --call -t16 mouse-mm39-minigraph.rgfa.gz <strain>.fa
  gives that assembly's traversal of every bubble, and misc/mgutils.js merge
  -r0 combines the calls and emits a VCF. Hours, no rebuild, and honest at
  bubble resolution — but it is a genotype table beside the graph, not paths in
  it, so a GBZ built from that VCF would be a graph derived from the calls
  rather than this one.

  minigraph-cactus, a rebuild. Writes per-haplotype W lines, so carriage, a
  base-level graph, a VCF and a GBZ all follow from one pass, and
  build_pggb_tabix.sh emits the five files above with SM:Z: on them. Multi-day
  on one box. This is what makes mouse a peer of demos/hprc rather than a
  structural-resolution sibling.
NOTES
