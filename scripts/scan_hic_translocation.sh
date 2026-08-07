#!/usr/bin/env bash
#
# Find and quantify a translocation between two chromosomes from Hi-C, by
# comparing a rearranged sample against a normal-karyotype control. This is the
# arithmetic behind the hic/bcr_abl1_translocation figure
# (website/scripts/specs/hic.ts) and the numbers the Hi-C structural-variant
# tutorial cites, so the tutorial quotes a script's output rather than a number
# somebody typed.
#
# THE IDEA. A translocation joins two chromosomes, and Hi-C contact frequency
# falls off with distance along whatever molecule the loci actually sit on. So on
# a fused chromosome the two partner regions are neighbours and contact each
# other constantly, while in a normal karyotype they are on separate molecules
# and only touch at the low background rate of the nucleus. The breakpoint is
# then the hottest inter-chromosomal bin pair. Nothing here is Hi-C-specific
# cleverness -- it is one dump and a sort. Purpose-built callers (EagleC,
# hic_breakfinder, HiNT) do this genome-wide with a trained model; this shows
# what they are looking at.
#
# WHY A CONTROL IS NOT OPTIONAL. Inter-chromosomal maps carry real background
# plus mapping artifacts, and an artifact is reproducible: chr9:129.42Mb x
# chr22:23.5Mb is the hottest bin in this pair in BOTH cell lines and is not a
# rearrangement. Ranking one sample tells you nothing on its own. What identifies
# a breakpoint is a bin that is hot in the sample and cold in the control.
#
# NORMALIZATION MUST BE `NONE`. This is the trap that matters. Matrix balancing
# (KR/SCALE/VC/INTER_SCALE) exists to divide out per-bin coverage differences,
# and an amplified fusion IS a coverage difference -- so a balanced matrix
# removes the thing being looked for. `NORM` is overridable so that claim is
# checkable from this script rather than asserted: at 250 kb under NONE the K562
# peak is ABL1 x BCR at 161,282 against the control's 149, and under INTER_SCALE
# that same bin is fifteenth of the pair's 55,376, behind low-mappability bins
# elsewhere on chr9 and chr22 that have nothing to do with the fusion and that
# the control scores at zero. The same applies to the browser: both HicTracks in
# config_demo.json set `selectedNormalization: NONE`.
#
# A balanced dump is also only available where the file stores a normalization
# vector, which on these two is 25 kb and coarser -- `NORM=INTER_SCALE RES=10000`
# returns an empty file, which the dump guard below reports.
#
# ONE TRAP INHERITED FROM THE SIBLING SCRIPT
# (scripts/build_gm12878_wholegenome_hic.sh): juicer_tools' region-restricted
# dump (`chr9:x1:x2`) silently returns ZERO records below 250 kb on these v9
# files -- no error, an empty file. Whole-chromosome-pair dumps, which is all
# this script does, are unaffected. Any windowing here is done with awk, after
# the dump, for exactly that reason.
#
# Data: ENCODE ENCSR545YBD (K562 in situ Hi-C) and ENCSR410MDC (GM12878 in situ
# Hi-C), both Aiden lab, hg38, .hic v9. Cite ENCODE:
#
#   ENCODE Project Consortium. An integrated encyclopedia of DNA elements in the
#   human genome. Nature 2012;489:57-74.
#
# The biology: K562 is derived from a chronic myeloid leukaemia patient and
# carries the Philadelphia chromosome, t(9;22)(q34;q11), which fuses BCR on
# chr22 to ABL1 on chr9 -- the fusion imatinib targets.
#
#   Rowley JD. A new consistent chromosomal abnormality in chronic myelogenous
#   leukaemia identified by quinacrine fluorescence and Giemsa staining.
#   Nature 1973;243:290-293.
#
# Requires: java (17+; Debian/Ubuntu: apt install default-jre), curl, awk, sort.
#           juicer_tools is downloaded into the outdir if not already there.
# Usage:    bash scripts/scan_hic_translocation.sh [outdir]
#           CHR1=chr9 CHR2=chr22 RES=250000 bash scripts/scan_hic_translocation.sh
#           NORM=INTER_SCALE bash scripts/scan_hic_translocation.sh
set -euo pipefail

OUTDIR="${1:-hic_translocation_scan}"

# Overridable: the recipe is not specific to this pair or these files. Point
# CASE/CTRL at any two .hic files that hold inter-chromosomal blocks and CHR1/
# CHR2 at any pair.
CASE="${CASE:-https://encode-public.s3.amazonaws.com/2021/10/28/4d332729-3463-4782-b33c-76e4fa8ff72a/ENCFF080DPJ.hic}"
CTRL="${CTRL:-https://encode-public.s3.amazonaws.com/2021/10/28/6f0cc163-86c7-4a68-baac-65af90f5a90d/ENCFF053VBX.hic}"
# The wrong control, kept because running it is the argument for the right one:
# ENCSR730CER is the GM12878 "supernatant" fraction, and its whole chr9 x chr22
# block holds 17,905 contacts to the deep in situ file's 2,072,975. Every bin in
# the junction's neighbourhood is empty in it, so K562 looks spectacular against
# a panel that is blank because nothing was sequenced.
#   CTRL=https://encode-public.s3.amazonaws.com/2022/04/25/c70efe98-342c-4334-a188-43174ddfb155/ENCFF563JTY.hic
CASE_LABEL="${CASE_LABEL:-K562 (ENCFF080DPJ)}"
CTRL_LABEL="${CTRL_LABEL:-GM12878 (ENCFF053VBX)}"
CHR1="${CHR1:-chr9}"
CHR2="${CHR2:-chr22}"
RES="${RES:-250000}"
NORM="${NORM:-NONE}"
TOP="${TOP:-10}"
JAR_URL="https://github.com/aidenlab/Juicebox/releases/download/v2.20.00/juicer_tools.2.20.00.jar"

mkdir -p "$OUTDIR"
cd "$OUTDIR"

# A dump is cached under a name carrying everything that decides its contents.
# Keyed on the label alone, a second run at a different RES or NORM in the same
# outdir reused the first one's file and printed it under the new heading.
CASE_OUT="case.$CHR1-$CHR2.$RES.$NORM.txt"
CTRL_OUT="ctrl.$CHR1-$CHR2.$RES.$NORM.txt"

if [ ! -f juicer_tools.jar ]; then
  echo "== fetching juicer_tools"
  curl -fL -o juicer_tools.jar "$JAR_URL"
fi

# `dump observed $NORM` over the whole chromosome pair. Raw counts by default,
# for the reason in the header. Output is three columns: bin1 start, bin2 start,
# value.
dump() {
  local src="$1" out="$2" label="$3"
  if [ -s "$out" ]; then
    echo "== $label: reusing $out"
    return
  fi
  echo "== $label: dumping $CHR1 x $CHR2 at ${RES}bp, normalization $NORM"
  java -Xmx4g -jar juicer_tools.jar dump observed "$NORM" \
    "$src" "$CHR1" "$CHR2" BP "$RES" "$out" 2>/dev/null
  if [ ! -s "$out" ]; then
    echo "FAILED: empty dump for $label. An empty file here means this .hic" >&2
    echo "stores neither the pair nor a $NORM vector at ${RES}bp (read the" >&2
    echo "footer) -- not that there is no contact between the two chromosomes." >&2
    echo "A balanced NORM is typically stored at coarser bins than NONE is." >&2
    exit 1
  fi
}

dump "$CASE" "$CASE_OUT" "$CASE_LABEL"
dump "$CTRL" "$CTRL_OUT" "$CTRL_LABEL"

# Totals and the ranked table. awk rather than a spreadsheet so the numbers in
# the tutorial are reproducible from the file.
summarize() {
  local f="$1" label="$2"
  awk -v L="$label" -F'\t' '
    { n++; tot += $3; if ($3 > max) { max = $3; mb1 = $1; mb2 = $2 } }
    END {
      printf "  %-26s %8d occupied bin pairs   %12.0f total   max %9.0f at %s:%d x %s:%d\n",
        L, n, tot, max, C1, mb1, C2, mb2
    }' C1="$CHR1" C2="$CHR2" "$f"
}

# Rank the case and carry the control's value for the same bin. One awk pass
# loads the control into a hash and joins it onto the case, so the table is a
# join, a sort and a format rather than a shell loop re-scanning the control
# file once per row.
#
# awk does the head rather than `| head -N`: head closes the pipe on sort, which
# dies of SIGPIPE, and under `set -o pipefail` the script exits 141 there --
# after printing the case table, so the control ranking below (the whole point
# of the comparison) never runs.
ranked_against_control() {
  awk -F'\t' -v OFS='\t' '
    NR == FNR { ctrl[$1 OFS $2] = $3; next }
    { k = $1 OFS $2; print $1, $2, $3, (k in ctrl ? ctrl[k] : 0) }
  ' "$CTRL_OUT" "$CASE_OUT" |
    sort -k3,3 -rn |
    awk -F'\t' -v n="$1" 'NR <= n { printf "     %14d %14d %10.0f %10.0f\n", $1, $2, $3, $4 }'
}

echo
echo "════ $CHR1 x $CHR2 inter-chromosomal contact, ${RES}bp bins, normalization $NORM"
summarize "$CASE_OUT" "$CASE_LABEL"
summarize "$CTRL_OUT" "$CTRL_LABEL"

echo
echo "════ top $TOP bin pairs in $CASE_LABEL, with the SAME bin in $CTRL_LABEL"
echo "     (a breakpoint is hot in the case and cold in the control; a bin hot in"
echo "      both is an artifact, not a rearrangement)"
printf '     %14s %14s %10s %10s\n' "$CHR1" "$CHR2" "case" "ctrl"
ranked_against_control "$TOP"

echo
echo "════ the same ranking for $CTRL_LABEL, to show what background looks like"
printf '     %14s %14s %10s\n' "$CHR1" "$CHR2" "ctrl"
sort -k3,3 -rn "$CTRL_OUT" |
  awk -F'\t' 'NR <= 5 { printf "     %14d %14d %10.0f\n", $1, $2, $3 }'

echo
echo "Wrote $OUTDIR/$CASE_OUT and $OUTDIR/$CTRL_OUT."
