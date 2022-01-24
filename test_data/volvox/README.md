# Deep sequencing track

```
wgsim volvox.fa out1.fq out2.fq
bwa mem -t 32 volvox.fa out1.fq out2.fq | samtools fixmate -u -m - - | samtools sort -u -@2 - | samtools markdup -@8 --reference volvox.fa - tmp.cram
samtools view tmp.cram ctgA:1000-2000 -o deep_sequencing.cram
```
