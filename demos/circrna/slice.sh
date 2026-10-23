#!/bin/bash
set -euo pipefail
export PATH=$HOME/.local/bin:$PATH
W=/mnt/sdb/cdiesh/circrna
mkdir -p $W/demo
cd $W

zcat /mnt/sdb/cdiesh/gencode/gencode.v49.annotation.gff3.gz |
  awk -F'\t' -v OFS='\t' '$3=="gene" && $9 ~ /gene_name=(HIPK3|ZKSCAN1|CAMSAP1|XPO1|SETD3|ASXL1);/ {
    s = $4 - 5000; print $1, (s < 0 ? 0 : s), $5 + 5000 }' |
  sort -k1,1 -k2,2n > demo/regions.bed
cat demo/regions.bed

for run in "$@"; do
  bam=aln/$run.Aligned.sortedByCoord.out.bam
  samtools view -b -L demo/regions.bed -M -o demo/$run.slice.bam $bam
  samtools index demo/$run.slice.bam
  awk -F'\t' -v OFS='\t' '$1 !~ /^#/ && $1==$4 && $3==$6 && $7>=0 &&
    !($1=="chr21" && $2<9500000) &&
    (($3=="+" && $5<$2) || ($3=="-" && $5>$2)) {
      s = $3=="+" ? $5-1 : $2-1
      e = $3=="+" ? $2 : $5
      k = $1"\t"s"\t"e
      if (!((k, $10) in seen)) { seen[k, $10]=1; n[k]++ }
    }
    END { for (k in n) if (n[k] >= 2) print k, n[k]" reads", n[k], "." }' \
    aln/$run.Chimeric.out.junction |
    sort -k1,1 -k2,2n | bgzip > demo/$run.backsplice.bed.gz
  tabix -f -p bed demo/$run.backsplice.bed.gz
  echo "$run: $(zcat demo/$run.backsplice.bed.gz | wc -l) junctions"
done
ls -la demo
