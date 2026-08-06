The NA12878 CEU exome from the 1000 Genomes Project — a CRAM alignments track on
GRCh38 — beside NCBI RefSeq genes, opened at a gene locus on chromosome 1.

The CRAM is fetched over HTTP range requests straight from S3, so there is no
server-side component. Config slots:
[CramAdapter](https://jbrowse.org/jb2/docs/config/cramadapter/),
[AlignmentsTrack](https://jbrowse.org/jb2/docs/config/alignmentstrack/). On
alignments data this size, turn on the
[web worker RPC](../plugins/#with-web-worker).
