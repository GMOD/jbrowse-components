#!/usr/bin/env bash
#
# Reproducibly build the coarse whole-genome Hi-C file that the hic/whole_genome
# figure (website/scripts/specs/alignments.ts) and its live link read.
#
# WHY A DERIVED FILE AT ALL. The figure's subject is inter-chromosomal contact,
# so it needs a .hic whose master index holds the off-diagonal pairs; the demo's
# own intra_nofrag_30.hic has 26 entries and every one is a self-pair, which is
# why its off-diagonal came back empty. ENCODE's GM12878 in situ Hi-C
# (ENCFF563JTY, ENCSR730CER) does hold all 300 pairs -- and is 1.72 GB, nearly
# all of it the fine resolutions a whole-genome view never asks for. Pointing
# the demo straight at it meant every reader who opened the live link pulled 300
# region-pair range requests off ENCODE's bucket (685,098 records, measured at
# 224s serially).
#
# WHAT THIS KEEPS. Only the coarsest binsize, 2.5 Mb, which is the one the
# whole-genome view asks for. That is ~1/1000th of the bytes and reproduces the
# source counts exactly -- the script verifies this rather than asserting it, by
# dumping a pair back out of the rebuilt file and diffing against the source
# dump. A mismatch fails the build.
#
# WHAT IT COSTS. The rebuilt file carries one resolution, so zooming in does not
# get finer. That degrades rather than breaks: LinearHicDisplay picks a binsize
# from the file's own list ("largest binsize <= 2*bpPerPx, falling back to the
# finest when nothing qualifies"), so a zoomed-in view keeps drawing 2.5 Mb
# blocks and the resolution stepper simply offers no finer step.
#
# ONE TRAP, found on the sibling loops file and worth knowing before you adapt
# this: juicer_tools' region-restricted dump (`chr3:x1:x2`) silently returns
# ZERO records below 250 kb on these v9 files -- no error, no warning, just an
# empty file. Whole-chromosome-pair dumps like the ones here are unaffected. If
# you ever need a windowed subset, dump the whole pair and filter with awk, and
# check the record count before trusting the output.
#
# Data: ENCODE ENCSR730CER, GM12878 in situ Hi-C, hg38, .hic v9. Cite ENCODE:
#
#   ENCODE Project Consortium. An integrated encyclopedia of DNA elements in the
#   human genome. Nature 2012;489:57-74.
#
# Requires: java (17+; Debian/Ubuntu: apt install default-jre), curl, awk.
#           juicer_tools is downloaded into the outdir if not already there.
# Usage:    bash scripts/build_gm12878_wholegenome_hic.sh [outdir]
#
# Deploy the result with:
#   DEPLOY_DEMO_ALLOW_UNTRACKED=1 scripts/deploy-demo.sh \
#     <outdir>/$NAME.hic hic/$NAME.hic
set -euo pipefail

OUTDIR="${1:-gm12878_hic_build}"
# Overridable, because the recipe is not specific to this file: any whole-genome
# .hic that carries inter-chromosomal blocks can be shrunk to its coarsest
# binsize the same way. Point SRC/NAME at a different ENCODE accession and the
# rest of the script, including the round-trip check, applies unchanged.
SRC="${SRC:-https://encode-public.s3.amazonaws.com/2022/04/25/c70efe98-342c-4334-a188-43174ddfb155/ENCFF563JTY.hic}"
NAME="${NAME:-gm12878_wholegenome_2500kb}"
RES="${RES:-2500000}"
JAR_URL="https://github.com/aidenlab/Juicebox/releases/download/v2.20.00/juicer_tools.2.20.00.jar"

mkdir -p "$OUTDIR/dumps"
cd "$OUTDIR"
JT="java -Xmx4g -jar juicer_tools.jar"

if [ ! -s juicer_tools.jar ]; then
  echo "fetching juicer_tools"
  curl -sL --max-time 600 -o juicer_tools.jar "$JAR_URL"
fi

# The main chromosomes, which are the ones the whole-genome view lays out. The
# assembly is full GRCh38; binning the alts and randoms too would spend bins on
# contigs the figure never draws.
CHROMS=(chr1 chr2 chr3 chr4 chr5 chr6 chr7 chr8 chr9 chr10 chr11 chr12 chr13 \
        chr14 chr15 chr16 chr17 chr18 chr19 chr20 chr21 chr22 chrX chrY)
n=${#CHROMS[@]}

if [ ! -s hg38.chrom.sizes ]; then
  echo "fetching hg38.chrom.sizes"
  curl -sL --max-time 120 \
    https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.chrom.sizes \
    -o hg38.chrom.sizes.all
  # emitted in CHROMS order, since `pre` bins against this list
  : > hg38.chrom.sizes
  for c in "${CHROMS[@]}"; do
    awk -v c="$c" '$1==c {print $1"\t"$2}' hg38.chrom.sizes.all >> hg38.chrom.sizes
  done
fi

total=$((n * (n + 1) / 2))
echo "dumping $total chromosome pairs at ${RES}bp (about 11s each)"
done_n=0
for ((i = 0; i < n; i++)); do
  for ((j = i; j < n; j++)); do
    a=${CHROMS[$i]}; b=${CHROMS[$j]}
    out="dumps/${a}_${b}.txt"
    done_n=$((done_n + 1))
    # resumable: a pair already dumped is skipped, so an interrupted run picks
    # up where it stopped rather than re-fetching an hour of range requests
    [ -s "$out" ] && continue
    $JT dump observed NONE "$SRC" "$a" "$b" BP $RES "$out" > /dev/null 2>&1 || {
      echo "  ! failed $a $b"
      : > "$out"
    }
    echo "  [$done_n/$total] $a $b $(wc -l < "$out") records"
  done
done

# juicer `pre` short-with-score format:
#   str1 chr1 pos1 frag1 str2 chr2 pos2 frag2 score
# frag1/frag2 differ (0/1) so a non-fragment map is not read as a self-ligation,
# and the score column is what carries the contact count through the rebuild.
echo "converting to short-with-score format"
: > contacts.txt
for ((i = 0; i < n; i++)); do
  for ((j = i; j < n; j++)); do
    a=${CHROMS[$i]}; b=${CHROMS[$j]}
    out="dumps/${a}_${b}.txt"
    [ -s "$out" ] || continue
    awk -v a="$a" -v b="$b" 'BEGIN{OFS=" "} $3>0 {print 0, a, $1, 0, 0, b, $2, 1, $3}' \
      "$out" >> contacts.txt
  done
done
echo "contacts: $(wc -l < contacts.txt) lines"

# -n: the figure draws raw counts on a linear ramp and asks for no
# normalization, so computing norm vectors would only add weight.
echo "building the coarse .hic"
$JT pre -r $RES -n -t ./pretmp contacts.txt "$NAME.hic" hg38.chrom.sizes

# The check that makes this a rebuild rather than a re-estimate: dump a pair
# back out and diff it against the source dump. Counts must survive exactly.
echo "verifying the round trip on chr1 x chr2"
$JT dump observed NONE "$NAME.hic" chr1 chr2 BP $RES roundtrip_chr1_chr2.txt > /dev/null 2>&1
if diff <(sort dumps/chr1_chr2.txt) <(sort roundtrip_chr1_chr2.txt) > /dev/null; then
  echo "  round trip exact: $(wc -l < roundtrip_chr1_chr2.txt) records match the source"
else
  echo "  ROUND TRIP MISMATCH -- the rebuilt file does not reproduce the source" >&2
  exit 1
fi

ls -la "$NAME.hic"
echo "source $(curl -sI "$SRC" | awk 'tolower($1)=="content-length:"{printf "%.2f GB", $2/1024/1024/1024}') -> $(du -h "$NAME.hic" | cut -f1)"
