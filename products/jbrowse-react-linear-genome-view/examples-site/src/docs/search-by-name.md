```bash
jbrowse text-index --file genes.gff3.gz --fileId gff3tabix_genes
```

`loc` takes a name the index finds, and opens the track it was found in. Each
`--fileId` must match the runtime `trackId`. An index for one track goes on that
track instead, as `textSearching: { textSearchAdapter: { uri } }`.
