# phyloP subset

`hg38.phyloP100way.brca1.bw` is chr17:42,900,000-43,300,000 (400kb around BRCA1)
sliced out of UCSC's `hg38.phyloP100way.bw`, which the `build-your-own`
examples-site's region-scoped demos use so they don't depend on
`hgdownload.soe.ucsc.edu` staying up during a CI smoke run.

Regenerate:

```
bigWigToBedGraph -chrom=chr17 -start=42900000 -end=43300000 \
  https://hgdownload.soe.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw \
  brca1.bedGraph
printf 'chr17\t83257441\n' > chrom.sizes
bedGraphToBigWig brca1.bedGraph chrom.sizes hg38.phyloP100way.brca1.bw
```

`EveryChromosome.tsx` still points at the live UCSC file — it genuinely needs
whole-genome coverage, which this subset can't stand in for.
