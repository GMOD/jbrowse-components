Feature displays on the canvas renderer support three **track-sizing**
strategies, chosen with the `heightMode` config slot and switchable at runtime
from the track's "Track sizing" menu:

- `fixed` — _"Scroll to see all features"_: keep a fixed `height` and scroll when
  there are more rows than fit (the default).
- `grow` — _"Expand to fit all features"_: grow the track tall enough to show
  every row at full size.
- `fit` — _"Squeeze all features into view"_: scale rows down so everything fits
  within the fixed `height`.

This example opens the TP53 locus — where the NCBI RefSeq track stacks many
transcript isoforms into more rows than a fixed height can show — twice, so the
two strategies sit side by side:

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

`grow` and `fit` are two answers to the same question — what should the track do
when there are more features than fit? `grow` gives each row its full height and
makes the track taller; `fit` keeps the track height fixed and shrinks the rows.
Both avoid scrolling; pick whichever trades vertical space for row detail the way
your layout needs.

`heightMode` is a display config slot, so it routes through the
[`displayDefaults` shorthand](https://jbrowse.org/jb2/docs/config_guides/tracks/).
It only affects the track sizing (the frame); the per-feature size (the mark) is
set independently by `displayMode`. See the
[LinearBasicDisplay config](https://jbrowse.org/jb2/docs/config/linearbasicdisplay/)
for the full set of options.
