The same crowded locus (TP53, where NCBI RefSeq stacks more isoforms than a
fixed height shows) opened twice, so the two modes sit side by side.
`heightMode` picks the strategy, and the track's "Track sizing" menu switches it
at runtime:

- `fixed` — keep `height`, scroll for the overflow (the default)
- `grow` — grow tall enough to show every row at full size
- `fit` — scale rows down until they all fit inside `height`

It is a display slot, so it routes through
[`displayDefaults`](../feature-colors-and-labels/#with-track-color-shorthand).
It sets the frame only; the per-feature size is `displayMode`, an independent
axis. Full options:
[LinearBasicDisplay](https://jbrowse.org/jb2/docs/config/linearbasicdisplay/).
