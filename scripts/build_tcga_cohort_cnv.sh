#!/usr/bin/env bash
#
# Reproducibly build the TCGA cohort copy-number demo shown in
# website/docs/tutorials/tcga_cohort_cnv.md: every primary tumor in a TCGA
# project as one row of a LinearMultiRowFeatureDisplay.
#
# All input is GDC *open-access* "Masked Copy Number Segment" data (SNP 6.0
# arrays, already harmonized to GRCh38), so no dbGaP token or controlled-access
# request is needed. The germline CNV masking is GDC's, not ours.
#
# The reshaping is deliberately trivial: concatenate every sample's segments and
# tag each row with its TCGA barcode. Segment_Mean is the caller's log2 ratio and
# is carried through as-is, with no re-normalization: JBrowse plots what the
# caller called.
#
# Requires: curl, python3, bgzip + tabix (htslib)
# Output:   tcga_<project>_cnv.bed.gz (+ .tbi)
# Runtime:  ~10-20 min for BRCA (1106 tumors), dominated by the GDC downloads
#
# Usage: build_tcga_cohort_cnv.sh [PROJECT] [LIMIT]
#   PROJECT  TCGA project id (default TCGA-BRCA)
#   LIMIT    only fetch the first N tumors (default: all; for a quick smoke test)

set -euo pipefail

PROJECT=${1:-TCGA-BRCA}
LIMIT=${2:-0}
OUT=$(echo "$PROJECT" | tr '[:upper:]-' '[:lower:]_')_cnv
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "== querying GDC for $PROJECT primary-tumor segment files"

# One manifest query: file_id -> TCGA barcode. Restricted to primary tumors, so
# the matched blood normals (which double the file count and have no somatic CNV)
# are left out.
curl -s 'https://api.gdc.cancer.gov/files' \
  -H 'Content-Type: application/json' \
  -d '{
    "filters": {"op":"and","content":[
      {"op":"in","content":{"field":"cases.project.project_id","value":["'"$PROJECT"'"]}},
      {"op":"in","content":{"field":"data_type","value":["Masked Copy Number Segment"]}},
      {"op":"in","content":{"field":"cases.samples.sample_type","value":["Primary Tumor"]}},
      {"op":"in","content":{"field":"access","value":["open"]}}
    ]},
    "fields": "file_id,cases.samples.submitter_id",
    "format": "JSON",
    "size": "20000"
  }' > "$WORK/manifest.json"

python3 - "$WORK" "$LIMIT" <<'PY'
import json, sys
work, limit = sys.argv[1], int(sys.argv[2])
hits = json.load(open(f'{work}/manifest.json'))['data']['hits']
rows = []
for h in hits:
    bc = h['cases'][0]['samples'][0]['submitter_id']
    rows.append((h['file_id'], bc))

# A few cases carry replicate aliquots for one sample (two array runs of the
# same tumor). partitionField would put both in the same row, painting
# overlapping segments on top of each other, so keep one file per barcode.
# Sorting by file_id first makes the choice deterministic across runs.
rows.sort()
seen = set()
deduped = []
for fid, bc in rows:
    if bc not in seen:
        seen.add(bc)
        deduped.append((fid, bc))
dups = len(rows) - len(deduped)
rows = sorted(deduped, key=lambda r: r[1])   # stable order -> reproducible output
if limit:
    rows = rows[:limit]
with open(f'{work}/files.tsv', 'w') as fh:
    for fid, bc in rows:
        fh.write(f'{fid}\t{bc}\n')
print(f'   {len(rows)} tumors' + (f' ({dups} replicate aliquots dropped)' if dups else ''))
PY

# GDC's /data endpoint takes a POST of many ids and streams back one tar.gz, so
# the whole cohort arrives in a handful of requests rather than one per sample.
# Batches stay modest because the response is built server-side before it streams.
echo "== downloading segments"
mkdir -p "$WORK/seg"
BATCH=150
cut -f1 "$WORK/files.tsv" | split -l $BATCH - "$WORK/batch."
for b in "$WORK"/batch.*; do
  # build the payload in python: joining ids in shell is easy to get wrong
  # (paste -d takes a cyclic *list* of delimiters, not one separator)
  python3 -c 'import json,sys; print(json.dumps({"ids":[l.strip() for l in open(sys.argv[1]) if l.strip()]}))' "$b" > "$b.json"
  # no --strip-components: GDC lays the tar out as <file_id>/<name>.seg.txt and
  # the reshape step below keys on that directory name to recover the barcode
  curl -s --retry 3 --retry-delay 5 'https://api.gdc.cancer.gov/data' \
    -H 'Content-Type: application/json' \
    -d @"$b.json" \
    | tar xz -C "$WORK/seg" \
    || echo "   warning: batch $(basename "$b") failed, continuing"
  echo -n '.'
done
echo

echo "== reshaping to one BED"
python3 - "$WORK" "$OUT" <<'PY'
import csv, os, sys
work, out = sys.argv[1], sys.argv[2]

# file_id -> barcode; GDC unpacks each file into a dir named for its id
bc = dict(l.rstrip('\n').split('\t') for l in open(f'{work}/files.tsv'))

rows = []
missing = 0
for fid, barcode in bc.items():
    d = os.path.join(work, 'seg', fid)
    if not os.path.isdir(d):
        missing += 1
        continue
    seg = next((os.path.join(d, f) for f in os.listdir(d) if f.endswith('.txt')), None)
    if seg is None:
        missing += 1
        continue
    with open(seg) as fh:
        for r in csv.DictReader(fh, delimiter='\t'):
            chrom = r['Chromosome']
            # GDC seg files use bare contig names; the BED needs to match the
            # hg38 assembly's refNames, which are chr-prefixed
            chrom = chrom if chrom.startswith('chr') else f'chr{chrom}'
            # .seg Start is 1-based inclusive; BED start is 0-based half-open
            start = int(r['Start']) - 1
            end = int(r['End'])
            mean = float(r['Segment_Mean'])
            # name shown in the feature detail popup
            rows.append((chrom, start, end, f'{mean:+.2f}', barcode, f'{mean:.4f}'))

rows.sort(key=lambda x: (x[0], x[1]))
with open(f'{out}.bed', 'w') as fh:
    fh.write('#chrom\tstart\tend\tname\tsample\tsegmean\n')
    for r in rows:
        fh.write('\t'.join(str(x) for x in r) + '\n')
print(f'   {len(rows)} segments from {len(bc) - missing} tumors'
      + (f' ({missing} files missing)' if missing else ''))
PY

# already sorted: python sorts (chrom, start) bytewise-then-numeric, which is
# exactly what tabix wants (and what LC_COLLATE=C sort -k1,1 -k2,2n would give)
bgzip -f "$OUT.bed"
tabix -f -p bed "$OUT.bed.gz"

echo "== done: $OUT.bed.gz ($(du -h "$OUT.bed.gz" | cut -f1))"
echo "   upload with: aws s3 cp $OUT.bed.gz{,.tbi} s3://jbrowse.org/demos/tcga/"
