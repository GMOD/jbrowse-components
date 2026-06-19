#!/usr/bin/env bash
#
# Regenerates the comparative-view example images in ../img. These are the
# screenshots referenced from the README "Compare two assemblies" section.
#
# Requires `jb2export` on PATH (npm i -g @jbrowse/img) and `rsvg-convert`
# (apt install librsvg2-bin). Override the command for in-repo dev runs:
#   JB2EXPORT="npx tsx --tsconfig ../../tsconfig.json \
#     --import ./src/integrationRegister.mjs src/bin.ts" ./scripts/render-comparative-examples.sh
#
# The yeast examples fetch everything from public S3 URLs, so they reproduce
# anywhere with network. The grape/peach example reads chrom.sizes from this
# repo's data/comparative and the alignment PAF from S3.
set -euo pipefail

cd "$(dirname "$0")/.."
JB2EXPORT="${JB2EXPORT:-jb2export}"
YEAST=https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447

# Whole-genome dotplot: every YJM1447 contig (x) vs every R64 contig (y).
$JB2EXPORT dotplot \
  --fasta "$YEAST/yjm1447.fa" \
  --fasta2 "$YEAST/r64.fa" \
  --paf "$YEAST/r64_vs_yjm1447.paf" \
  --width 1100 --out img/yeast_dotplot.png

# Single-chromosome synteny ribbon: YJM1447 chr I vs R64 chr I (NC_001133.9).
$JB2EXPORT synteny \
  --fasta "$YEAST/yjm1447.fa" --loc I \
  --fasta2 "$YEAST/r64.fa" --loc2 NC_001133.9 \
  --paf "$YEAST/r64_vs_yjm1447.paf" \
  --width 1400 --out img/yeast_synteny.png

# Whole-genome multi-chromosome synteny via a session-spec (autoDiagonalize
# reorders grape chromosomes for least overlap; colorBy:query tints ribbons by
# peach chromosome).
$JB2EXPORT \
  --config data/comparative/grape_peach.config.json \
  --spec data/comparative/grape_peach.spec.json \
  --width 1400 --out img/grape_peach_synteny.png

# Mammalian-scale: human (hs1) vs mouse (mm39). minAlignmentLength:500000 (in the
# spec) drops short alignments so the large syntenic blocks stay legible.
$JB2EXPORT \
  --config data/comparative/hs1_mm39.config.json \
  --spec data/comparative/hs1_mm39.spec.json \
  --width 1400 --out img/hs1_mm39_synteny.png

echo "wrote img/yeast_dotplot.png img/yeast_synteny.png img/grape_peach_synteny.png img/hs1_mm39_synteny.png"
