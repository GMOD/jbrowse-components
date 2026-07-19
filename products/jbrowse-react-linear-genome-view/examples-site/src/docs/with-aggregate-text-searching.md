JBrowse can resolve gene symbols and other feature names typed into the location
box, jumping the view to matching features. This requires a prebuilt search
index (a `trix` file generated from the track's GFF or VCF data).

An **aggregate** index covers multiple tracks in a single index, best when you
want one global search across all annotation. Pass it via
`aggregateTextSearchAdapters` on `createViewState`:

```js
const state = createViewState({
  assembly,
  tracks,
  aggregateTextSearchAdapters: [
    {
      type: 'TrixTextSearchAdapter',
      textSearchAdapterId: 'my_index',
      ixFilePath: { uri: 'trix/aggregate.ix' },
      ixxFilePath: { uri: 'trix/aggregate.ixx' },
      metaFilePath: { uri: 'trix/aggregate_meta.json' },
    },
  ],
})
```

Build the index with the `--file` form of
[`jbrowse text-index`](https://jbrowse.org/jb2/docs/cli/#jbrowse-text-index)
(one `--file`/`--fileId` pair per track). `--fileId` must match the runtime
`trackId` so a hit knows which track to open. For one index per track instead,
see
[per-track text searching](../text-searching/#with-per-track-text-searching).
