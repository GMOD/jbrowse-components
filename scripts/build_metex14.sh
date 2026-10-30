#!/usr/bin/env bash
#
# MET exon 14 skipping in two lung cancer cell lines from the Cancer Cell Line
# Encyclopedia: NCI-H596, whose DNA carries c.3028+1G>T at the exon's splice
# donor, and EBC-1, which splices exon 14 in. CCLE's own alignments sit in SRA
# against GRCh37; the script takes the reads they place around MET exons 13-15
# and aligns them again to hg38 chr7 with HISAT2, the RNA spliced and the DNA
# not, so the BAMs are what a reader's own pipeline would give. Mates are
# aligned one read at a time.
#
# Requires: curl, sra-tools (sam-dump), samtools, hisat2
# Usage:    bash build_metex14.sh [outdir]
#
# Your own reads: skip the slicing and align your FASTQ with the same hisat2
# command against a whole-genome index; the protein browser draws hg38.

set -euo pipefail

work=${1:-metex14_build}
mkdir -p "$work"/ref "$work"/out
cd "$work"

# CCLE (BioProject PRJNA523380) stores its alignments in SRA against GRCh37
# with chromosome 7 named "7"; these windows cover MET exons 13-15 there.
H596_WGS=SRR8670696
H596_RNA=SRR8616162
EBC1_RNA=SRR8615634
RNA_REGION=CM000669.1:116395000-116416000
DNA_REGION=CM000669.1:116410800-116415800

if [ ! -f ref/hisat2/chr7.1.ht2 ]; then
  curl -sfo ref/chr7.fa.gz https://hgdownload.soe.ucsc.edu/goldenPath/hg38/chromosomes/chr7.fa.gz
  zcat ref/chr7.fa.gz >ref/chr7.fa
  samtools faidx ref/chr7.fa
  mkdir -p ref/hisat2
  hisat2-build -p 8 ref/chr7.fa ref/hisat2/chr7 >ref/hisat2/build.log
fi

slice_fastq() {
  local run=$1 region=$2 out=$3
  {
    printf '@HD\tVN:1.6\n@SQ\tSN:7\tLN:159138663\n'
    sam-dump --aligned-region "$region" "$run" | grep -v '^@'
  } | samtools fastq -F 0x900 - 2>/dev/null | gzip >"$out"
}

align() {
  local fq=$1 name=$2 extra=$3
  # shellcheck disable=SC2086
  hisat2 -p 8 $extra --rg-id "$name" --rg "SM:$name" -x ref/hisat2/chr7 -U "$fq" 2>"out/$name.hisat2.log" |
    samtools sort -o "out/$name.bam" -
  samtools index "out/$name.bam"
}

slice_fastq $H596_WGS $DNA_REGION h596_dna.fq.gz
slice_fastq $H596_RNA $RNA_REGION h596_rna.fq.gz
slice_fastq $EBC1_RNA $RNA_REGION ebc1_rna.fq.gz

align h596_dna.fq.gz NCI-H596_DNA --no-spliced-alignment
align h596_rna.fq.gz NCI-H596_RNA ''
align ebc1_rna.fq.gz EBC-1_RNA_all ''

# EBC-1 carries extra copies of MET, about 9000x over exon 14; 5% of its reads
# brings it to H596's depth
samtools view -b -s 7.05 out/EBC-1_RNA_all.bam -o out/EBC-1_RNA_5pct.bam
samtools index out/EBC-1_RNA_5pct.bam

ls -la out
