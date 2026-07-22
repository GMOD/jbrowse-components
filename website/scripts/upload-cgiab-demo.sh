#!/bin/bash
#
# Upload the C-GIAB somatic-CNV demo data + config to jbrowse.org/demos/cgiab/,
# the hosted instance the sv_cgiab screenshot specs (website/scripts/specs/sv.ts,
# synteny.ts) and the tutorial's "live demo" link render against.
#
# Run scripts/build_sv_visualization_cgiab.sh first to produce the tracks, then
# stage the files this script expects into a local dir (default ./cgiab_demo) and
# run this. Mirrors deploy_staging.sh: rclone sync (content-hash, only changed
# files) + a CloudFront invalidation so the CDN serves the new data immediately.
#
# Usage: bash website/scripts/upload-cgiab-demo.sh [localdir]   # default ./cgiab_demo
set -euo pipefail

SRC="${1:-cgiab_demo}"
DEST=s3:jbrowse.org/demos/cgiab
CF_DISTRIBUTION=E13LGELJOT4GQO   # same distribution as deploy_staging.sh
HERE=$(cd "$(dirname "$0")/.." && pwd)   # website/ (holds rclone.conf)

# Files the screenshot specs reference by exact name (see the CGIAB helpers in
# screenshot-spec-helpers.ts). The depth bigWig is HiFiCNV's (rename its
# hificnv.<sample>.depth.bw output); the BAF bigWig is the unfolded 0..1 track
# the build script pileups over germline het sites, deliberately not HiFiCNV's
# folded maf.bw; the PIF comes from `jbrowse make-pif HG008T_v3.2.paf`.
# config.json is the hosted demo config (V0.5 benchmark + HG008T_v3.2 assembly
# + the HiFiCNV/BAF/Wakhan tracks).
EXPECTED=(
  HG008-T.hificnv.depth.bw
  HG008-T_baf.bcftools.bw
  HG008T_v3.2.pif.gz
  HG008T_v3.2.pif.gz.tbi
  HG008T_v3.2.fasta.gz
  HG008T_v3.2.fasta.gz.fai
  HG008T_v3.2.fasta.gz.gzi
  GRCh38_HG008-T-V0.5_somatic-CNV_PASS.draftbenchmark.calls.bed
  config.json
)

missing=0
for f in "${EXPECTED[@]}"; do
  [ -f "$SRC/$f" ] || { echo "missing: $SRC/$f"; missing=1; }
done
[ "$missing" -eq 0 ] || { echo "Stage the files above into $SRC/ first."; exit 1; }

# `copy`, deliberately NOT `sync`. The staged dir holds only the files a build
# regenerates, but demos/cgiab also serves things built by other recipes (the
# CUZD1 read slice, the indexcov bigWigs, the readpair .hic matrices) that the
# figure specs reference by URL. `sync` deletes remote files absent from $SRC,
# so it would silently drop every one of them. `copy` only adds and overwrites.
# Deleting anything under demos/cgiab is a deliberate, manual act.
echo "Copying $SRC/ -> $DEST (dry run first)"
rclone --config "$HERE/rclone.conf" copy "$SRC" "$DEST" --checksum --fast-list --dry-run
read -r -p "Proceed with the upload above? [y/N] " ok
[ "$ok" = y ] || { echo "aborted"; exit 1; }
rclone --config "$HERE/rclone.conf" copy "$SRC" "$DEST" --checksum --fast-list --progress
aws cloudfront create-invalidation --distribution-id "$CF_DISTRIBUTION" --paths "/demos/cgiab/*"
echo "Done. Regenerate the figures: cd website && pnpm screenshots --filter sv_cgiab"
