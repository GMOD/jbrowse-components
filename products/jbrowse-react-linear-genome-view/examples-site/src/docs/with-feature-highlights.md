`init.highlight` paints a band over a _region_, across every track at once.
`featureHighlights` marks one _feature_ instead: it boxes the gene, transcript
or variant at whatever row and height its own track laid it out, and it sorts
that feature to a top row of the lane and holds it there across pan and zoom. On
a dense annotation track the second half is usually the point.

Each entry names one feature, by name or by span:

```js
featureHighlights: [
  { refName: 'chr12', name: 'KRAS' }, // exact label, case insensitive
  { refName: 'chr12', start: 25205245, end: 25250929 }, // interbase, ±1bp
]
```

Prefer the name. The span form is interbase (0-based, half-open) and has to
agree with the track's own record to within a base, while a location box reads
`chr12:25,205,246-25,250,929` for that same feature — 1-based and inclusive — so
coordinates copied off the screen match nothing. An entry may carry both, and
then the name is the fallback used when the span misses.

This is the same state a right-click "Highlight feature" writes, so a user can
add and clear these by hand. It rides `displaySnapshot` rather than the track's
[`displayDefaults`](../feature-colors-and-labels/#with-track-color-shorthand)
because it is display state, not a config slot, and JBrowse drops a state prop
written onto a config without saying so.
