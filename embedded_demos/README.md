# JBrowse 2 embedded demos

## Linear genome view demo

This demo shows a variety of tracks on hg38

The text searching index created by running `jbrowse text-index` on the specific
gene track file. This uses the --fileId to say what the trackId is of the file
we are indexing with --file

```bash
## create index
jbrowse text-index --file https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz --fileId genes

## upload to aws
aws s3 sync trix s3://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix --delete

```

## Circular genome view demo

This demo shows translocations SVs
