#!/usr/bin/env bash
#
# A tomato pangenome on Micro-Tom SLM_r2.1 (GCF_036512215.1), the one tomato
# assembly in UCSC GenArk with RefSeq genes: a minigraph graph built here from
# 19 chromosome-scale NCBI assemblies, plus the tabix projections JBrowse
# queries a locus from. Hosted under https://jbrowse.org/demos/tomato_pangenome/,
# read by website/pangenome-config/tomato-microtom.json in GMOD/jb2hubs.
#
# The panel is the newest and most contiguous NCBI tomato assemblies:
#   - 15 of the 20 assemblies of PRJNA1201608 (the Nat Genet 2026 tomato
#     T2T super-pangenome, doi 10.1038/s41588-026-02508-y): Heinz 1706, M82,
#     TS-9, TS-60 and TS-623, S. pimpinellifolium LA2093, S. galapagense and
#     S. cheesmaniae, and seven wild species
#   - the T2T VF36 (PRJNA1204391)
#   - S. pimpinellifolium LA1589 and two S. lycopersicum var. cerasiforme
#     lines (PRJNA865891), for the intermediate group
# The wild species (S. pennellii, peruvianum, chilense, habrochaites and
# the rest) diverge enough that their bubbles mix divergence with structural
# change; they come last, so the cultivated forms build the graph first.
#
# THE ONE THING TO KNOW: minigraph writes no P or W lines, so the graph says
# nothing about which accession carries which allele, and a segment's rank is
# construction order. jb2hubs' buildTomatoSvStates.sh recovers carriage per
# bubble by mapping each assembly back with `minigraph --call`, from the
# graph/<name>.pansn.fa files this script leaves.
#
# Sequence names: each assembly's own sequence report says which sequence is
# which chromosome. The twelve chromosomes are kept and renamed
# <name>#1#chr<N>, the UCSC names in GenArk's chromAlias for Micro-Tom, so the
# graph loads on that assembly's NC_090800.1 to NC_090811.1. Chromosome 0,
# organelles, unplaced and unlocalized scaffolds stay out.
#
# Requires: datasets (NCBI datasets CLI), unzip, python3, gawk (as `awk`),
#           sort, gzip, coreutils, bgzip and tabix (htslib), minigraph,
#           gfatools, gfa-to-tabix
# Usage:    bash scripts/build_tomato_pangenome.sh [outdir]
#           THREADS=8 bash scripts/build_tomato_pangenome.sh /mnt/sdb/tomato
#           FETCH_ONLY=1 ... downloads and writes graph/*.pansn.fa, then stops
#           before minigraph, so the fetch can run while the box is busy
#
# Every stage is skipped when its output exists, so a re-run resumes.

set -euo pipefail

for tool in datasets unzip python3 awk sort gzip bgzip tabix minigraph gfatools gfa-to-tabix; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    exit 1
  }
done

OUT="${1:-tomato_pangenome}"
mkdir -p "$OUT"
cd "$OUT"
mkdir -p ncbi graph logs

export LC_ALL=C
THREADS="${THREADS:-8}"
GRAPH=tomato-microtom-minigraph
REF=MicroTom

# THE REFERENCE MUST BE FIRST: minigraph is incremental, so this order is the
# graph's construction order and what SR records. Names become PanSN sample
# prefixes, so no '#', '/' or whitespace. Cultivated tomato first, then its
# closest wild relatives, then the green-fruited wild species.
PANEL="GCF_036512215.1 MicroTom
GCA_057925125.1 Heinz1706
GCA_057925105.1 M82
GCA_057925015.1 TS-60
GCA_057924985.1 TS-9
GCA_057925115.1 TS-623
GCA_051912385.1 VF36
GCA_057925255.1 pimpinellifolium_LA2093
GCA_034621305.1 pimpinellifolium_LA1589
GCA_025759795.1 cerasiforme_BGV006232
GCA_025759695.1 cerasiforme_BGV006768
GCA_057925305.1 galapagense_LA0426
GCA_057925315.1 cheesmaniae_LA0166
GCA_057925405.1 neorickii_LA0735
GCA_057925465.1 chmielewskii_LA1028
GCA_057925505.1 peruvianum_LA0111
GCA_057925645.1 chilense_LA0458
GCA_057925635.1 habrochaites_LA1777
GCA_057925475.1 huaylasense_LA1982
GCA_057925745.1 pennellii_LA0716"
printf '%s\n' "$PANEL" | tr ' ' '\t' >panel.tsv

# GenArk's GCF_036512215.1.chrom.sizes.txt for the twelve chromosomes, under
# their chromAlias UCSC names: the check that the reference is Micro-Tom.
REF_SIZES="chr1 94708454
chr2 71710245
chr3 68736248
chr4 68494551
chr5 69564429
chr6 52172941
chr7 71053079
chr8 68473177
chr9 70139957
chr10 65184273
chr11 62371966
chr12 70164003"
printf '%s\n' "$REF_SIZES" | tr ' ' '\t' >ref.chrom.sizes

echo "== fetch each assembly with its sequence report"
while read -r acc name; do
  dir="ncbi/$acc"
  if [ ! -s "$dir/fna.sha256" ]; then
    rm -rf "$dir" "$dir.tmp" "ncbi/$acc.zip"
    datasets download genome accession "$acc" --include genome,seq-report \
      --filename "ncbi/$acc.zip" --no-progressbar
    unzip -o -q "ncbi/$acc.zip" -d "$dir.tmp"
    mkdir -p "$dir"
    data="$dir.tmp/ncbi_dataset/data"
    mv "$data/$acc"/*.fna "$dir/genomic.fna"
    mv "$data/$acc/sequence_report.jsonl" "$dir/"
    mv "$data/assembly_data_report.jsonl" "$dir/"
    rm -rf "$dir.tmp" "ncbi/$acc.zip"
    sha256sum "$dir/genomic.fna" | awk -v n="$name" -v a="$acc" '{print n "\t" a "\t" $1}' >"$dir/fna.sha256"
  fi
  echo "  $name $(cut -f3 "$dir/fna.sha256")"
done <panel.tsv
while read -r acc _; do cat "ncbi/$acc/fna.sha256"; done <panel.tsv >sources.sha256.tsv

echo "== keep each assembly's twelve chromosomes, renamed <name>#1#chr<N>"
while read -r acc name; do
  dir="ncbi/$acc"
  out="graph/$name.pansn.fa"
  [ -s "$out" ] && continue
  # seqid -> chrN, from both the GenBank and the RefSeq accession, since the
  # FASTA of a GCF_ assembly names its sequences by RefSeq accession. A
  # chrName of "01", "Chr1", "ch01" or "chr01" is chromosome 1, and "0" is
  # not a chromosome.
  python3 -I - "$dir/sequence_report.jsonl" >"$dir/chrommap.tsv" <<'PY'
import json, re, sys
seen = set()
for line in open(sys.argv[1]):
    r = json.loads(line)
    if r.get("role") != "assembled-molecule":
        continue
    m = re.fullmatch(r"(?i:ch(?:r|romosome)?)?_?0*([1-9][0-9]?)", r.get("chrName", ""))
    if not m or not 1 <= int(m.group(1)) <= 12:
        continue
    chrom = "chr" + m.group(1)
    if chrom in seen:
        sys.exit(f"{sys.argv[1]}: two assembled molecules named {chrom}")
    seen.add(chrom)
    for key in ("genbankAccession", "refseqAccession"):
        if r.get(key):
            print(f"{r[key]}\t{chrom}")
PY
  awk -v name="$name" '
    NR == FNR { chrom[$1] = $2; next }
    /^>/ { id = substr($1, 2); keep = (id in chrom); if (keep) print ">" name "#1#" chrom[id]; next }
    keep { print }' "$dir/chrommap.tsv" "$dir/genomic.fna" >"$out.tmp"
  mv "$out.tmp" "$out"
done <panel.tsv

echo "== audit: every assembly has chr1 to chr12; the reference is Micro-Tom"
while read -r _ name; do
  awk '/^>/ { if (n) print n "\t" len; n = $1; sub(/^>[^#]*#1#/, "", n); len = 0; next }
    { len += length($0) } END { if (n) print n "\t" len }' "graph/$name.pansn.fa" >"graph/$name.chrom.sizes"
  have=$(cut -f1 "graph/$name.chrom.sizes" | sort -V | paste -sd' ')
  printf '  %-20s %s\n' "$name" "$have"
  if ! diff -q <(cut -f1 ref.chrom.sizes | sort) <(cut -f1 "graph/$name.chrom.sizes" | sort) >/dev/null; then
    echo "refusing: $name does not have exactly chr1 to chr12" >&2
    exit 1
  fi
done <panel.tsv
if ! diff <(sort ref.chrom.sizes) <(sort "graph/$REF.chrom.sizes"); then
  echo "refusing: the reference's chromosomes are not Micro-Tom's" >&2
  exit 1
fi
if [ "${FETCH_ONLY:-0}" = 1 ]; then
  echo "FETCH_ONLY=1: stopping before minigraph"
  exit 0
fi

echo "== minigraph over Micro-Tom and the panel, in panel order"
FASTAS=()
while read -r _ name; do FASTAS+=("graph/$name.pansn.fa"); done <panel.tsv
if [ ! -s "graph/$GRAPH.rgfa.gz" ]; then
  start=$(date +%s)
  minigraph -cxggs -t "$THREADS" "${FASTAS[@]}" >"graph/$GRAPH.rgfa.tmp" 2>logs/minigraph.log
  mv "graph/$GRAPH.rgfa.tmp" "graph/$GRAPH.rgfa"
  echo "  minigraph took $(($(date +%s) - start)) s" | tee -a logs/minigraph.log
  bgzip -@ "$THREADS" -k "graph/$GRAPH.rgfa"
fi

echo "== audits: SN tags, segment ids, and the reference thread"
cd graph
[ -s "$GRAPH.rgfa" ] || gzip -dc "$GRAPH.rgfa.gz" >"$GRAPH.rgfa"
gfatools stat "$GRAPH.rgfa" | tee "$GRAPH.stat.txt"
awk '$1=="S"' "$GRAPH.rgfa" | grep -oP 'SN:Z:\K\S+' | sort | uniq -c >"$GRAPH.sn.counts.txt"
bad=$(awk '{print $2}' "$GRAPH.sn.counts.txt" |
  grep -vcE '^[A-Za-z0-9_.-]+#1#chr([1-9]|1[0-2])$' || true)
[ "$bad" -eq 0 ] || { echo "refusing: $bad SN tags do not match <name>#1#chr<1-12>" >&2; exit 1; }
dups=$(awk '$1=="S"{print $2}' "$GRAPH.rgfa" | sort | uniq -d | awk 'NR<=5')
[ -z "$dups" ] || { echo "refusing: duplicate segment ids: $dups" >&2; exit 1; }
# rank 0 is the reference alone, and each of its chromosomes sums to its length
awk '$1=="S" { sn = ""; sr = ""
    for (i = 4; i <= NF; i++) { if ($i ~ /^SN:Z:/) sn = substr($i, 6); if ($i ~ /^SR:i:/) sr = substr($i, 6) }
    if (sr == 0) len[sn] += length($3) }
  END { for (s in len) print s "\t" len[s] }' "$GRAPH.rgfa" | sed "s/^$REF#1#//" | sort >"$GRAPH.rank0.sizes"
if ! diff <(sort ../ref.chrom.sizes) "$GRAPH.rank0.sizes"; then
  echo "refusing: the rank-0 thread is not Micro-Tom's twelve chromosomes" >&2
  exit 1
fi
echo "  SN tags clean, no duplicate ids, rank 0 is Micro-Tom's twelve chromosomes"

echo "== projections"
[ -s "$GRAPH.graph.bed.gz" ] || gfa-to-tabix "$GRAPH.rgfa.gz" --layout contig -o "$GRAPH"
if [ ! -s "$GRAPH.bubbles.bed.gz" ]; then
  gfatools bubble "$GRAPH.rgfa" | sort -k1,1 -k2,2n | bgzip >"$GRAPH.bubbles.bed.gz.tmp"
  mv "$GRAPH.bubbles.bed.gz.tmp" "$GRAPH.bubbles.bed.gz"
fi
[ -f "$GRAPH.bubbles.bed.gz.csi" ] || tabix -f -C -p bed "$GRAPH.bubbles.bed.gz"
[ -f "$GRAPH.bubbles.bed.gz.tbi" ] || tabix -f -p bed "$GRAPH.bubbles.bed.gz"
[ -s "$GRAPH.fold10000.graph.bed.gz" ] ||
  gfa-to-tabix fold "$GRAPH.rgfa.gz" --below 10000 --layout contig -o "$GRAPH.fold10000"
rm -f "$GRAPH.rgfa"
cd ..
for f in graph/"$GRAPH".*; do
  case "$f" in *.txt | *.sizes) ;; *) cp -p "$f" . ;; esac
done

echo
echo "Built in $PWD:"
ls -l "$GRAPH".*
sha256sum "$GRAPH".* | tee checksums.sha256
cat <<'NOTES'

Publish under demos/tomato_pangenome/ with a README.txt beside the data
(demos/tomato_pangenome/README.txt in GMOD/jbrowse-components), never a bare
`aws s3 cp` over an existing object: the bucket has no versioning.
NOTES
