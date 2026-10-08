For a large file, sort and index it, and use `GtfTabixAdapter`:

```bash
jbrowse sort-gff genes.gtf | bgzip > genes.gtf.gz
tabix -p gff genes.gtf.gz
```
