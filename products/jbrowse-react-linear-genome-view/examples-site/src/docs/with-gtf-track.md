Gene models from a GTF are a `FeatureTrack` over a
[GtfAdapter](https://jbrowse.org/jb2/docs/config/gtfadapter/) (plain text, read
into memory) or a
[GtfTabixAdapter](https://jbrowse.org/jb2/docs/config/gtftabixadapter/)
(bgzipped and indexed, for large files). This demo is a real GENCODE record —
TP53 — remapped onto volvox `ctgA`.

Unlike GFF3, GTF has no spanning `gene` line and often no `transcript` line
either, so JBrowse builds the model from the exon/CDS lines: lines sharing a
`transcript_id` group under a transcript (synthesized if absent, per the
Cufflinks/StringTie convention), and transcripts sharing a `gene_id` group into
a gene.

The gene label comes from `aggregateField` (default `gene_name`), falling back
to `gene_id` — so a UCSC `genePredToGtf` or AUGUSTUS file, which carries only
`gene_id`, still gets a gene model. Point it wherever your display name lives.

For a large file, index it first — `jbrowse sort-gff` works on GTF, which shares
GFF's column layout:

```bash
jbrowse sort-gff genes.gtf | bgzip > genes.gtf.gz
tabix -p gff genes.gtf.gz
```
