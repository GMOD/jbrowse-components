Typing a gene symbol into the location box jumps the view to matching features,
given a prebuilt `trix` index. An **aggregate** index covers several tracks at
once — the right shape when you want one global search — and goes on
`aggregateTextSearchAdapters`.

Build it with the `--file` form of
[`jbrowse text-index`](https://jbrowse.org/jb2/docs/cli/#jbrowse-text-index),
one `--file`/`--fileId` pair per track:

```bash
jbrowse text-index --file genes.gff3.gz --fileId volvox_genes \
                   --file vars.vcf.gz   --fileId volvox_vars
```

Two ways to get this wrong, both quiet: **`--fileId` must match the runtime
`trackId`**, or a hit has no way to know which track to open; and the two flags
are paired **by position**, so a `--fileId` list that doesn't run in the same
order as the `--file` list indexes each track under its neighbour's id.

For one index per track instead, see
[per-track text searching](../text-searching/#with-per-track-text-searching).
