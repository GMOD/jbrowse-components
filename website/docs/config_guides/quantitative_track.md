---
id: quantitative_track
title: Quantitative tracks
---

### QuantitativeTrack config

Example QuantitativeTrack config:

```json
{
  "trackId": "my_wiggle_track",
  "name": "My Wiggle Track",
  "assemblyNames": ["hg19"],
  "type": "QuantitativeTrack",
  "adapter": {
    "type": "BigWig",
    "bigWigLocation": {
      "uri": "http://yourhost/file.bw",
      "locationType": "UriLocation"
    }
  }
}
```

#### General QuantitativeTrack options

- `scaleType` - options: linear, log, to display the coverage data. default:
  linear
- `adapter` - an adapter that returns numeric stopToken data, e.g.
  feature.get('score')

#### Autoscale options for QuantitativeTrack

Options for autoscale:

- `local` - min/max values of what is visible on the screen
- `global` - min/max values in the entire dataset
- `localsd` - mean value +- N stddevs of what is visible on screen
- `globalsd` - mean value +/- N stddevs of everything in the dataset

#### Score min/max for QuantitativeTrack

These options overrides the autoscale options and provides a minimum or maximum
value for the autoscale bar:

- minScore
- maxScore

#### QuantitativeTrack drawing options

- `inverted` - draws upside down
- `defaultRendering` - can be density, xyplot, or line
- `summaryScoreMode` - options: min, max, whiskers

#### QuantitativeTrack renderer options

- `filled` - fills in the XYPlot histogram
- `bicolorPivot` - options: numeric, mean, none. default: numeric
- `bicolorPivotValue` - number at which the color switches from posColor to
  negColor. default: 0
- `color` - color or color callback for drawing the values. overrides
  posColor/negColor. default: none
- `posColor` - color to draw "positive" values. default: red
- `negColor` - color to draw "negative" values. default: blue
- `clipColor` - color to draw "clip" indicator. default: red

#### BigWigAdapter options

- `bigWigLocation` - a 'file location' for the bigwig

Example BigWig adapter config:

```json
{
  "type": "BigWig",
  "bigWigLocation": {
    "uri": "http://yourhost/file.bw",
    "locationType": "UriLocation"
  }
}
```
