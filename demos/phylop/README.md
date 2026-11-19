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

`hg38.phyloP100way.shh.bw` is chr7:155,700,000-155,900,000 (200kb around SHH),
for the `jbrowse-react-app` examples-site's human demos:

```
bigWigToBedGraph -chrom=chr7 -start=155700000 -end=155900000 \
  https://hgdownload.soe.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw \
  shh.bedGraph
printf 'chr7\t159345973\n' > chrom.sizes
bedGraphToBigWig shh.bedGraph chrom.sizes hg38.phyloP100way.shh.bw
```

`EveryChromosome.tsx` still points at the live UCSC file — it genuinely needs
whole-genome coverage, which this subset can't stand in for.
