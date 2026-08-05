#!/usr/bin/env bash
#
# Run build_dog10k_wolfdog_ancestry.sh over all 38 dog autosomes and join the
# results into one genome-wide painting.
#
# The per-chromosome script is per-chromosome by design: it slices, paints and
# reports one chromosome at a time so the working set stays small, and the
# expensive artifact (the panel slice) is worth keeping only until that
# chromosome is painted. So the genome-wide run is a driver around it rather
# than a flag inside it. Each chromosome is built in a scratch directory, the
# handful of small outputs are copied out under a "$CHROM." prefix, and the
# scratch directory is removed before the next one starts. Peak disk is one
# chromosome's working set, not 38.
#
# A chromosome that already has a .done marker is skipped, so an interrupted run
# resumes where it stopped. The whole sweep is around five hours; the FLARE runs
# dominate, and the panel slice is network bound.
#
# Writes dog10k_anglofrench.autosomes.bed.gz, the Anglo-French hound clade over
# all 38 autosomes, which is the track the local ancestry tutorial's genome-wide
# figure draws, and prints the sequence-weighted wolf fraction per animal.
#
# Requires: everything build_dog10k_wolfdog_ancestry.sh requires, plus about
#           40 GB of free disk for the scratch directory.
# Usage:    bash scripts/build_dog10k_ancestry_genomewide.sh [outdir]
set -euo pipefail

OUTDIR="${1:-dog10k_genomewide_build}"
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

# Sibling helpers this script runs, fetched next to it when absent, so a bare
# `curl -fO` of this one file behaves the same as a repo checkout. The
# per-chromosome script fetches its own helpers the same way once it runs.
HELPERS=(build_dog10k_wolfdog_ancestry.sh dog10k_ancestry_genomewide.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

mkdir -p "$OUTDIR/keep"
OUTDIR=$(cd "$OUTDIR" && pwd)
KEEP="$OUTDIR/keep"

# Per chromosome, the files worth keeping: both paintings from the sweep run and
# the clade run, FLARE's per-sample summaries (the aggregator's numerator), and
# the two label tables that map a sample id to the row name in the BED. Nothing
# here is over a few hundred kB; everything else in the working directory is a
# VCF that can be rebuilt from the panel.
KEEP_FILES=(
  "dog10k_wolfdog_ancestry.CHROM.bed.gz"
  "dog10k_wolfdog_named.CHROM.bed.gz"
  "dog10k_anglofrench.CHROM.bed.gz"
  "wolfdog_CHROM.global.anc.gz"
  "anglofrench_CHROM.global.anc.gz"
  "named.tsv"
  "anglofrench.tsv"
)

for i in $(seq 1 38); do
  chrom="chr$i"
  if [ -f "$KEEP/$chrom.done" ]; then
    echo "== $chrom already done, skipping"
    continue
  fi
  echo "== $chrom starting at $(date +%H:%M)"
  work="$OUTDIR/work.$chrom"
  rm -rf "$work"
  bash "$SCRIPT_DIR/build_dog10k_wolfdog_ancestry.sh" "$chrom" "$work" \
    > "$KEEP/$chrom.log" 2>&1
  for f in "${KEEP_FILES[@]}"; do
    src="$work/${f//CHROM/$chrom}"
    [ -f "$src" ] && cp "$src" "$KEEP/$chrom.$(basename "$src")"
  done
  # The marker goes down only after the copies, so an interrupt during the copy
  # rebuilds the chromosome rather than leaving a partial keep set behind.
  touch "$KEEP/$chrom.done"
  rm -rf "$work"
  echo "== $chrom done at $(date +%H:%M), $(df -h --output=avail "$OUTDIR" | tail -1) free"
done

# Concatenate the per-chromosome clade paintings. Keep the single `#`-header on
# top, since the BedTabixAdapter reads the column names from it, and sort the
# rest under LC_ALL=C so the order does not shift with the locale.
OUT="$OUTDIR/dog10k_anglofrench.autosomes.bed"
first=$(ls "$KEEP"/chr*.dog10k_anglofrench.*.bed.gz | head -1)
{
  zcat "$first" | grep '^#'
  zcat "$KEEP"/chr*.dog10k_anglofrench.*.bed.gz \
    | grep -v '^#' \
    | LC_ALL=C sort -t"$(printf '\t')" -k1,1 -k2,2n
} > "$OUT"
bgzip -f "$OUT"
tabix -f -p bed "$OUT.gz"

echo
echo "Wrote $OUT.gz"
echo "  chromosomes: $(zcat "$OUT.gz" | grep -v '^#' | cut -f1 | sort -u | wc -l)"
echo "  rows:        $(zcat "$OUT.gz" | grep -v '^#' | cut -f10 | sort -u | wc -l)"
echo "  features:    $(zcat "$OUT.gz" | grep -vc '^#')"
echo
python3 "$SCRIPT_DIR/dog10k_ancestry_genomewide.py" "$KEEP"
