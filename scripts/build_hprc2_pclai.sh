#!/usr/bin/env bash
#
# Reproducibly build the HPRC2 local-ancestry painting shown in
# website/docs/tutorials/pangenome_hprc.md ("Paint every haplotype by ancestry").
#
# HPRC Release 2 publishes PCLAI local-ancestry calls as one BED per haplotype,
# already on GRCh38, with a CIELAB-interpolated PCA color in the itemRgb column.
# LinearMultiRowFeatureDisplay wants the opposite shape: one file, with a column
# naming the row each feature belongs to. So this fetches N of those per-haplotype
# BEDs, keeps the five columns the painting needs, tags each row with its
# haplotype, and writes one bgzipped+tabixed BED.
#
# Nothing is inferred here. The upstream calls are taken as published; the only
# transformation is a column projection and a concatenation.
#
# Requires: curl, sort, bgzip, tabix.
# Usage:    bash scripts/build_hprc2_pclai.sh [outdir] [chrom] [nsamples]
#
set -euo pipefail

OUTDIR="${1:-hprc2_pclai_build}"
CHROM="${2:-chr1}"
NSAMPLES="${3:-32}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

# ── Pinned inputs ───────────────────────────────────────────────────────────
# The release index: sample_id,haplotype,assembly_name,location(s3://...). It is
# the authority on which haplotype token a file uses -- some samples are
# hap1/hap2 and others pat/mat, so URLs must be read from here, never built.
INDEX="https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/pclai/pclai_v1.1_grch38_coord_local_hprc_r2.index.csv"

# The four samples Fig 1d of the HPRC2 paper highlights, always included so the
# figure keeps its contrast however NSAMPLES changes: an admixed Puerto Rican
# (HG01167), a Yoruba (NA19240), a Kinh Vietnamese (HG02135), and an Iberian
# (HG01530) with sporadic AFR-like haplotypes.
FEATURED="HG01167 NA19240 HG02135 HG01530"

echo "== fetching release index"
# The published index is CRLF; strip it or every `location` carries a trailing
# carriage return and the URLs it yields are rejected.
curl -fsSL "$INDEX" | tr -d '\r' > pclai_index.csv

# Featured samples first, then fill up to NSAMPLES from the rest in file order.
# Deterministic: no shuffling, no sampling.
awk -F, -v feat="$FEATURED" -v n="$NSAMPLES" '
  BEGIN { split(feat, f, " "); for (i in f) want[f[i]] = 1 }
  NR == 1 { next }
  { if ($1 in want) sel[$1] = 1 }
  END {
    for (s in sel) print s
  }
' pclai_index.csv > chosen.txt

awk -F, -v n="$NSAMPLES" '
  NR == 1 { next }
  !seen[$1]++ { print $1 }
' pclai_index.csv > allsamples.txt

# Featured first, then fill by striding across the index rather than taking the
# first N. Sample IDs are grouped by cohort in index order (HG00xxx GBR/FIN/CHS,
# HG01xxx PUR/CLM/IBS, HG02xxx PJL/KHV, HG03xxx ITU/STU/MSL, NA18xxx/NA19xxx
# JPT/YRI, NA20xxx TSI/GIH/ASW), so the first N are ancestry-homogeneous and the
# painting comes out as two flat color blocks. A stride spreads the selection
# over every cohort. Deterministic: a fixed stride, no shuffling.
grep -vxF -f chosen.txt allsamples.txt > rest.txt
NREST=$(wc -l < rest.txt)
NEED=$(( NSAMPLES - $(wc -l < chosen.txt) ))
{
  cat chosen.txt
  if [ "$NEED" -gt 0 ]; then
    awk -v need="$NEED" -v total="$NREST" '
      BEGIN { stride = total / need }
      { idx = int(NR / stride); if (idx != last && count < need) { print; count++; last = idx } }
    ' rest.txt
  fi
} > use.txt
echo "== using $(wc -l < use.txt) samples on $CHROM"

# ── Project and concatenate ─────────────────────────────────────────────────
# Input BED columns: chrom start end name score strand thickStart thickEnd itemRgb pca
# Output: chrom start end name score strand thickStart thickEnd itemRgb sample
# The trailing `sample` column is the display's partitionField. Keeping itemRgb
# in column 9 matters: the BED parser only applies named BED fields at exactly 12
# columns, so at this width the color lands in `field8` and the automatic BED
# color path claims it with no columnNames and no jexl.
: > combined.bed
while read -r SAMPLE; do
  # Read both haplotype rows for this sample straight out of the index.
  grep "^${SAMPLE}," pclai_index.csv | while IFS=, read -r sid hap asm loc; do
    url="https://s3-us-west-2.amazonaws.com/${loc#s3://}"
    echo "   ${sid} hap${hap}"
    curl -fsSL "$url" \
      | awk -v OFS='\t' -v s="${sid}.h${hap}" -v c="$CHROM" \
          '$1 == c { print $1, $2, $3, $4, $5, ".", $2, $3, $9, s }' \
      >> combined.bed
  done
done < use.txt

echo "== sorting and indexing"
# The `#`-prefixed header names the extra column so the adapter exposes it as
# `sample` (the partitionField) rather than a positional field name.
{
  printf '#chrom\tstart\tend\tname\tscore\tstrand\tthickStart\tthickEnd\titemRgb\tsample\n'
  sort -k1,1 -k2,2n combined.bed
} > hprc2_pclai_"${CHROM}".bed

bgzip -f hprc2_pclai_"${CHROM}".bed
tabix -f -p bed hprc2_pclai_"${CHROM}".bed.gz

echo "== done"
ls -la hprc2_pclai_"${CHROM}".bed.gz hprc2_pclai_"${CHROM}".bed.gz.tbi
echo "rows: $(wc -l < combined.bed)  haplotypes: $(cut -f10 combined.bed | sort -u | wc -l)"
