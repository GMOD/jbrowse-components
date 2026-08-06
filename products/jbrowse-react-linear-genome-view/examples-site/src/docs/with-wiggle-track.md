Quantitative data — coverage, signal, microarray intensity — is a
[QuantitativeTrack](https://jbrowse.org/jb2/docs/config/quantitativetrack/) over
a [BigWigAdapter](https://jbrowse.org/jb2/docs/config/bigwigadapter/), drawn by
a
[LinearWiggleDisplay](https://jbrowse.org/jb2/docs/config/linearwiggledisplay/).

The
[`displayDefaults` shorthand](../feature-colors-and-labels/#with-track-color-shorthand)
configures it without naming the display: `defaultRendering` picks among
`xyplot`, `density` and `line`, and `minScore`/`maxScore` pin the axis instead
of autoscaling.

`scaleType` (linear/log), `summaryScoreMode` and the bicolor pivots are in the
[config docs](https://jbrowse.org/jb2/docs/config/linearwiggledisplay/); the
[quantitative track guide](https://jbrowse.org/jb2/docs/config_guides/quantitative_track/)
is the full walkthrough.
