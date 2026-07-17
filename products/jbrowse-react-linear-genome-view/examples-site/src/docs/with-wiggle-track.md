Quantitative data — coverage, signal, microarray intensities — loads as a
`QuantitativeTrack` backed by a
[BigWigAdapter](https://jbrowse.org/jb2/docs/config/bigwigadapter/). The track
renders through a
[LinearWiggleDisplay](https://jbrowse.org/jb2/docs/config/linearwiggledisplay/),
which offers several renderers (`xyplot`, `density`, `line`) and an autoscaling
score axis.

The
[`displayDefaults` object shorthand](../feature-colors-and-labels/#with-track-color-shorthand)
is the easiest way to configure all of this up front — JBrowse routes each key
to the wiggle display:

```js
displayDefaults: {
  defaultRendering: 'xyplot', // 'xyplot' | 'density' | 'line'
  height: 150,
  color: '#a05195',
  minScore: 0,                // pin the score axis instead of autoscaling
  maxScore: 1000,
}
```

Every available slot — `scaleType` (linear/log), `summaryScoreMode`, bicolor
pivots, and more — is listed in the
[LinearWiggleDisplay config docs](https://jbrowse.org/jb2/docs/config/linearwiggledisplay/),
and the runtime state (the fields you can set via a `displaySnapshot` in
[`init`](../session-setup/#with-init-advanced)) is documented in the
[LinearWiggleDisplay state model](https://jbrowse.org/jb2/docs/models/linearwiggledisplay/).
See the
[quantitative track guide](https://jbrowse.org/jb2/docs/config_guides/quantitative_track/)
for the full walkthrough.
