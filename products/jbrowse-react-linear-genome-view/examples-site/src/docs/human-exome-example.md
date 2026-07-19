A real-world dataset on GRCh38: the NA12878 CEU exome (a CRAM alignments track
from the 1000 Genomes project) shown alongside NCBI RefSeq genes, opened at a
gene locus on chromosome 1.

This uses the managed [`<LinearGenomeView>`](../setting-up-the-view/#with-init)
— `assembly`, `tracks`, and `init` are passed as plain props and the component
owns the engine. The CRAM track is fetched directly over HTTP range requests
from S3; no server-side component is required. For the config slots, see
[CramAdapter](https://jbrowse.org/jb2/docs/config/cramadapter/) and
[AlignmentsTrack](https://jbrowse.org/jb2/docs/config/alignmentstrack/).

On large alignments datasets like this, consider enabling the
[web worker RPC](../accounts-and-workers/#with-web-worker) to keep parsing off the main thread.
