#!/usr/bin/env bash
#
# A Drosophila melanogaster pangenome on UCSC dm6: a minigraph graph built here
# from 29 chromosome-level NCBI assemblies and the dm6 reference (BDGP Release
# 6 + ISO1 MT, GCF_000001215.4), plus the tabix projections JBrowse queries a
# locus from. Hosted under https://jbrowse.org/demos/fly_pangenome/, read by
# website/pangenome-config/fly-dm6.json in GMOD/jb2hubs.
#
# The panel is every assembly a survey of NCBI found at contig N50 18 Mb or
# more and chromosome level, newest and best first within each set:
#   - the 13 Drosophila Synthetic Population Resource founders and Oregon-R,
#     PacBio CLR (Chakraborty et al. 2019, Nat Commun, PRJNA418342)
#   - 11 Bloomington marker stocks, ONT (Samano et al. 2026, PRJNA1214913)
#   - 3 single-fly PacBio HiFi assemblies (PRJNA1482540)
#   - Canton S, ONT and PacBio (PRJNA1237537)
#
# THE ONE THING TO KNOW: minigraph writes no P or W lines, so the graph says
# nothing about which strain carries which allele, and a segment's rank is
# construction order. jb2hubs' buildFlySvStates.sh recovers carriage per
# bubble by mapping each assembly back with `minigraph --call`, from the
# graph/<name>.pansn.fa files this script leaves.
#
# Sequence names: NCBI names a GenBank assembly's chromosomes by accession
# (CM010590.1), so each assembly's own sequence report says which is which.
# Every sequence whose role is assembled-molecule is kept and renamed
# <name>#1#chr<chrName>, MT becoming chrM, UCSC's spelling. Unplaced and
# unlocalized scaffolds stay out. Three HiFi assemblies name chromosome 3 as
# one molecule ("3", about 65 Mb, where dm6 has 3L and 3R), and are kept as
# chr3: minigraph aligns it to both arms.
#
# Requires: datasets (NCBI datasets CLI), unzip, python3, gawk (as `awk`),
#           sort, gzip, coreutils, bgzip and tabix (htslib), minigraph,
#           gfatools, gfa-to-tabix
# Usage:    bash scripts/build_fly_pangenome.sh [outdir]
#           THREADS=8 bash scripts/build_fly_pangenome.sh /mnt/sdb/fly
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

OUT="${1:-fly_pangenome}"
mkdir -p "$OUT"
cd "$OUT"
mkdir -p ncbi graph logs

export LC_ALL=C
THREADS="${THREADS:-8}"
GRAPH=fly-dm6-minigraph
REF=dm6

# THE REFERENCE MUST BE FIRST: minigraph is incremental, so this order is the
# graph's construction order and what SR records. Names become PanSN sample
# prefixes, so no '#', '/' or whitespace. The DSPR founder code follows a
# Chakraborty strain's name where the strain has one (A1 to A7, B1 to B6, AB8).
PANEL="GCF_000001215.4 dm6
GCA_003401745.1 KSA2
GCA_003402055.1 QI2
GCA_003401735.1 Canton-S_A1
GCA_003401925.1 BER1_B1
GCA_003401795.1 BS1_A3
GCA_003401885.1 Wild5B_A6
GCA_003401915.1 A7
GCA_003401685.1 SAMry506_AB8
GCA_003402015.1 OreR
GCA_003401805.1 BOG1_A2
GCA_003401855.1 VAG1_A5
GCA_003402005.1 RVC3_B4
GCA_003401975.1 CA1_B2
GCA_003397115.2 B6
GCA_055682045.1 BDSC_5295
GCA_055681985.1 BDSC_620
GCA_056149345.1 BDSC_1349
GCA_055723745.1 BDSC_1282
GCA_055768685.1 BDSC_554
GCA_056149365.1 BDSC_6027
GCA_055768665.1 BDSC_2969
GCA_055723785.1 BDSC_156
GCA_055723755.1 BDSC_1570
GCA_055768645.1 BDSC_576
GCA_055768715.1 BDSC_662
GCA_059582535.1 A4_HiFi
GCA_059582545.1 GUM_HiFi
GCA_059582525.1 SAM_HiFi
GCA_048772135.1 CantonS_Yunnan"
printf '%s\n' "$PANEL" | tr ' ' '\t' >panel.tsv

# UCSC dm6.chrom.sizes for the eight chromosomes the graph keeps. The reference
# FASTA is NCBI's RefSeq copy, so this is the check that it is dm6.
DM6_SIZES="chr2L 23513712
chr2R 25286936
chr3L 28110227
chr3R 32079331
chr4 1348131
chrX 23542271
chrY 3667352
chrM 19524"
printf '%s\n' "$DM6_SIZES" | tr ' ' '\t' >dm6.chrom.sizes

echo "== fetch each assembly with its sequence report"
while read -r acc name; do
  dir="ncbi/$acc"
  if [ ! -s "$dir/fna.sha256" ]; then
    rm -rf "$dir" "ncbi/$acc.zip"
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

echo "== keep each assembly's chromosomes, renamed <name>#1#chr<chrName>"
while read -r acc name; do
  dir="ncbi/$acc"
  out="graph/$name.pansn.fa"
  [ -s "$out" ] && continue
  # seqid -> chrName, from both the GenBank and the RefSeq accession, since the
  # FASTA of a GCF_ assembly names its sequences by RefSeq accession
  python3 -I - "$dir/sequence_report.jsonl" >"$dir/chrommap.tsv" <<'PY'
import json, sys
seen = set()
for line in open(sys.argv[1]):
    r = json.loads(line)
    if r.get("role") != "assembled-molecule":
        continue
    chrom = "chrM" if r["chrName"] in ("MT", "M") else "chr" + r["chrName"]
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

echo "== audit: every assembly has chromosomes 2, 3, 4 and X; dm6 is UCSC's"
while read -r _ name; do
  awk '/^>/ { if (n) print n "\t" len; n = $1; sub(/^>[^#]*#1#/, "", n); len = 0; next }
    { len += length($0) } END { if (n) print n "\t" len }' "graph/$name.pansn.fa" >"graph/$name.chrom.sizes"
  have=$(cut -f1 "graph/$name.chrom.sizes" | sort | paste -sd' ')
  printf '  %-15s %s\n' "$name" "$have"
  for c in chr2L chr2R chr4 chrX; do
    grep -qx "$c" <(cut -f1 "graph/$name.chrom.sizes") || { echo "refusing: $name has no $c" >&2; exit 1; }
  done
  grep -qxE 'chr3|chr3L' <(cut -f1 "graph/$name.chrom.sizes") || { echo "refusing: $name has no chromosome 3" >&2; exit 1; }
done <panel.tsv
if ! diff <(sort dm6.chrom.sizes) <(sort "graph/$REF.chrom.sizes"); then
  echo "refusing: the reference's chromosomes are not dm6's" >&2
  exit 1
fi
if [ "${FETCH_ONLY:-0}" = 1 ]; then
  echo "FETCH_ONLY=1: stopping before minigraph"
  exit 0
fi

echo "== minigraph over dm6 and the panel, in panel order"
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
  grep -vcE '^[A-Za-z0-9_.-]+#1#chr(2L|2R|3L|3R|3|4|X|Y|M)$' || true)
[ "$bad" -eq 0 ] || { echo "refusing: $bad SN tags do not match <name>#1#chr<2L|2R|3L|3R|3|4|X|Y|M>" >&2; exit 1; }
dups=$(awk '$1=="S"{print $2}' "$GRAPH.rgfa" | sort | uniq -d | awk 'NR<=5')
[ -z "$dups" ] || { echo "refusing: duplicate segment ids: $dups" >&2; exit 1; }
# rank 0 is dm6 alone, and each of its chromosomes sums to dm6's length
awk '$1=="S" { sn = ""; sr = ""
    for (i = 4; i <= NF; i++) { if ($i ~ /^SN:Z:/) sn = substr($i, 6); if ($i ~ /^SR:i:/) sr = substr($i, 6) }
    if (sr == 0) len[sn] += length($3) }
  END { for (s in len) print s "\t" len[s] }' "$GRAPH.rgfa" | sed "s/^$REF#1#//" | sort >"$GRAPH.rank0.sizes"
if ! diff <(sort ../dm6.chrom.sizes) "$GRAPH.rank0.sizes"; then
  echo "refusing: the rank-0 thread is not dm6's eight chromosomes" >&2
  exit 1
fi
echo "  SN tags clean, no duplicate ids, rank 0 is dm6's eight chromosomes"

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

Publish under demos/fly_pangenome/ with a README.txt beside the data
(demos/fly_pangenome/README.txt in GMOD/jbrowse-components), never a bare
`aws s3 cp` over an existing object: the bucket has no versioning.
NOTES
