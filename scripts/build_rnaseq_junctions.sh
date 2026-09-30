#!/usr/bin/env bash
#
# A whole-library splice-junction table, the file behind the junction track in
# website/docs/tutorials/rnaseq.md.
#
# regtools reads every spliced alignment out of the BAM and counts the reads
# per intron, then annotates each junction against RefSeq: the splice-site
# motif on the junction's strand, and whether an annotated transcript joins
# that donor to that acceptor. One awk line turns the annotated table into a
# BED of introns with those two columns after the six BED ones.
#
# With no arguments it runs on the tutorial's hg19 paired-end stranded
# RNA-seq BAM (RSeQC's sample files), which it downloads, with UCSC's hg19
# FASTA and RefSeq GTF. It needs about 6 GB of disk.
#
# Requires: regtools, samtools, bgzip + tabix (htslib), curl, awk, gzip.
# Usage:    bash scripts/build_rnaseq_junctions.sh [outdir]
#           STRAND=RF bash scripts/build_rnaseq_junctions.sh   # a dUTP library
#
set -euo pipefail

for tool in regtools samtools bgzip tabix curl awk gzip; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    exit 1
  }
done

OUTDIR="${1:-rnaseq_junctions}"
# FR: the first read of each pair runs along the transcript, which is what
# this library does; the ACTB junctions come out on the minus strand, ACTB's
STRAND="${STRAND:-FR}"
BAM_URL=https://s3.amazonaws.com/jbrowse.org/genomes/hg19/paired_end_rnaseq/Pairend_StrandSpecific_51mer_Human_hg19.bam
UCSC=https://hgdownload.soe.ucsc.edu/goldenPath/hg19/bigZips

mkdir -p "$OUTDIR"
cd "$OUTDIR"

[ -s rnaseq.bam ] || curl -fsS -o rnaseq.bam "$BAM_URL"
[ -s rnaseq.bam.bai ] || curl -fsS -o rnaseq.bam.bai "$BAM_URL.bai"
[ -s genes.gtf ] || curl -fsS "$UCSC/genes/hg19.refGene.gtf.gz" | gzip -dc > genes.gtf
[ -s genome.fa ] || curl -fsS "$UCSC/hg19.fa.gz" | gzip -dc > genome.fa
[ -s genome.fa.fai ] || samtools faidx genome.fa

regtools junctions extract -s "$STRAND" rnaseq.bam -o regtools.bed
regtools junctions annotate regtools.bed genome.fa genes.gtf -o annotated.tsv

# annotate reports the last base of one exon and the first base of the next,
# so the intron ends one base before `end`. Columns 7 and 14 are the motif and
# the known-junction flag.
awk -F'\t' -v OFS='\t' 'NR > 1 { print $1, $2, $3 - 1, $4, $5, $6, $7, $14 }' \
  annotated.tsv > junctions.bed

sort -k1,1 -k2,2n junctions.bed | bgzip > junctions.bed.gz
tabix -f -p bed junctions.bed.gz

echo "Wrote $OUTDIR/junctions.bed.gz"
