#!/usr/bin/env bash
# Idempotently re-indexes the GfaTabix fixtures used by browser tests.
#
# - test_data/volvox/volvox_pangenome_50.*       : primary CI fixture (small).
# - test_data/volvox/volvox_indel_pangenome.*    : SV fixture.
# - test/data/synteny-demo/hprc/hprc-v1.1-mc-grch38-chrM.* : 44-haplotype
#   realistic case. Source .vg downloaded if missing.
#
# Usage:
#   bash tools/gfa-to-tabix/prepare-fixtures.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BIN="$SCRIPT_DIR/target/release/gfa-to-tabix"

if [[ ! -x "$BIN" ]]; then
  echo "Building gfa-to-tabix release binary..."
  (cd "$SCRIPT_DIR" && cargo build --release)
fi

have() {
  command -v "$1" >/dev/null 2>&1
}

reindex_if_missing() {
  local prefix="$1"
  local gfa="$2"
  for f in "$prefix.pos.bed.gz" "$prefix.synteny.bed.gz" \
           "$prefix.edges.spatial.bed.gz"; do
    if [[ ! -f "$f" ]]; then
      echo "[$(basename "$prefix")] missing index files, re-indexing"
      "$BIN" "$gfa" "$prefix"
      return
    fi
  done
  echo "[$(basename "$prefix")] indexes present, skipping"
}

# ---- volvox_pangenome_50 ----

vol50_prefix="$REPO_ROOT/test_data/volvox/volvox_pangenome_50"
reindex_if_missing "$vol50_prefix" "$vol50_prefix.gfa"

# ---- volvox_indel_pangenome ----

vol_indel_prefix="$REPO_ROOT/test_data/volvox/volvox_indel_pangenome"
reindex_if_missing "$vol_indel_prefix" "$vol_indel_prefix.gfa"

# ---- HPRC chrM: download .vg, convert to GFA, re-index ----

hprc_dir="$REPO_ROOT/test/data/synteny-demo/hprc"
hprc_chrm_prefix="$hprc_dir/hprc-v1.1-mc-grch38-chrM"
hprc_chrm_vg="$hprc_chrm_prefix.vg"
hprc_chrm_gfa="$hprc_chrm_prefix.gfa"
hprc_chrm_url="https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/freeze1/minigraph-cactus/hprc-v1.1-mc-grch38/hprc-v1.1-mc-grch38.chroms/chrM.vg"

mkdir -p "$hprc_dir"
if [[ ! -f "$hprc_chrm_vg" ]] && [[ ! -f "$hprc_chrm_gfa" ]]; then
  if have curl; then
    echo "[hprc-chrM] downloading .vg from HPRC bucket"
    curl -fL -o "$hprc_chrm_vg" "$hprc_chrm_url"
  else
    echo "[hprc-chrM] curl not available, skipping download"
  fi
fi
if [[ -f "$hprc_chrm_vg" ]] && [[ ! -f "$hprc_chrm_gfa" ]]; then
  if have vg; then
    echo "[hprc-chrM] converting .vg → .gfa"
    vg view -g "$hprc_chrm_vg" > "$hprc_chrm_gfa.tmp"
    mv "$hprc_chrm_gfa.tmp" "$hprc_chrm_gfa"
  fi
fi
if [[ -f "$hprc_chrm_gfa" ]]; then
  reindex_if_missing "$hprc_chrm_prefix" "$hprc_chrm_gfa"
else
  echo "[hprc-chrM] source GFA unavailable, skipping"
fi

echo ""
echo "Fixture status:"
for prefix in "$vol50_prefix" "$vol_indel_prefix" "$hprc_chrm_prefix"; do
  echo "  $prefix:"
  for ext in pos.bed.gz synteny.bed.gz edges.spatial.bed.gz; do
    if [[ -f "$prefix.$ext" ]]; then
      printf "    %-30s %s\n" "$ext" "$(stat -c %s "$prefix.$ext") bytes"
    else
      printf "    %-30s missing\n" "$ext"
    fi
  done
done
