#!/usr/bin/env bash
# Idempotently re-indexes the fixtures Phase 0 needs.
#
# - test_data/volvox/volvox_pangenome_50.*       : primary CI fixture (small).
# - test_data/volvox/volvox_indel_pangenome.*    : SV fixture; re-indexed with
#   --bubbles when the deconstruct VCF can be generated.
# - test/data/synteny-demo/hprc/hprc-v1.1-mc-grch38-chrM.* : 44-haplotype
#   realistic case. Source .vg downloaded if missing.
#
# Builds vg .xg / odgi .og as truth-extractor caches under the *.truth-cache/
# sibling directory (created lazily by the harness — this script only ensures
# the GfaTabixAdapter inputs exist).
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

# ---- volvox_pangenome_50: ensure pos/segments/edges/bubbles all present ----

vol50_prefix="$REPO_ROOT/test_data/volvox/volvox_pangenome_50"
vol50_gfa="$vol50_prefix.gfa"

reindex_vol50=false
for f in "$vol50_prefix.pos.bed.gz" "$vol50_prefix.segments.bin" \
         "$vol50_prefix.edges.bin" "$vol50_prefix.bubbles.bed.gz"; do
  if [[ ! -f "$f" ]]; then
    reindex_vol50=true
    break
  fi
done
if $reindex_vol50; then
  echo "[volvox_pangenome_50] missing index files, re-indexing"
  if have vg && have bgzip && have tabix; then
    tmp_vcf="$(mktemp -t vol50_decon.XXXXXX.vcf.gz)"
    vg convert -g "$vol50_gfa" -p \
      | vg deconstruct -P ref -a - \
      | bgzip -c > "$tmp_vcf"
    tabix -p vcf "$tmp_vcf"
    "$BIN" --bubbles "$tmp_vcf" "$vol50_gfa" "$vol50_prefix"
    rm -f "$tmp_vcf" "$tmp_vcf.tbi"
  else
    echo "  (vg/bgzip/tabix missing — building without bubbles)"
    "$BIN" "$vol50_gfa" "$vol50_prefix"
  fi
else
  echo "[volvox_pangenome_50] indexes present, skipping"
fi

# ---- volvox_indel_pangenome: re-index with edges + bubbles ----

vol_indel_prefix="$REPO_ROOT/test_data/volvox/volvox_indel_pangenome"
vol_indel_gfa="$vol_indel_prefix.gfa"

reindex_indel=false
for f in "$vol_indel_prefix.pos.bed.gz" "$vol_indel_prefix.segments.bin" \
         "$vol_indel_prefix.edges.bin" "$vol_indel_prefix.bubbles.bed.gz"; do
  if [[ ! -f "$f" ]]; then
    reindex_indel=true
    break
  fi
done
if $reindex_indel; then
  echo "[volvox_indel_pangenome] missing index files, re-indexing"
  if have vg && have bgzip && have tabix; then
    tmp_vcf="$(mktemp -t indel_decon.XXXXXX.vcf.gz)"
    vg convert -g "$vol_indel_gfa" -p \
      | vg deconstruct -P ref -a - \
      | bgzip -c > "$tmp_vcf"
    tabix -p vcf "$tmp_vcf"
    "$BIN" --bubbles "$tmp_vcf" "$vol_indel_gfa" "$vol_indel_prefix"
    rm -f "$tmp_vcf" "$tmp_vcf.tbi"
  else
    echo "  (vg missing — building without bubbles)"
    "$BIN" "$vol_indel_gfa" "$vol_indel_prefix"
  fi
else
  echo "[volvox_indel_pangenome] indexes present, skipping"
fi

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

reindex_hprc=false
for f in "$hprc_chrm_prefix.pos.bed.gz" "$hprc_chrm_prefix.segments.bin" \
         "$hprc_chrm_prefix.edges.bin"; do
  if [[ ! -f "$f" ]]; then
    reindex_hprc=true
    break
  fi
done
if [[ -f "$hprc_chrm_gfa" ]] && $reindex_hprc; then
  echo "[hprc-chrM] re-indexing"
  if have vg && have bgzip && have tabix; then
    tmp_vcf="$(mktemp -t hprc_chrM_decon.XXXXXX.vcf.gz)"
    vg deconstruct -P GRCh38 -a "$hprc_chrm_vg" 2>/dev/null \
      | bgzip -c > "$tmp_vcf"
    tabix -p vcf "$tmp_vcf" 2>/dev/null || true
    "$BIN" --bubbles "$tmp_vcf" "$hprc_chrm_gfa" "$hprc_chrm_prefix"
    rm -f "$tmp_vcf" "$tmp_vcf.tbi"
  else
    "$BIN" "$hprc_chrm_gfa" "$hprc_chrm_prefix"
  fi
elif [[ -f "$hprc_chrm_gfa" ]]; then
  echo "[hprc-chrM] indexes present, skipping"
else
  echo "[hprc-chrM] source GFA unavailable, skipping"
fi

echo ""
echo "Fixture status:"
for prefix in "$vol50_prefix" "$vol_indel_prefix" "$hprc_chrm_prefix"; do
  echo "  $prefix:"
  for ext in pos.bed.gz segments.bin edges.bin bubbles.bed.gz; do
    if [[ -f "$prefix.$ext" ]]; then
      printf "    %-20s %s\n" "$ext" "$(stat -c %s "$prefix.$ext") bytes"
    else
      printf "    %-20s missing\n" "$ext"
    fi
  done
done
