#!/usr/bin/env bash
#
# Reproducibly build the TCGA cohort somatic-mutation demo shown in
# website/docs/tutorials/tcga_cohort_cnv.md: every primary tumor in a TCGA
# project as one row of a LinearMultiSampleVariantMatrixDisplay, the mutation
# counterpart to the copy-number stack that build_tcga_cohort_cnv.sh builds.
#
# All input is GDC *open-access* "Masked Somatic Mutation" data (MAF, aliquot
# ensemble calls already annotated with VEP and harmonized to GRCh38), so no
# dbGaP token or controlled-access request is needed. The germline and
# low-confidence masking is GDC's, not ours.
#
# The reshaping is a pivot: a MAF lists one tumor's mutated sites, and the
# matrix display needs one record per site with a genotype for every tumor.
# maf_to_vcf.py does that, carrying the MAF's VEP columns through as INFO/CSQ so
# the display's consequence coloring works on the result.
#
# The clinical TSV is what makes the matrix readable: without it the rows are
# 979 barcodes in alphabetical order, with it they group by receptor subtype or
# histology.
#
# Requires: curl, python3, bgzip + tabix (htslib)
# Output:   tcga_<project>_mutations.vcf.gz (+ .tbi)
#           tcga_<project>_clinical.tsv
# Runtime:  ~5-10 min for BRCA (979 tumors), dominated by the GDC downloads
#
# Usage: build_tcga_somatic_mutations.sh [PROJECT] [LIMIT]
#   PROJECT  TCGA project id (default TCGA-BRCA)
#   LIMIT    only fetch the first N tumors (default: all; for a quick smoke test)

set -euo pipefail

PROJECT=${1:-TCGA-BRCA}
LIMIT=${2:-0}
PREFIX=$(echo "$PROJECT" | tr '[:upper:]-' '[:lower:]_')
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "== querying GDC for $PROJECT primary-tumor MAF files"

# Same Primary Tumor restriction the copy-number build uses, so the two tracks
# are the same cohort: it drops the handful of metastatic-only cases, whose
# barcodes would otherwise appear in the matrix with no clinical row to join to.
curl -s 'https://api.gdc.cancer.gov/files' \
  -H 'Content-Type: application/json' \
  -d '{
    "filters": {"op":"and","content":[
      {"op":"in","content":{"field":"cases.project.project_id","value":["'"$PROJECT"'"]}},
      {"op":"in","content":{"field":"data_type","value":["Masked Somatic Mutation"]}},
      {"op":"in","content":{"field":"cases.samples.sample_type","value":["Primary Tumor"]}},
      {"op":"in","content":{"field":"access","value":["open"]}}
    ]},
    "fields": "file_id",
    "format": "JSON",
    "size": "20000"
  }' > "$WORK/manifest.json"

python3 - "$WORK" "$LIMIT" <<'PY'
import json, sys
work, limit = sys.argv[1], int(sys.argv[2])
ids = sorted(h['file_id'] for h in json.load(open(f'{work}/manifest.json'))['data']['hits'])
if limit:
    ids = ids[:limit]
open(f'{work}/files.txt', 'w').write('\n'.join(ids) + '\n')
print(f'   {len(ids)} MAF files')
PY

# One POST of many ids streams back a single tar.gz, so the cohort arrives in a
# handful of requests rather than one per tumor.
echo "== downloading MAFs"
mkdir -p "$WORK/maf"
split -l 150 "$WORK/files.txt" "$WORK/batch."
for b in "$WORK"/batch.*; do
  python3 -c 'import json,sys; print(json.dumps({"ids":[l.strip() for l in open(sys.argv[1]) if l.strip()]}))' "$b" > "$b.json"
  curl -s --retry 3 --retry-delay 5 'https://api.gdc.cancer.gov/data' \
    -H 'Content-Type: application/json' \
    -d @"$b.json" \
    | tar xz -C "$WORK/maf" \
    || echo "   warning: batch $(basename "$b") failed, continuing"
  echo -n '.'
done
echo

# Written straight into bgzip: the intermediate VCF is ~350 MB of mostly 0/0,
# which compresses to single-digit MB and never needs to hit disk uncompressed.
echo "== pivoting MAFs into one multi-sample VCF"
python3 "$SCRIPT_DIR/maf_to_vcf.py" "$WORK/maf" - | bgzip > "${PREFIX}_mutations.vcf.gz"
tabix -f -p vcf "${PREFIX}_mutations.vcf.gz"

echo "== fetching clinical annotations"
python3 "$SCRIPT_DIR/gdc_clinical_tsv.py" "$PROJECT" "${PREFIX}_clinical.tsv"

echo "== done: ${PREFIX}_mutations.vcf.gz ($(du -h "${PREFIX}_mutations.vcf.gz" | cut -f1))"
echo "         ${PREFIX}_clinical.tsv ($(du -h "${PREFIX}_clinical.tsv" | cut -f1))"
echo "   upload with: aws s3 cp ${PREFIX}_mutations.vcf.gz{,.tbi} s3://jbrowse.org/demos/tcga/"
echo "                aws s3 cp ${PREFIX}_clinical.tsv s3://jbrowse.org/demos/tcga/"
