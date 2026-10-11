# gene_density fixture

The session the
[gene density tutorial](../../website/docs/tutorials/gene_density.md) opens on,
and the live link under its figures
(`config=https://jbrowse.org/demos/gene_density/config.json`).

Four hg38 feature tracks, each beside a QuantitativeTrack of its features per
kilobase: UCSC's RefSeq curated genes as GFF3, and the Alu, L1 and simple-repeat
rows of UCSC's RepeatMasker table as one BED each. Every bigWig is
`jbrowse make-density` over the file it sits beside, 1 kb bins, every bin
written. `scripts/build_gene_density.sh` rebuilds the lot from the UCSC and
jbrowse.org copies; deploy the outputs with `scripts/deploy-demo.sh`.
