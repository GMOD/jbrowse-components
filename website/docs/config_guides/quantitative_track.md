---
title: Quantitative track
description: BigWig/BedGraph signal track config and display options
guide_category: Track types
---

**TL;DR:** a `QuantitativeTrack` shows a single BigWig or bedGraph signal. Scale
and color options (`scaleType`, `autoscale`, `defaultRendering`, `color`, etc.)
go in `displayDefaults`.

Example QuantitativeTrack config:

```json addtrack
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

## Display options

Scale, autoscale, and color options (`scaleType`, `autoscale`, `minScore`,
`maxScore`, `defaultRendering`, `color`, `bicolorPivot`, etc.) go in the
[`displayDefaults` shorthand](/docs/config_guides/tracks/#configuring-displays).
`defaultRendering` picks the plot style and accepts `xyplot`, `density`, `line`,
or `scatter`:

```json addtrack
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

## Adapters

- `BigWigAdapter` - a BigWig file
- `BedGraphTabixAdapter` - a bgzip+tabix-indexed bedGraph, for large data
- `BedGraphAdapter` - a small plain `.bedGraph`

The examples above use the reduced `uri` form. See the
[](/docs/config/bigwigadapter), [](/docs/config/bedgraphtabixadapter), and
[](/docs/config/bedgraphadapter) config docs for all options.

## See also

- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/multiquantitative_track)
