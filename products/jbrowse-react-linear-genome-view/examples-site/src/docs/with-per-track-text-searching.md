A **per-track** index lives in a `textSearching` block on the track config
rather than at the top level, and is opened only when that track loads — the
right shape when tracks come and go dynamically.

Build it with `jbrowse text-index --file myfile.gff3.gz --fileId my_track`,
where `--fileId` matches the runtime `trackId`. Slots are documented in
[TrixTextSearchAdapter](https://jbrowse.org/jb2/docs/config/trixtextsearchadapter/).
For one index spanning many tracks, see
[aggregate text searching](../text-searching/#with-aggregate-text-searching).
