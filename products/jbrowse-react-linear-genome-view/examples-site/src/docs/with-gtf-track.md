Gene models from a GTF file load as a `FeatureTrack` backed by a
[GtfAdapter](https://jbrowse.org/jb2/docs/config/gtfadapter/) (plain text,
loaded into memory) or a
[GtfTabixAdapter](https://jbrowse.org/jb2/docs/config/gtftabixadapter/)
(bgzipped and tabix-indexed, for large files). The `uri` shorthand accepts a
plain or gzipped path:

```js
adapter: {
  type: 'GtfAdapter',
  uri: 'https://example.com/genes.gtf',
}
```

This example uses a real GENCODE record (the TP53 gene) remapped into the volvox
`ctgA` coordinate system.

Unlike GFF3, GTF has no spanning `gene` line and often no `transcript` line
either. JBrowse builds the gene model from the per-feature (exon/CDS) lines:
lines sharing a `transcript_id` are grouped under a transcript (synthesized if
absent, per the Cufflinks/StringTie convention), and transcripts sharing a
`gene_id` are grouped into a gene.

The gene's label comes from the `aggregateField` (default `gene_name`), falling
back to the `gene_id` when the file has no such attribute — so a UCSC
`genePredToGtf` or AUGUSTUS file, which carries only `gene_id`, still gets a
gene model. Point `aggregateField` at whichever attribute holds your display
name:

```js
adapter: {
  type: 'GtfAdapter',
  uri: 'https://example.com/genes.gtf',
  aggregateField: 'ref_gene_name',
}
```

For large files, prepare a tabix-indexed GTF and use the `GtfTabixAdapter`.
`jbrowse sort-gff` works on GTF too, since it shares GFF's refName/start column
layout:

```bash
jbrowse sort-gff genes.gtf | bgzip > genes.gtf.gz
tabix -p gff genes.gtf.gz
```

See the
[feature track file-type guide](https://jbrowse.org/jb2/docs/config_guides/file_types/)
for the full list of feature adapters.
