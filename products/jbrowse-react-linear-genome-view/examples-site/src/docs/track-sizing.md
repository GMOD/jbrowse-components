Feature displays on the canvas renderer support three track-sizing strategies,
chosen with the `heightMode` config slot and switchable at runtime from the
track's "Track sizing" menu:

- `fixed` (_"Scroll to see all features"_): keep a fixed `height` and scroll
  when there are more rows than fit (the default).
- `grow` (_"Expand to fit all features"_): grow the track tall enough to show
  every row at full size.
- `fit` (_"Squeeze all features into view"_): scale rows down so everything fits
  within the fixed `height`.

This example opens the TP53 locus twice — the NCBI RefSeq track stacks more
transcript isoforms there than a fixed height can show — so `grow` and `fit` sit
side by side:

```js
tracks: [
  {
    type: 'FeatureTrack',
    trackId: 'refseq_grow',
    // ...
    displayDefaults: { heightMode: 'grow' },
  },
  {
    type: 'FeatureTrack',
    trackId: 'refseq_fit',
    // ...
    displayDefaults: { heightMode: 'fit', height: 150 },
  },
]
```

`heightMode` is a display config slot, so it routes through the
[`displayDefaults` shorthand](https://jbrowse.org/jb2/docs/config_guides/tracks/).
It sets the track sizing (the frame) only; the per-feature size (the mark) is
set independently by `displayMode`. See the
[LinearBasicDisplay config](https://jbrowse.org/jb2/docs/config/linearbasicdisplay/)
for the full set of options.
