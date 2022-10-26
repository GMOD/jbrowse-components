---
id: quantitative_track
toplevel: true
title: Quantitative and multi-quantitative tracks
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

- `scaleType` - options: linear, log, to display the coverage data. default: linear
- `adapter` - an adapter that returns numeric signal data, e.g. feature.get('score')

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

### MultiQuantitativeTrack config

Example MultiQuantitativeTrack config:

```json
{
  "type": "MultiQuantitativeTrack",
  "trackId": "microarray_multi",
  "name": "MultiWig",
  "category": ["ENCODE bigWigs"],
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "bigWigs": [
      "https://www.encodeproject.org/files/ENCFF055ZII/@@download/ENCFF055ZII.bigWig",
      "https://www.encodeproject.org/files/ENCFF826HEW/@@download/ENCFF826HEW.bigWig",
      "https://www.encodeproject.org/files/ENCFF858LIM/@@download/ENCFF858LIM.bigWig",
      "https://www.encodeproject.org/files/ENCFF425TNW/@@download/ENCFF425TNW.bigWig",
      "https://www.encodeproject.org/files/ENCFF207RBY/@@download/ENCFF207RBY.bigWig",
      "https://www.encodeproject.org/files/ENCFF289CTN/@@download/ENCFF289CTN.bigWig",
      "https://www.encodeproject.org/files/ENCFF884IEG/@@download/ENCFF884IEG.bigWig",
      "https://www.encodeproject.org/files/ENCFF495SBQ/@@download/ENCFF495SBQ.bigWig",
      "https://www.encodeproject.org/files/ENCFF959EZF/@@download/ENCFF959EZF.bigWig",
      "https://www.encodeproject.org/files/ENCFF926YZX/@@download/ENCFF926YZX.bigWig",
      "https://www.encodeproject.org/files/ENCFF269CHA/@@download/ENCFF269CHA.bigWig",
      "https://www.encodeproject.org/files/ENCFF857KTJ/@@download/ENCFF857KTJ.bigWig",
      "https://www.encodeproject.org/files/ENCFF109KCQ/@@download/ENCFF109KCQ.bigWig",
      "https://www.encodeproject.org/files/ENCFF942TZX/@@download/ENCFF942TZX.bigWig",
      "https://www.encodeproject.org/files/ENCFF140HPM/@@download/ENCFF140HPM.bigWig",
      "https://www.encodeproject.org/files/ENCFF305JRR/@@download/ENCFF305JRR.bigWig",
      "https://www.encodeproject.org/files/ENCFF739FDJ/@@download/ENCFF739FDJ.bigWig",
      "https://www.encodeproject.org/files/ENCFF518OJP/@@download/ENCFF518OJP.bigWig",
      "https://www.encodeproject.org/files/ENCFF810HHS/@@download/ENCFF810HHS.bigWig",
      "https://www.encodeproject.org/files/ENCFF939JSB/@@download/ENCFF939JSB.bigWig",
      "https://www.encodeproject.org/files/ENCFF041TAK/@@download/ENCFF041TAK.bigWig"
    ]
  }
}
```

#### General MultiQuantitativeTrack options

You can pass an array of urls for bigWig files to the "bigWigs" slot for
MultiWiggleAdapter, or an array of complete subtrack adapter configs to the
"subadapters" slot for MultiWiggleAdapter. The subadapters slot can contain
extra fields such as color, which is interpreted as the subtrack color, and any
accessory fields like "group" that might help end users organize the subtracks.

Example with group field:

```json
{
  "type": "MultiQuantitativeTrack",
  "trackId": "microarray_multi_groups",
  "name": "MultiWig (groups)",
  "category": ["ENCODE bigWigs"],
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BigWigAdapter",
        "name": "k1",
        "bigWigLocation": {
          "uri": "https://www.encodeproject.org/files/ENCFF055ZII/@@download/ENCFF055ZII.bigWig"
        },
        "group": "group1"
      },
      {
        "type": "BigWigAdapter",
        "name": "k2",
        "bigWigLocation": {
          "uri": "https://www.encodeproject.org/files/ENCFF826HEW/@@download/ENCFF826HEW.bigWig"
        },
        "group": "group2"
      }
    ]
  }
}
```

The "name" or "source" field on the subadapters will be used as the subtrack
label (where, "source" will be given priority over "name" if specified)
