#!/bin/bash
# Builds a pangenome GFA from Arabidopsis thaliana ecotype FASTAs using PGGB,
# then converts to GFA-tabix format for use in MultiLGVSyntenyDisplay.
#
# PGGB (PanGenome Graph Builder) constructs a pangenome graph from whole-genome
# alignments. The output GFA can be used directly with JBrowse's GfaTabixAdapter,
# which supports any-genome-as-reference natively via segment indexing.
#
# Ecotypes: Col-0 (TAIR10), Ler-0, Cvi-0, Eri-1
#
# Approach:
#   1. Download FASTAs from NCBI using `datasets` CLI
#   2. Keep only nuclear chromosomes, add PanSN prefix to sequence names
#   3. Concatenate + bgzip + index for PGGB input
#   4. Run PGGB via singularity container
#   5. Convert output GFA to tabix-indexed format using `jbrowse make-gfa-tabix`
#
# Output is intended for upload to s3://jbrowse.org/demos/gfadata/athaliana
#
# Requires: datasets (NCBI), samtools, bgzip, singularity, python3
# Optional: tabix (for make-gfa-tabix step)
# Usage: bash build-arabidopsis-pggb.sh [output-dir]

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="${1:-/tmp/arabidopsis-pggb}"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
THREADS="${THREADS:-$(nproc)}"

mkdir -p "$OUT_DIR"

PGGB_IMAGE="docker://ghcr.io/pangenome/pggb:latest"
PGGB_SIF="$OUT_DIR/pggb.sif"

# ── Step 1: Download FASTAs ──────────────────────────────────────────────────

echo "=== Step 1: Download FASTAs from NCBI ==="
for ENTRY in "GCF_000001735.4:Col-0" "GCA_001651475.1:Ler" "GCA_036942575.1:Cvi" "GCA_902460315.1:Eri"; do
  ACC="${ENTRY%%:*}"
  NAME="${ENTRY##*:}"
  FA="$OUT_DIR/${NAME}.raw.fa"
  if [ -f "$FA" ]; then
    echo "  $NAME: already downloaded"
    continue
  fi
  echo "  $NAME ($ACC)..."
  datasets download genome accession "$ACC" --include genome \
    --filename "$OUT_DIR/${NAME}.zip"
  unzip -o -j "$OUT_DIR/${NAME}.zip" "ncbi_dataset/data/$ACC/*.fna" \
    -d "$OUT_DIR/"
  mv "$OUT_DIR"/*.fna "$FA"
  rm -rf "$OUT_DIR/${NAME}.zip" "$OUT_DIR/README.md" "$OUT_DIR/md5sum.txt"
  echo "    $(du -sh "$FA" | cut -f1)"
done

# ── Step 2: Add PanSN prefix, keep only nuclear chromosomes ─────────────────

echo ""
echo "=== Step 2: Add PanSN prefix (sample#1#accession) ==="

python3 << 'PYEOF'
import os

out_dir = os.environ.get("OUT_DIR", "/tmp/arabidopsis-pggb")

# Nuclear chromosome accessions per genome (5 chromosomes each)
nuclear_chroms = {
    "Col-0": ["NC_003070.9", "NC_003071.7", "NC_003074.8", "NC_003075.7", "NC_003076.8"],
    "Ler": ["CM004359.1", "CM004360.1", "CM004361.1", "CM004362.1", "CM004363.1"],
    "Cvi": ["CP138176.1", "CP138177.1", "CP138178.1", "CP138179.1", "CP138180.1"],
    "Eri": ["LR699765.1", "LR699766.1", "LR699767.1", "LR699768.1", "LR699769.1"],
}

for sample, chroms in nuclear_chroms.items():
    chrom_set = set(chroms)
    inpath = os.path.join(out_dir, f"{sample}.raw.fa")
    outpath = os.path.join(out_dir, f"{sample}.pansn.fa")
    plainpath = os.path.join(out_dir, f"{sample}.fa")

    if os.path.exists(outpath) and os.path.getsize(outpath) > 0:
        print(f"  {sample}: already processed")
        continue

    writing = False
    written = []
    with open(inpath) as fin, \
         open(outpath, "w") as fpansn, \
         open(plainpath, "w") as fplain:
        for line in fin:
            if line.startswith(">"):
                acc = line.split()[0][1:]
                if acc in chrom_set:
                    writing = True
                    written.append(acc)
                    fpansn.write(f">{sample}#1#{acc}\n")
                    fplain.write(f">{acc}\n")
                else:
                    writing = False
            elif writing:
                fpansn.write(line)
                fplain.write(line)
    print(f"  {sample}: {len(written)} chromosomes ({', '.join(written)})")
PYEOF

# ── Step 3: Bgzip individual FASTAs for JBrowse assemblies ───────────────────

echo ""
echo "=== Step 3: Bgzip and index individual FASTAs ==="
for NAME in Col-0 Ler Cvi Eri; do
  if [ -f "$OUT_DIR/${NAME}.fa.gz" ]; then
    echo "  $NAME: already indexed"
    continue
  fi
  bgzip -f "$OUT_DIR/${NAME}.fa"
  samtools faidx "$OUT_DIR/${NAME}.fa.gz"
  echo "  $NAME: $(du -sh "$OUT_DIR/${NAME}.fa.gz" | cut -f1)"
done

# ── Step 4: Concatenate + bgzip + index for PGGB ────────────────────────────

echo ""
echo "=== Step 4: Prepare PGGB input ==="
PGGB_INPUT="$OUT_DIR/athaliana_4way.fa.gz"
if [ -f "$PGGB_INPUT" ]; then
  echo "  Already prepared"
else
  cat "$OUT_DIR"/Col-0.pansn.fa "$OUT_DIR"/Ler.pansn.fa \
      "$OUT_DIR"/Cvi.pansn.fa "$OUT_DIR"/Eri.pansn.fa \
    | bgzip -@ "$THREADS" > "$PGGB_INPUT"
  samtools faidx "$PGGB_INPUT"
  echo "  $(grep -c '.' "$PGGB_INPUT.fai") sequences, $(du -sh "$PGGB_INPUT" | cut -f1)"
fi

# ── Step 5: Pull PGGB singularity image ─────────────────────────────────────

echo ""
echo "=== Step 5: Pull PGGB singularity image ==="
if [ -f "$PGGB_SIF" ]; then
  echo "  Already pulled"
else
  singularity pull "$PGGB_SIF" "$PGGB_IMAGE"
fi

# ── Step 6: Run PGGB ────────────────────────────────────────────────────────

echo ""
echo "=== Step 6: Run PGGB ==="
PGGB_OUT="$OUT_DIR/pggb-out"
mkdir -p "$PGGB_OUT"

# Check if GFA already exists
EXISTING_GFA=$(ls "$PGGB_OUT"/*.final.gfa 2>/dev/null | head -1 || true)
if [ -n "$EXISTING_GFA" ]; then
  echo "  GFA already exists: $EXISTING_GFA"
else
  echo "  Running PGGB with $THREADS threads..."
  echo "  Input: $PGGB_INPUT"
  echo "  This will take a while for whole-genome data..."

  # PGGB parameters:
  #   -p 90: 90% minimum identity (appropriate for within-species comparison)
  #   -s 10000: segment length for mapping
  #   -n 4: number of haplotypes (4 ecotypes × 1 haplotype each)
  #   -t: threads
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
GFA_TABIX_PREFIX="$OUT_DIR/athaliana_4way"
if [ -f "${GFA_TABIX_PREFIX}.pos.bed.gz" ]; then
  echo "  Already converted"
else
  node --experimental-strip-types -e "
    import { run } from '$REPO_ROOT/products/jbrowse-cli/src/commands/make-gfa-tabix/index.ts'
    run(['$EXISTING_GFA', '--out', '$GFA_TABIX_PREFIX'])
  " 2>&1 || {
    echo "  Falling back to CLI invocation..."
    node --experimental-strip-types \
      "$REPO_ROOT/products/jbrowse-cli/src/index.ts" \
      make-gfa-tabix "$EXISTING_GFA" --out "$GFA_TABIX_PREFIX"
  }
  echo "  pos: $(du -sh "${GFA_TABIX_PREFIX}.pos.bed.gz" | cut -f1)"
  echo "  segs: $(du -sh "${GFA_TABIX_PREFIX}.segs.bed.gz" | cut -f1)"
fi

# ── Step 8: Summary ─────────────────────────────────────────────────────────

echo ""
echo "=== Done ==="
echo ""
echo "GFA file: $EXISTING_GFA ($(du -sh "$EXISTING_GFA" | cut -f1))"
echo ""
echo "GFA-tabix files:"
ls -lh "${GFA_TABIX_PREFIX}".*.bed.gz* 2>/dev/null | awk '{print "  " $NF ": " $5}'
echo ""
echo "Individual FASTA files for JBrowse assemblies:"
ls -lh "$OUT_DIR"/*.fa.gz 2>/dev/null | awk '{print "  " $NF ": " $5}'
echo ""
echo "Upload to s3://jbrowse.org/demos/gfadata/athaliana/:"
echo "  GFA-tabix: athaliana_4way.{pos,segs,aln}.bed.gz + .tbi"
echo "  FASTAs: {Col-0,Ler,Cvi,Eri}.fa.gz + .fai + .gzi"
echo "  Raw GFA: $(basename "$EXISTING_GFA") (optional, for graph genome view)"
