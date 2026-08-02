#!/usr/bin/env bash
#
# Great ape HSA16 all-vs-all alignment for a JBrowse multi-way synteny view.
#
# Reproduces the input to the chr16 panel of Yoo et al. 2025 (Nature,
# "Complete sequencing of ape genomes"), which was drawn with SVbyEye plotAVA.
#
# Extracts the HSA16-syntenic chromosome from six T2T assemblies, PanSN-names
# them, aligns all-versus-all with SVbyEye's documented parameters, and writes a
# filtered PAF that JBrowse's AllVsAllPAFAdapter reads directly.
#
# Requires: minimap2, samtools, awk, curl, htslib (bgzip); twoBitToFa optional
# Usage:    bash scripts/build_great_ape_chr16.sh [outdir]
#
# Tunables (environment variables):
#   THREADS      minimap2 threads                      (default: nproc)
#   IDX_BATCH    minimap2 -I target index batch size   (default: 1G)
#   MINLEN       min alignment block length to keep    (default: 100000)
#   OUTDIR       working/output directory              (default: script dir)
#   KEEP_RAW     write the full unfiltered PAF, bgzipped (default: 1)
#   INSECURE     add curl -k, for TLS-intercepting networks (default: 0)
#
# ---------------------------------------------------------------------------
# MEMORY WARNING
#
# The published parameters combine -c (base-level alignment) with -P (retain
# all chains). In ape satellite arrays -P keeps every paralogous chain and -c
# base-aligns all of them. On a 30 GB machine this exhausted RAM and drove
# 54 GB into swap without emitting a single row.
#
# IDX_BATCH (minimap2 -I) is the lever: it splits the target index into batches
# and makes one query pass per batch. Peak memory drops roughly in proportion,
# runtime rises roughly in proportion to the number of batches. Output is the
# same set of alignments, only the record ORDER differs.
#
# The six chromosomes total ~600 Mb, so the default -I 1G is a single batch and
# behaves like no batching at all. If you hit swap, step down: 512M, then 256M.
# Watch it with:  /usr/bin/time -v  (this script already reports peak RSS)
#
# Rough guidance, unverified above 30 GB:
#   >=64 GB RAM   IDX_BATCH=1G    likely fine in one batch
#    ~32 GB RAM   IDX_BATCH=256M  expect several passes
#    <32 GB RAM   consider dropping -P (see NO_P below)
#
# NO_P=1 drops -P. SVbyEye's own pairwise recipe omits it, and it is by far the
# biggest memory contributor. It loses paralogous secondary chains, which the
# six-row figure does not draw anyway (same-sample records cannot appear in a
# synteny band, and this script filters them out regardless).
# ---------------------------------------------------------------------------

set -euo pipefail

OUTDIR=${1:-${OUTDIR:-great_ape_chr16}}
mkdir -p "$OUTDIR"
THREADS=${THREADS:-$(nproc)}
IDX_BATCH=${IDX_BATCH:-1G}
MINLEN=${MINLEN:-100000}
KEEP_RAW=${KEEP_RAW:-1}
INSECURE=${INSECURE:-0}
NO_P=${NO_P:-0}

CURL_OPTS=(-fsSL --retry 3 --retry-delay 5)
if [ "$INSECURE" = 1 ]; then CURL_OPTS+=(-k); fi

cd "$OUTDIR"

# --- dependency check -------------------------------------------------------

for tool in minimap2 samtools awk curl; do
  command -v "$tool" >/dev/null || { echo "missing required tool: $tool" >&2; exit 1; }
done

# --- what to fetch ----------------------------------------------------------
#
# The T2T ape assemblies use APE chromosome numbering with the human synteny
# encoded in the sequence name, so HSA16's counterpart is chr18 in all five
# apes. Siamang is absent on purpose: the rearranged gibbon karyotype has no
# single hsa16 chromosome, which is why the published panel has six rows.
#
# Gorilla and bonobo are trio-phased (_pat_); the rest are Hi-C phased (_hap1_).
#
# GenomeArk ships .fai and .gzi beside each bgzipped FASTA and its sequence
# names match GenBank exactly, so samtools pulls one chromosome by HTTP range
# request. No whole-genome download happens anywhere in this script.

GENOMEARK=https://s3.amazonaws.com/genomeark/species

# sample|genomeark path|sequence name|expected length
APES="
chimp|Pan_troglodytes/mPanTro3/assembly_curated/mPanTro3.pri.cur.20231122.fasta.gz|chr18_hap1_hsa16|94528409
bonobo|Pan_paniscus/mPanPan1/assembly_curated/mPanPan1.pat.cur.20231122.fasta.gz|chr18_pat_hsa16|100427192
gorilla|Gorilla_gorilla/mGorGor1/assembly_curated/mGorGor1.pat.cur.20231122.fasta.gz|chr18_pat_hsa16|131347499
ponPyg|Pongo_pygmaeus/mPonPyg2/assembly_curated/mPonPyg2.pri.cur.20231122.fasta.gz|chr18_hap1_hsa16|87425153
ponAbe|Pongo_abelii/mPonAbe1/assembly_curated/mPonAbe1.pri.cur.20231205.fasta.gz|chr18_hap1_hsa16|89553113
"

HUMAN_LEN=96330374

echo "== extracting chromosomes (HTTP range requests, no full downloads)"

for row in $APES; do
  IFS='|' read -r sample path seq len <<< "$row"
  if [ -s "$sample.fa" ]; then
    echo "   $sample: cached"
  else
    echo "   $sample: $seq"
    samtools faidx "$GENOMEARK/$path" "$seq" > "$sample.fa.tmp"
    mv "$sample.fa.tmp" "$sample.fa"
  fi
done

# Human T2T-CHM13v2.0 chr16. twoBitToFa off UCSC is faster when available;
# otherwise fall back to NCBI by accession (NC_060940.1 == hs1 chr16).
if [ -s human.fa ]; then
  echo "   human: cached"
elif command -v twoBitToFa >/dev/null; then
  echo "   human: chr16 (UCSC hs1.2bit)"
  twoBitToFa -seq=chr16 https://hgdownload.soe.ucsc.edu/goldenPath/hs1/bigZips/hs1.2bit human.fa.tmp
  mv human.fa.tmp human.fa
else
  echo "   human: chr16 (NCBI NC_060940.1)"
  curl "${CURL_OPTS[@]}" \
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=NC_060940.1&rettype=fasta&retmode=text" \
    | awk 'NR==1{print ">chr16"; next} {print}' > human.fa.tmp
  mv human.fa.tmp human.fa
fi

# --- verify lengths ---------------------------------------------------------
#
# A truncated range request produces a short sequence that still looks like a
# valid FASTA, and the alignment would silently be wrong. Check against the
# published lengths before spending an hour on minimap2.

echo "== verifying sequence lengths"
fail=0
check_len() {
  local sample=$1 expect=$2
  local got
  got=$(grep -v '^>' "$sample.fa" | tr -d '\n' | wc -c)
  if [ "$got" = "$expect" ]; then
    printf '   %-8s %12s  ok\n' "$sample" "$got"
  else
    printf '   %-8s %12s  MISMATCH (expected %s)\n' "$sample" "$got" "$expect"
    fail=1
  fi
}
for row in $APES; do
  IFS='|' read -r sample path seq len <<< "$row"
  check_len "$sample" "$len"
done
check_len human "$HUMAN_LEN"
[ "$fail" = 0 ] || { echo "length check failed; delete the bad .fa and re-run" >&2; exit 1; }

# --- PanSN naming -----------------------------------------------------------
#
# JBrowse's AllVsAllPAFAdapter classifies each PAF record by the PanSN sample
# prefix (sample#haplotype#contig) and strips it to recover the assembly's own
# refName. The contig part must therefore match the refName in your JBrowse
# assembly exactly. Renaming happens only in this concatenated copy.

if [ -s all.fa ]; then
  echo "== all.fa cached"
else
  echo "== building PanSN-named multi-FASTA"
  for sample in human chimp bonobo gorilla ponPyg ponAbe; do
    awk -v s="$sample" '/^>/{sub(/^>/, ">" s "#1#"); print; next} {print}' "$sample.fa"
  done > all.fa.tmp
  mv all.fa.tmp all.fa
fi
grep '^>' all.fa | sed 's/^/   /'

# --- align ------------------------------------------------------------------
#
# SVbyEye's documented all-versus-all recipe (vignettes/SVbyEye.Rmd):
#   minimap2 -x asm20 -c --eqx -D -P --dual=no in.multi.fa in.multi.fa
#
# -D --dual=no   skip the self diagonal, report each pair once (-X is shorthand)
# -c --eqx       emit CIGAR with =/X operators
# -P             retain all chains, do not demote secondaries
#
# NOTE: --secondary=no is NOT usable here. minimap2 rejects it outright:
#   "-X/-P and --secondary=no can't be applied at the same time"
# Volume is controlled by length filtering instead, which is SVbyEye's own
# filterPaf(min.align.len=...) step.

MM2_OPTS=(-x asm20 -c --eqx -D --dual=no -I "$IDX_BATCH" -t "$THREADS")
if [ "$NO_P" != 1 ]; then MM2_OPTS+=(-P); fi

RAW=great_ape_chr16.raw.paf.gz
OUT=great_ape_chr16.paf

echo "== aligning: minimap2 ${MM2_OPTS[*]}"
echo "   (expect roughly half an hour per pass on 16 cores; watch for swap)"

# The cross-sample filter is ours, not SVbyEye's: a same-sample record is
# intra-chromosomal paralogy, and it can never draw in a synteny band because
# band mode requires the mate to be the adjacent row's assembly. In the
# unfiltered run these were 76% of all records.
FILTER='$11 >= minlen { split($1,q,"#"); split($6,t,"#"); if (q[1] != t[1]) print }'

if [ "$KEEP_RAW" = 1 ] && command -v bgzip >/dev/null; then
  # tee the full stream to a compressed archive so re-filtering at a different
  # MINLEN later costs nothing, while never writing a multi-GB plain file
  /usr/bin/time -v minimap2 "${MM2_OPTS[@]}" all.fa all.fa 2> mm2.log \
    | tee >(bgzip -@ 4 > "$RAW") \
    | awk -F'\t' -v minlen="$MINLEN" "$FILTER" > "$OUT"
else
  /usr/bin/time -v minimap2 "${MM2_OPTS[@]}" all.fa all.fa 2> mm2.log \
    | awk -F'\t' -v minlen="$MINLEN" "$FILTER" > "$OUT"
fi

# --- report -----------------------------------------------------------------

echo "== done"
printf '   %-28s %s records, %s\n' "$OUT" "$(wc -l < "$OUT")" "$(du -h "$OUT" | cut -f1)"
[ -s "$RAW" ] && printf '   %-28s %s\n' "$RAW" "$(du -h "$RAW" | cut -f1)"

echo "== per-pair record counts"
awk -F'\t' '{split($1,q,"#"); split($6,t,"#");
             p=(q[1]<t[1]) ? q[1]"_"t[1] : t[1]"_"q[1]; c[p]++}
       END  {for (k in c) printf "   %-18s %6d\n", k, c[k]}' "$OUT" | sort

echo "== resource use"
grep -E 'Elapsed \(wall|Maximum resident' mm2.log | sed 's/^/  /'

cat <<'NOTE'

Next: point a JBrowse SyntenyTrack at great_ape_chr16.paf.

  "adapter": {
    "type": "AllVsAllPAFAdapter",
    "uri": "great_ape_chr16.paf",
    "assemblyNames": ["chimp","bonobo","human","gorilla","ponPyg","ponAbe"]
  }

If your JBrowse assemblies are named something else (for example the GenArk
accessions GCA_028858775.2 etc.), map them with assemblyNameToPanSN:

  "assemblyNameToPanSN": { "GCA_028858775.2": "chimp", "hs1": "human", ... }

Stack the rows in a LinearSyntenyView with one tracks[] entry per adjacent
pair, and set colorBy:"strand" to match the published figure's
forward/inverted coloring.
NOTE
