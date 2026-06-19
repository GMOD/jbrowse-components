#!/usr/bin/env bash
#
# Regenerates the example images in ../img referenced from the README:
# comparative views (dotplot, synteny, multi-way), a circular chord plot, a
# gene/feature track, the reference-sequence track, and a dark-theme render.
#
# Requires `jb2export` on PATH (npm i -g @jbrowse/img) and `rsvg-convert`
# (apt install librsvg2-bin). `pngquant` (apt install pngquant) is optional but
# recommended — it shrinks the committed PNGs ~50-60%. Override the command for
# in-repo dev runs:
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

# render <out> <jb2export args...> — runs the export and remembers the output so
# it can be optimized once at the end.
OUTS=()
render() {
  local out="$1"
  shift
  $JB2EXPORT "$@" --out "$out"
  OUTS+=("$out")
}

# Headline (README "## Screenshot"): a multi-track human view from public files —
# NCBI RefSeq genes, ClinGen gene-disease, phyloP conservation, SKBR3 nanopore.
# --aliases reconciles the 1 / chr1 / NC_000001.10 refname styles across files.
render img/1.png \
  --fasta https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz \
  --aliases https://jbrowse.org/genomes/hg19/hg19_aliases.txt \
  --gffgz https://s3.amazonaws.com/jbrowse.org/genomes/hg19/ncbi_refseq/GRCh37_latest_genomic.sort.gff.gz \
  --bigbed https://hgdownload.soe.ucsc.edu/gbdb/hg19/bbi/clinGen/clinGenGeneDisease.bb \
  --bigwig https://hgdownload.cse.ucsc.edu/goldenpath/hg19/phyloP100way/hg19.100way.phyloP100way.bw \
  --cram https://s3.amazonaws.com/jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.cram \
  --loc 1:19,197,000-19,233,000 --width 1200

# Whole-genome dotplot: every YJM1447 contig (x) vs every R64 contig (y).
render img/yeast_dotplot.png dotplot \
  --fasta "$YEAST/yjm1447.fa" \
  --fasta2 "$YEAST/r64.fa" \
  --paf "$YEAST/r64_vs_yjm1447.paf" \
  --width 1100

# Single-chromosome synteny ribbon: YJM1447 chr I vs R64 chr I (NC_001133.9).
render img/yeast_synteny.png synteny \
  --fasta "$YEAST/yjm1447.fa" --loc I \
  --fasta2 "$YEAST/r64.fa" --loc2 NC_001133.9 \
  --paf "$YEAST/r64_vs_yjm1447.paf" \
  --width 1400

# Whole-genome multi-chromosome synteny via a session-spec (autoDiagonalize
# reorders grape chromosomes for least overlap; colorBy:query tints ribbons by
# peach chromosome).
render img/grape_peach_synteny.png \
  --config data/comparative/grape_peach.config.json \
  --spec data/comparative/grape_peach.spec.json \
  --width 1400

# Mammalian-scale: human (hs1) vs mouse (mm39). minAlignmentLength:500000 (in the
# spec) drops short alignments so the large syntenic blocks stay legible.
render img/hs1_mm39_synteny.png \
  --config data/comparative/hs1_mm39.config.json \
  --spec data/comparative/hs1_mm39.spec.json \
  --width 1400

# Three-level stack: hg38 / hs1 / mm39 (one ribbon per adjacent pair — a UCSC
# liftOver chain for hg38<->hs1, the .pif for hs1<->mm39).
render img/hg38_hs1_mm39_synteny.png \
  --config data/comparative/hg38_hs1_mm39.config.json \
  --spec data/comparative/hg38_hs1_mm39.spec.json \
  --width 1400

# Circular structural-variant chord plot (bundled volvox SV VCF).
render img/circular_chords.png circular \
  --fasta data/volvox/volvox.fa --vcfgz data/volvox/volvox.dup.vcf.gz \
  --width 800

# Gene/feature track and dark theme (bundled volvox annotations).
render img/gene_track.png --fasta data/volvox/volvox.fa \
  --gffgz data/volvox/volvox.sort.gff3.gz \
  --loc ctgA:1-50000 --width 1200
render img/dark_theme.png --fasta data/volvox/volvox.fa \
  --bigwig data/volvox/volvox-sorted.bam.coverage.bw \
  --gffgz data/volvox/volvox.sort.gff3.gz \
  --loc ctgA:1-20000 --themeName darkStock --width 1200

# Reference-sequence track zoomed to base level: --refseq shows the DNA bases and
# the six-frame translation (green start codons, red stops).
render img/sequence.png --fasta data/volvox/volvox.fa \
  --loc ctgA:108-208 --refseq --width 1500

# Alignments: a plain pileup, then reads colored+sorted by read-group tag.
render img/alignments_pileup.png --fasta data/volvox/volvox.fa \
  --bam data/volvox/volvox-sorted.bam --loc ctgA:1-20000 --width 1200
render img/alignments_readgroup.png --fasta data/volvox/volvox.fa \
  --bam data/volvox/volvox-rg.bam color:tag:RG sort:tag:RG height:300 \
  --loc ctgA:1000-2000 --width 1200

# group:tag:HP splits the pileup into one sub-track per haplotype. HG002
# ultralong ONT (hg19) streamed from the GIAB FTP; the het deletion sits in one
# haplotype only.
render img/alignments_haplotype.png \
  --fasta https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz \
  --bam "https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/data/AshkenazimTrio/HG002_NA24385_son/Ultralong_OxfordNanopore/combined_2018-08-10/HG002_ONTrel2_16x_RG_HP10xtrioRTG.cram.bam" \
  group:tag:HP color:tag:HP height:400 --loc 1:63,005,675-63,007,432 --width 1200

# Variant track (bundled volvox VCF).
render img/variants.png --fasta data/volvox/volvox.fa \
  --vcfgz data/volvox/volvox.filtered.vcf.gz --loc ctgA:1-20000 --width 1200

# Shrink the committed PNGs (flat-color renders quantize cleanly). --nofs matches
# the website pipeline: no dithering, so an unchanged render re-quantizes to the
# same bytes instead of churning git. Best-effort — skipped if pngquant is absent.
if command -v pngquant >/dev/null 2>&1; then
  pngquant --nofs --quality=70-90 --skip-if-larger --force --ext .png "${OUTS[@]}" \
    || true
else
  echo "pngquant not found; leaving PNGs unoptimized (apt install pngquant)" >&2
fi

echo "wrote ${#OUTS[@]} images to img/"
