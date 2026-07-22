---
title: Quantitative tracks
description: BigWig/BedGraph signal track config and display options
guide_category: Track types
---

## QuantitativeTrack config

Example QuantitativeTrack config:

```json
{
  "type": "QuantitativeTrack",
  "trackId": "my_wiggle_track",
  "name": "My Wiggle Track",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "https://yourhost/file.bw"
  }
}
```

### Display options

Scale, autoscale, and color options (`scaleType`, `autoscale`, `minScore`,
`maxScore`, `defaultRendering`, `color`, `bicolorPivot`, etc.) are appearance
settings, so they go in the
[`displayDefaults` shorthand](/docs/config_guides/tracks/#configuring-displays).
`defaultRendering` picks the plot style and accepts `xyplot`, `density`, `line`,
or `scatter`:

```json
{
  "type": "QuantitativeTrack",
  "trackId": "my_wiggle_track",
  "name": "My Wiggle Track",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "https://yourhost/file.bw"
  },
  "displayDefaults": { "scaleType": "log" }
}
```

See the [LinearWiggleDisplay config docs](/docs/config/linearwiggledisplay) for
the full list of display slots and their defaults.

### Adapters

BigWig (`BigWigAdapter`) and bedGraph are both supported. For bedGraph, use
`BedGraphTabixAdapter` (a bgzip+tabix-indexed file) for large data, or
`BedGraphAdapter` for a small plain `.bedGraph`. The example above uses the
reduced `uri` form. See the [BigWigAdapter](/docs/config/bigwigadapter),
[BedGraphTabixAdapter](/docs/config/bedgraphtabixadapter), and
[BedGraphAdapter](/docs/config/bedgraphadapter) config docs for all options.

## See also

- [Quantitative track](/docs/user_guides/quantitative_track)
- [Multi-quantitative track](/docs/user_guides/multiquantitative_track)
