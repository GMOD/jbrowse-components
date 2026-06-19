#!/usr/bin/env bash
#
# Regenerates the example images in ../img referenced from the README:
# comparative views (dotplot, synteny, multi-way), a circular chord plot, a
# gene/feature track, and a dark-theme render.
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

# Three-level stack: hg38 / hs1 / mm39 (one ribbon per adjacent pair — a UCSC
# liftOver chain for hg38<->hs1, the .pif for hs1<->mm39).
$JB2EXPORT \
  --config data/comparative/hg38_hs1_mm39.config.json \
  --spec data/comparative/hg38_hs1_mm39.spec.json \
  --width 1400 --out img/hg38_hs1_mm39_synteny.png

# Circular structural-variant chord plot (bundled volvox SV VCF).
$JB2EXPORT circular \
  --fasta data/volvox/volvox.fa --vcfgz data/volvox/volvox.dup.vcf.gz \
  --width 800 --out img/circular_chords.png

# Gene/feature track and dark theme (bundled volvox annotations).
$JB2EXPORT --fasta data/volvox/volvox.fa --gffgz data/volvox/volvox.sort.gff3.gz \
  --loc ctgA:1-50000 --width 1200 --out img/gene_track.png
$JB2EXPORT --fasta data/volvox/volvox.fa \
  --bigwig data/volvox/volvox-sorted.bam.coverage.bw \
  --gffgz data/volvox/volvox.sort.gff3.gz \
  --loc ctgA:1-20000 --themeName darkStock --width 1200 --out img/dark_theme.png

echo "wrote comparative + circular + gene-track + dark-theme images to img/"
