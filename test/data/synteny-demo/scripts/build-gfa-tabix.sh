#!/bin/bash
# Downloads source data and regenerates all GFA tabix indexes.
# Produces files ready for upload to s3://jbrowse.org/demos/gfadata/
#
# Usage:
#   bash build-gfa-tabix.sh [output-dir] [--all-chroms]
#
# Prerequisites: bgzip, tabix, sort, node (v20+), vg, curl
#
# Data sources:
#   - Volvox test data: local repo fixtures (test_data/volvox/)
#   - HPRC minigraph-cactus v1.1: per-chromosome .vg files converted to GFA
#     https://github.com/human-pangenomics/hpp_pangenome_resources
#   - PGGB chrM: https://github.com/pangenome/pggb (example data)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
OUT_DIR="${1:-$SCRIPT_DIR/../gfa-tabix-output}"
DOWNLOAD_DIR="${HPRC_DOWNLOAD_DIR:-$HOME/hprc-data}"

mkdir -p "$OUT_DIR" "$DOWNLOAD_DIR"

RUST_BINARY="$REPO_ROOT/tools/gfa-to-tabix/target/release/gfa-to-tabix"

run_gfa_tabix_ts() {
  node --experimental-strip-types -e "
    const { run } = require('$REPO_ROOT/products/jbrowse-cli/src/commands/make-gfa-tabix/index.ts');
    run(process.argv.slice(1)).catch(e => { console.error(e); process.exit(1); });
  " -- "$@"
}

run_gfa_tabix_rust() {
  "$RUST_BINARY" "$@"
}

# Build Rust binary if not present
if [ ! -f "$RUST_BINARY" ]; then
  echo "Building Rust gfa-to-tabix..."
  (cd "$REPO_ROOT/tools/gfa-to-tabix" && cargo build --release 2>&1)
fi

HPRC_S3="https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/freeze1/minigraph-cactus/hprc-v1.1-mc-grch38/hprc-v1.1-mc-grch38.chroms"

# Download per-chromosome .vg from HPRC S3, convert to GFA with vg
download_hprc_chr() {
  local chr="$1"
  local variant="${2:-}" # "d9" for d9 graphs with sequences
  local suffix="${variant:+.$variant}"
  local vg_file="$DOWNLOAD_DIR/hprc-v1.1-mc-grch38.$chr${suffix}.vg"
  local gfa_file="$DOWNLOAD_DIR/hprc-v1.1-mc-grch38.$chr${suffix}.gfa"
  if [ ! -f "$gfa_file" ]; then
    if [ ! -f "$vg_file" ]; then
      echo "   Downloading HPRC $chr${suffix} .vg..." >&2
      curl -sL "$HPRC_S3/$chr${suffix}.vg" -o "$vg_file"
    fi
    echo "   Converting $chr${suffix} .vg → .gfa with vg convert..." >&2
    vg convert -f "$vg_file" > "$gfa_file"
  fi
  echo "$gfa_file"
}

echo "=== GFA Tabix Build Script ==="
echo "Output:    $OUT_DIR"
echo "Downloads: $DOWNLOAD_DIR"
echo ""

# ── 1. Volvox pangenome (local, 4 genomes) ───────────────────────────────────

echo "── 1. Volvox indel pangenome ──"
run_gfa_tabix_rust "$REPO_ROOT/test_data/volvox/volvox_indel_pangenome.gfa" \
  "$REPO_ROOT/test_data/volvox/volvox_indel_pangenome"
echo ""

# ── 2. Synthetic 4-genome (local) ────────────────────────────────────────────

echo "── 2. Synthetic 4-genome ──"
run_gfa_tabix_rust "$REPO_ROOT/test/data/synteny-demo/synthetic/synthetic_4genome.gfa" \
  "$REPO_ROOT/test_data/volvox/synthetic_4genome"
echo ""

# ── 3. PGGB chrM (download, 4 human genomes, has sequences) ─────────────────

echo "── 3. PGGB chrM pangenome ──"
PGGB_CHRM_GFA="$DOWNLOAD_DIR/chrM.pan.4.gfa"
if [ ! -f "$PGGB_CHRM_GFA" ]; then
  echo "   Downloading from pangenome/pggb example data..."
  curl -sL "https://raw.githubusercontent.com/pangenome/pggb/master/data/chrM.pan.4.gfa" \
    -o "$PGGB_CHRM_GFA"
fi
run_gfa_tabix_rust "$PGGB_CHRM_GFA" "$OUT_DIR/pggb-chrM"
echo ""

# ── 4. HPRC minigraph-cactus chrM (90 haplotypes) ───────────────────────────

echo "── 4. HPRC minigraph-cactus chrM ──"
HPRC_CHRM="$(download_hprc_chr chrM)"
HPRC_CHRM_OUT="$OUT_DIR/hprc-v1.1-mc-grch38-chrM"
run_gfa_tabix_rust "$HPRC_CHRM" "$HPRC_CHRM_OUT" --ref-assembly 'GRCh38#0'
# Copy to repo test data for unit tests
cp "$HPRC_CHRM_OUT".pos.bed.gz      "$REPO_ROOT/test/data/synteny-demo/hprc/"
cp "$HPRC_CHRM_OUT".pos.bed.gz.tbi  "$REPO_ROOT/test/data/synteny-demo/hprc/"
cp "$HPRC_CHRM_OUT".synteny.bed.gz      "$REPO_ROOT/test/data/synteny-demo/hprc/" 2>/dev/null || true
cp "$HPRC_CHRM_OUT".synteny.bed.gz.tbi  "$REPO_ROOT/test/data/synteny-demo/hprc/" 2>/dev/null || true
echo ""

# ── 5. HPRC minigraph-cactus chr20 ──────────────────────────────────────────

echo "── 5. HPRC minigraph-cactus chr20 ──"
HPRC_CHR20="$(download_hprc_chr chr20)"
run_gfa_tabix_rust "$HPRC_CHR20" "$OUT_DIR/hprc-v1.1-mc-grch38-chr20" --ref-assembly 'GRCh38#0'
echo ""

# ── Optional: all remaining chromosomes ──────────────────────────────────────

if [ "${1:-}" = "--all-chroms" ] || [ "${2:-}" = "--all-chroms" ]; then
  for CHR in chr1 chr2 chr3 chr4 chr5 chr6 chr7 chr8 chr9 chr10 \
             chr11 chr12 chr13 chr14 chr15 chr16 chr17 chr18 chr19 \
             chr21 chr22 chrX chrY; do
    echo "── HPRC $CHR ──"
    HPRC_CHR="$(download_hprc_chr "$CHR")"
    run_gfa_tabix_rust "$HPRC_CHR" "$OUT_DIR/hprc-v1.1-mc-grch38-$CHR" --ref-assembly 'GRCh38#0'
    echo ""
  done
fi

echo ""
echo "=== Done ==="
echo ""
echo "Output files:"
find "$OUT_DIR" -maxdepth 1 \( -name "*.gz" -o -name "*.idx" -o -name "*.tbi" -o -name "*.json" \) | sort | while read f; do
  echo "  $(ls -lh "$f" | awk '{print $5}') $f"
done
echo ""
echo "To upload to S3:"
echo "  aws s3 sync $OUT_DIR/ s3://jbrowse.org/demos/gfadata/ \\"
echo "    --exclude 'downloads/*' --acl public-read"
