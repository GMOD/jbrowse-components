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
# The cohort recurrence bedGraph is derived from that BED at the end, by
# cnv_recurrence.py: no extra download, and it answers the question the stacked
# figure cannot, which is what fraction of the cohort carries each event.
#
# The same step runs a second time split by a clinical column, which turns the
# one frequency profile into one per group: a bedGraph column pair per group,
# which a MultiQuantitativeTrack draws as one row each.
#
# The same segments are written a second way, as a samples-by-bins Zarr store,
# which is what the whole-genome view actually wants: the BED has to return every
# segment of every tumor for that view, while the matrix reads one level of a
# resolution pyramid. Skipped when node is absent — the BED and the bedGraphs
# above stand on their own.
#
# Requires: curl, python3, bgzip + tabix (htslib); node >=22 for the Zarr store
# Output:   tcga_<project>_cnv.bed.gz (+ .tbi)
#           tcga_<project>_cnv_recurrence.bedGraph.gz (+ .tbi)
#           tcga_<project>_cnv_recurrence_by_<groupby>.bedGraph.gz (+ .tbi)
#           tcga_<project>_clinical.tsv
#           tcga_<project>_cnv.zarr/
# Runtime:  ~15-25 min for BRCA (1106 tumors), dominated by the GDC downloads
#
# Usage: build_tcga_cohort_cnv.sh [PROJECT] [LIMIT] [GROUPBY]
#   PROJECT  TCGA project id (default TCGA-BRCA)
#   LIMIT    only fetch the first N tumors (default: all; for a quick smoke test)
#   GROUPBY  clinical column to split recurrence by (default subtype, which is
#            breast specific; histology and stage are harmonized across projects)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Sibling helpers this script runs, fetched next to it when absent, so a bare
# `curl -fO` of this one file behaves the same as a repo checkout.
HELPERS=(cnv_recurrence.py tcga_clinical_tsv.py build_signal_zarr.ts)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

PROJECT=${1:-TCGA-BRCA}
LIMIT=${2:-0}
GROUPBY=${3:-subtype}
SLUG=$(echo "$PROJECT" | tr '[:upper:]-' '[:lower:]_')
OUT=${SLUG}_cnv
CLINICAL=${SLUG}_clinical.tsv
# A group's per-bin percentage is only worth plotting once the group is big
# enough for it to mean something; the smoke-test path keeps every group so that
# a 20-tumor run still exercises the grouped output end to end.
MIN_GROUP=20
[ "$LIMIT" -eq 0 ] || MIN_GROUP=1
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

# The stacked track shows where events are; at 1000+ rows in a few hundred pixels
# it cannot show how many tumors carry them. This collapses the same file into
# per-bin gain/loss frequencies, which is that missing axis.
echo "== summarizing cohort recurrence"
python3 "$SCRIPT_DIR/cnv_recurrence.py" "$OUT.bed.gz" "${OUT}_recurrence.bedGraph"
bgzip -f "${OUT}_recurrence.bedGraph"
tabix -f -p bed "${OUT}_recurrence.bedGraph.gz"

# The same clinical table the mutation cohort groups its matrix rows by, built
# by the same helper with the same arguments, so one hosted copy serves both
# tracks and a tumor means the same thing in each.
echo "== fetching clinical annotation"
python3 "$SCRIPT_DIR/tcga_clinical_tsv.py" "$PROJECT" "$CLINICAL"

# One frequency profile per clinical group, in one file: cnv_recurrence.py gives
# each group its own gain/loss column pair, BedGraphTabixAdapter reads every
# column past `end` as its own signal, and MultiQuantitativeTrack draws one row
# per signal. Same cutoffs and same denominator convention as the pooled file
# above, so a group's row and the cohort row can be read against each other.
echo "== summarizing recurrence by $GROUPBY"
BY="${OUT}_recurrence_by_${GROUPBY}.bedGraph"
python3 "$SCRIPT_DIR/cnv_recurrence.py" "$OUT.bed.gz" "$BY" \
  --groups "$CLINICAL:$GROUPBY" --min-group "$MIN_GROUP"
bgzip -f "$BY"
tabix -f -p bed "$BY.gz"

# One row per tumor again, but binned rather than as intervals. The pyramid is
# spaced ~3x rather than 10x because the adapter takes the coarsest level whose
# bins are still no wider than a screen pixel: a 10x gap leaves a view landing
# just under a level's bin size fetching up to 10x more bins than it can draw.
#
# --samples here is only a name<TAB>group table (no URLs); it fixes the row order
# and hands each tumor its clinical group, which is what the clustering sidebar
# groups on and what "color by" keys on.
if command -v node >/dev/null 2>&1; then
  echo "== building the signal matrix"
  awk -F'\t' -v col="$GROUPBY" '
    NR==1 { for (i = 1; i <= NF; i++) if ($i == col) c = i; next }
    c     { print $1 "\t" $c }' "$CLINICAL" > "$WORK/samples_group.tsv"
  # The base level is held in memory whole while every coarser one is derived
  # from it: 1104 tumors x 10kb bins is ~1.3 GB, so the default heap is not
  # enough at cohort scale.
  node --max-old-space-size=6144 "$SCRIPT_DIR/build_signal_zarr.ts" \
    --bed "$OUT.bed.gz" --sample-column sample --value-column segmean \
    --samples "$WORK/samples_group.tsv" \
    --out "$OUT.zarr" \
    --levels 10000,30000,100000,300000,1000000,3000000
else
  echo "== skipping the signal matrix (node not found)"
fi

echo "== done: $OUT.bed.gz ($(du -h "$OUT.bed.gz" | cut -f1))"
echo "         ${OUT}_recurrence.bedGraph.gz ($(du -h "${OUT}_recurrence.bedGraph.gz" | cut -f1))"
echo "         $BY.gz ($(du -h "$BY.gz" | cut -f1))"
echo "         $CLINICAL ($(du -h "$CLINICAL" | cut -f1))"
[ -d "$OUT.zarr" ] && echo "         $OUT.zarr ($(du -sh "$OUT.zarr" | cut -f1))"
echo "   upload with: aws s3 cp $OUT.bed.gz{,.tbi} s3://jbrowse.org/demos/tcga/"
echo "                aws s3 cp ${OUT}_recurrence.bedGraph.gz{,.tbi} s3://jbrowse.org/demos/tcga/"
echo "                aws s3 cp $BY.gz{,.tbi} s3://jbrowse.org/demos/tcga/"
[ -d "$OUT.zarr" ] && echo "                aws s3 cp --recursive $OUT.zarr s3://jbrowse.org/demos/tcga/$OUT.zarr"
