#!/bin/bash
set -euo pipefail
export PATH=$HOME/.local/bin:$PATH
W=/mnt/sdb/cdiesh/circrna
run=SRR10612055
mkdir -p $W/fastq $W/aln
cd $W
until [ -s ref/hg38.primary.fa.fai ]; do sleep 30; done
f=fastq/$run.fastq.gz
[ -s $f.done ] || {
  curl -sSfL --retry 50 --retry-all-errors --retry-delay 20 -C - -o $f "https://ftp.sra.ebi.ac.uk/vol1/fastq/SRR106/055/$run/${run}_1.fastq.gz"
  gzip -t $f
  touch $f.done
}
out=aln/$run.isocirc.bam
[ -s $out.bai ] || {
  minimap2 -ax splice -t 10 --secondary=no ref/hg38.primary.fa $f |
    samtools sort -@ 4 -m 2G -o $out
  samtools index $out
}
echo ALL DONE
