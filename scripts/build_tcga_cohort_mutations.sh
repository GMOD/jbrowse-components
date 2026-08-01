#!/usr/bin/env bash
#
# Reproducibly build the TCGA cohort somatic-mutation demo shown in
# website/docs/tutorials/tcga_cohort_mutations.md: every primary tumor in a TCGA
# project as one row of a multi-sample variant track, plus the samples TSV that
# groups those rows by histology and receptor subtype.
#
# All input is GDC *open-access* data, so no dbGaP token is involved:
#   - "Masked Somatic Mutation" MAFs (WXS, GDC's aliquot-merged ensemble calls
#     with germline and other risky sites masked out), already on GRCh38
#   - each case's "Clinical Supplement" XML, for the ER/PR/HER2 IHC calls
#
# The MAFs are exome only. This cohort therefore says nothing about mutation
# density between genes, and every figure built on it is a gene-scale figure.
#
# Requires: curl, python3, samtools + bgzip + tabix (htslib)
# Output:   tcga_<project>_mutations.vcf.gz (+ .tbi)
#           tcga_<project>_clinical.tsv
# Runtime:  ~10 min for BRCA (979 tumors), dominated by the GDC downloads
#
# Usage: build_tcga_cohort_mutations.sh [PROJECT] [LIMIT]
#   PROJECT  TCGA project id (default TCGA-BRCA)
#   LIMIT    only fetch the first N tumors (default: all; for a quick smoke test)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Sibling helpers this script runs, fetched next to it when absent, so a bare
# `curl -fO` of this one file behaves the same as a repo checkout.
HELPERS=(maf_to_vcf.py tcga_clinical_tsv.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

PROJECT=${1:-TCGA-BRCA}
LIMIT=${2:-0}
OUT=$(echo "$PROJECT" | tr '[:upper:]-' '[:lower:]_')_mutations
CLINICAL=$(echo "$PROJECT" | tr '[:upper:]-' '[:lower:]_')_clinical.tsv
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "== querying GDC for $PROJECT somatic mutation files"

# Every open MAF for the project, with no sample-type filter: a file query can
# only filter on what the *case* has, so `cases.samples.sample_type` would keep
# a case's metastasis MAF as readily as its primary tumor one. Which sample a MAF
# is of is in the file itself, so maf_to_vcf.py picks the cohort out of the
# barcodes it reads (and drops the replicate aliquots), and this step just takes
# everything the project has.
curl -s "https://api.gdc.cancer.gov/files" \
  -H 'Content-Type: application/json' \
  -d '{
    "filters": {"op":"and","content":[
      {"op":"in","content":{"field":"cases.project.project_id","value":["'"$PROJECT"'"]}},
      {"op":"in","content":{"field":"data_type","value":["Masked Somatic Mutation"]}},
      {"op":"in","content":{"field":"access","value":["open"]}}
    ]},
    "fields": "file_id",
    "format": "JSON",
    "size": "20000"
  }' > "$WORK/manifest.json"

python3 - "$WORK" "$LIMIT" <<'PY'
import json, sys
work, limit = sys.argv[1], int(sys.argv[2])
# sorted for a deterministic --limit slice across runs
ids = sorted(h['file_id'] for h in json.load(open(f'{work}/manifest.json'))['data']['hits'])
if limit:
    ids = ids[:limit]
with open(f'{work}/files.txt', 'w') as fh:
    fh.write('\n'.join(ids) + '\n')
print(f'   {len(ids)} MAFs')
PY

echo "== downloading MAFs"
mkdir -p "$WORK/maf"
BATCH=200
split -l $BATCH "$WORK/files.txt" "$WORK/batch."
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

# One MAF per tumor in, one multi-sample VCF out, keeping primary solid tumors
# (`01`) so the cohort matches the copy-number one. This step also runs on a MAF
# collection assembled some other way, since it needs nothing but the MAFs.
echo "== merging to one multi-sample VCF"
python3 "$SCRIPT_DIR/maf_to_vcf.py" "$WORK/maf" "$OUT.vcf" --sample-types 01

bgzip -f "$OUT.vcf"
tabix -f -p vcf "$OUT.vcf.gz"

# The clinical columns are what make the cohort groupable: without them the rows
# are 979 barcodes in alphabetical order.
echo "== fetching clinical annotation"
python3 "$SCRIPT_DIR/tcga_clinical_tsv.py" "$PROJECT" "$CLINICAL"

echo "== done: $OUT.vcf.gz ($(du -h "$OUT.vcf.gz" | cut -f1))"
echo "         $CLINICAL ($(du -h "$CLINICAL" | cut -f1))"
echo "   upload with: aws s3 cp $OUT.vcf.gz{,.tbi} s3://jbrowse.org/demos/tcga/"
echo "                aws s3 cp $CLINICAL s3://jbrowse.org/demos/tcga/"
