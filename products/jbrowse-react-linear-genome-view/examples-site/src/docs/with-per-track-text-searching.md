A **per-track** index attaches to a single track config rather than the
top-level view config, and is opened only when that track is loaded, best when
tracks are added and removed dynamically. Add a `textSearching` block to the
track:

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  // ...
  textSearching: {
    textSearchAdapter: {
      type: 'TrixTextSearchAdapter',
      textSearchAdapterId: 'my_track_index',
      ixFilePath: { uri: 'myfile.gff3.gz.ix' },
      ixxFilePath: { uri: 'myfile.gff3.gz.ixx' },
      metaFilePath: { uri: 'myfile.gff3.gz_meta.json' },
    },
  },
}
```

Build it with `jbrowse text-index --file myfile.gff3.gz --fileId my_track`
(where `--fileId` matches the runtime `trackId`). For one index spanning many
tracks, see
[aggregate text searching](../text-searching/#with-aggregate-text-searching).
Adapter slots are documented in
[TrixTextSearchAdapter](https://jbrowse.org/jb2/docs/config/trixtextsearchadapter/).
