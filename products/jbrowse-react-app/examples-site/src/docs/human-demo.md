A real-world hg38 session, opened at the _SHH_ locus, carrying the kinds of
track a production embed runs at once:

- **NCBI RefSeq genes** (GFF3+tabix) with a `TrixTextSearchAdapter`, so typing a
  gene symbol in the location box jumps there
- **Repeats** from a BigBed
- **NA12878 exome** alignments (CRAM, 1000 Genomes)
- **1000 Genomes variant calls** (VCF+tabix)
- **phyloP100way conservation** as a BigWig

Every file is fetched over HTTP range requests from public buckets, so there is
no server-side component. It is the same `<JBrowse>` as the
[basic example](../basic-example/) with a fuller `assemblies`/`tracks`. On
alignments data this heavy, turn on the
[web worker RPC](../customizing-the-app/#with-web-worker).
