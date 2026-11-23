#!/usr/bin/env bash
#
# A rice pangenome on the T2T Nipponbare reference AGIS-1.0
# (GCF_034140825.1): a minigraph graph built here from 47 chromosome-scale NCBI
# assemblies, plus the tabix projections JBrowse queries a locus from. Hosted
# under https://jbrowse.org/demos/rice_pangenome/, read by
# website/pangenome-config/rice-agis1.json in GMOD/jb2hubs.
#
# The panel is the newest and most contiguous NCBI rice assemblies, contig N50
# 18 Mb or more:
#   - 37 of the 67 HiFi + ONT assemblies of PRJNA1276249 (Zhejiang University,
#     2025-26; the Nat Genet 2025 rice centromere paper, doi
#     10.1038/s41588-025-02365-1): 31 cultivated and 3 weedy O. sativa and 3
#     wild O. rufipogon. Its African O. glaberrima and O. barthii are left
#     out, and so are members under 18 Mb and look-alike Chinese lines.
#   - Kasalath (aus) and IR64 (indica) from PRJNA1311239, and Moroberekan
#     (tropical japonica), so aus and the upland japonicas are not left to
#     guesswork
#   - Complete Genome indica ZH8015, T197 and FNA, and the japonicas Udai21,
#     Changxianggeng 1813, Balilla and Wuyunjing 8
#
# THE ONE THING TO KNOW: minigraph writes no P or W lines, so the graph says
# nothing about which accession carries which allele, and a segment's rank is
# construction order. The callset stage recovers carriage per bubble by
# mapping each assembly back with `minigraph --call` and merging the calls into
# rice-agis1-minigraph.vcf.gz, one haploid column per assembly, as jb2hubs'
# buildRiceSvStates.sh does for the portal.
#
# Sequence names: each assembly's own sequence report says which sequence is
# which chromosome. The twelve nuclear chromosomes are kept and renamed
# <name>#1#chr<N>, the UCSC names in GenArk's chromAlias for AGIS-1.0, so the
# graph loads on that assembly's NC_089035.1 to NC_089046.1. Organelles,
# unplaced and unlocalized scaffolds stay out.
#
# Requires: datasets (NCBI datasets CLI), unzip, python3, gawk (as `awk`),
#           sort, gzip, coreutils, curl, bgzip and tabix (htslib), minigraph,
#           gfatools, gfa-to-tabix (5.0 or later), k8, bcftools
# Usage:    bash scripts/build_rice_pangenome.sh [outdir]
#           THREADS=8 bash scripts/build_rice_pangenome.sh /mnt/sdb/rice
#           FETCH_ONLY=1 ... downloads and writes graph/*.pansn.fa, then stops
#           before minigraph, so the fetch can run while the box is busy
#
# Every stage is skipped when its output exists, so a re-run resumes.

set -euo pipefail

for tool in datasets unzip python3 awk sort gzip curl bgzip tabix minigraph gfatools gfa-to-tabix k8 bcftools; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    exit 1
  }
done

OUT="${1:-rice_pangenome}"
mkdir -p "$OUT"
cd "$OUT"
mkdir -p ncbi graph logs

export LC_ALL=C
THREADS="${THREADS:-8}"
GRAPH=rice-agis1-minigraph
REF=Nipponbare

# THE REFERENCE MUST BE FIRST: minigraph is incremental, so this order is the
# graph's construction order and what SR records. Names become PanSN sample
# prefixes, so no '#', '/' or whitespace. Within the 67-accession set the
# order is cultivated, weedy, wild; the T2T and HiFi singles follow.
PANEL="GCF_034140825.1 Nipponbare
GCA_052000205.1 SL001
GCA_055775305.1 SL010
GCA_055775405.1 SL019
GCA_051999345.1 SL022
GCA_051999975.1 SL028
GCA_055775355.1 SL032
GCA_052000165.1 SL039
GCA_055775345.1 SL044
GCA_051999355.1 SL084
GCA_055775325.1 SL102
GCA_051999325.1 SL120
GCA_051999185.1 SL121
GCA_051999965.1 SL126
GCA_051999645.1 SL127
GCA_051999865.1 SL129
GCA_051999565.1 SL133
GCA_051999775.1 SL167
GCA_052000005.1 SL177
GCA_051999725.1 SL187
GCA_051999175.1 SL190
GCA_051999655.1 SL202
GCA_051999125.1 SL203
GCA_052000235.1 9311
GCA_052000285.1 J4155S
GCA_055776325.1 NJ11
GCA_055776135.1 XL628S
GCA_052000335.1 Zag
GCA_055776125.1 Cempo-Abang
GCA_055776245.1 Cempo-Ireng
GCA_055776205.1 Balatinaw
GCA_055776225.1 Pulut-Hitam-2
GCA_055776365.1 CX20
GCA_055776265.1 YZ-2
GCA_055776285.1 PI653432
GCA_051999005.1 CW06
GCA_051998715.1 CW09
GCA_051998695.1 CW15
GCA_055690895.1 Kasalath
GCA_055690995.1 IR64
GCA_058969475.1 Moroberekan
GCA_034818605.1 ZH8015
GCA_052759605.1 T197
GCA_054286825.1 FNA
GCA_055397395.1 Udai21
GCA_026167685.1 Changxianggeng1813
GCA_054130845.1 Balilla
GCA_054130905.1 Wuyunjing8"
printf '%s\n' "$PANEL" | tr ' ' '\t' >panel.tsv

# GenArk's GCF_034140825.1.chrom.sizes.txt for the twelve chromosomes, under
# their chromAlias UCSC names: the check that the reference is AGIS-1.0.
REF_SIZES="chr1 43929697
chr2 36447916
chr3 37399924
chr4 36078568
chr5 30400764
chr6 32122276
chr7 29936421
chr8 28605474
chr9 27474823
chr10 23931887
chr11 31111469
chr12 28271460"
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
  # chrName of "01", "Chr1" or "chr01" is chromosome 1.
  python3 -I - "$dir/sequence_report.jsonl" >"$dir/chrommap.tsv" <<'PY'
import json, re, sys
seen = set()
for line in open(sys.argv[1]):
    r = json.loads(line)
    if r.get("role") != "assembled-molecule":
        continue
    m = re.fullmatch(r"(?i:chr)?0*([1-9][0-9]?)", r.get("chrName", ""))
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

echo "== audit: every assembly has chr1 to chr12; the reference is AGIS-1.0"
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
  echo "refusing: the reference's chromosomes are not AGIS-1.0's" >&2
  exit 1
fi
if [ "${FETCH_ONLY:-0}" = 1 ]; then
  echo "FETCH_ONLY=1: stopping before minigraph"
  exit 0
fi

echo "== minigraph over AGIS-1.0 and the panel, in panel order"
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
  echo "refusing: the rank-0 thread is not AGIS-1.0's twelve chromosomes" >&2
  exit 1
fi
echo "  SN tags clean, no duplicate ids, rank 0 is AGIS-1.0's twelve chromosomes"

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

echo "== callset: map each assembly back onto the graph, one VCF column each"
# mgutils.js and mgutils-es6.js live in minigraph's misc/, which the bioconda
# package leaves out; this is the revision the hosted callset was built with.
MGUTILS="https://raw.githubusercontent.com/lh3/minigraph/2f569ebe3071fcb242f1bf0eabbb917941b47239/misc"
mkdir -p calls
for js in mgutils.js mgutils-es6.js; do
  if [ ! -s "calls/$js" ]; then
    curl -fsSL -o "calls/$js.part" "$MGUTILS/$js"
    mv "calls/$js.part" "calls/$js"
  fi
done
cut -f2 panel.tsv >calls/samples.txt
CALLS=()
while read -r _ name; do
  out="calls/$name.call.bed"
  if [ ! -s "$out" ]; then
    # --call: the walk this assembly takes through every bubble, one line per
    # `gfatools bubble` line, in the same order for every assembly. Each call
    # loads the whole graph's index, 15 to 19 GB here.
    minigraph -cxasm --call -t "$THREADS" "graph/$GRAPH.rgfa.gz" \
      "graph/$name.pansn.fa" >"$out.tmp" 2>"logs/call.$name.log"
    mv "$out.tmp" "$out"
  fi
  CALLS+=("$out")
done <panel.tsv
if [ ! -s "$GRAPH.vcf.gz" ]; then
  {
    awk '{ printf "##contig=<ID=%s,length=%d>\n", $1, $2 }' ref.chrom.sizes
    echo '##INFO=<ID=END,Number=1,Type=Integer,Description="End of the bubble">'
    echo '##INFO=<ID=AN,Number=1,Type=Integer,Description="Number of called alleles">'
    paste "${CALLS[@]}" | k8 calls/mgutils.js merge -s calls/samples.txt - |
      sed "s/^$REF#1#//"
  } >calls/merged.bed
  # -r0: the first column, AGIS-1.0, is allele 0; -a: up to one allele per
  # assembly. The ID is the bubble's end segments, a record whose reference
  # call is not allele 0 is dropped, and so is the reference's own column.
  k8 calls/mgutils-es6.js merge2vcf -r0 -a "${#CALLS[@]}" calls/merged.bed |
    bcftools annotate --set-id '%INFO/VS%INFO/VE' -Ou |
    bcftools view -i 'GT[0]="ref"' -Ou |
    bcftools view -s "^$REF" -Ou |
    bcftools sort -Oz -o "$GRAPH.vcf.gz.tmp"
  mv "$GRAPH.vcf.gz.tmp" "$GRAPH.vcf.gz"
  tabix -f -p vcf "$GRAPH.vcf.gz"
  rm calls/merged.bed
fi

echo
echo "Built in $PWD:"
ls -l "$GRAPH".*
sha256sum "$GRAPH".* | tee checksums.sha256
cat <<'NOTES'

Publish under demos/rice_pangenome/ with a README.txt beside the data
(demos/rice_pangenome/README.txt in GMOD/jbrowse-components), never a bare
`aws s3 cp` over an existing object: the bucket has no versioning.
NOTES
