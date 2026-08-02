#!/bin/bash
#
# Upload the somatic-rearrangement demo data + config to jbrowse.org/demos/cancer_sv/,
# the hosted instance the cancer_sv screenshot specs (website/scripts/specs/cancer_sv.ts)
# and the tutorial's figure links render against.
#
# Run scripts/build_cancer_sv_demo.sh first; it writes everything below into its
# own <outdir>/demo. Point this at that directory.
#
# Usage: bash website/scripts/upload-cancer-sv-demo.sh [localdir]   # default ./cancer_sv_build/demo
set -euo pipefail

SRC="${1:-cancer_sv_build/demo}"
DEST=s3:jbrowse.org/demos/cancer_sv
CF_DISTRIBUTION=E13LGELJOT4GQO   # same distribution as deploy_staging.sh
HERE=$(cd "$(dirname "$0")/.." && pwd)   # website/ (holds rclone.conf)

# Files the specs reference by exact name. The derivative assembly, its
# reference-alignment PIF, the labelled segment BED and the realigned reads all
# come out of scripts/sv_multihop.py; the STAR-Fusion TSV and the copy-number
# bigWig out of scripts/depmap_to_jbrowse.py. The COLO829 tumour CRAM and the
# matched-normal BAM are NOT here: the config streams those from the ONT
# open-data bucket rather than rehosting ~100 GB.
EXPECTED=(
  COLO829.somatic-sv.vcf.gz
  COLO829.somatic-sv.vcf.gz.tbi
  COLO829_tumor.coverage.bw
  COLO829_normal.coverage.bw
  der3_RARB.derivative.fa.gz
  der3_RARB.derivative.fa.gz.fai
  der3_RARB.derivative.fa.gz.gzi
  der3_RARB.derivative_segments.bed.gz
  der3_RARB.derivative_segments.bed.gz.tbi
  der3_RARB.vs_reference.paf
  der3_RARB.vs_reference.pif.gz
  der3_RARB.vs_reference.pif.gz.tbi
  der3_RARB.reads_vs_derivative.bam
  der3_RARB.reads_vs_derivative.bam.bai
  K562.star-fusion.tsv
  K562_cn.bw
  K562_isoseq.bam
  K562_isoseq.bam.bai
  config.json
)

missing=0
for f in "${EXPECTED[@]}"; do
  [ -f "$SRC/$f" ] || { echo "missing: $SRC/$f"; missing=1; }
done
[ "$missing" -eq 0 ] || { echo "Build the demo into $SRC/ first."; exit 1; }

# `copy`, deliberately NOT `sync`. The bucket has no versioning, so a `sync` from
# a partial staging dir deletes whatever it does not contain and the deletion is
# neither reviewable nor recoverable -- that is how demos/ecoli_pangenome lost
# tracks and started failing with "Could not resolve identifier". `copy` only
# adds and overwrites; deleting anything here is a deliberate, manual act.
echo "Copying $SRC/ -> $DEST (dry run first)"
rclone --config "$HERE/rclone.conf" copy "$SRC" "$DEST" --checksum --fast-list --dry-run
read -r -p "Proceed with the upload above? [y/N] " ok
[ "$ok" = y ] || { echo "aborted"; exit 1; }
rclone --config "$HERE/rclone.conf" copy "$SRC" "$DEST" --checksum --fast-list --progress
aws cloudfront create-invalidation --distribution-id "$CF_DISTRIBUTION" --paths "/demos/cancer_sv/*"
echo "Done. Regenerate the figures: cd website && pnpm screenshots --filter cancer_sv"
