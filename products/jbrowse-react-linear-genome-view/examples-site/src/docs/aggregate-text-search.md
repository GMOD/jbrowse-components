```bash
jbrowse text-index --file genes.gff3.gz --fileId gff3tabix_genes \
                   --file vars.vcf.gz   --fileId volvox_vars
```

`--fileId` must match the runtime `trackId`, and each one pairs with the
`--file` in the same position.
