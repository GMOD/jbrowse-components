#!/bin/bash
set -euo pipefail
export PATH=$HOME/.local/bin:$PATH
W=/mnt/sdb/cdiesh/circrna
mkdir -p $W/fastq $W/ref $W/aln
cd $W

if [ ! -s ref/hg38.primary.fa.fai ]; then
  samtools faidx /mnt/sdb/cdiesh/cancer/hg38.fa \
    $(for c in $(seq 1 22) X Y M; do echo chr$c; done) > ref/hg38.primary.fa
  samtools faidx ref/hg38.primary.fa
fi

if [ ! -s ref/star/SA ]; then
  mkdir -p ref/star
  STAR --runMode genomeGenerate --runThreadN 20 --genomeDir ref/star \
    --genomeFastaFiles ref/hg38.primary.fa \
    --sjdbGTFfile /mnt/sdb/cdiesh/gencode/gencode.v49.annotation.gff3 \
    --sjdbGTFtagExonParentTranscript Parent --sjdbOverhang 100 \
    --outTmpDir $W/ref/star_tmp
fi

for run in "$@"; do
  d=$(echo $run | cut -c1-6)
  sub=00$(echo $run | rev | cut -c1)
  for m in 1 2; do
    f=fastq/${run}_$m.fastq.gz
    [ -s $f.done ] || {
      curl -sSfL --retry 50 --retry-all-errors --retry-delay 20 -C - -o $f "https://ftp.sra.ebi.ac.uk/vol1/fastq/$d/$sub/$run/${run}_$m.fastq.gz"
      gzip -t $f
      touch $f.done
    }
  done
done

for run in "$@"; do
  out=aln/$run.
  [ -s ${out}Aligned.sortedByCoord.out.bam ] && continue
  rm -rf ${out}_STARtmp
  STAR --runThreadN 20 --genomeDir ref/star \
    --readFilesIn fastq/${run}_1.fastq.gz fastq/${run}_2.fastq.gz \
    --readFilesCommand zcat --outFileNamePrefix $out \
    --outSAMtype BAM SortedByCoordinate --limitBAMsortRAM 30000000000 \
    --outSAMattributes NH HI AS nM NM MD XS \
    --chimOutType WithinBAM SoftClip Junctions \
    --chimSegmentMin 15 --chimJunctionOverhangMin 15 \
    --chimScoreMin 1 --chimScoreJunctionNonGTAG -4 \
    --chimSegmentReadGapMax 3 --alignSJDBoverhangMin 10 \
    --alignSJoverhangMin 15
  samtools index -@ 8 ${out}Aligned.sortedByCoord.out.bam
done
echo ALL DONE
