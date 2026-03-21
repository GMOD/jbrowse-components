#!/bin/bash
# Builds a pangenome GFA from Arabidopsis thaliana chromosome 1 using PGGB.
# Uses only chr1 from each ecotype for speed (~30MB per genome instead of ~120MB).
#
# Ecotypes: Col-0 (TAIR10), Ler-0, Cvi-0, Eri-1
#
# Requires: datasets (NCBI), samtools, bgzip, singularity, python3
# Usage: bash build-arabidopsis-pggb-chr1.sh [output-dir]

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="${1:-/tmp/arabidopsis-pggb-chr1}"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
THREADS="${THREADS:-$(nproc)}"

mkdir -p "$OUT_DIR"

PGGB_IMAGE="docker://ghcr.io/pangenome/pggb:latest"
PGGB_SIF="$OUT_DIR/pggb.sif"

# Chr1 accession per genome
declare -A CHR1_ACC=(
  [Col-0]="NC_003070.9"
  [Ler]="CM004359.1"
  [Cvi]="CP138176.1"
  [Eri]="LR699765.1"
)

declare -A NCBI_ACC=(
  [Col-0]="GCF_000001735.4"
  [Ler]="GCA_001651475.1"
  [Cvi]="GCA_036942575.1"
  [Eri]="GCA_902460315.1"
)

GENOMES=(Col-0 Ler Cvi Eri)

# ── Step 1: Download FASTAs ──────────────────────────────────────────────────

echo "=== Step 1: Download FASTAs from NCBI ==="
# Reuse from full pipeline if available
SRC_DIR="/tmp/arabidopsis-pggb"
for NAME in "${GENOMES[@]}"; do
  RAW="$OUT_DIR/${NAME}.raw.fa"
  if [ -f "$RAW" ]; then
    echo "  $NAME: already downloaded"
    continue
  fi
  if [ -f "$SRC_DIR/${NAME}.raw.fa" ]; then
    cp "$SRC_DIR/${NAME}.raw.fa" "$RAW"
    echo "  $NAME: copied from $SRC_DIR"
    continue
  fi
  if [ -f "/tmp/arabidopsis-allvsall/${NAME}.raw.fa" ]; then
    cp "/tmp/arabidopsis-allvsall/${NAME}.raw.fa" "$RAW"
    echo "  $NAME: copied from /tmp/arabidopsis-allvsall"
    continue
  fi
  ACC="${NCBI_ACC[$NAME]}"
  echo "  $NAME ($ACC)..."
  datasets download genome accession "$ACC" --include genome \
    --filename "$OUT_DIR/${NAME}.zip"
  unzip -o -j "$OUT_DIR/${NAME}.zip" "ncbi_dataset/data/$ACC/*.fna" \
    -d "$OUT_DIR/"
  mv "$OUT_DIR"/*.fna "$RAW"
  rm -rf "$OUT_DIR/${NAME}.zip" "$OUT_DIR/README.md" "$OUT_DIR/md5sum.txt"
done

# ── Step 2: Extract chr1 with PanSN naming ───────────────────────────────────

echo ""
echo "=== Step 2: Extract chr1 with PanSN prefix ==="
for NAME in "${GENOMES[@]}"; do
  CHR1="${CHR1_ACC[$NAME]}"
  PANSN="$OUT_DIR/${NAME}.chr1.pansn.fa"
  PLAIN="$OUT_DIR/${NAME}.chr1.fa"

  if [ -f "$PANSN" ] && [ -s "$PANSN" ]; then
    echo "  $NAME: already extracted"
    continue
  fi

  python3 -c "
target = '$CHR1'
sample = '$NAME'
writing = False
with open('$OUT_DIR/${NAME}.raw.fa') as fin, \
     open('$PANSN', 'w') as fpansn, \
     open('$PLAIN', 'w') as fplain:
    for line in fin:
        if line.startswith('>'):
            acc = line.split()[0][1:]
            writing = acc == target
            if writing:
                fpansn.write(f'>{sample}#1#{acc}\n')
                fplain.write(f'>{acc}\n')
        elif writing:
            fpansn.write(line)
            fplain.write(line)
print(f'  {sample}: {target}')
"
done

# ── Step 3: Bgzip individual chr1 FASTAs ─────────────────────────────────────

echo ""
echo "=== Step 3: Bgzip and index ==="
for NAME in "${GENOMES[@]}"; do
  if [ -f "$OUT_DIR/${NAME}.chr1.fa.gz" ]; then
    echo "  $NAME: already indexed"
    continue
  fi
  bgzip -f "$OUT_DIR/${NAME}.chr1.fa"
  samtools faidx "$OUT_DIR/${NAME}.chr1.fa.gz"
  echo "  $NAME: $(du -sh "$OUT_DIR/${NAME}.chr1.fa.gz" | cut -f1)"
done

# ── Step 4: Concatenate + bgzip for PGGB ────────────────────────────────────

echo ""
echo "=== Step 4: Prepare PGGB input (chr1 only) ==="
PGGB_INPUT="$OUT_DIR/athaliana_chr1.fa.gz"
if [ -f "$PGGB_INPUT" ]; then
  echo "  Already prepared"
else
  cat "$OUT_DIR"/Col-0.chr1.pansn.fa "$OUT_DIR"/Ler.chr1.pansn.fa \
      "$OUT_DIR"/Cvi.chr1.pansn.fa "$OUT_DIR"/Eri.chr1.pansn.fa \
    | bgzip -@ "$THREADS" > "$PGGB_INPUT"
  samtools faidx "$PGGB_INPUT"
  echo "  $(grep -c '.' "$PGGB_INPUT.fai") sequences, $(du -sh "$PGGB_INPUT" | cut -f1)"
fi

# ── Step 5: Pull PGGB singularity image ─────────────────────────────────────

echo ""
echo "=== Step 5: Pull PGGB singularity image ==="
# Reuse from full pipeline if available
if [ -f "$SRC_DIR/pggb.sif" ] && [ ! -f "$PGGB_SIF" ]; then
  ln -sf "$SRC_DIR/pggb.sif" "$PGGB_SIF"
  echo "  Linked from $SRC_DIR"
elif [ -f "$PGGB_SIF" ]; then
  echo "  Already pulled"
else
  singularity pull "$PGGB_SIF" "$PGGB_IMAGE"
fi

# ── Step 6: Run PGGB ────────────────────────────────────────────────────────

echo ""
echo "=== Step 6: Run PGGB (chr1 only, ~30MB × 4 genomes) ==="
PGGB_OUT="$OUT_DIR/pggb-out"
mkdir -p "$PGGB_OUT"

EXISTING_GFA=$(ls "$PGGB_OUT"/*.final.gfa 2>/dev/null | head -1 || true)
if [ -n "$EXISTING_GFA" ]; then
  echo "  GFA already exists: $(basename "$EXISTING_GFA")"
else
  echo "  Running PGGB with $THREADS threads..."
  singularity run \
    -B "$OUT_DIR:$OUT_DIR" \
    "$PGGB_SIF" \
    pggb \
      -i "$PGGB_INPUT" \
      -o "$PGGB_OUT" \
      -p 90 \
      -s 10000 \
      -n 4 \
      -t "$THREADS"

  EXISTING_GFA=$(ls "$PGGB_OUT"/*.final.gfa 2>/dev/null | head -1 || true)
  if [ -z "$EXISTING_GFA" ]; then
    echo "ERROR: PGGB did not produce a GFA file"
    ls -la "$PGGB_OUT"/
    exit 1
  fi
  echo "  GFA: $(du -sh "$EXISTING_GFA" | cut -f1)"
fi

# ── Step 7: Convert GFA to tabix format ──────────────────────────────────────

echo ""
echo "=== Step 7: Convert GFA to tabix-indexed format ==="
GFA_TABIX_PREFIX="$OUT_DIR/athaliana_chr1"
if [ -f "${GFA_TABIX_PREFIX}.pos.bed.gz" ]; then
  echo "  Already converted"
else
  node --experimental-strip-types -e "
    import { run } from '$REPO_ROOT/products/jbrowse-cli/src/commands/make-gfa-tabix/index.ts'
    run(['$EXISTING_GFA', '--out', '$GFA_TABIX_PREFIX'])
  " 2>&1 || {
    echo "  Trying CLI entry point..."
    node --experimental-strip-types \
      "$REPO_ROOT/products/jbrowse-cli/src/index.ts" \
      make-gfa-tabix "$EXISTING_GFA" --out "$GFA_TABIX_PREFIX"
  }
fi

# ── Step 8: Summary ─────────────────────────────────────────────────────────

echo ""
echo "=== Done ==="
echo ""
echo "GFA: $EXISTING_GFA ($(du -sh "$EXISTING_GFA" | cut -f1))"
echo ""
echo "GFA-tabix files:"
ls -lh "${GFA_TABIX_PREFIX}"*.bed.gz* 2>/dev/null | awk '{print "  " $NF ": " $5}'
echo ""
echo "Individual chr1 FASTAs:"
ls -lh "$OUT_DIR"/*.chr1.fa.gz 2>/dev/null | awk '{print "  " $NF ": " $5}'
echo ""
echo "Upload to s3://jbrowse.org/demos/gfadata/athaliana/"
