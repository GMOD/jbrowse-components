#!/usr/bin/env bash
# Downloads the public data the outside tasks in tasks.ts hand an agent, into
# ~/agent-evals/fixtures. Needs curl, samtools, bigWigToBedGraph and
# bedGraphToBigWig. About 400 MB passes through a temp folder; 30 MB stays.
set -euo pipefail

out=${1:-$HOME/agent-evals/fixtures}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$out"
cd "$out"

ncbi=https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF
curl -sfo k12.fna.gz $ncbi/000/005/845/GCF_000005845.2_ASM584v2/GCF_000005845.2_ASM584v2_genomic.fna.gz
curl -sfo sakai.fna.gz $ncbi/000/008/865/GCF_000008865.2_ASM886v2/GCF_000008865.2_ASM886v2_genomic.fna.gz

# the first 300,000 reads of ERR022075, E. coli K-12 MG1655 Illumina
{ curl -s https://ftp.sra.ebi.ac.uk/vol1/fastq/ERR022/ERR022075/ERR022075_1.fastq.gz || true; } |
  { gzip -dc 2>/dev/null || true; } | awk 'NR <= 1200000; NR == 1200000 { exit }' | gzip >reads.fastq.gz

# NA12878 1000 Genomes high-coverage CRAM, sliced around BRCA1
curl -sf https://hgdownload.soe.ucsc.edu/goldenPath/hg38/chromosomes/chr17.fa.gz | gzip -dc >"$tmp/chr17.fa"
samtools faidx "$tmp/chr17.fa"
samtools view -T "$tmp/chr17.fa" -b -o na12878_brca1.bam \
  https://ftp.sra.ebi.ac.uk/vol1/run/ERR323/ERR3239334/NA12878.final.cram chr17:43030000-43130000
samtools index na12878_brca1.bam
rm -f NA12878.final.cram.crai

# ENCODE H3K27ac fold change over control, sliced to the beta-globin locus
curl -sfo hg38.chrom.sizes https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.chrom.sizes
encode=https://encode-public.s3.amazonaws.com
for pair in \
  "k562 $encode/2022/06/14/f774d0cc-aa31-4a00-8dd1-c153c9459962/ENCFF289IVJ.bigWig" \
  "gm12878 $encode/2020/09/30/7ae35df2-f211-4f5a-90e2-1bce9a864622/ENCFF469WVA.bigWig"; do
  set -- $pair
  curl -sfo "$tmp/$1.bw" "$2"
  bigWigToBedGraph "$tmp/$1.bw" "$tmp/$1.bedgraph" -chrom=chr11 -start=5200000 -end=5320000
  bedGraphToBigWig "$tmp/$1.bedgraph" hg38.chrom.sizes "${1}_h3k27ac.bw"
done
rm hg38.chrom.sizes
