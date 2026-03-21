#!/bin/bash
# Downloads Arabidopsis thaliana ecotype FASTAs from NCBI and generates
# all-vs-all minimap2 alignments for use in MultiLGVSyntenyDisplay.
#
# Ecotypes: Col-0 (TAIR10), Ler-0, Cvi-0, Eri-1
#
# Approach:
#   1. Download FASTAs from NCBI using `datasets` CLI
#   2. Keep only nuclear chromosomes, add PanSN prefix to sequence names
#      (sample#haplotype#contig, per https://github.com/pangenome/PanSN-spec)
#      Contig names use original NCBI accession IDs (no renaming)
#   3. Concatenate all genomes into one FASTA
#   4. Run minimap2 self-alignment with -X to get true all-vs-all PAF
#   5. Convert to PIF using `jbrowse make-pif --all-vs-all`
#   6. Bgzip + index individual FASTAs for JBrowse assembly configs
#
# Output is intended for upload to s3://jbrowse.org/demos/gfadata/athaliana
#
# Requires: datasets (NCBI), samtools, minimap2, bgzip, tabix, sort, python3
# Usage: bash build-arabidopsis-allvsall.sh [output-dir]

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="${1:-/tmp/arabidopsis-allvsall}"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

mkdir -p "$OUT_DIR"

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

out_dir = os.environ.get("OUT_DIR", "/tmp/arabidopsis-allvsall")

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
    # Also write a version without PanSN prefix for individual assembly FASTA
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

# ── Step 3: Index individual FASTAs ──────────────────────────────────────────

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

# ── Step 4: Concatenate all genomes ──────────────────────────────────────────

echo ""
echo "=== Step 4: Concatenate PanSN FASTAs ==="
ALL_FA="$OUT_DIR/all_genomes.fa"
if [ -f "$ALL_FA" ] && [ -s "$ALL_FA" ]; then
  echo "  Already concatenated"
else
  cat "$OUT_DIR"/Col-0.pansn.fa "$OUT_DIR"/Ler.pansn.fa \
      "$OUT_DIR"/Cvi.pansn.fa "$OUT_DIR"/Eri.pansn.fa > "$ALL_FA"
  samtools faidx "$ALL_FA"
  echo "  $(grep -c '^>' "$ALL_FA") sequences, $(du -sh "$ALL_FA" | cut -f1)"
fi

# ── Step 5: minimap2 self-alignment ──────────────────────────────────────────

echo ""
echo "=== Step 5: minimap2 self-alignment (all-vs-all) ==="
ALL_PAF="$OUT_DIR/allvsall.paf"
if [ -f "$ALL_PAF" ] && [ -s "$ALL_PAF" ]; then
  echo "  Already aligned ($(wc -l < "$ALL_PAF") alignments)"
else
  echo "  Running minimap2 -cx asm5 --cs -X (this may take a few minutes)..."
  echo "  (-X skips self and dual mappings for true all-vs-all)"
  THREADS="${THREADS:-$(nproc)}"
  minimap2 -cx asm5 --cs -X -t "$THREADS" "$ALL_FA" "$ALL_FA" > "$ALL_PAF" 2>"$OUT_DIR/minimap2.log"
  echo "  $(wc -l < "$ALL_PAF") alignments, $(du -sh "$ALL_PAF" | cut -f1)"
fi

# ── Step 6: Generate PIF ─────────────────────────────────────────────────────

echo ""
echo "=== Step 6: Generate all-vs-all PIF ==="
PIF="$OUT_DIR/arabidopsis_4way_allvsall.pif.gz"
if [ -f "$PIF" ] && [ -s "$PIF" ]; then
  echo "  Already generated"
else
  node --experimental-strip-types -e "
    import { run } from '$REPO_ROOT/products/jbrowse-cli/src/commands/make-pif/index.ts'
    run(['$ALL_PAF', '--out', '$PIF', '--all-vs-all'])
  "
  echo "  $(du -sh "$PIF" | cut -f1)"
fi

# ── Step 7: Verify ───────────────────────────────────────────────────────────

echo ""
echo "=== Step 7: Verify ==="
echo "PIF header:"
zcat "$PIF" | grep '^#'
echo ""
echo "Pair genome coverage:"
for PAIR in $(zcat "$PIF" | grep '^#pair' | sed 's/^#//'); do
  echo "  $PAIR"
done
echo ""
echo "Individual FASTA files for JBrowse assemblies:"
ls -lh "$OUT_DIR"/*.fa.gz | awk '{print "  " $NF ": " $5}'
echo ""
echo "Upload these to s3://jbrowse.org/demos/gfadata/athaliana/"
echo "  - arabidopsis_4way_allvsall.pif.gz"
echo "  - arabidopsis_4way_allvsall.pif.gz.tbi"
echo "  - Col-0.fa.gz, Col-0.fa.gz.fai, Col-0.fa.gz.gzi"
echo "  - Ler.fa.gz, Ler.fa.gz.fai, Ler.fa.gz.gzi"
echo "  - Cvi.fa.gz, Cvi.fa.gz.fai, Cvi.fa.gz.gzi"
echo "  - Eri.fa.gz, Eri.fa.gz.fai, Eri.fa.gz.gzi"
