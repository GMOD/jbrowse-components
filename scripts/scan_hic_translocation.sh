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
# removes the thing being looked for. Measured on these two files at 250 kb:
# under NONE the K562 peak is at ABL1 x BCR; under INTER_SCALE the peak moves to
# the shared mapping artifact and the fusion drops by two orders of magnitude.
# The same applies to the browser: both HicTracks in config_demo.json set
# `selectedNormalization: NONE`.
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
set -euo pipefail

OUTDIR="${1:-hic_translocation_scan}"

# Overridable: the recipe is not specific to this pair or these files. Point
# CASE/CTRL at any two .hic files that hold inter-chromosomal blocks and CHR1/
# CHR2 at any pair.
CASE="${CASE:-https://encode-public.s3.amazonaws.com/2021/10/28/4d332729-3463-4782-b33c-76e4fa8ff72a/ENCFF080DPJ.hic}"
CTRL="${CTRL:-https://encode-public.s3.amazonaws.com/2021/10/28/6f0cc163-86c7-4a68-baac-65af90f5a90d/ENCFF053VBX.hic}"
CASE_LABEL="${CASE_LABEL:-K562 (ENCFF080DPJ)}"
CTRL_LABEL="${CTRL_LABEL:-GM12878 (ENCFF053VBX)}"
CHR1="${CHR1:-chr9}"
CHR2="${CHR2:-chr22}"
RES="${RES:-250000}"
TOP="${TOP:-10}"
JAR_URL="https://github.com/aidenlab/Juicebox/releases/download/v2.20.00/juicer_tools.2.20.00.jar"

mkdir -p "$OUTDIR"
cd "$OUTDIR"

if [ ! -f juicer_tools.jar ]; then
  echo "== fetching juicer_tools"
  curl -fL -o juicer_tools.jar "$JAR_URL"
fi

# `dump observed NONE` over the whole chromosome pair. Raw counts, for the reason
# in the header. Output is three columns: bin1 start, bin2 start, count.
dump() {
  local src="$1" out="$2" label="$3"
  if [ -s "$out" ]; then
    echo "== $label: reusing $out"
    return
  fi
  echo "== $label: dumping $CHR1 x $CHR2 at ${RES}bp"
  java -Xmx4g -jar juicer_tools.jar dump observed NONE \
    "$src" "$CHR1" "$CHR2" BP "$RES" "$out" 2>/dev/null
  if [ ! -s "$out" ]; then
    echo "FAILED: empty dump for $label. An empty file here means the pair is" >&2
    echo "not stored in this .hic (read the footer) -- not that there is no" >&2
    echo "contact between the two chromosomes." >&2
    exit 1
  fi
}

dump "$CASE" case.txt "$CASE_LABEL"
dump "$CTRL" ctrl.txt "$CTRL_LABEL"

# Totals and the ranked table. awk rather than a spreadsheet so the numbers in
# the tutorial are reproducible from the file.
summarize() {
  local f="$1" label="$2"
  awk -v L="$label" -F'\t' '
    { n++; tot += $3; if ($3 > max) { max = $3; mb1 = $1; mb2 = $2 } }
    END {
      printf "  %-26s %8d occupied bin pairs   %12d contacts   max %9d at %s:%d x %s:%d\n",
        L, n, tot, max, C1, mb1, C2, mb2
    }' C1="$CHR1" C2="$CHR2" "$f"
}

echo
echo "════ $CHR1 x $CHR2 inter-chromosomal contact, ${RES}bp bins, raw counts"
summarize case.txt "$CASE_LABEL"
summarize ctrl.txt "$CTRL_LABEL"

echo
echo "════ top $TOP bin pairs in $CASE_LABEL, with the SAME bin in $CTRL_LABEL"
echo "     (a breakpoint is hot in the case and cold in the control; a bin hot in"
echo "      both is an artifact, not a rearrangement)"
printf '     %14s %14s %10s %10s\n' "$CHR1" "$CHR2" "case" "ctrl"
sort -k3,3 -rn case.txt | head -"$TOP" | while IFS=$'\t' read -r b1 b2 c; do
  ctrl=$(awk -F'\t' -v a="$b1" -v b="$b2" '$1==a && $2==b { print $3; found=1 }
                                           END { if (!found) print 0 }' ctrl.txt)
  printf '     %14d %14d %10.0f %10.0f\n' "$b1" "$b2" "$c" "$ctrl"
done

echo
echo "════ the same ranking for $CTRL_LABEL, to show what background looks like"
printf '     %14s %14s %10s\n' "$CHR1" "$CHR2" "ctrl"
sort -k3,3 -rn ctrl.txt | head -5 | while IFS=$'\t' read -r b1 b2 c; do
  printf '     %14d %14d %10.0f\n' "$b1" "$b2" "$c"
done

echo
echo "Wrote $OUTDIR/case.txt and $OUTDIR/ctrl.txt."
