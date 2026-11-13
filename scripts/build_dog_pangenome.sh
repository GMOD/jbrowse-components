#!/usr/bin/env bash
#
# A dog pangenome on UCSC canFam4 (UU_Cfam_GSD_1.0, GCA_011100685.1): a
# minigraph graph built here from 26 chromosome-scale NCBI canid assemblies,
# plus the tabix projections JBrowse queries a locus from. Hosted under
# https://jbrowse.org/demos/dog_pangenome/, read by
# website/pangenome-config/dog-canfam4.json in GMOD/jb2hubs.
#
# The panel is the newest and most contiguous NCBI dog, wolf and dingo
# assemblies, contig N50 11 Mb or more, newest and best first:
#   - Alfie, ROS_Cfam_2.0 (NHGRI, 2026), both near-T2T haplotypes
#   - the University of Michigan haplotype pairs of Sonar and Melody (2025),
#     4 of the public haplotypes the Panagram preprint (Jenike et al. 2026,
#     bioRxiv 10.64898/2026.10.21.760756) analysed
#   - 13 single dog assemblies, among them Cairn terrier CA611, the
#     panel's one dog with furnishings, and canFam6 (Tasha)
#   - the Mexican wolf (VGP) and wolf GW haplotype pairs, the Greenland
#     wolf and two dingoes
# Panagram's own six dogs are not on NCBI yet and wait for their deposition.
#
# THE ONE THING TO KNOW: minigraph writes no P or W lines, so the graph says
# nothing about which dog carries which allele, and a segment's rank is
# construction order. jb2hubs' buildDogSvStates.sh recovers carriage per
# bubble by mapping each assembly back with `minigraph --call`, from the
# graph/<name>.pansn.fa files this script leaves.
#
# Sequence names: each assembly's own sequence report says which sequence is
# which chromosome. Chromosomes 1 to 38 and X are kept and renamed
# <name>#1#chr<N>, canFam4's UCSC names. canFam4 has no Y; chrY, chrM,
# unplaced and unlocalized scaffolds stay out. A haplotype without an X (a
# male's alternate, for one) is kept without it.
#
# Requires: datasets (NCBI datasets CLI), unzip, python3, gawk (as `awk`),
#           sort, gzip, coreutils, bgzip and tabix (htslib), minigraph,
#           gfatools, gfa-to-tabix
# Usage:    bash scripts/build_dog_pangenome.sh [outdir]
#           THREADS=8 bash scripts/build_dog_pangenome.sh /mnt/sdb/dog
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

OUT="${1:-dog_pangenome}"
mkdir -p "$OUT"
cd "$OUT"
mkdir -p ncbi graph logs

export LC_ALL=C
THREADS="${THREADS:-8}"
GRAPH=dog-canfam4-minigraph
REF=canFam4

# THE REFERENCE MUST BE FIRST: minigraph is incremental, so this order is the
# graph's construction order and what SR records. Names become PanSN sample
# prefixes, so no '#', '/' or whitespace. Dogs first, wolves and dingoes
# last.
PANEL="GCA_011100685.1 canFam4
GCA_062019780.1 Alfie_pri
GCA_062019781.1 Alfie_alt
GCA_053572145.1 Sonar_hap1
GCA_053572105.1 Sonar_hap2
GCA_053569395.1 Melody_hap1
GCA_053572085.1 Melody_hap2
GCA_044048985.1 Beagle_D2023-6-2
GCA_043643935.1 Whippet_Lino
GCA_059750645.1 ShibaInu_2026
GCA_056151415.1 Husky_Sorin
GCA_057128235.1 MixedBreed_N25-0066
GCA_013276365.2 Basenji_China
GCA_031010295.1 Cairn_CA611
GCA_031010765.1 Bernese_BD
GCA_031010635.1 Bernese_OD
GCA_031165255.1 Labrador_UMich
GCA_000002285.4 Boxer_Tasha_canFam6
GCA_008641055.3 GSD_Nala
GCA_014441545.1 Labrador_ROS1
GCA_048164855.1 MexicanWolf_hap1
GCA_048164845.1 MexicanWolf_hap2
GCA_059341535.1 Wolf_GW_hap1
GCA_059341495.1 Wolf_GW_hap2
GCA_905319855.2 GreenlandWolf_mCanLor1
GCA_003254725.2 Dingo_Sandy
GCA_012295265.2 Dingo_Cooinda"
printf '%s\n' "$PANEL" | tr ' ' '\t' >panel.tsv

# UCSC canFam4.chrom.sizes for the 39 chromosomes the graph keeps: the check
# that the reference FASTA is canFam4.
REF_SIZES="chr1 123556469
chr2 84979418
chr3 92479059
chr4 89535178
chr5 89562946
chr6 78113029
chr7 81081596
chr8 76405709
chr9 61171909
chr10 70643054
chr11 74805798
chr12 72970719
chr13 64299765
chr14 61112200
chr15 64676183
chr16 60362399
chr17 65088165
chr18 56472973
chr19 55516201
chr20 58627490
chr21 51742555
chr22 61573679
chr23 53134997
chr24 48566227
chr25 51730745
chr26 39257614
chr27 46662488
chr28 41733330
chr29 42517134
chr30 40643782
chr31 39901454
chr32 40225481
chr33 32139216
chr34 42397973
chr35 28051305
chr36 31223415
chr37 30785915
chr38 24803098
chrX 124992030"
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

echo "== keep each assembly's chromosomes 1 to 38 and X, renamed <name>#1#chr<N>"
while read -r acc name; do
  dir="ncbi/$acc"
  out="graph/$name.pansn.fa"
  [ -s "$out" ] && continue
  # seqid -> chrN, from both the GenBank and the RefSeq accession, since the
  # FASTA of a GCF_ assembly names its sequences by RefSeq accession. A
  # chrName of "01", "Chr1" or "chr01" is chromosome 1.
  python3 -I - "$dir/sequence_report.jsonl" >"$dir/chrommap.tsv" <<'PY'
import json, re, sys
seen = set()
for line in open(sys.argv[1]):
    r = json.loads(line)
    if r.get("role") != "assembled-molecule":
        continue
    m = re.fullmatch(r"(?i:chr)?0*([1-9][0-9]?|X)", r.get("chrName", ""))
    if not m or (m.group(1) != "X" and int(m.group(1)) > 38):
        continue
    chrom = "chr" + m.group(1).upper()
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

echo "== audit: every assembly has chr1 to chr38; the reference is canFam4"
while read -r _ name; do
  awk '/^>/ { if (n) print n "\t" len; n = $1; sub(/^>[^#]*#1#/, "", n); len = 0; next }
    { len += length($0) } END { if (n) print n "\t" len }' "graph/$name.pansn.fa" >"graph/$name.chrom.sizes"
  have=$(cut -f1 "graph/$name.chrom.sizes" | grep -c . || true)
  x=$(grep -qx chrX <(cut -f1 "graph/$name.chrom.sizes") && echo "+X" || echo "no X")
  printf '  %-24s %s chromosomes, %s\n' "$name" "$have" "$x"
  for c in $(seq 1 38); do
    grep -qx "chr$c" <(cut -f1 "graph/$name.chrom.sizes") || { echo "refusing: $name has no chr$c" >&2; exit 1; }
  done
done <panel.tsv
if ! diff <(sort ref.chrom.sizes) <(sort "graph/$REF.chrom.sizes"); then
  echo "refusing: the reference's chromosomes are not canFam4's" >&2
  exit 1
fi
if [ "${FETCH_ONLY:-0}" = 1 ]; then
  echo "FETCH_ONLY=1: stopping before minigraph"
  exit 0
fi

echo "== minigraph over canFam4 and the panel, in panel order"
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
  grep -vcE '^[A-Za-z0-9_.-]+#1#chr([1-9]|[12][0-9]|3[0-8]|X)$' || true)
[ "$bad" -eq 0 ] || { echo "refusing: $bad SN tags do not match <name>#1#chr<1-38|X>" >&2; exit 1; }
dups=$(awk '$1=="S"{print $2}' "$GRAPH.rgfa" | sort | uniq -d | head -5)
[ -z "$dups" ] || { echo "refusing: duplicate segment ids: $dups" >&2; exit 1; }
# rank 0 is the reference alone, and each of its chromosomes sums to its length
awk '$1=="S" { sn = ""; sr = ""
    for (i = 4; i <= NF; i++) { if ($i ~ /^SN:Z:/) sn = substr($i, 6); if ($i ~ /^SR:i:/) sr = substr($i, 6) }
    if (sr == 0) len[sn] += length($3) }
  END { for (s in len) print s "\t" len[s] }' "$GRAPH.rgfa" | sed "s/^$REF#1#//" | sort >"$GRAPH.rank0.sizes"
if ! diff <(sort ../ref.chrom.sizes) "$GRAPH.rank0.sizes"; then
  echo "refusing: the rank-0 thread is not canFam4's 39 chromosomes" >&2
  exit 1
fi
echo "  SN tags clean, no duplicate ids, rank 0 is canFam4's 39 chromosomes"

echo "== projections"
[ -s "$GRAPH.graph.bed.gz" ] || gfa-to-tabix "$GRAPH.rgfa.gz" --layout contig -o "$GRAPH"
if [ ! -s "$GRAPH.bubbles.bed.gz" ]; then
  gfatools bubble "$GRAPH.rgfa" | sort -k1,1 -k2,2n | bgzip >"$GRAPH.bubbles.bed.gz.tmp"
  mv "$GRAPH.bubbles.bed.gz.tmp" "$GRAPH.bubbles.bed.gz"
fi
[ -f "$GRAPH.bubbles.bed.gz.csi" ] || tabix -f -C -p bed "$GRAPH.bubbles.bed.gz"
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

Publish under demos/dog_pangenome/ with a README.txt beside the data
(demos/dog_pangenome/README.txt in GMOD/jbrowse-components), never a bare
`aws s3 cp` over an existing object: the bucket has no versioning.
NOTES
