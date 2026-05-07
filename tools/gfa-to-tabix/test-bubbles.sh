#!/bin/bash
# Tests that gfa-to-tabix --bubbles produces correct per-genome bubble rows.
# Run after `cargo build --release`.
#
# Usage: bash tools/gfa-to-tabix/test-bubbles.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BINARY="$REPO_ROOT/tools/gfa-to-tabix/target/release/gfa-to-tabix"
GFA="$REPO_ROOT/test_data/volvox/volvox_pangenome_50.gfa"
VCF_DIR="$REPO_ROOT/test_data/volvox"
WORK_DIR="$(mktemp -d)"
PASS=0
FAIL=0

cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

# Generate a raw VCF with PanSN CHROM names via vg deconstruct.
# The saved .vcf.gz has stripped names (for the JBrowse variant track),
# so we must produce a fresh one with full PanSN paths.
if ! command -v vg &>/dev/null; then
  echo "SKIP: vg not installed"
  exit 0
fi

echo "Generating VCF via vg deconstruct..."
VG_FILE="$WORK_DIR/graph.vg"
VCF="$WORK_DIR/variants.vcf.gz"
vg convert -g "$GFA" -p > "$VG_FILE"
REF_PREFIX="$(vg paths -L -x "$VG_FILE" | grep "^ref" | head -1 | cut -d'#' -f1-2)"
vg deconstruct -P "$REF_PREFIX" -a "$VG_FILE" | bgzip -c > "$VCF"
tabix -p vcf "$VCF"

if [ ! -f "$BINARY" ]; then
  echo "Building gfa-to-tabix..."
  (cd "$REPO_ROOT/tools/gfa-to-tabix" && cargo build --release 2>&1)
fi

echo "=== gfa-to-tabix --bubbles tests ==="

OUT="$WORK_DIR/volvox_pangenome_50"
"$BINARY" "$GFA" "$OUT" --bubbles "$VCF" 2>/dev/null

check() {
  local desc="$1"
  local cond="$2"
  if eval "$cond"; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc"
    FAIL=$((FAIL + 1))
  fi
}

BUBBLES="$OUT.bubbles.bed.gz"

check "bubbles.bed.gz exists" "[ -f '$BUBBLES' ]"
check "bubbles.bed.gz.tbi exists" "[ -f '$BUBBLES.tbi' ]"

# Header has #genomes line with 50 samples (no ref — VCF convention)
HEADER="$(zcat "$BUBBLES" | head -1 || true)"
check "header starts with #genomes=" "echo \"$HEADER\" | grep -q '^#genomes='"

GENOME_COUNT="$(echo "$HEADER" | sed 's/#genomes=//' | tr ',' '\n' | wc -l)"
check "header lists 50 genomes" "[ $GENOME_COUNT -eq 50 ]"

# Data records exist
RECORD_COUNT="$(zcat "$BUBBLES" | grep -cv '^#')"
check "has data records" "[ $RECORD_COUNT -gt 0 ]"

# Per-genome PanSN names in chrom column (the key feature)
UNIQUE_CHROMS="$(zcat "$BUBBLES" | grep -v '^#' | cut -f1 | sort -u)"
CHROM_COUNT="$(echo "$UNIQUE_CHROMS" | wc -l)"
check "bubbles indexed for multiple genomes (not just ref)" "[ $CHROM_COUNT -gt 1 ]"
check "bubbles indexed for all 51 genomes (ref + 50 samples)" "[ $CHROM_COUNT -eq 51 ]"

# Specific genomes present
check "ref#0#ctgA in bubbles" "echo \"$UNIQUE_CHROMS\" | grep -q 'ref#0#ctgA'"
check "sample01#0#ctgA in bubbles" "echo \"$UNIQUE_CHROMS\" | grep -q 'sample01#0#ctgA'"
check "sample50#0#ctgA in bubbles" "echo \"$UNIQUE_CHROMS\" | grep -q 'sample50#0#ctgA'"

# Records have correct column count (9 columns)
BAD_COLS="$(zcat "$BUBBLES" | grep -v '^#' | awk -F'\t' 'NF != 9' | wc -l)"
check "all records have 9 tab-separated columns" "[ $BAD_COLS -eq 0 ]"

# CS column (col 7) is non-empty for most records
EMPTY_CS="$(zcat "$BUBBLES" | grep -v '^#' | awk -F'\t' '$7 == ""' | wc -l)"
check "fewer than 10% of records have empty CS" "[ $EMPTY_CS -lt $((RECORD_COUNT / 10)) ]"

# Tabix can query each genome
REF_HITS="$(tabix "$BUBBLES" ref#0#ctgA:0-1000 2>/dev/null | wc -l)"
check "tabix query from ref returns records" "[ $REF_HITS -gt 0 ]"

SAMPLE_HITS="$(tabix "$BUBBLES" sample01#0#ctgA:0-1000 2>/dev/null | wc -l)"
check "tabix query from sample01 returns records" "[ $SAMPLE_HITS -gt 0 ]"

# other output files also generated
check "pos.bed.gz exists" "[ -f '$OUT.pos.bed.gz' ]"
check "synteny.bed.gz exists" "[ -f '$OUT.synteny.bed.gz' ]"
check "edges.spatial.bed.gz exists" "[ -f '$OUT.edges.spatial.bed.gz' ]"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
