#!/bin/bash
# Builds the volvox 50-sample pangenome test data using pggb.
#
# Pipeline:
#   1. Generate 50 mutated FASTA assemblies from volvox ctgA
#   2. Run pggb (via singularity) to build a pangenome graph
#   3. Run gfa-to-tabix to produce indexed files
#
# Prerequisites: singularity, vg, samtools, node (v20+)
#
# Usage:
#   bash scripts/build-volvox-pangenome.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$REPO_ROOT/test_data/volvox"
WORK_DIR="$(mktemp -d)"
RUST_BINARY="$REPO_ROOT/tools/gfa-to-tabix/target/release/gfa-to-tabix"
PGGB_IMG="docker://ghcr.io/pangenome/pggb:latest"
NUM_SAMPLES=50
PREFIX="volvox_pangenome_50"

cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

echo "=== Building volvox ${NUM_SAMPLES}-sample pangenome ==="
echo "Work dir: $WORK_DIR"

# Build Rust tool if needed
if [ ! -f "$RUST_BINARY" ]; then
  echo "Building gfa-to-tabix..."
  (cd "$REPO_ROOT/tools/gfa-to-tabix" && cargo build --release 2>&1)
fi

# Step 1: Generate mutated FASTAs
echo ""
echo "── Step 1: Generating ${NUM_SAMPLES} mutated assemblies ──"
node --experimental-strip-types "$SCRIPT_DIR/generate-volvox-pangenome.ts" \
  "$WORK_DIR/assemblies"

echo "  Created $(ls "$WORK_DIR/assemblies/"*.fa | wc -l) FASTA files"

# Step 2: Build combined FASTA with PanSN-compatible names and run pggb
echo ""
echo "── Step 2: Running pggb ──"

# pggb needs a single multisample FASTA with samtools faidx
cat "$WORK_DIR/assemblies/"*.fa > "$WORK_DIR/combined.fa"
samtools faidx "$WORK_DIR/combined.fa"

echo "  Combined FASTA: $(wc -l < "$WORK_DIR/combined.fa.fai") sequences"

singularity exec "$PGGB_IMG" pggb \
  -i "$WORK_DIR/combined.fa" \
  -o "$WORK_DIR/pggb_out" \
  -n "$((NUM_SAMPLES + 1))" \
  -t "$(nproc)" \
  -p 90 \
  -s 1000 \
  -S \
  2>&1 | tail -5

# Find the output GFA
PGGB_GFA="$(ls "$WORK_DIR/pggb_out/"*.smooth.final.gfa 2>/dev/null | head -1)"
if [ -z "$PGGB_GFA" ]; then
  PGGB_GFA="$(ls "$WORK_DIR/pggb_out/"*.gfa 2>/dev/null | head -1)"
fi
if [ -z "$PGGB_GFA" ]; then
  echo "ERROR: pggb did not produce a GFA file"
  ls -la "$WORK_DIR/pggb_out/"
  exit 1
fi
echo "  pggb GFA: $PGGB_GFA"

# Copy GFA to output
cp "$PGGB_GFA" "$OUT_DIR/$PREFIX.gfa"

# Step 3: gfa-to-tabix
echo ""
echo "── Step 3: Running gfa-to-tabix ──"

"$RUST_BINARY" "$OUT_DIR/$PREFIX.gfa" "$OUT_DIR/$PREFIX"

echo ""
echo "=== Done ==="
echo "Output files in $OUT_DIR/$PREFIX.*:"
ls -lh "$OUT_DIR/$PREFIX."* 2>/dev/null | awk '{print "  " $5 "\t" $NF}'
